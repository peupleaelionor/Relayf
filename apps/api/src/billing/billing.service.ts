import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma.service';
import { CreateCheckoutSessionDto, CreatePortalSessionDto } from './dto/billing.dto';
import { env, stripePriceMap } from '@relayflow/config';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe;

  constructor(private prisma: PrismaService) {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2024-04-10',
    });
  }

  async getSubscription(workspaceId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });
    const billingCustomer = await this.prisma.billingCustomer.findUnique({
      where: { workspaceId },
    });
    return { subscription, billingCustomer };
  }

  async getOrCreateCustomer(workspaceId: string, email: string, name?: string) {
    const existing = await this.prisma.billingCustomer.findUnique({ where: { workspaceId } });
    if (existing) return existing;

    const stripeCustomer = await this.stripe.customers.create({
      email,
      name,
      metadata: { workspaceId },
    });

    const customer = await this.prisma.billingCustomer.create({
      data: {
        workspaceId,
        stripeCustomerId: stripeCustomer.id,
        email,
        name,
      },
    });

    this.logger.log(`Stripe customer created for workspace ${workspaceId}: ${stripeCustomer.id}`);
    return customer;
  }

  async createCheckoutSession(workspaceId: string, userId: string, dto: CreateCheckoutSessionDto) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const customer = await this.getOrCreateCustomer(workspaceId, user.email, user.name || undefined);

    const planKey = dto.plan.toLowerCase() as keyof typeof stripePriceMap;
    const intervalKey = dto.interval === 'MONTHLY' ? 'monthly' : 'yearly';

    const priceId = stripePriceMap[planKey]?.[intervalKey];
    if (!priceId) {
      throw new BadRequestException(`No price configured for plan ${dto.plan} / interval ${dto.interval}`);
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customer.stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: dto.successUrl,
      cancel_url: dto.cancelUrl,
      metadata: { workspaceId, plan: dto.plan, interval: dto.interval },
    });

    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(workspaceId: string, dto: CreatePortalSessionDto) {
    const customer = await this.prisma.billingCustomer.findUnique({ where: { workspaceId } });
    if (!customer) throw new NotFoundException('No billing customer found for this workspace');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: dto.returnUrl,
    });

    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new BadRequestException('Stripe webhook secret not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${err}`);
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const workspaceId = sub.metadata?.workspaceId;
        if (!workspaceId) break;

        const plan = (sub.metadata?.plan as any) || 'FREE';
        const interval = (sub.metadata?.interval as any) || 'MONTHLY';

        await this.prisma.subscription.upsert({
          where: { workspaceId },
          create: {
            workspaceId,
            stripeSubscriptionId: sub.id,
            stripePriceId: (sub.items.data[0]?.price?.id) || '',
            status: sub.status.toUpperCase() as any,
            plan,
            interval,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            seats: 1,
          },
          update: {
            stripeSubscriptionId: sub.id,
            stripePriceId: (sub.items.data[0]?.price?.id) || '',
            status: sub.status.toUpperCase() as any,
            plan,
            interval,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
            cancelledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
            trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
            trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          },
        });

        await this.prisma.workspace.update({
          where: { id: workspaceId },
          data: { plan },
        });

        this.logger.log(`Subscription ${event.type} for workspace ${workspaceId}`);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const workspaceId = sub.metadata?.workspaceId;
        if (!workspaceId) break;

        await this.prisma.subscription.update({
          where: { workspaceId },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        await this.prisma.workspace.update({ where: { id: workspaceId }, data: { plan: 'FREE' } });
        this.logger.log(`Subscription deleted for workspace ${workspaceId}`);
        break;
      }
    }

    return { received: true };
  }

  async getUsage(workspaceId: string) {
    const records = await this.prisma.usageRecord.findMany({
      where: { workspaceId },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    return records;
  }
}
