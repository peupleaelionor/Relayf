import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  CampaignStatus,
  CampaignRecipientStatus,
  MessageStatus,
  MessageEventType,
  AuditAction,
  ContactStatus,
  MessageChannel,
} from '@prisma/client';
import { interpolate } from '@relayflow/config';
import { PrismaService } from '../prisma.service';
import { ProviderRouterService } from '../providers/provider-router.service';
import {
  QUEUE_NAMES,
  CAMPAIGN_JOBS,
  IDEMPOTENCY,
  RATE_LIMIT,
} from '../queue/queue.constants';

interface CampaignJobData {
  campaignId: string;
  workspaceId: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Processor(QUEUE_NAMES.CAMPAIGNS)
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouterService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    super();
  }

  async process(job: Job<CampaignJobData>): Promise<void> {
    if (job.name === CAMPAIGN_JOBS.DISPATCH) {
      await this.dispatchCampaign(job);
    }
  }

  private async dispatchCampaign(job: Job<CampaignJobData>): Promise<void> {
    const { campaignId, workspaceId } = job.data;
    const lockKey = `${IDEMPOTENCY.CAMPAIGN_LOCK_PREFIX}${campaignId}`;

    // Acquire distributed lock to prevent duplicate processing across instances
    const acquired = await this.redis.set(
      lockKey,
      '1',
      'EX',
      IDEMPOTENCY.CAMPAIGN_LOCK_TTL,
      'NX',
    );
    if (!acquired) {
      this.logger.warn(`Campaign ${campaignId} already locked – skipping`);
      return;
    }

    try {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { senderIdentity: true },
      });

      if (!campaign) {
        this.logger.warn(`Campaign ${campaignId} not found`);
        return;
      }

      if (
        campaign.status !== CampaignStatus.SCHEDULED &&
        campaign.status !== CampaignStatus.RUNNING
      ) {
        this.logger.warn(`Campaign ${campaignId} status=${campaign.status} – skipping`);
        return;
      }

      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.RUNNING, startedAt: new Date() },
      });

      const BATCH_SIZE = 100;
      let sentCount = 0;
      let failedCount = 0;

      // Process pending recipients in cursor-based batches to avoid OOM
      let lastId: string | undefined;

      while (true) {
        const recipients = await this.prisma.campaignRecipient.findMany({
          where: {
            campaignId,
            status: CampaignRecipientStatus.PENDING,
            ...(lastId ? { id: { gt: lastId } } : {}),
          },
          take: BATCH_SIZE,
          orderBy: { id: 'asc' },
          include: { contact: true },
        });

        if (recipients.length === 0) break;

        for (const recipient of recipients) {
          const contact = recipient.contact;

          // Skip opted-out or inactive contacts
          if (
            contact.status === ContactStatus.UNSUBSCRIBED ||
            contact.status === ContactStatus.BLOCKED
          ) {
            await this.prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: { status: CampaignRecipientStatus.SKIPPED, failureReason: 'contact_opted_out' },
            });
            continue;
          }

          // Resolve destination address based on channel
          const to = this.resolveRecipientAddress(campaign.channel, contact);
          if (!to) {
            await this.prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: CampaignRecipientStatus.SKIPPED,
                failureReason: 'no_valid_address',
              },
            });
            continue;
          }

          // Workspace-level rate limiting (sliding window)
          await this.enforceWorkspaceRateLimit(workspaceId);

          // Campaign-level throttle
          if (campaign.throttleRpm) {
            await this.enforceCampaignThrottle(campaignId, campaign.throttleRpm);
          }

          // Resolve template variables
          const variables: Record<string, string> = {
            firstName: contact.firstName ?? '',
            lastName: contact.lastName ?? '',
            email: contact.email ?? '',
            phone: contact.phone ?? '',
            ...Object.fromEntries(
              Object.entries(contact.attributes as Record<string, unknown>).map(([k, v]) => [
                k,
                String(v ?? ''),
              ]),
            ),
          };
          const body = interpolate(campaign.body ?? '', variables);
          const subject = campaign.subject ? interpolate(campaign.subject, variables) : undefined;
          const from = campaign.senderIdentity?.value ?? '';

          try {
            const result = await this.router.send({
              channel: campaign.channel,
              to,
              from,
              body,
              subject,
              workspaceId,
            });

            const message = await this.prisma.message.create({
              data: {
                workspaceId,
                campaignId,
                contactId: contact.id,
                channel: campaign.channel,
                status: MessageStatus.SENT,
                to,
                from,
                subject,
                body,
                providerMessageId: result.providerMessageId,
                cost: result.cost,
                sentAt: new Date(),
              },
            });

            await this.prisma.messageEvent.create({
              data: {
                messageId: message.id,
                type: MessageEventType.SENT,
                occurredAt: new Date(),
              },
            });

            await this.prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: CampaignRecipientStatus.SENT,
                messageId: message.id,
                sentAt: new Date(),
              },
            });

            sentCount++;
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `Failed to send to contact ${contact.id} for campaign ${campaignId}: ${errorMessage}`,
            );

            const failedMessage = await this.prisma.message.create({
              data: {
                workspaceId,
                campaignId,
                contactId: contact.id,
                channel: campaign.channel,
                status: MessageStatus.FAILED,
                to,
                from,
                subject,
                body,
                errorMessage,
              },
            });

            await this.prisma.messageEvent.create({
              data: {
                messageId: failedMessage.id,
                type: MessageEventType.FAILED,
                occurredAt: new Date(),
                data: { error: errorMessage },
              },
            });

            await this.prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: CampaignRecipientStatus.FAILED,
                messageId: failedMessage.id,
                failureReason: errorMessage,
              },
            });

            failedCount++;
          }
        }

        await this.prisma.campaign.update({
          where: { id: campaignId },
          data: { sentCount, failedCount },
        });

        lastId = recipients[recipients.length - 1]!.id;
        if (recipients.length < BATCH_SIZE) break;
      }

      // Determine final campaign status
      const totalRecipients = await this.prisma.campaignRecipient.count({
        where: { campaignId },
      });
      const finalStatus =
        sentCount === 0 && failedCount === totalRecipients
          ? CampaignStatus.FAILED
          : CampaignStatus.COMPLETED;

      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: finalStatus, completedAt: new Date(), sentCount, failedCount },
      });

      await this.prisma.auditLog.create({
        data: {
          workspaceId,
          action: AuditAction.CAMPAIGN_LAUNCHED,
          resource: 'campaign',
          resourceId: campaignId,
          metadata: { sentCount, failedCount, finalStatus },
        },
      });

      this.logger.log(
        `Campaign ${campaignId} ${finalStatus} sent=${sentCount} failed=${failedCount}`,
      );
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private resolveRecipientAddress(
    channel: MessageChannel,
    contact: { phone: string | null; email: string | null; telegramId: string | null },
  ): string | null {
    switch (channel) {
      case MessageChannel.SMS:
      case MessageChannel.WHATSAPP:
        return contact.phone;
      case MessageChannel.TELEGRAM:
        return contact.telegramId;
      case MessageChannel.EMAIL:
        return contact.email;
      default:
        return null;
    }
  }

  private async enforceWorkspaceRateLimit(workspaceId: string): Promise<void> {
    const key = `${RATE_LIMIT.WORKSPACE_KEY_PREFIX}${workspaceId}`;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.WINDOW_MS;

    await this.redis.zremrangebyscore(key, '-inf', windowStart);
    const count = await this.redis.zcard(key);

    if (count >= RATE_LIMIT.WORKSPACE_RPM) {
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestScore = oldest.length >= 2 ? parseInt(oldest[1]!, 10) : now;
      const waitMs = oldestScore + RATE_LIMIT.WINDOW_MS - now + 10;
      if (waitMs > 0) await sleep(waitMs);
    }

    const member = `${now}:${Math.random()}`;
    await this.redis.zadd(key, now, member);
    await this.redis.expire(key, Math.ceil(RATE_LIMIT.WINDOW_MS / 1000) + 5);
  }

  private async enforceCampaignThrottle(campaignId: string, throttleRpm: number): Promise<void> {
    const key = `${RATE_LIMIT.CAMPAIGN_KEY_PREFIX}${campaignId}`;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.WINDOW_MS;

    await this.redis.zremrangebyscore(key, '-inf', windowStart);
    const count = await this.redis.zcard(key);

    if (count >= throttleRpm) {
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestScore = oldest.length >= 2 ? parseInt(oldest[1]!, 10) : now;
      const waitMs = oldestScore + RATE_LIMIT.WINDOW_MS - now + 10;
      if (waitMs > 0) await sleep(waitMs);
    }

    const member = `${now}:${Math.random()}`;
    await this.redis.zadd(key, now, member);
    await this.redis.expire(key, Math.ceil(RATE_LIMIT.WINDOW_MS / 1000) + 5);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CampaignJobData>, err: Error): void {
    this.logger.error(`Campaign job ${job.id} failed: ${err.message}`, err.stack);
  }
}
