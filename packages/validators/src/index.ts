import { z } from "zod";
import {
  UserRole,
  MessageChannel,
  CampaignStatus,
  TemplateStatus,
  ContactStatus,
  WebhookEventType,
  SenderIdentityType,
  ConsentChannel,
  BillingInterval,
  WorkspacePlan,
} from "@relayflow/types";

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

export const IdSchema = z.string().cuid();
export const EmailSchema = z.string().email().toLowerCase().trim();
export const PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in E.164 format (+1234567890)");
export const UrlSchema = z.string().url();
export const SlugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens");
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});
export const SortOrderSchema = z.enum(["asc", "desc"]).default("desc");

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
  name: z.string().min(2).max(100).trim(),
  workspaceName: z.string().min(2).max(100).trim().optional(),
});

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
  totpCode: z.string().length(6).optional(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8)
      .max(128)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const EnableTotpSchema = z.object({
  totpCode: z.string().length(6),
});

// ─────────────────────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  avatarUrl: UrlSchema.optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Workspace
// ─────────────────────────────────────────────────────────────────────────────

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  slug: SlugSchema.optional(),
  timezone: z.string().default("UTC"),
  locale: z.string().default("en-US"),
});

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  logoUrl: UrlSchema.optional().nullable(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  customDomain: z.string().optional().nullable(),
  settings: z
    .object({
      defaultChannel: z.nativeEnum(MessageChannel).optional(),
      sendingLimit: z.number().int().min(1).max(100_000).optional(),
      dailyLimit: z.number().int().min(1).max(10_000_000).optional(),
      unsubscribeUrl: UrlSchema.optional().nullable(),
      trackOpens: z.boolean().optional(),
      trackClicks: z.boolean().optional(),
      webhookRetries: z.number().int().min(0).max(10).optional(),
      replyToEmail: EmailSchema.optional().nullable(),
    })
    .optional(),
});

export const InviteMemberSchema = z.object({
  email: EmailSchema,
  role: z.nativeEnum(UserRole).default(UserRole.MEMBER),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

// ─────────────────────────────────────────────────────────────────────────────
// API Key
// ─────────────────────────────────────────────────────────────────────────────

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  scopes: z.array(z.string()).min(1),
  expiresAt: z.coerce.date().optional().nullable(),
  rateLimitRpm: z.number().int().min(10).max(10_000).default(60),
});

// ─────────────────────────────────────────────────────────────────────────────
// Contact
// ─────────────────────────────────────────────────────────────────────────────

export const CreateContactSchema = z.object({
  email: EmailSchema.optional().nullable(),
  phone: PhoneSchema.optional().nullable(),
  telegramId: z.string().optional().nullable(),
  firstName: z.string().max(100).trim().optional().nullable(),
  lastName: z.string().max(100).trim().optional().nullable(),
  externalId: z.string().max(255).optional().nullable(),
  attributes: z.record(z.unknown()).optional().default({}),
  tagIds: z.array(IdSchema).optional(),
}).refine(
  (data) => data.email || data.phone || data.telegramId,
  "Contact must have at least one of: email, phone, or telegramId",
);

export const UpdateContactSchema = z.object({
  email: EmailSchema.optional().nullable(),
  phone: PhoneSchema.optional().nullable(),
  telegramId: z.string().optional().nullable(),
  firstName: z.string().max(100).trim().optional().nullable(),
  lastName: z.string().max(100).trim().optional().nullable(),
  status: z.nativeEnum(ContactStatus).optional(),
  externalId: z.string().max(255).optional().nullable(),
  attributes: z.record(z.unknown()).optional(),
  tagIds: z.array(IdSchema).optional(),
});

export const BulkUpsertContactsSchema = z.object({
  contacts: z
    .array(CreateContactSchema)
    .min(1)
    .max(1000, "Maximum 1000 contacts per bulk operation"),
  updateExisting: z.boolean().default(true),
  matchField: z.enum(["email", "phone", "externalId"]).default("email"),
});

export const CreateContactTagSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color")
    .default("#6366f1"),
});

export const ListContactsSchema = PaginationSchema.extend({
  search: z.string().optional(),
  status: z.nativeEnum(ContactStatus).optional(),
  tagId: IdSchema.optional(),
  channel: z.nativeEnum(MessageChannel).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "email", "firstName"]).default("createdAt"),
  sortOrder: SortOrderSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Template
