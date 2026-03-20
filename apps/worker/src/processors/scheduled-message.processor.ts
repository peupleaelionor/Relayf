import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MessageStatus, MessageEventType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ProviderRouterService } from '../providers/provider-router.service';
import { QUEUE_NAMES, MESSAGE_JOBS, IDEMPOTENCY } from '../queue/queue.constants';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

interface ScheduledMessageJobData {
  messageId: string;
  workspaceId: string;
}

@Processor(QUEUE_NAMES.MESSAGES)
export class ScheduledMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledMessageProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouterService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    super();
  }

  async process(job: Job<ScheduledMessageJobData>): Promise<void> {
    if (job.name === MESSAGE_JOBS.SCHEDULED) {
      await this.sendScheduledMessage(job);
    }
  }

  private async sendScheduledMessage(job: Job<ScheduledMessageJobData>): Promise<void> {
    const { messageId, workspaceId } = job.data;

    // Idempotency: skip if already processed
    const lockKey = `${IDEMPOTENCY.MESSAGE_LOCK_PREFIX}${messageId}`;
    const acquired = await this.redis.set(lockKey, '1', 'EX', 300, 'NX');
    if (!acquired) {
      this.logger.warn(`Message ${messageId} already being processed – skipping`);
      return;
    }

    try {
      const message = await this.prisma.message.findUnique({ where: { id: messageId } });

      if (!message) {
        this.logger.warn(`Message ${messageId} not found`);
        return;
      }

      if (message.status !== MessageStatus.QUEUED && message.status !== MessageStatus.PENDING) {
        this.logger.log(`Message ${messageId} already in status ${message.status} – skipping`);
        return;
      }

      await this.prisma.message.update({
        where: { id: messageId },
        data: { status: MessageStatus.SENDING },
      });

      const result = await this.router.send({
        channel: message.channel,
        to: message.to,
        from: message.from,
        body: message.body,
        subject: message.subject ?? undefined,
        workspaceId,
      });

      await this.prisma.message.update({
        where: { id: messageId },
        data: {
          status: MessageStatus.SENT,
          providerMessageId: result.providerMessageId,
          cost: result.cost,
          sentAt: new Date(),
        },
      });

      await this.prisma.messageEvent.create({
        data: {
          messageId,
          type: MessageEventType.SENT,
          occurredAt: new Date(),
        },
      });

      this.logger.log(`Message ${messageId} sent via ${message.channel}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Message ${messageId} failed: ${errorMessage}`);

      await this.prisma.message.update({
        where: { id: messageId },
        data: { status: MessageStatus.FAILED, errorMessage },
      });

      await this.prisma.messageEvent.create({
        data: {
          messageId,
          type: MessageEventType.FAILED,
          occurredAt: new Date(),
          data: { error: errorMessage },
        },
      });

      // Re-throw so BullMQ registers the job as failed and can retry
      throw err;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ScheduledMessageJobData>, err: Error): void {
    this.logger.error(`Scheduled message job ${job.id} failed: ${err.message}`);
  }
}
