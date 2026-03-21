// ─────────────────────────────────────────────────────────────────────────────
// RelayFlow – Shared TypeScript Types
// ─────────────────────────────────────────────────────────────────────────────

// ── Primitives ────────────────────────────────────────────────────────────────

export type ID = string;
export type Timestamp = Date;
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum UserRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
  VIEWER = "VIEWER",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
}

export enum WorkspaceStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  CANCELLED = "CANCELLED",
}

export enum WorkspacePlan {
  FREE = "FREE",
  STARTER = "STARTER",
  GROWTH = "GROWTH",
  SCALE = "SCALE",
  ENTERPRISE = "ENTERPRISE",
}

export enum MessageChannel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  WHATSAPP = "WHATSAPP",
  TELEGRAM = "TELEGRAM",
}

export enum MessageStatus {
  PENDING = "PENDING",
  QUEUED = "QUEUED",
  SENDING = "SENDING",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  BOUNCED = "BOUNCED",
  UNDELIVERED = "UNDELIVERED",
  READ = "READ",
}

export enum CampaignStatus {
  DRAFT = "DRAFT",
  SCHEDULED = "SCHEDULED",
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED",
}

export enum CampaignRecipientStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED",
  OPTED_OUT = "OPTED_OUT",
}

export enum TemplateStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}

export enum MessageEventType {
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  BOUNCED = "BOUNCED",
  OPENED = "OPENED",
  CLICKED = "CLICKED",
  UNSUBSCRIBED = "UNSUBSCRIBED",
  COMPLAINED = "COMPLAINED",
  READ = "READ",
}

export enum ContactStatus {
  ACTIVE = "ACTIVE",
  UNSUBSCRIBED = "UNSUBSCRIBED",
  BOUNCED = "BOUNCED",
  COMPLAINED = "COMPLAINED",
  BLOCKED = "BLOCKED",
}

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  TRIALING = "TRIALING",
  PAST_DUE = "PAST_DUE",
  CANCELLED = "CANCELLED",
  UNPAID = "UNPAID",
  INCOMPLETE = "INCOMPLETE",
}

export enum WebhookEventType {
  MESSAGE_SENT = "message.sent",
  MESSAGE_DELIVERED = "message.delivered",
  MESSAGE_FAILED = "message.failed",
  MESSAGE_OPENED = "message.opened",
  MESSAGE_CLICKED = "message.clicked",
  CONTACT_CREATED = "contact.created",
  CONTACT_UPDATED = "contact.updated",
  CONTACT_OPTED_OUT = "contact.opted_out",
  CAMPAIGN_STARTED = "campaign.started",
  CAMPAIGN_COMPLETED = "campaign.completed",
  CAMPAIGN_FAILED = "campaign.failed",
  SUBSCRIPTION_CREATED = "subscription.created",
  SUBSCRIPTION_UPDATED = "subscription.updated",
  SUBSCRIPTION_CANCELLED = "subscription.cancelled",
}

export enum WebhookDeliveryStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  RETRYING = "RETRYING",
}

export enum AuditAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  API_KEY_CREATED = "API_KEY_CREATED",
  API_KEY_REVOKED = "API_KEY_REVOKED",
  MEMBER_INVITED = "MEMBER_INVITED",
  MEMBER_REMOVED = "MEMBER_REMOVED",
  CAMPAIGN_LAUNCHED = "CAMPAIGN_LAUNCHED",
  CAMPAIGN_CANCELLED = "CAMPAIGN_CANCELLED",
  PLAN_CHANGED = "PLAN_CHANGED",
  BILLING_UPDATED = "BILLING_UPDATED",
}

export enum SenderIdentityStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  FAILED = "FAILED",
}

export enum SenderIdentityType {
  EMAIL = "EMAIL",
  PHONE = "PHONE",
  WHATSAPP = "WHATSAPP",
  TELEGRAM = "TELEGRAM",
}

export enum ConsentChannel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  WHATSAPP = "WHATSAPP",
  TELEGRAM = "TELEGRAM",
}

export enum ConsentStatus {
  OPTED_IN = "OPTED_IN",
  OPTED_OUT = "OPTED_OUT",
  PENDING = "PENDING",
}

