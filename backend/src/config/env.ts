/**
 * Environment configuration, validated once at startup. `APP_ENV` decides which provider
 * credentials are required: staging/production refuse to start without them, development runs
 * with fallbacks (log mailer, disabled uploads/Google) and prints warnings instead.
 */
import { z } from 'zod';

import { deployedSecretIssues, isPlaceholderSecret, parseTrustProxy, type TrustProxy } from './env-hardening.js';

const APP_ENVS = ['development', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const booleanString = (defaultValue: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((value) => (value === undefined ? defaultValue : value === 'true' || value === '1'));

const csv = optionalString.transform((value) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [],
);

const rawEnvSchema = z.object({
  APP_ENV: z.enum(APP_ENVS, { error: `APP_ENV must be one of ${APP_ENVS.join(', ')}` }),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  PUBLIC_API_URL: z.url().optional(),
  CORS_ORIGINS: csv,
  TRUST_PROXY: optionalString,
  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  MONGODB_URI: z.string({ error: 'MONGODB_URI is required' }).min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: optionalString,
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(500).default(20),
  REDIS_URL: z.string({ error: 'REDIS_URL is required' }).min(1, 'REDIS_URL is required'),
  JWT_ACCESS_SECRET: z
    .string({ error: 'JWT_ACCESS_SECRET is required' })
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  /** Defaults include APP_ENV, so a secret shared by mistake cannot replay staging tokens in production. */
  JWT_ISSUER: optionalString,
  JWT_AUDIENCE: optionalString,
  GOOGLE_WEB_CLIENT_ID: optionalString,
  GOOGLE_IOS_CLIENT_ID: optionalString,
  GOOGLE_ANDROID_CLIENT_ID: optionalString,
  CLOUDINARY_URL: optionalString,
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(465),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  EXPO_ACCESS_TOKEN: optionalString,
  GEOCODER_URL: z.url().default('https://nominatim.openstreetmap.org'),
  GEOCODER_EMAIL: optionalString,
  GEOCODER_USER_AGENT: optionalString,
  GEOCODER_COUNTRY_CODES: z.string().default('il'),
  /** Spacing of provider calls across instances: Nominatim's public API allows 1/s; a hosted plan may allow less (or 0). */
  GEOCODER_MIN_INTERVAL_MS: z.coerce.number().int().min(0).max(60_000).default(1000),
  CRON_ENABLED: booleanString(true),
  CRON_DISABLED_JOBS: csv,
  RATE_LIMIT_ENABLED: booleanString(true),
  PASSWORD_BREACH_CHECK: booleanString(true),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(10_000),
  /** Window in which explorer refresh events to one professional are merged (0 = send each at once). */
  EXPLORER_EVENT_WINDOW_MS: z.coerce.number().int().min(0).max(10_000).default(2000),
});
type RawEnv = z.output<typeof rawEnvSchema>;

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface Env {
  appEnv: AppEnv;
  port: number;
  publicApiUrl: string;
  /** `'*'` allows every origin (development only). */
  corsOrigins: string[] | '*';
  trustProxy: TrustProxy;
  logLevel: (typeof LOG_LEVELS)[number];
  mongo: { uri: string; dbName: string | undefined; maxPoolSize: number };
  redis: { url: string };
  jwt: { accessSecret: string; issuer: string; audience: string };
  /** Accepted `aud` values of Google id tokens; empty = Google sign-in not configured. */
  googleClientIds: string[];
  /** The same ids per app platform (`null` = that app's Google sign-in is refused with 401). */
  googleClients: Record<GooglePlatform, string | null>;
  cloudinary: CloudinaryConfig | null;
  mail: { from: string; resendApiKey: string | null; smtp: SmtpConfig | null };
  expoAccessToken: string | null;
  geocoder: { url: string; email: string | null; userAgent: string; countryCodes: string; minIntervalMs: number };
  cron: { enabled: boolean; disabledJobs: string[] };
  rateLimit: { enabled: boolean };
  /** Reject new passwords found in data breaches (Pwned Passwords range API). */
  passwordBreachCheck: boolean;
  shutdownTimeoutMs: number;
  realtime: { explorerEventWindowMs: number };
}

export type GooglePlatform = 'web' | 'ios' | 'android';

export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'EnvError';
  }
}

