import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { WebhookDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { QUEUE_NAMES, WEBHOOK_JOBS } from '../queue/queue.constants';

interface WebhookJobData {
  webhookEventId: string;
}

const MAX_WEBHOOK_ATTEMPTS = 5;
const BACKOFF_DELAYS_MS = [0, 30_000, 300_000, 1_800_000, 7_200_000]; // 0s, 30s, 5m, 30m, 2h

@Processor(QUEUE_NAMES.WEBHOOKS)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    if (job.name === WEBHOOK_JOBS.DELIVER) {
      await this.deliverWebhook(job);
    }
  }

  private async deliverWebhook(job: Job<WebhookJobData>): Promise<void> {
    const { webhookEventId } = job.data;

    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
      include: { endpoint: true },
    });

    if (!event) {
      this.logger.warn(`WebhookEvent ${webhookEventId} not found`);
      return;
    }

    if (event.status === WebhookDeliveryStatus.SUCCESS) {
      this.logger.log(`WebhookEvent ${webhookEventId} already delivered – skipping`);
      return;
    }

    const { endpoint } = event;

    if (!endpoint.isActive) {
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: WebhookDeliveryStatus.FAILED, errorMessage: 'endpoint_disabled' },
      });
      return;
    }

    const payloadStr = JSON.stringify(event.payload);
    const signature = createHmac('sha256', endpoint.secret)
      .update(payloadStr)
      .digest('hex');

    const newAttempts = event.attempts + 1;

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RelayFlow-Signature': `sha256=${signature}`,
          'X-RelayFlow-Event': event.type,
          'X-RelayFlow-Delivery': webhookEventId,
          'User-Agent': 'RelayFlow-Webhooks/1.0',
        },
        body: payloadStr,
        signal: AbortSignal.timeout(30_000),
      });

      const responseBody = await response.text().catch(() => '');
      const isSuccess = response.status >= 200 && response.status < 300;

      if (isSuccess) {
        await this.prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: WebhookDeliveryStatus.SUCCESS,
            attempts: newAttempts,
            deliveredAt: new Date(),
            responseCode: response.status,
            responseBody: responseBody.slice(0, 1000),
            errorMessage: null,
          },
        });

        await this.prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: {
            lastDeliveryAt: new Date(),
            lastDeliveryStatus: WebhookDeliveryStatus.SUCCESS,
            failureCount: 0,
          },
        });

        this.logger.log(`WebhookEvent ${webhookEventId} delivered to ${endpoint.url}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${responseBody.slice(0, 200)}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `WebhookEvent ${webhookEventId} delivery attempt ${newAttempts} failed: ${errorMessage}`,
      );

      const isDeadLetter = newAttempts >= MAX_WEBHOOK_ATTEMPTS;
      const nextStatus = isDeadLetter
        ? WebhookDeliveryStatus.FAILED
        : WebhookDeliveryStatus.RETRYING;
      const nextRetryAt =
        !isDeadLetter && BACKOFF_DELAYS_MS[newAttempts]
          ? new Date(Date.now() + BACKOFF_DELAYS_MS[newAttempts]!)
          : null;

      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: nextStatus,
          attempts: newAttempts,
          errorMessage,
          nextRetryAt,
        },
      });

      await this.prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: {
          lastDeliveryAt: new Date(),
          lastDeliveryStatus: nextStatus,
          failureCount: { increment: 1 },
        },
      });

      if (!isDeadLetter) {
        // BullMQ will auto-retry via job options (attempts + backoff), or we throw to trigger retry
        throw new Error(errorMessage);
      } else {
        this.logger.error(
          `WebhookEvent ${webhookEventId} moved to dead-letter after ${newAttempts} attempts`,
        );
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<WebhookJobData>, err: Error): void {
    this.logger.error(`Webhook job ${job.id} failed: ${err.message}`);
  }
}
