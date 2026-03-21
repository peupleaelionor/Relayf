import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('campaigns') private campaignsQueue: Queue,
    @InjectQueue('messages') private messagesQueue: Queue,
    @InjectQueue('webhooks') private webhooksQueue: Queue,
  ) {}

  async enqueueCampaignSend(campaignId: string, workspaceId: string) {
    const job = await this.campaignsQueue.add(
      'send-campaign',
      { campaignId, workspaceId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    this.logger.log(`Enqueued campaign send job ${job.id} for campaign ${campaignId}`);
    return job;
  }

  async enqueueMessage(messageId: string, workspaceId: string) {
    const job = await this.messagesQueue.add(
      'send-message',
      { messageId, workspaceId },
      { attempts: 3, backoff: { type: 'exponential', delay: 3000 } },
    );
    this.logger.log(`Enqueued message job ${job.id} for message ${messageId}`);
    return job;
  }

  async enqueueWebhookDelivery(webhookEventId: string) {
    const job = await this.webhooksQueue.add(
      'deliver-webhook',
      { webhookEventId },
      { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
    );
    this.logger.log(`Enqueued webhook delivery job ${job.id} for event ${webhookEventId}`);
    return job;
  }
}
