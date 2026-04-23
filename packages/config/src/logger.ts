import pino, { type Logger, type LoggerOptions } from 'pino';

/**
 * Shared structured logger for server contexts (route handlers, server
 * actions, Inngest functions). Client code should keep using `console`
 * and let Sentry / PostHog catch what matters.
 *
 * Conventions:
 * - Log JSON in production (pino default) so Vercel / log-aggregators
 *   can parse. Pretty-print in dev.
 * - Never log secrets. `redact` enforces this at the library level for
 *   common field names.
 * - Include `ctx` objects (workspaceId, userId, route) — never embed
 *   them in the message string.
 */
const isDev = process.env.NODE_ENV !== 'production';

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  base: {
    app: 'phloz',
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    region: process.env.VERCEL_REGION ?? null,
  },
  // Redact common secret-bearing fields before they hit the transport.
  redact: {
    paths: [
      'password',
      '*.password',
      'token',
      '*.token',
      'authorization',
      'headers.authorization',
      'headers.cookie',
      '*.apiKey',
      '*.api_key',
      '*.stripeSecretKey',
      '*.supabaseServiceRoleKey',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Pretty-print in dev only — requires pino-pretty, which we don't
  // install as a hard dep. When absent pino falls back to JSON.
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      }
    : {}),
};

let _logger: Logger | null = null;

/**
 * Get (or lazily create) the singleton logger. Callers can `child()` it
 * to add per-request context without mutating the root.
 */
export function getLogger(): Logger {
  if (!_logger) {
    try {
      _logger = pino(baseOptions);
    } catch {
      // Falls through when `pino-pretty` isn't installed in production
      // builds — retry without the transport.
      _logger = pino({ ...baseOptions, transport: undefined });
    }
  }
  return _logger;
}

/** Convenience — create a child logger with request-scoped context. */
export function requestLogger(ctx: {
  requestId?: string;
  route?: string;
  userId?: string;
  workspaceId?: string;
}): Logger {
  return getLogger().child(ctx);
}
