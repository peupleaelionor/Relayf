import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { MessageStatus, MessageEventType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ProviderRouterService } from '../providers/provider-router.service';
import { QUEUE_NAMES, MESSAGE_JOBS, RETRY } from '../queue/queue.constants';

interface RetryJobData {
  messageId: string;
  workspaceId: string;
  attempt: number;
}

@Processor(QUEUE_NAMES.MESSAGES)
export class RetryProcessor extends WorkerHost {
  private readonly logger = new Logger(RetryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouterService,
    @InjectQueue(QUEUE_NAMES.MESSAGES) private readonly messagesQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<RetryJobData>): Promise<void> {
    if (job.name === MESSAGE_JOBS.RETRY) {
      await this.retryMessage(job);
    }
  }

  private async retryMessage(job: Job<RetryJobData>): Promise<void> {
    const { messageId, workspaceId, attempt } = job.data;

    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) {
      this.logger.warn(`Retry: Message ${messageId} not found`);
      return;
    }

    // Exhausted retries – mark permanently failed
    if (attempt >= RETRY.MAX_MESSAGE_ATTEMPTS) {
      this.logger.warn(`Message ${messageId} exhausted ${RETRY.MAX_MESSAGE_ATTEMPTS} retries`);
      await this.prisma.message.update({
        where: { id: messageId },
        data: { status: MessageStatus.FAILED, errorMessage: 'max_retries_exceeded' },
      });
      await this.prisma.messageEvent.create({
        data: {
          messageId,
          type: MessageEventType.FAILED,
          occurredAt: new Date(),
          data: { reason: 'max_retries_exceeded', attempt },
        },
      });
      return;
    }

    try {
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
          errorMessage: null,
          errorCode: null,
        },
      });

      await this.prisma.messageEvent.create({
        data: {
          messageId,
          type: MessageEventType.SENT,
          occurredAt: new Date(),
          data: { retriedAttempt: attempt },
        },
      });

      this.logger.log(`Message ${messageId} sent on retry attempt ${attempt}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Message ${messageId} retry attempt ${attempt} failed: ${errorMessage}`);

      await this.prisma.message.update({
        where: { id: messageId },
        data: { status: MessageStatus.FAILED, errorMessage },
      });

      // Exponential backoff: 2^attempt * 5000 ms, capped at 30 min
      const delayMs = Math.min(Math.pow(2, attempt) * 5_000, 1_800_000);

      await this.messagesQueue.add(
        MESSAGE_JOBS.RETRY,
        { messageId, workspaceId, attempt: attempt + 1 },
        { delay: delayMs, removeOnComplete: true },
      );

      this.logger.log(
        `Message ${messageId} re-queued for retry attempt ${attempt + 1} in ${delayMs}ms`,
      );
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RetryJobData>, err: Error): void {
    this.logger.error(`Retry job ${job.id} failed: ${err.message}`);
  }
}
