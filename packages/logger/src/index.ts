import pino, { type Logger, type LoggerOptions } from "pino";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

export interface LoggerConfig {
  level?: LogLevel;
  name?: string;
  pretty?: boolean;
  redact?: string[];
  base?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default redaction paths (never log these values)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_REDACT_PATHS = [
  "password",
  "passwordHash",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "authorization",
  "req.headers.authorization",
  "req.headers.cookie",
  "body.password",
  "body.currentPassword",
  "body.newPassword",
  "*.passwordHash",
  "*.totpSecret",
  "*.credentials",
  "*.stripeSecretKey",
];

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createLogger(config: LoggerConfig = {}): Logger {
  const {
    level = (process.env["LOG_LEVEL"] as LogLevel | undefined) ?? "info",
    name,
    pretty = process.env["NODE_ENV"] !== "production",
    redact = [],
    base = {},
  } = config;

  const options: LoggerOptions = {
    level,
    name,
    base: {
      env: process.env["NODE_ENV"] ?? "development",
      ...base,
    },
    redact: {
      paths: [...DEFAULT_REDACT_PATHS, ...redact],
      censor: "[REDACTED]",
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (pretty) {
    return pino(
      options,
      pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
          ignore: "pid,hostname",
          singleLine: false,
          messageFormat: "{name} | {msg}",
        },
      }),
    );
  }

  return pino(options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Default singleton logger
// ─────────────────────────────────────────────────────────────────────────────

export const logger = createLogger({ name: "relayflow" });

// ─────────────────────────────────────────────────────────────────────────────
// Child logger factory (for per-request or per-module loggers)
// ─────────────────────────────────────────────────────────────────────────────

export function createChildLogger(
  parent: Logger,
  bindings: Record<string, unknown>,
): Logger {
  return parent.child(bindings);
}

// ─────────────────────────────────────────────────────────────────────────────
// Request logger helper
// ─────────────────────────────────────────────────────────────────────────────

export interface RequestLogBindings {
  requestId: string;
  userId?: string;
  workspaceId?: string;
  method?: string;
  url?: string;
  ip?: string;
}

export function createRequestLogger(
  parent: Logger,
  bindings: RequestLogBindings,
): Logger {
  return parent.child({ ...bindings, module: "request" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────────────────────

export type { Logger };
export { pino };
