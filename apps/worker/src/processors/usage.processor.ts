import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { MessageStatus, MessageChannel } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { QUEUE_NAMES, USAGE_JOBS, USAGE_CRON } from '../queue/queue.constants';

interface UsageJobData {
  /** Optional: aggregate only for a specific workspace; omit to aggregate all */
  workspaceId?: string;
}

@Injectable()
@Processor(QUEUE_NAMES.USAGE)
export class UsageProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(UsageProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.USAGE) private readonly usageQueue: Queue,
  ) {
    super();
  }

  /** Register a repeating hourly job on startup (idempotent – BullMQ deduplicates by jobId). */
  async onModuleInit(): Promise<void> {
    await this.usageQueue.add(
      USAGE_JOBS.AGGREGATE,
      {},
      {
        repeat: { pattern: USAGE_CRON },
        jobId: 'usage:aggregate:recurring',
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.log(`Usage aggregation cron registered (${USAGE_CRON})`);
  }

  async process(job: Job<UsageJobData>): Promise<void> {
    if (job.name === USAGE_JOBS.AGGREGATE) {
      await this.aggregateUsage(job.data.workspaceId);
    }
  }

  private async aggregateUsage(targetWorkspaceId?: string): Promise<void> {
    const workspaces = targetWorkspaceId
      ? await this.prisma.workspace.findMany({ where: { id: targetWorkspaceId } })
      : await this.prisma.workspace.findMany({ where: { deletedAt: null } });

    this.logger.log(`Aggregating usage for ${workspaces.length} workspace(s)`);

    for (const workspace of workspaces) {
      try {
        const subscription = await this.prisma.subscription.findUnique({
          where: { workspaceId: workspace.id },
        });

        if (!subscription) continue;

        const periodStart = subscription.currentPeriodStart;
        const periodEnd = subscription.currentPeriodEnd;

        // Count sent messages per channel in this billing period
        const counts = await this.prisma.message.groupBy({
          by: ['channel'],
          where: {
            workspaceId: workspace.id,
            status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED] },
            sentAt: { gte: periodStart, lte: periodEnd },
          },
          _count: { _all: true },
        });

        for (const row of counts) {
          await this.prisma.usageRecord.upsert({
            where: {
              // Using a unique composite via findFirst + createOrUpdate pattern
              // UsageRecord has no unique constraint on (workspaceId, subscriptionId, channel, period)
              // so we create a new record each hour
              id: `${workspace.id}-${subscription.id}-${row.channel}-${this.currentHourKey()}`,
            },
            update: { quantity: row._count._all },
            create: {
              id: `${workspace.id}-${subscription.id}-${row.channel}-${this.currentHourKey()}`,
              workspaceId: workspace.id,
              subscriptionId: subscription.id,
              channel: row.channel as MessageChannel,
              quantity: row._count._all,
              recordedAt: new Date(),
              billingPeriodStart: periodStart,
              billingPeriodEnd: periodEnd,
            },
          });
        }

        this.logger.debug(`Usage recorded for workspace ${workspace.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to aggregate usage for workspace ${workspace.id}: ${msg}`);
      }
    }
  }

  private currentHourKey(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<UsageJobData>, err: Error): void {
    this.logger.error(`Usage job ${job.id} failed: ${err.message}`);
  }
}
