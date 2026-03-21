import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { QueueService } from '../queue/queue.service';
import { CreateCampaignDto, UpdateCampaignDto, ScheduleCampaignDto } from './dto/campaign.dto';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  async findAll(workspaceId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where: { workspaceId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campaign.count({ where: { workspaceId } }),
    ]);
    return { data: campaigns, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, workspaceId: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, workspaceId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async create(workspaceId: string, dto: CreateCampaignDto) {
    const { recipientContactIds, ...campaignData } = dto;

    const campaign = await this.prisma.campaign.create({
      data: {
        workspaceId,
        ...campaignData,
        status: 'DRAFT',
        totalRecipients: recipientContactIds?.length || 0,
        sentCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        openCount: 0,
        clickCount: 0,
      },
    });

    if (recipientContactIds && recipientContactIds.length > 0) {
      const recipients = recipientContactIds.map((contactId) => ({
        campaignId: campaign.id,
        contactId,
        status: 'PENDING' as const,
      }));
      await this.prisma.campaignRecipient.createMany({ data: recipients, skipDuplicates: true });
    }

    return campaign;
  }

  async update(id: string, workspaceId: string, dto: UpdateCampaignDto) {
    const campaign = await this.findOne(id, workspaceId);
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException('Can only update DRAFT or SCHEDULED campaigns');
    }
    return this.prisma.campaign.update({ where: { id }, data: dto });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.campaign.delete({ where: { id } });
  }

  async schedule(id: string, workspaceId: string, dto: ScheduleCampaignDto) {
    const campaign = await this.findOne(id, workspaceId);
    if (!['DRAFT'].includes(campaign.status)) {
      throw new BadRequestException('Can only schedule DRAFT campaigns');
    }
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt: dto.scheduledAt },
    });
  }

  async send(id: string, workspaceId: string) {
    const campaign = await this.findOne(id, workspaceId);
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException('Campaign must be in DRAFT or SCHEDULED state to send');
    }

    const recipientCount = await this.prisma.campaignRecipient.count({ where: { campaignId: id } });

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        totalRecipients: recipientCount,
      },
    });

    await this.queueService.enqueueCampaignSend(id, workspaceId);
    this.logger.log(`Campaign ${id} enqueued for sending`);
    return updated;
  }

  async cancel(id: string, workspaceId: string) {
    const campaign = await this.findOne(id, workspaceId);
    if (!['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED'].includes(campaign.status)) {
      throw new BadRequestException('Campaign cannot be cancelled in its current state');
    }
    return this.prisma.campaign.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async listRecipients(id: string, workspaceId: string, page = 1, limit = 50) {
    await this.findOne(id, workspaceId);
    const skip = (page - 1) * limit;
    const [recipients, total] = await Promise.all([
      this.prisma.campaignRecipient.findMany({
        where: { campaignId: id },
        include: { contact: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campaignRecipient.count({ where: { campaignId: id } }),
    ]);
    return { data: recipients, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