function parseCloudinary(raw: RawEnv): CloudinaryConfig | null {
  if (raw.CLOUDINARY_URL) {
    // cloudinary://<api_key>:<api_secret>@<cloud_name>
    const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(raw.CLOUDINARY_URL);
    if (!match?.[1] || !match[2] || !match[3]) return null;
    return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
  }
  if (raw.CLOUDINARY_CLOUD_NAME && raw.CLOUDINARY_API_KEY && raw.CLOUDINARY_API_SECRET) {
    return { cloudName: raw.CLOUDINARY_CLOUD_NAME, apiKey: raw.CLOUDINARY_API_KEY, apiSecret: raw.CLOUDINARY_API_SECRET };
  }
  return null;
}

/** Credentials that staging/production must have (development falls back, see `envWarnings`). */
function missingForDeployedEnv(raw: RawEnv, cloudinary: CloudinaryConfig | null): string[] {
  const missing: string[] = [];
  if (!raw.PUBLIC_API_URL) missing.push('PUBLIC_API_URL');
  if (!raw.GOOGLE_WEB_CLIENT_ID) missing.push('GOOGLE_WEB_CLIENT_ID');
  if (!cloudinary) missing.push('CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)');
  if (!raw.RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!raw.EMAIL_FROM) missing.push('EMAIL_FROM');
  if (!raw.GEOCODER_EMAIL) missing.push('GEOCODER_EMAIL');
  if (!raw.GEOCODER_USER_AGENT) missing.push('GEOCODER_USER_AGENT');
  return missing.map((name) => `${name} is required when APP_ENV=${raw.APP_ENV}`);
}

/**
 * `.env` files write an unset variable as `NAME=` (see `.env.example`): a blank value means "not
 * set", so it falls back to the default instead of failing the variable's format.
 */
function withoutBlankValues(source: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1].trim() !== ''),
  );
}

