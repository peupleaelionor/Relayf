import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { WebhookEventType } from '@prisma/client';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  async findAll(workspaceId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, workspaceId: string) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({ where: { id, workspaceId } });
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    return endpoint;
  }

  async create(workspaceId: string, dto: CreateWebhookDto) {
    const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        workspaceId,
        url: dto.url,
        secret,
        events: dto.events,
        description: dto.description,
        isActive: true,
        failureCount: 0,
      },
    });
    this.logger.log(`Webhook endpoint created for workspace ${workspaceId}: ${dto.url}`);
    return { ...endpoint, secret };
  }

  async update(id: string, workspaceId: string, dto: UpdateWebhookDto) {
    await this.findOne(id, workspaceId);
    return this.prisma.webhookEndpoint.update({ where: { id }, data: dto });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.webhookEndpoint.delete({ where: { id } });
  }

  async listDeliveries(endpointId: string, workspaceId: string, page = 1, limit = 20) {
    await this.findOne(endpointId, workspaceId);
    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
      this.prisma.webhookEvent.findMany({
        where: { endpointId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.webhookEvent.count({ where: { endpointId } }),
    ]);
    return { data: events, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async deliverWebhook(workspaceId: string, endpointId: string, type: WebhookEventType, payload: object) {
    const endpoint = await this.findOne(endpointId, workspaceId);
    if (!endpoint.isActive) return;
    if (!endpoint.events.includes(type)) return;

    const payloadStr = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', endpoint.secret)
      .update(payloadStr)
      .digest('hex');

    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        workspaceId,
        endpointId,
        type,
        payload: payload as any,
        status: 'PENDING',
        attempts: 0,
      },
    });

    await this.queueService.enqueueWebhookDelivery(webhookEvent.id);
    return webhookEvent;
  }

  async dispatchToAllEndpoints(workspaceId: string, type: WebhookEventType, payload: object) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { workspaceId, isActive: true, events: { has: type } },
    });

    for (const endpoint of endpoints) {
      await this.deliverWebhook(workspaceId, endpoint.id, type, payload);
    }
  }
}
