import { PrismaClient, Prisma } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient({
  log: [
    { emit: "stdout", level: "query" },
    { emit: "stdout", level: "info" },
    { emit: "stdout", level: "warn" },
    { emit: "stdout", level: "error" },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hashPassword(password: string): string {
  // WARNING: SHA-256 is used here for seeding convenience only.
  // Production code MUST use bcrypt or argon2 (see apps/api/src/lib/auth.ts).
  return crypto.createHash("sha256").update(password).digest("hex");
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main seed
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("🌱 Starting database seed...\n");

  // ── Users ──────────────────────────────────────────────────────────────────

  console.log("Creating users...");

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      name: "Alice Johnson",
      passwordHash: hashPassword("Password123!"),
      status: "ACTIVE",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      name: "Bob Smith",
      passwordHash: hashPassword("Password123!"),
      status: "ACTIVE",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: "carol@example.com" },
    update: {},
    create: {
      email: "carol@example.com",
      name: "Carol Williams",
      passwordHash: hashPassword("Password123!"),
      status: "ACTIVE",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`  ✓ Created ${3} users\n`);

  // ── Workspace ──────────────────────────────────────────────────────────────

  console.log("Creating workspace...");

  const workspace = await prisma.workspace.upsert({
    where: { slug: "acme-corp" },
    update: {},
    create: {
      name: "Acme Corp",
      slug: "acme-corp",
      status: "ACTIVE",
      plan: "GROWTH",
      timezone: "America/New_York",
      locale: "en-US",
      settings: {
        defaultChannel: "EMAIL",
        sendingLimit: 100,
        dailyLimit: 10000,
        trackOpens: true,
        trackClicks: true,
        webhookRetries: 3,
        replyToEmail: "support@acme.com",
      } satisfies Prisma.InputJsonValue,
    },
  });

  // ── Workspace Members ──────────────────────────────────────────────────────

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: alice.id } },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: alice.id,
      role: "OWNER",
      joinedAt: new Date(),
    },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: bob.id } },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: bob.id,
      role: "ADMIN",
      invitedBy: alice.id,
      joinedAt: new Date(),
    },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: carol.id } },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: carol.id,
      role: "MEMBER",
      invitedBy: alice.id,
      joinedAt: new Date(),
    },
  });

  console.log(`  ✓ Created workspace "${workspace.name}" with 3 members\n`);

  // ── API Key ────────────────────────────────────────────────────────────────

  console.log("Creating API keys...");

  const rawApiKey = "rf_live_seed_testkey1234567890abcdef";
  await prisma.aPIKey.upsert({
    where: { keyHash: hashApiKey(rawApiKey) },
    update: {},
    create: {
      workspaceId: workspace.id,
      createdBy: alice.id,
      name: "Production Key",
      keyHash: hashApiKey(rawApiKey),
      keyPrefix: "rf_live_seed",
      scopes: ["messages:send", "contacts:read", "contacts:write", "campaigns:read"],
      rateLimitRpm: 120,
    },
  });

  console.log(`  ✓ Created API key (raw: ${rawApiKey})\n`);

  // ── Contact Tags ───────────────────────────────────────────────────────────

  console.log("Creating contact tags...");

  const [vipTag, newsletterTag, trialTag, churnRiskTag] = await Promise.all([
    prisma.contactTag.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "VIP" } },
      update: {},
      create: { workspaceId: workspace.id, name: "VIP", color: "#f59e0b" },
    }),
    prisma.contactTag.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "Newsletter" } },
      update: {},
      create: { workspaceId: workspace.id, name: "Newsletter", color: "#6366f1" },
    }),
    prisma.contactTag.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "Trial" } },
      update: {},
      create: { workspaceId: workspace.id, name: "Trial", color: "#10b981" },
    }),
    prisma.contactTag.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "Churn Risk" } },
      update: {},
      create: { workspaceId: workspace.id, name: "Churn Risk", color: "#ef4444" },
    }),
  ]);

  console.log(`  ✓ Created 4 contact tags\n`);

  // ── Contacts ───────────────────────────────────────────────────────────────

  console.log("Creating contacts...");

  const contactsData = [
    {
      email: "john.doe@customer.com",
      phone: "+14155551001",
      firstName: "John",
      lastName: "Doe",
      attributes: { company: "Doe Enterprises", plan: "pro", ltv: 2400 },
      tags: [vipTag.id, newsletterTag.id],
    },
    {
      email: "jane.smith@example.com",
      phone: "+14155551002",
      firstName: "Jane",
      lastName: "Smith",
      attributes: { company: "Smith LLC", plan: "starter", ltv: 480 },
      tags: [newsletterTag.id, trialTag.id],
    },
    {
      email: "mike.jones@test.com",
      phone: "+14155551003",
      firstName: "Mike",
      lastName: "Jones",
      attributes: { company: "Jones Inc", plan: "free", ltv: 0 },
      tags: [trialTag.id],
    },
    {
      email: "sara.wilson@bizco.com",
      phone: "+14155551004",
      firstName: "Sara",
      lastName: "Wilson",
      attributes: { company: "Biz Co", plan: "growth", ltv: 9600 },
      tags: [vipTag.id, newsletterTag.id],
    },
    {
      email: "tom.brown@startups.io",
      phone: "+14155551005",
      firstName: "Tom",
      lastName: "Brown",
      attributes: { company: "Startups.io", plan: "starter", ltv: 960 },
      tags: [newsletterTag.id],
    },
    {
      email: "emily.davis@corp.net",
      phone: "+14155551006",
      firstName: "Emily",
      lastName: "Davis",
      attributes: { company: "Corp Net", plan: "pro", ltv: 3600 },
      tags: [vipTag.id, churnRiskTag.id],
    },
    {
      email: "chris.martin@agency.com",
      phone: "+14155551007",
      firstName: "Chris",
      lastName: "Martin",
      attributes: { company: "Marketing Agency", plan: "growth", ltv: 12000 },
      tags: [vipTag.id, newsletterTag.id],
    },
    {
      email: "lisa.taylor@freelance.io",
      phone: "+14155551008",
      firstName: "Lisa",
      lastName: "Taylor",
      attributes: { company: "Freelance", plan: "free", ltv: 0 },
      tags: [trialTag.id, churnRiskTag.id],
    },
    {
      email: "david.anderson@bigco.com",
      phone: "+14155551009",
      firstName: "David",
      lastName: "Anderson",
      attributes: { company: "Big Co", plan: "enterprise", ltv: 48000 },
      tags: [vipTag.id, newsletterTag.id],
    },
    {
      email: "nancy.white@techsolutions.com",
      phone: "+14155551010",
      firstName: "Nancy",
      lastName: "White",
      attributes: { company: "Tech Solutions", plan: "growth", ltv: 7200 },
      tags: [newsletterTag.id],
    },
  ];

  const contacts = await Promise.all(
    contactsData.map(async (data) => {
      const contact = await prisma.contact.upsert({
        where: { workspaceId_email: { workspaceId: workspace.id, email: data.email } },
        update: {},
        create: {
          workspaceId: workspace.id,
          email: data.email,
          phone: data.phone,
          firstName: data.firstName,
          lastName: data.lastName,
          status: "ACTIVE",
          attributes: data.attributes as Prisma.InputJsonValue,
        },
      });

      // Create tag associations
      await Promise.all(
        data.tags.map((tagId) =>
          prisma.contactTagMap.upsert({
            where: { contactId_tagId: { contactId: contact.id, tagId } },
            update: {},
            create: { contactId: contact.id, tagId },
          }),
        ),
      );

      return contact;
    }),
  );

  console.log(`  ✓ Created ${contacts.length} contacts with tags\n`);

  // ── Consent Records ────────────────────────────────────────────────────────

  console.log("Creating consent records...");

  for (const contact of contacts.slice(0, 8)) {
    for (const channel of ["EMAIL", "SMS"] as const) {
      await prisma.consentRecord.upsert({
        where: {
          workspaceId_contactId_channel: {
            workspaceId: workspace.id,
            contactId: contact.id,
            channel,
          },
        },
        update: {},
        create: {
          workspaceId: workspace.id,
          contactId: contact.id,
          channel,
          status: "OPTED_IN",
          consentedAt: subtractDays(new Date(), Math.floor(Math.random() * 90)),
          source: "signup_form",
        },
      });
    }
  }

  console.log(`  ✓ Created consent records\n`);

  // ── Sender Identity ────────────────────────────────────────────────────────

  console.log("Creating sender identities...");

  const senderEmail = await prisma.senderIdentity.upsert({
    where: { workspaceId_value: { workspaceId: workspace.id, value: "hello@acme.com" } },
    update: {},
    create: {
      workspaceId: workspace.id,
      type: "EMAIL",
      name: "Acme Notifications",
      value: "hello@acme.com",
      status: "VERIFIED",
      isDefault: true,
      verifiedAt: subtractDays(new Date(), 30),
    },
  });

  const senderSms = await prisma.senderIdentity.upsert({
    where: { workspaceId_value: { workspaceId: workspace.id, value: "+15005550006" } },
    update: {},
    create: {
      workspaceId: workspace.id,
      type: "PHONE",
      name: "Acme SMS",
      value: "+15005550006",
      status: "VERIFIED",
      isDefault: true,
      verifiedAt: subtractDays(new Date(), 30),
    },
  });

  console.log(`  ✓ Created 2 sender identities\n`);

  // ── Templates ──────────────────────────────────────────────────────────────

  console.log("Creating templates...");

  const welcomeTemplate = await prisma.template.create({
    data: {
      workspaceId: workspace.id,
      name: "Welcome Email",
      channel: "EMAIL",
      status: "ACTIVE",
      subject: "Welcome to {{company}}, {{firstName}}! 🎉",
      body: `<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1>Welcome, {{firstName}}!</h1>
  <p>Thanks for joining <strong>{{company}}</strong>. We're thrilled to have you on board.</p>
  <p>Your account is ready. Here's what you can do next:</p>
  <ul>
    <li>Complete your profile</li>
    <li>Explore our features</li>
    <li>Contact support if you need help</li>
  </ul>
  <a href="{{dashboardUrl}}" style="padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px">
    Get Started →
  </a>
</body>
</html>`,
      variables: ["firstName", "company", "dashboardUrl"],
      previewText: "Your account is ready — let's get started!",
    },
  });

  const promoTemplate = await prisma.template.create({
    data: {
      workspaceId: workspace.id,
      name: "Promotional Offer",
      channel: "EMAIL",
      status: "ACTIVE",
      subject: "{{firstName}}, exclusive offer just for you 🎁",
      body: `<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1>Hi {{firstName}},</h1>
  <p>We have a special offer for you: <strong>{{discountPercent}}% off</strong> your next purchase!</p>
  <p>Use code <code>{{promoCode}}</code> at checkout. Expires {{expiryDate}}.</p>
  <a href="{{ctaUrl}}" style="padding:12px 24px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:6px">
    Claim Offer →
  </a>
</body>
</html>`,
      variables: ["firstName", "discountPercent", "promoCode", "expiryDate", "ctaUrl"],
      previewText: "Your exclusive offer is waiting",
    },
  });

  const smsTemplate = await prisma.template.create({
    data: {
      workspaceId: workspace.id,
      name: "SMS Appointment Reminder",
      channel: "SMS",
      status: "ACTIVE",
      body: "Hi {{firstName}}, reminder: you have an appointment on {{date}} at {{time}}. Reply STOP to unsubscribe.",
      variables: ["firstName", "date", "time"],
    },
  });

  const reengageTemplate = await prisma.template.create({
    data: {
      workspaceId: workspace.id,
      name: "Re-engagement Email",
      channel: "EMAIL",
      status: "ACTIVE",
      subject: "We miss you, {{firstName}} 👋",
      body: `<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1>Hey {{firstName}}, it's been a while!</h1>
  <p>We noticed you haven't logged in for {{daysSinceLogin}} days. We've added some exciting new features since your last visit.</p>
  <a href="{{loginUrl}}" style="padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px">
    Come Back →
  </a>
  <p style="color:#999;font-size:12px;margin-top:24px">
    Don't want these emails? <a href="{{unsubscribeUrl}}">Unsubscribe</a>
  </p>
</body>
</html>`,
      variables: ["firstName", "daysSinceLogin", "loginUrl", "unsubscribeUrl"],
      previewText: "See what's new since your last visit",
    },
  });

  console.log(`  ✓ Created 4 templates\n`);

  // ── Campaigns ──────────────────────────────────────────────────────────────

  console.log("Creating campaigns...");

  const completedCampaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "Q1 Welcome Series",
      channel: "EMAIL",
      status: "COMPLETED",
      templateId: welcomeTemplate.id,
      subject: "Welcome to Acme Corp, {{firstName}}! 🎉",
      senderIdentityId: senderEmail.id,
      startedAt: subtractDays(new Date(), 14),
      completedAt: subtractDays(new Date(), 14),
      totalRecipients: 8,
      sentCount: 8,
      deliveredCount: 7,
      failedCount: 1,
      openCount: 5,
      clickCount: 3,
    },
  });

  const scheduledCampaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "Spring Promo Blast",
      channel: "EMAIL",
      status: "SCHEDULED",
      templateId: promoTemplate.id,
      subject: "{{firstName}}, spring offer just for you 🌸",
      senderIdentityId: senderEmail.id,
      scheduledAt: addDays(new Date(), 3),
      totalRecipients: 10,
      throttleRpm: 500,
    },
  });

  const draftCampaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "SMS Appointment Reminders – June",
      channel: "SMS",
      status: "DRAFT",
      templateId: smsTemplate.id,
      senderIdentityId: senderSms.id,
      totalRecipients: 0,
      throttleRpm: 60,
    },
  });

  const reengageCampaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: "Churn Risk Re-engagement",
      channel: "EMAIL",
      status: "DRAFT",
      templateId: reengageTemplate.id,
      subject: "We miss you, {{firstName}} 👋",
      senderIdentityId: senderEmail.id,
      totalRecipients: 2,
    },
  });

  console.log(`  ✓ Created 4 campaigns\n`);

  // ── Messages (for completed campaign) ─────────────────────────────────────

  console.log("Creating messages and events...");

  const messageResults = await Promise.all(
    contacts.slice(0, 8).map(async (contact, i) => {
      const isDelivered = i !== 2; // contact index 2 fails
      const isSentDaysAgo = subtractDays(new Date(), 14);

      const msg = await prisma.message.create({
        data: {
          workspaceId: workspace.id,
          campaignId: completedCampaign.id,
          contactId: contact.id,
          channel: "EMAIL",
          status: isDelivered ? (i < 5 ? "READ" : "DELIVERED") : "FAILED",
          to: contact.email ?? "",
          from: "hello@acme.com",
          subject: `Welcome to Acme Corp, ${contact.firstName}!`,
          body: `<html><body><h1>Welcome, ${contact.firstName}!</h1></body></html>`,
          providerMessageId: `msg_${crypto.randomBytes(8).toString("hex")}`,
          sentAt: isSentDaysAgo,
          deliveredAt: isDelivered ? isSentDaysAgo : null,
          errorCode: isDelivered ? null : "5.1.1",
          errorMessage: isDelivered ? null : "Mailbox not found",
        },
      });

      // Create events
      const eventsToCreate: Prisma.MessageEventCreateManyInput[] = [
        {
          messageId: msg.id,
          type: "SENT",
          occurredAt: isSentDaysAgo,
          data: {},
        },
      ];

      if (isDelivered) {
        eventsToCreate.push({
          messageId: msg.id,
          type: "DELIVERED",
          occurredAt: new Date(isSentDaysAgo.getTime() + 30_000),
          data: {},
        });
      }

      if (i < 5 && isDelivered) {
        eventsToCreate.push({
          messageId: msg.id,
          type: "OPENED",
          occurredAt: new Date(isSentDaysAgo.getTime() + 3_600_000),
          data: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
          ipAddress: "203.0.113." + (i + 1),
        });
      }

      if (i < 3 && isDelivered) {
        eventsToCreate.push({
          messageId: msg.id,
          type: "CLICKED",
          occurredAt: new Date(isSentDaysAgo.getTime() + 3_700_000),
          data: { url: "https://acme.com/dashboard" },
          ipAddress: "203.0.113." + (i + 1),
        });
      }

      await prisma.messageEvent.createMany({ data: eventsToCreate });

      // Add campaign recipient
      await prisma.campaignRecipient.create({
        data: {
          campaignId: completedCampaign.id,
          contactId: contact.id,
          status: isDelivered ? "DELIVERED" : "FAILED",
          messageId: msg.id,
          sentAt: isSentDaysAgo,
          failureReason: isDelivered ? null : "Mailbox not found",
        },
      });

      return msg;
    }),
  );

  console.log(`  ✓ Created ${messageResults.length} messages with events\n`);

  // ── Provider Account ───────────────────────────────────────────────────────

  console.log("Creating provider accounts...");

  await prisma.providerAccount.createMany({
    data: [
      {
        workspaceId: workspace.id,
        channel: "EMAIL",
        name: "Resend Production",
        provider: "resend",
        credentials: { apiKey: "[REDACTED]" } as unknown as Prisma.InputJsonValue,
        isDefault: true,
        isActive: true,
      },
      {
        workspaceId: workspace.id,
        channel: "SMS",
        name: "Twilio Production",
        provider: "twilio",
        credentials: {
          accountSid: "[REDACTED]",
          authToken: "[REDACTED]",
          fromNumber: "+15005550006",
        } as unknown as Prisma.InputJsonValue,
        isDefault: true,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log(`  ✓ Created provider accounts\n`);

  // ── Billing ────────────────────────────────────────────────────────────────

  console.log("Creating billing records...");

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const billingCustomer = await prisma.billingCustomer.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      stripeCustomerId: "cus_seed_acmecorp123",
      email: "billing@acme.com",
      name: "Acme Corp",
    },
  });

  const subscription = await prisma.subscription.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      stripeSubscriptionId: "sub_seed_acmecorp123",
      stripePriceId: "price_growth_monthly",
      status: "ACTIVE",
      plan: "GROWTH",
      interval: "MONTHLY",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      seats: 3,
    },
  });

  // Usage records for current month
  await prisma.usageRecord.createMany({
    data: [
      {
        workspaceId: workspace.id,
        subscriptionId: subscription.id,
        channel: "EMAIL",
        quantity: 847,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
      },
      {
        workspaceId: workspace.id,
        subscriptionId: subscription.id,
        channel: "SMS",
        quantity: 123,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
      },
    ],
    skipDuplicates: true,
  });

  console.log(`  ✓ Created billing customer, subscription, and usage records\n`);

  // ── Webhook Endpoint ───────────────────────────────────────────────────────

  console.log("Creating webhook endpoints...");

  const webhookEndpoint = await prisma.webhookEndpoint.create({
    data: {
      workspaceId: workspace.id,
      url: "https://hooks.acme.com/relayflow",
      secret: crypto.randomBytes(32).toString("hex"),
      events: [
        "MESSAGE_DELIVERED",
        "MESSAGE_FAILED",
        "CAMPAIGN_COMPLETED",
        "CONTACT_OPTED_OUT",
      ],
      isActive: true,
      description: "Production webhook receiver",
    },
  });

  console.log(`  ✓ Created webhook endpoint\n`);

  // ── Audit Logs ─────────────────────────────────────────────────────────────

  console.log("Creating audit log entries...");

  await prisma.auditLog.createMany({
    data: [
      {
        workspaceId: workspace.id,
        userId: alice.id,
        action: "CREATE",
        resource: "workspace",
        resourceId: workspace.id,
        metadata: { name: workspace.name } as Prisma.InputJsonValue,
        ipAddress: "192.0.2.1",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      },
      {
        workspaceId: workspace.id,
        userId: alice.id,
        action: "MEMBER_INVITED",
        resource: "workspace_member",
        resourceId: bob.id,
        metadata: { email: bob.email, role: "ADMIN" } as Prisma.InputJsonValue,
        ipAddress: "192.0.2.1",
      },
      {
        workspaceId: workspace.id,
        userId: alice.id,
        action: "API_KEY_CREATED",
        resource: "api_key",
        metadata: { name: "Production Key" } as Prisma.InputJsonValue,
        ipAddress: "192.0.2.1",
      },
      {
        workspaceId: workspace.id,
        userId: alice.id,
        action: "CAMPAIGN_LAUNCHED",
        resource: "campaign",
        resourceId: completedCampaign.id,
        metadata: {
          name: completedCampaign.name,
          channel: completedCampaign.channel,
          recipientCount: 8,
        } as Prisma.InputJsonValue,
        ipAddress: "192.0.2.1",
      },
      {
        workspaceId: workspace.id,
        userId: alice.id,
        action: "PLAN_CHANGED",
        resource: "subscription",
        resourceId: subscription.id,
        changes: { from: "FREE", to: "GROWTH" } as Prisma.InputJsonValue,
        metadata: {} as Prisma.InputJsonValue,
        ipAddress: "192.0.2.1",
      },
    ],
  });

  console.log(`  ✓ Created audit log entries\n`);

  // ─────────────────────────────────────────────────────────────────────────

  console.log("✅ Seed complete!\n");
  console.log("Summary:");
  console.log(`  • Workspace: ${workspace.name} (slug: ${workspace.slug})`);
  console.log(`  • Users: alice@example.com / bob@example.com / carol@example.com`);
  console.log(`  • Password: Password123!`);
  console.log(`  • API Key: ${rawApiKey}`);
  console.log(`  • Contacts: ${contacts.length}`);
  console.log(`  • Templates: 4`);
  console.log(`  • Campaigns: 4 (1 completed, 1 scheduled, 2 draft)`);
  console.log(`  • Messages: ${messageResults.length}`);
  console.log(`  • Billing: Growth plan active\n`);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
