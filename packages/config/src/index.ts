import * as dotenv from "dotenv";
import { z } from "zod";
import * as path from "path";

// Load .env from repo root (up to 4 levels)
for (const dir of [".", "..", "../..", "../../.."]) {
  dotenv.config({ path: path.resolve(process.cwd(), dir, ".env") });
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment schema
// ─────────────────────────────────────────────────────────────────────────────

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_DIRECT_URL: z.string().optional(),

  // Redis
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  REDIS_TOKEN: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_GROWTH_MONTHLY: z.string().optional(),
  STRIPE_PRICE_SCALE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_STARTER_YEARLY: z.string().optional(),
  STRIPE_PRICE_GROWTH_YEARLY: z.string().optional(),
  STRIPE_PRICE_SCALE_YEARLY: z.string().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_WHATSAPP_NUMBER: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("noreply@relayflow.io"),
  EMAIL_FROM_NAME: z.string().default("RelayFlow"),

  // S3 / R2
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o"),

  // Internal
  INTERNAL_API_SECRET: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().default(100),

  // CORS
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof EnvSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Parse and validate environment
// ─────────────────────────────────────────────────────────────────────────────

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.errors
      .map((e) => `  • ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
  return result.data;
}

export const env = parseEnv();

// ─────────────────────────────────────────────────────────────────────────────
// Derived config
// ─────────────────────────────────────────────────────────────────────────────

export const isDev = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";
export const isProd = env.NODE_ENV === "production";

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const stripePriceMap = {
  starter: {
    monthly: env.STRIPE_PRICE_STARTER_MONTHLY,
    yearly: env.STRIPE_PRICE_STARTER_YEARLY,
  },
  growth: {
    monthly: env.STRIPE_PRICE_GROWTH_MONTHLY,
    yearly: env.STRIPE_PRICE_GROWTH_YEARLY,
  },
  scale: {
    monthly: env.STRIPE_PRICE_SCALE_MONTHLY,
    yearly: env.STRIPE_PRICE_SCALE_YEARLY,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Template variable interpolation helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interpolates a template string with variable substitution.
 * Variables use {{variableName}} syntax.
 *
 * @example
 * interpolate("Hello {{firstName}}!", { firstName: "Alice" })
 * // => "Hello Alice!"
 */
export function interpolate(
  template: string,
  variables: Record<string, string | number | boolean | null | undefined>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const value = variables[key.trim()];
    if (value === null || value === undefined) return match;
    return String(value);
  });
}

/**
 * Extracts variable names from a template string.
 *
 * @example
 * extractVariables("Hello {{firstName}}, your code is {{code}}")
 * // => ["firstName", "code"]
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{([^}]+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]!.trim()))];
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug generation
// ─────────────────────────────────────────────────────────────────────────────

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginationOptions {
  page: number;
  perPage: number;
}

export interface PaginationResult {
  skip: number;
  take: number;
  page: number;
  perPage: number;
}

export function buildPagination(opts: PaginationOptions): PaginationResult {
  const page = Math.max(1, opts.page);
  const perPage = Math.min(100, Math.max(1, opts.perPage));
  return {
    skip: (page - 1) * perPage,
    take: perPage,
    page,
    perPage,
  };
}

export function buildPaginationMeta(
  total: number,
  opts: PaginationOptions,
) {
  const page = Math.max(1, opts.page);
  const perPage = Math.min(100, Math.max(1, opts.perPage));
  const totalPages = Math.ceil(total / perPage);
  return {
    page,
    perPage,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Misc utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if the given date is in the past. */
export function isExpired(date: Date): boolean {
  return date.getTime() < Date.now();
}

/** Adds `ms` milliseconds to the given date (or now). */
export function addMs(ms: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + ms);
}

/** Parses a duration string like "15m", "1h", "7d" into milliseconds. */
export function parseDurationMs(duration: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration);
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * multipliers[unit]!;
}

/** Masks a secret by showing only the first and last 4 chars. */
export function maskSecret(secret: string, visibleChars = 4): string {
  if (secret.length <= visibleChars * 2) return "*".repeat(secret.length);
  const start = secret.slice(0, visibleChars);
  const end = secret.slice(-visibleChars);
  const masked = "*".repeat(secret.length - visibleChars * 2);
  return `${start}${masked}${end}`;
}

/** Generates a short human-readable API key prefix (e.g. "rf_live_abc123"). */
export function buildApiKeyPrefix(env: "live" | "test" = "live"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `rf_${env}_${rand}`;
}

/** Deep-merges two plain objects. */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
): T {
  const result = { ...base };
  for (const key in override) {
    const baseVal = base[key];
    const overrideVal = override[key];
    if (
      overrideVal !== null &&
      typeof overrideVal === "object" &&
      !Array.isArray(overrideVal) &&
      typeof baseVal === "object" &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      ) as T[typeof key];
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal as T[typeof key];
    }
  }
  return result;
}
