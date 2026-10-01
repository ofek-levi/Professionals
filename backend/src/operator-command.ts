/**
 * The frame of the operator commands (`delete-account.ts`, `remove-review.ts`, `export-account.ts`,
 * `change-email.ts`, `list-user-emails.ts`; OPERATIONS.md §9): run from a machine with the
 * environment's variables (`npm run <command> -- …` reads `.env`; `node dist/<command>.js …` in the
 * image), each reaches MongoDB, Redis and the providers as the server does. Exit codes: 0 done,
 * 1 failed or nothing to act on, 2 wrong usage.
 */
import './models.js';

import { parseArgs } from 'node:util';

import { EnvError, parseEnv } from './config/env.js';
import { createDeps, type AppDeps } from './deps.js';
import { connectMongo, disconnectMongo } from './infra/mongo.js';
import { closeRedis, createRedis } from './infra/redis.js';
import { createLogger } from './lib/logger.js';

function parsedArgs(usage: string, flags: readonly string[]) {
  const options = Object.fromEntries(flags.map((flag) => [flag, { type: 'boolean' as const }]));
  try {
    return parseArgs({ args: process.argv.slice(2), options, allowPositionals: true });
  } catch {
    return usageError(usage);
  }
}

/**
 * The command line: `required` (non-empty) then up to `optional` positionals, and boolean `--flags`.
 * Anything else prints the usage and exits 2.
 */
export function commandLine(
  usage: string,
  shape: { required: number; optional?: number; flags?: readonly string[] },
): { args: string[]; flags: Set<string> } {
  const parsed = parsedArgs(usage, shape.flags ?? []);
  const args = parsed.positionals.map((arg) => arg.trim());
  const fits = args.length >= shape.required && args.length <= shape.required + (shape.optional ?? 0) && args.every(Boolean);
  if (!fits) usageError(usage);
  return { args, flags: new Set(Object.keys(parsed.values)) };
}

export function usageError(usage: string, problem?: string): never {
  process.stderr.write(`${problem ? `${problem}\n` : ''}Usage: ${usage}\n`);
  process.exit(2);
}

/**
 * Runs `work` with the providers and exits with its code once the background work it started
 * (emails, image deletions, realtime events) has finished; an error exits 1.
 */
export function runOperatorCommand(name: string, work: (deps: AppDeps) => Promise<number>): void {
  withDeps(name, work).then(
    (code) => process.exit(code),
    (error: unknown) => {
      process.stderr.write(`${error instanceof EnvError ? error.message : String(error instanceof Error ? (error.stack ?? error) : error)}\n`);
      process.exit(1);
    },
  );
}

async function withDeps(name: string, work: (deps: AppDeps) => Promise<number>): Promise<number> {
  const env = parseEnv();
  const logger = createLogger({ level: env.logLevel, pretty: false });
  await connectMongo(env.mongo);
  const redis = createRedis(env.redis.url, `${name}-${env.appEnv}`);
  try {
    const deps = createDeps({ env, logger, redis });
    const code = await work(deps);
    await deps.background.drain();
    return code;
  } finally {
    await disconnectMongo();
    await closeRedis(redis);
  }
}
