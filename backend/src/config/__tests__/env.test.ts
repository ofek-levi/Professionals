import { describe, expect, it } from 'vitest';

import { EnvError, envWarnings, parseEnv } from '../env.js';

const BASE = {
  MONGODB_URI: 'mongodb://localhost:27017/pro',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

const DEPLOYED = {
  ...BASE,
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

  it('rejects a malformed CLOUDINARY_URL', () => {
    expect(errorOf({ ...DEPLOYED, APP_ENV: 'staging', CLOUDINARY_URL: 'https://nope' }).issues.join()).toContain('CLOUDINARY_URL');
  });
});
