import { describe, expect, it } from 'vitest';

import { EnvError, envWarnings, parseEnv } from '../env.js';

const BASE = {
  MONGODB_URI: 'mongodb://localhost:27017/pro',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

/** `openssl rand -base64 48` */
const STRONG_SECRET = 'q3N1v8Jx0bXo2kqk6H1ZrR6dF0w9Pj4sYt7uLm2cVb5nA8eGi3oKp6sTz1xWy4Q9';

const DEPLOYED = {
  ...BASE,
  JWT_ACCESS_SECRET: STRONG_SECRET,
  TRUST_PROXY: '1',
  PUBLIC_API_URL: 'https://api.example.com/',
  GOOGLE_WEB_CLIENT_ID: 'web',
  GOOGLE_IOS_CLIENT_ID: 'ios',
  CLOUDINARY_URL: 'cloudinary://key:secret@cloud',
  RESEND_API_KEY: 're_123',
  EMAIL_FROM: 'Professionals <no-reply@example.com>',
  GEOCODER_EMAIL: 'ops@example.com',
  GEOCODER_USER_AGENT: 'ProfessionalsAPI/1.0 (ops@example.com)',
  CORS_ORIGINS: 'https://app.example.com, https://admin.example.com',
};

function errorOf(source: Record<string, string>): EnvError {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error;
    throw error;
  }
  throw new Error('expected parseEnv to throw');
}