/** Parses and validates `source` (default `process.env`); throws `EnvError` listing every problem. */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = rawEnvSchema.safeParse(withoutBlankValues(source));
  if (!result.success) {
    throw new EnvError(result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`));
  }
  const raw = result.data;
  const cloudinary = parseCloudinary(raw);
  if (raw.CLOUDINARY_URL && !cloudinary) throw new EnvError(['CLOUDINARY_URL must look like cloudinary://key:secret@cloud']);
  const deployed = raw.APP_ENV !== 'development';
  const trustProxy = parseTrustProxy(raw.TRUST_PROXY, deployed);
  const issues = [
    ...(deployed ? [...missingForDeployedEnv(raw, cloudinary), ...deployedSecretIssues(raw.JWT_ACCESS_SECRET)] : []),
    ...trustProxy.issues,
  ];
  if (issues.length > 0) throw new EnvError(issues);
  const smtp: SmtpConfig | null =
    raw.SMTP_USER && raw.SMTP_PASS ? { host: raw.SMTP_HOST, port: raw.SMTP_PORT, user: raw.SMTP_USER, pass: raw.SMTP_PASS } : null;

  return {
    appEnv: raw.APP_ENV,
    port: raw.PORT,
    publicApiUrl: (raw.PUBLIC_API_URL ?? `http://localhost:${raw.PORT}`).replace(/\/+$/, ''),
    corsOrigins: raw.CORS_ORIGINS.length > 0 ? raw.CORS_ORIGINS : deployed ? [] : '*',
    trustProxy: trustProxy.value,
    logLevel: raw.LOG_LEVEL ?? (deployed ? 'info' : 'debug'),
    mongo: { uri: raw.MONGODB_URI, dbName: raw.MONGODB_DB_NAME, maxPoolSize: raw.MONGODB_MAX_POOL_SIZE },
    redis: { url: raw.REDIS_URL },
    jwt: {
      accessSecret: raw.JWT_ACCESS_SECRET,
      issuer: raw.JWT_ISSUER ?? `professionals-api:${raw.APP_ENV}`,
      audience: raw.JWT_AUDIENCE ?? `professionals-app:${raw.APP_ENV}`,
    },
    googleClientIds: [raw.GOOGLE_WEB_CLIENT_ID, raw.GOOGLE_IOS_CLIENT_ID, raw.GOOGLE_ANDROID_CLIENT_ID].filter(
      (id): id is string => id !== undefined,
    ),
    googleClients: {
      web: raw.GOOGLE_WEB_CLIENT_ID ?? null,
      ios: raw.GOOGLE_IOS_CLIENT_ID ?? null,
      android: raw.GOOGLE_ANDROID_CLIENT_ID ?? null,
    },
    cloudinary,
    mail: {
      from: raw.EMAIL_FROM ?? (smtp ? `Professionals <${smtp.user}>` : 'Professionals <no-reply@localhost>'),
      // Development always uses SMTP (or the log fallback), even when a Resend key is present.
      resendApiKey: deployed ? (raw.RESEND_API_KEY ?? null) : null,
      smtp: deployed ? null : smtp,
    },
    expoAccessToken: raw.EXPO_ACCESS_TOKEN ?? null,
    geocoder: {
      url: raw.GEOCODER_URL.replace(/\/+$/, ''),
      email: raw.GEOCODER_EMAIL ?? null,
      userAgent: raw.GEOCODER_USER_AGENT ?? 'ProfessionalsAPI/1.0 (development)',
      countryCodes: raw.GEOCODER_COUNTRY_CODES,
      minIntervalMs: raw.GEOCODER_MIN_INTERVAL_MS,
    },
    cron: { enabled: raw.CRON_ENABLED, disabledJobs: raw.CRON_DISABLED_JOBS },
    rateLimit: { enabled: raw.RATE_LIMIT_ENABLED },
    passwordBreachCheck: raw.PASSWORD_BREACH_CHECK,
    shutdownTimeoutMs: raw.SHUTDOWN_TIMEOUT_MS,
    realtime: { explorerEventWindowMs: raw.EXPLORER_EVENT_WINDOW_MS },
  };
}

/**
 * Startup warnings. Development: features that run degraded because a credential is missing.
 * Staging/production: settings that start fine but break a client (the web app, a native app's
 * Google sign-in) in a way its users would only see as a generic error.
 */
export function envWarnings(env: Env): string[] {
  return env.appEnv === 'development' ? developmentWarnings(env) : deployedWarnings(env);
}

function developmentWarnings(env: Env): string[] {
  const warnings: string[] = [];
  if (isPlaceholderSecret(env.jwt.accessSecret)) warnings.push('JWT_ACCESS_SECRET is the example placeholder (refused in staging/production)');
  if (!env.mail.smtp) warnings.push('SMTP_USER/SMTP_PASS not set: emails are written to the log instead of being sent');
  if (!env.cloudinary) warnings.push('Cloudinary is not configured: POST /v1/uploads/images answers 503');
  if (env.googleClientIds.length === 0) warnings.push('Google client ids are not configured: Google sign-in answers 503');
  return warnings;
}

const NATIVE_GOOGLE_CLIENTS = [
  ['android', 'GOOGLE_ANDROID_CLIENT_ID', 'Android'],
  ['ios', 'GOOGLE_IOS_CLIENT_ID', 'iOS'],
] as const;

function deployedWarnings(env: Env): string[] {
  const warnings: string[] = [];
  if (Array.isArray(env.corsOrigins) && env.corsOrigins.length === 0) {
    warnings.push(
      'CORS_ORIGINS is empty: browsers may not call this API, so the web app cannot load or sign in (it reports "No connection"); set it to the web app\'s origin(s)',
    );
  }
  for (const [platform, variable, app] of NATIVE_GOOGLE_CLIENTS) {
    if (!env.googleClients[platform]) {
      warnings.push(`${variable} is not set: "Continue with Google" in the ${app} app is refused (401 INVALID_GOOGLE_TOKEN); set it if that app is shipped`);
    }
  }
  return warnings;
}