export enum BillingInterval {
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface BaseEntity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SoftDeletable {
  deletedAt: Timestamp | null;
}

// ── User ──────────────────────────────────────────────────────────────────────

export interface User extends BaseEntity, SoftDeletable {
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: Timestamp | null;
  name: string;
  avatarUrl: string | null;
  passwordHash: string;
  status: UserStatus;
  lastLoginAt: Timestamp | null;
  lastLoginIp: string | null;
  totpSecret: string | null;
  totpEnabled: boolean;
}

export interface PublicUser {
  id: ID;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  totpEnabled: boolean;
  createdAt: Timestamp;
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export interface Workspace extends BaseEntity, SoftDeletable {
  name: string;
  slug: string;
  logoUrl: string | null;
  status: WorkspaceStatus;
  plan: WorkspacePlan;
  timezone: string;
  locale: string;
  customDomain: string | null;
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  defaultChannel: MessageChannel;
  sendingLimit: number;
  dailyLimit: number;
  unsubscribeUrl: string | null;
  trackOpens: boolean;
  trackClicks: boolean;
  webhookRetries: number;
  replyToEmail: string | null;
}

export interface WorkspaceMember extends BaseEntity {
  workspaceId: ID;
  userId: ID;
  role: UserRole;
  invitedBy: ID | null;
  joinedAt: Timestamp | null;
  user?: PublicUser;
  workspace?: Workspace;
}

export interface Invite extends BaseEntity {
  workspaceId: ID;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: Timestamp;
  acceptedAt: Timestamp | null;
  invitedBy: ID;
  workspace?: Workspace;
}

// ── API Key ───────────────────────────────────────────────────────────────────

export interface APIKey extends BaseEntity {
  workspaceId: ID;
  createdBy: ID;
  name: string;
  keyHash: string;
  keyPrefix: string;
  lastUsedAt: Timestamp | null;
  expiresAt: Timestamp | null;
  revokedAt: Timestamp | null;
  scopes: string[];
  rateLimitRpm: number;
}

export interface APIKeyWithSecret extends APIKey {
  secret: string;
}

// ── Contact ───────────────────────────────────────────────────────────────────

export interface Contact extends BaseEntity, SoftDeletable {
  workspaceId: ID;
  email: string | null;
  phone: string | null;
  telegramId: string | null;
  firstName: string | null;
  lastName: string | null;
  status: ContactStatus;
  externalId: string | null;
  attributes: Record<string, JSONValue>;
  tags?: ContactTag[];
}

export interface ContactTag extends BaseEntity {
  workspaceId: ID;
  name: string;
  color: string;
  contacts?: Contact[];
}

// ── Template ──────────────────────────────────────────────────────────────────

export interface Template extends BaseEntity {
  workspaceId: ID;
  name: string;
  channel: MessageChannel;
  status: TemplateStatus;
  subject: string | null;
  body: string;
  variables: string[];
  previewText: string | null;
  version: number;
}

// ── Campaign ──────────────────────────────────────────────────────────────────

export interface Campaign extends BaseEntity {
  workspaceId: ID;
  name: string;
  channel: MessageChannel;
  status: CampaignStatus;
  templateId: ID | null;
  subject: string | null;
  body: string | null;
  scheduledAt: Timestamp | null;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  senderIdentityId: ID | null;
  throttleRpm: number | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  openCount: number;
  clickCount: number;
  metadata: Record<string, JSONValue>;
  template?: Template;
  senderIdentity?: SenderIdentity;
}

export interface CampaignRecipient extends BaseEntity {
  campaignId: ID;
  contactId: ID;
  status: CampaignRecipientStatus;
  messageId: ID | null;
  scheduledAt: Timestamp | null;
  sentAt: Timestamp | null;
  failureReason: string | null;
  contact?: Contact;
  message?: Message;
}

// ── Message ───────────────────────────────────────────────────────────────────

export interface Message extends BaseEntity {
  workspaceId: ID;
  campaignId: ID | null;
  contactId: ID | null;
  channel: MessageChannel;
  status: MessageStatus;
  to: string;
  from: string;
  subject: string | null;
  body: string;
  providerMessageId: string | null;
  providerAccountId: ID | null;
  cost: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: Timestamp | null;
  deliveredAt: Timestamp | null;
  metadata: Record<string, JSONValue>;
  events?: MessageEvent[];
}

export interface MessageEvent extends BaseEntity {
  messageId: ID;
  type: MessageEventType;
  occurredAt: Timestamp;
  data: Record<string, JSONValue>;
  ipAddress: string | null;
  userAgent: string | null;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export interface ProviderAccount extends BaseEntity {
  workspaceId: ID;
  channel: MessageChannel;
  name: string;
  provider: string;
  credentials: Record<string, string>;
  isDefault: boolean;
  isActive: boolean;
  metadata: Record<string, JSONValue>;
}

// ── Sender Identity ───────────────────────────────────────────────────────────

export interface SenderIdentity extends BaseEntity {
  workspaceId: ID;
  type: SenderIdentityType;
  name: string;
  value: string;
  status: SenderIdentityStatus;
  isDefault: boolean;
  verifiedAt: Timestamp | null;
  metadata: Record<string, JSONValue>;
}

// ── Billing ───────────────────────────────────────────────────────────────────

export interface BillingCustomer extends BaseEntity {
  workspaceId: ID;
  stripeCustomerId: string;
  email: string;
  name: string | null;
}

export interface Subscription extends BaseEntity {
  workspaceId: ID;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: SubscriptionStatus;
  plan: WorkspacePlan;
  interval: BillingInterval;
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  cancelAt: Timestamp | null;
  cancelledAt: Timestamp | null;
  trialStart: Timestamp | null;
  trialEnd: Timestamp | null;
  seats: number;
  metadata: Record<string, JSONValue>;
}

export interface UsageRecord extends BaseEntity {
  workspaceId: ID;
  subscriptionId: ID;
  channel: MessageChannel;
  quantity: number;
  recordedAt: Timestamp;
  billingPeriodStart: Timestamp;
  billingPeriodEnd: Timestamp;
}

// ── Webhook ───────────────────────────────────────────────────────────────────

export interface WebhookEndpoint extends BaseEntity {
  workspaceId: ID;
  url: string;
  secret: string;
  events: WebhookEventType[];
  isActive: boolean;
  description: string | null;
  failureCount: number;
  lastDeliveryAt: Timestamp | null;
  lastDeliveryStatus: WebhookDeliveryStatus | null;
}

export interface WebhookEvent extends BaseEntity {
  workspaceId: ID;
  endpointId: ID;
  type: WebhookEventType;
  payload: Record<string, JSONValue>;
  status: WebhookDeliveryStatus;
  attempts: number;
  nextRetryAt: Timestamp | null;
  deliveredAt: Timestamp | null;
  responseCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
}

// ── Compliance ────────────────────────────────────────────────────────────────

export interface ConsentRecord extends BaseEntity {
  workspaceId: ID;
  contactId: ID;
  channel: ConsentChannel;
  status: ConsentStatus;
  consentedAt: Timestamp | null;
  revokedAt: Timestamp | null;
  ipAddress: string | null;
  userAgent: string | null;
  source: string | null;
}

export interface OptOutRecord extends BaseEntity {
  workspaceId: ID;
  contactId: ID;
  channel: MessageChannel;
  reason: string | null;
  optedOutAt: Timestamp;
  ipAddress: string | null;
}

export interface AuditLog extends BaseEntity {
  workspaceId: ID;
  userId: ID | null;
  action: AuditAction;
  resource: string;
  resourceId: string | null;
  changes: Record<string, JSONValue> | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, JSONValue>;
}

// ── API Response Types ────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ── Auth Types ────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface JwtPayload {
  sub: ID;
  email: string;
  workspaceId: ID | null;
  role: UserRole | null;
  iat: number;
  exp: number;
  jti: string;
}

export interface RequestContext {
  userId: ID;
  workspaceId: ID;
  role: UserRole;
  apiKeyId?: ID;
  requestId: string;
}

// ── Plan Limits ───────────────────────────────────────────────────────────────

export interface PlanLimits {
  monthlyMessages: number;
  contacts: number;
  campaigns: number;
  templates: number;
  apiKeys: number;
  teamMembers: number;
  webhookEndpoints: number;
  channels: MessageChannel[];
}

export const PLAN_LIMITS: Record<WorkspacePlan, PlanLimits> = {
  [WorkspacePlan.FREE]: {
    monthlyMessages: 500,
    contacts: 250,
    campaigns: 3,
    templates: 5,
    apiKeys: 2,
    teamMembers: 1,
    webhookEndpoints: 1,
    channels: [MessageChannel.EMAIL],
  },
  [WorkspacePlan.STARTER]: {
    monthlyMessages: 10_000,
    contacts: 5_000,
    campaigns: 20,
    templates: 50,
    apiKeys: 5,
    teamMembers: 3,
    webhookEndpoints: 5,
    channels: [MessageChannel.EMAIL, MessageChannel.SMS],
  },
  [WorkspacePlan.GROWTH]: {
    monthlyMessages: 100_000,
    contacts: 50_000,
    campaigns: 200,
    templates: 500,
    apiKeys: 20,
    teamMembers: 10,
    webhookEndpoints: 20,
    channels: [
      MessageChannel.EMAIL,
      MessageChannel.SMS,
      MessageChannel.WHATSAPP,
      MessageChannel.TELEGRAM,
    ],
  },
  [WorkspacePlan.SCALE]: {
    monthlyMessages: 1_000_000,
    contacts: 500_000,
    campaigns: -1, // unlimited
    templates: -1,
    apiKeys: 100,
    teamMembers: 50,
    webhookEndpoints: 100,
    channels: [
      MessageChannel.EMAIL,
      MessageChannel.SMS,
      MessageChannel.WHATSAPP,
      MessageChannel.TELEGRAM,
    ],
  },
  [WorkspacePlan.ENTERPRISE]: {
    monthlyMessages: -1,
    contacts: -1,
    campaigns: -1,
    templates: -1,
    apiKeys: -1,
    teamMembers: -1,
    webhookEndpoints: -1,
    channels: [
      MessageChannel.EMAIL,
      MessageChannel.SMS,
      MessageChannel.WHATSAPP,
      MessageChannel.TELEGRAM,
    ],
  },
};
