import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SmsRouterService } from '../providers/sms/sms-router.service';
import { TelegramProvider } from '../providers/telegram/telegram.provider';
import { SendMessageDto } from './dto/message.dto';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private prisma: PrismaService,
    private smsRouter: SmsRouterService,
    private telegramProvider: TelegramProvider,
  ) {}

  async sendMessage(workspaceId: string, dto: SendMessageDto) {
    const message = await this.prisma.message.create({
      data: {
        workspaceId,
        channel: dto.channel,
        to: dto.to,
        from: dto.from || '',
        body: dto.body,
        subject: dto.subject,
        contactId: dto.contactId,
        status: 'PENDING',
      },
    });

    try {
      let providerMessageId: string | undefined;
      let cost: number | undefined;

      if (dto.channel === 'SMS') {
        const result = await this.smsRouter.send(dto.to, dto.from || '', dto.body, workspaceId);
        providerMessageId = result.messageId;
        cost = result.cost;
      } else if (dto.channel === 'TELEGRAM') {
        const result = await this.telegramProvider.sendMessage(dto.to, dto.body);
        providerMessageId = result.messageId;
      } else {
        throw new BadRequestException(`Channel ${dto.channel} not yet supported for direct send`);
      }

      const updated = await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'SENT' as any,
          sentAt: new Date(),
          providerMessageId,
          cost,
        },
      });

      await this.prisma.messageEvent.create({
        data: {
          messageId: message.id,
          type: 'SENT',
          occurredAt: new Date(),
          data: { providerMessageId },
        },
      });

      return updated;
    } catch (err) {
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          errorMessage: String(err),
        },
      });

      await this.prisma.messageEvent.create({
        data: {
          messageId: message.id,
          type: 'FAILED',
          occurredAt: new Date(),
          data: { error: String(err) },
        },
      });

      throw err;
    }
  }

  async listMessages(
    workspaceId: string,
    page = 1,
    limit = 20,
    filters: {
      channel?: string;
      status?: string;
      contactId?: string;
      campaignId?: string;
    } = {},
  ) {
    const skip = (page - 1) * limit;
    const where: any = { workspaceId };

    if (filters.channel) where.channel = filters.channel;
    if (filters.status) where.status = filters.status;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.campaignId) where.campaignId = filters.campaignId;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.message.count({ where }),
    ]);

    return { data: messages, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, workspaceId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id, workspaceId },
      include: { events: { orderBy: { occurredAt: 'asc' } } },
    });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }
}
