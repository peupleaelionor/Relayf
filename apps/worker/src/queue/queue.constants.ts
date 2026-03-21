export const QUEUE_NAMES = {
  CAMPAIGNS: 'campaigns',
  MESSAGES: 'messages',
  WEBHOOKS: 'webhooks',
  USAGE: 'usage',
} as const;

export const CAMPAIGN_JOBS = {
  DISPATCH: 'campaign:dispatch',
} as const;

export const MESSAGE_JOBS = {
  SCHEDULED: 'message:scheduled',
  RETRY: 'message:retry',
} as const;

export const WEBHOOK_JOBS = {
  DELIVER: 'webhook:deliver',
} as const;

export const USAGE_JOBS = {
  AGGREGATE: 'usage:aggregate',
} as const;

export const RATE_LIMIT = {
  /** Default workspace-level messages per minute */
  WORKSPACE_RPM: 300,
  /** Redis key prefix for workspace rate limiter */
  WORKSPACE_KEY_PREFIX: 'ratelimit:workspace:',
  /** Redis key prefix for campaign-level throttle */
  CAMPAIGN_KEY_PREFIX: 'ratelimit:campaign:',
  /** Window in ms for sliding-window rate limiter */
  WINDOW_MS: 60_000,
} as const;

export const IDEMPOTENCY = {
  /** Lock TTL in seconds – max time a campaign job may hold a lock */
  CAMPAIGN_LOCK_TTL: 7200,
  /** Prefix for campaign processing locks */
  CAMPAIGN_LOCK_PREFIX: 'lock:campaign:',
  /** Prefix for message processing locks */
  MESSAGE_LOCK_PREFIX: 'lock:message:',
} as const;

export const RETRY = {
  MAX_MESSAGE_ATTEMPTS: 5,
} as const;

export const USAGE_CRON = '0 * * * *';
