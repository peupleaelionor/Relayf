import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async getOverview(workspaceId: string) {
    const [
      totalMessages,
      deliveredMessages,
      failedMessages,
      openedMessages,
      clickedMessages,
      activeCampaigns,
      totalContacts,
    ] = await Promise.all([
      this.prisma.message.count({ where: { workspaceId } }),
      this.prisma.message.count({ where: { workspaceId, status: 'DELIVERED' } }),
      this.prisma.message.count({ where: { workspaceId, status: { in: ['FAILED', 'BOUNCED'] } } }),
      this.prisma.messageEvent.count({
        where: { message: { workspaceId }, type: 'OPENED' },
      }),
      this.prisma.messageEvent.count({
        where: { message: { workspaceId }, type: 'CLICKED' },
      }),
      this.prisma.campaign.count({
        where: { workspaceId, status: { in: ['RUNNING', 'SCHEDULED'] } },
      }),
      this.prisma.contact.count({ where: { workspaceId, deletedAt: null } }),
    ]);

    const openRate = totalMessages > 0 ? (openedMessages / totalMessages) * 100 : 0;
    const clickRate = totalMessages > 0 ? (clickedMessages / totalMessages) * 100 : 0;
    const deliveryRate = totalMessages > 0 ? (deliveredMessages / totalMessages) * 100 : 0;

    return {
      totalMessages,
      deliveredMessages,
      failedMessages,
      openedMessages,
      clickedMessages,
      activeCampaigns,
      totalContacts,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
    };
  }

  async getCampaignAnalytics(workspaceId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      channel: c.channel,
      status: c.status,
      totalRecipients: c.totalRecipients,
      sentCount: c.sentCount,
      deliveredCount: c.deliveredCount,
      failedCount: c.failedCount,
      openCount: c.openCount,
      clickCount: c.clickCount,
      openRate: c.sentCount > 0 ? Math.round((c.openCount / c.sentCount) * 10000) / 100 : 0,
      clickRate: c.sentCount > 0 ? Math.round((c.clickCount / c.sentCount) * 10000) / 100 : 0,
      deliveryRate: c.sentCount > 0 ? Math.round((c.deliveredCount / c.sentCount) * 10000) / 100 : 0,
      createdAt: c.createdAt,
      startedAt: c.startedAt,
      completedAt: c.completedAt,
    }));
  }

  async getMessagesOverTime(workspaceId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const messages = await this.prisma.message.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      select: { createdAt: true, status: true, channel: true },
    });

    const grouped: Record<string, { date: string; total: number; delivered: number; failed: number }> = {};

    for (const msg of messages) {
      const date = msg.createdAt.toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = { date, total: 0, delivered: 0, failed: 0 };
      }
      grouped[date].total++;
      if (msg.status === 'DELIVERED') grouped[date].delivered++;
      if (msg.status === 'FAILED' || msg.status === 'BOUNCED') grouped[date].failed++;
    }

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }
}