// ─────────────────────────────────────────────────────────────────────────────

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  channel: z.nativeEnum(MessageChannel),
  subject: z.string().max(998).optional().nullable(),
  body: z.string().min(1).max(100_000),
  previewText: z.string().max(200).optional().nullable(),
}).refine(
  (data) => {
    if (data.channel === MessageChannel.EMAIL && !data.subject) {
      return false;
    }
    return true;
  },
  { message: "Email templates require a subject", path: ["subject"] },
);

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  status: z.nativeEnum(TemplateStatus).optional(),
  subject: z.string().max(998).optional().nullable(),
  body: z.string().min(1).max(100_000).optional(),
  previewText: z.string().max(200).optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Campaign
// ─────────────────────────────────────────────────────────────────────────────

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  channel: z.nativeEnum(MessageChannel),
  templateId: IdSchema.optional().nullable(),
  subject: z.string().max(998).optional().nullable(),
  body: z.string().min(1).max(100_000).optional().nullable(),
  senderIdentityId: IdSchema.optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
  throttleRpm: z.number().int().min(1).max(10_000).optional().nullable(),
  recipientTagIds: z.array(IdSchema).optional(),
  recipientContactIds: z.array(IdSchema).optional(),
  metadata: z.record(z.unknown()).optional().default({}),
}).refine(
  (data) => data.templateId || data.body,
  "Campaign must have either a templateId or a body",
);

export const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  subject: z.string().max(998).optional().nullable(),
  body: z.string().min(1).max(100_000).optional().nullable(),
  templateId: IdSchema.optional().nullable(),
  senderIdentityId: IdSchema.optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
  throttleRpm: z.number().int().min(1).max(10_000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const CampaignActionSchema = z.object({
  action: z.enum(["launch", "pause", "resume", "cancel"]),
});

export const ListCampaignsSchema = PaginationSchema.extend({
  status: z.nativeEnum(CampaignStatus).optional(),
  channel: z.nativeEnum(MessageChannel).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "scheduledAt", "name"]).default("createdAt"),
  sortOrder: SortOrderSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Message
// ─────────────────────────────────────────────────────────────────────────────

export const SendMessageSchema = z.object({
  channel: z.nativeEnum(MessageChannel),
  to: z.string().min(1),
  from: z.string().optional(),
  subject: z.string().max(998).optional().nullable(),
  body: z.string().min(1).max(10_000),
  contactId: IdSchema.optional().nullable(),
  senderIdentityId: IdSchema.optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const ListMessagesSchema = PaginationSchema.extend({
  campaignId: IdSchema.optional(),
  contactId: IdSchema.optional(),
  channel: z.nativeEnum(MessageChannel).optional(),
  status: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortOrder: SortOrderSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Sender Identity
// ─────────────────────────────────────────────────────────────────────────────

export const CreateSenderIdentitySchema = z.object({
  type: z.nativeEnum(SenderIdentityType),
  name: z.string().min(1).max(100).trim(),
  value: z.string().min(1),
  isDefault: z.boolean().default(false),
});

// ─────────────────────────────────────────────────────────────────────────────
// Webhook
// ─────────────────────────────────────────────────────────────────────────────

export const CreateWebhookSchema = z.object({
  url: UrlSchema,
  events: z
    .array(z.nativeEnum(WebhookEventType))
    .min(1, "At least one event type is required"),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const UpdateWebhookSchema = z.object({
  url: UrlSchema.optional(),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Billing
// ─────────────────────────────────────────────────────────────────────────────

export const CreateCheckoutSessionSchema = z.object({
  plan: z.nativeEnum(WorkspacePlan),
  interval: z.nativeEnum(BillingInterval).default(BillingInterval.MONTHLY),
  successUrl: UrlSchema,
  cancelUrl: UrlSchema,
});

export const CreatePortalSessionSchema = z.object({
  returnUrl: UrlSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Consent
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateConsentSchema = z.object({
  contactId: IdSchema,
  channel: z.nativeEnum(ConsentChannel),
  status: z.enum(["OPTED_IN", "OPTED_OUT"]),
  source: z.string().max(100).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
export type CreateContactInput = z.infer<typeof CreateContactSchema>;
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;
export type BulkUpsertContactsInput = z.infer<typeof BulkUpsertContactsSchema>;
export type CreateContactTagInput = z.infer<typeof CreateContactTagSchema>;
export type ListContactsInput = z.infer<typeof ListContactsSchema>;
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;
export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
export type ListCampaignsInput = z.infer<typeof ListCampaignsSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type ListMessagesInput = z.infer<typeof ListMessagesSchema>;
export type CreateSenderIdentityInput = z.infer<typeof CreateSenderIdentitySchema>;
export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>;
export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionSchema>;
export type UpdateConsentInput = z.infer<typeof UpdateConsentSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