describe('parseEnv', () => {
  it('refuses a missing or unknown APP_ENV', () => {
    expect(errorOf(BASE).issues.join()).toContain('APP_ENV must be one of development, staging, production');
    expect(errorOf({ ...BASE, APP_ENV: 'test' }).issues.join()).toContain('APP_ENV');
  });

  it('lists every invalid variable', () => {
    const error = errorOf({ APP_ENV: 'development', MONGODB_URI: '', REDIS_URL: 'redis://x', JWT_ACCESS_SECRET: 'short' });
    expect(error.issues).toEqual(
      expect.arrayContaining([expect.stringContaining('MONGODB_URI'), expect.stringContaining('JWT_ACCESS_SECRET must be at least 32 characters')]),
    );
  });

  it('runs development without provider credentials, with warnings', () => {
    const env = parseEnv({ ...BASE, APP_ENV: 'development' });
    expect(env).toMatchObject({
      appEnv: 'development',
      port: 4000,
      publicApiUrl: 'http://localhost:4000',
      corsOrigins: '*',
      trustProxy: false,
      cloudinary: null,
      googleClientIds: [],
      mail: { resendApiKey: null, smtp: null },
      cron: { enabled: true, disabledJobs: [] },
    });
    expect(envWarnings(env)).toHaveLength(3);
  });

  it('uses Gmail SMTP in development even when a Resend key is present', () => {
    const env = parseEnv({ ...BASE, APP_ENV: 'development', SMTP_USER: 'me@gmail.com', SMTP_PASS: 'app-password', RESEND_API_KEY: 're_1' });
    expect(env.mail).toEqual({
      from: 'Professionals <me@gmail.com>',
      resendApiKey: null,
      smtp: { host: 'smtp.gmail.com', port: 465, user: 'me@gmail.com', pass: 'app-password' },
    });
  });

  it('refuses to start staging/production without provider credentials', () => {
    const error = errorOf({ ...BASE, APP_ENV: 'production' });
    expect(error.issues).toEqual(
      expect.arrayContaining([
        'RESEND_API_KEY is required when APP_ENV=production',
        'GOOGLE_IOS_CLIENT_ID is required when APP_ENV=production',
        'CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) is required when APP_ENV=production',
      ]),
    );
  });

  it('parses a complete production configuration', () => {
    const env = parseEnv({ ...DEPLOYED, APP_ENV: 'production', TRUST_PROXY: '1', CRON_DISABLED_JOBS: 'push-receipts' });
    expect(env).toMatchObject({
      publicApiUrl: 'https://api.example.com',
      corsOrigins: ['https://app.example.com', 'https://admin.example.com'],
      trustProxy: 1,
      logLevel: 'info',
      googleClientIds: ['web', 'ios'],
      cloudinary: { cloudName: 'cloud', apiKey: 'key', apiSecret: 'secret' },
      mail: { resendApiKey: 're_123', smtp: null },
      cron: { enabled: true, disabledJobs: ['push-receipts'] },
    });
    expect(envWarnings(env)).toEqual([]);
  });

  it('refuses the example or a weak JWT secret when deployed, and warns about it in development', () => {
    const placeholder = 'change-me-to-a-long-random-secret-of-32-chars-or-more';
    expect(errorOf({ ...DEPLOYED, APP_ENV: 'production', JWT_ACCESS_SECRET: placeholder }).issues).toEqual([
      'JWT_ACCESS_SECRET is a placeholder: generate one with `openssl rand -base64 48`',
    ]);
    for (const weak of ['x'.repeat(64), 'abcdefgh'.repeat(6), 'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(2), 'short-but-32-characters-long-okk']) {
      expect(errorOf({ ...DEPLOYED, APP_ENV: 'staging', JWT_ACCESS_SECRET: weak }).issues.join()).toContain('too weak');
    }
    // Hex of 32 random bytes is fine.
    parseEnv({ ...DEPLOYED, APP_ENV: 'staging', JWT_ACCESS_SECRET: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' });
    expect(envWarnings(parseEnv({ ...BASE, APP_ENV: 'development', JWT_ACCESS_SECRET: placeholder }))).toContain(
      'JWT_ACCESS_SECRET is the example placeholder (refused in staging/production)',
    );
  });

  it('scopes token issuer and audience to the environment by default', () => {
    expect(parseEnv({ ...DEPLOYED, APP_ENV: 'staging' }).jwt).toMatchObject({ issuer: 'professionals-api:staging', audience: 'professionals-app:staging' });
    expect(parseEnv({ ...DEPLOYED, APP_ENV: 'production', JWT_AUDIENCE: 'app' }).jwt.audience).toBe('app');
  });

  it('requires an explicit TRUST_PROXY when deployed and refuses `true` there', () => {
    const { TRUST_PROXY: _unset, ...withoutProxy } = DEPLOYED;
    expect(errorOf({ ...withoutProxy, APP_ENV: 'production' }).issues.join()).toContain('TRUST_PROXY is required');
    expect(errorOf({ ...DEPLOYED, APP_ENV: 'production', TRUST_PROXY: 'true' }).issues.join()).toContain('spoof');
    expect(errorOf({ ...DEPLOYED, APP_ENV: 'staging', TRUST_PROXY: '10.0.0.0/8, bogus' }).issues.join()).toContain('bogus');
    expect(errorOf({ ...DEPLOYED, APP_ENV: 'staging', TRUST_PROXY: '10.0.0.0/33' }).issues.join()).toContain('10.0.0.0/33');
    expect(parseEnv({ ...DEPLOYED, APP_ENV: 'production', TRUST_PROXY: '10.0.0.0/8, 2001:db8::/32, loopback' }).trustProxy).toEqual([
      '10.0.0.0/8',
      '2001:db8::/32',
      'loopback',
    ]);
    expect(parseEnv({ ...DEPLOYED, APP_ENV: 'production', TRUST_PROXY: 'false' }).trustProxy).toBe(false);
    expect(parseEnv({ ...BASE, APP_ENV: 'development', TRUST_PROXY: 'true' }).trustProxy).toBe(true);
  });

  it('rejects a malformed CLOUDINARY_URL', () => {
    expect(errorOf({ ...DEPLOYED, APP_ENV: 'staging', CLOUDINARY_URL: 'https://nope' }).issues.join()).toContain('CLOUDINARY_URL');
  });
});
