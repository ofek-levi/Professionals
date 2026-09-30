/**
 * Deletes an account from the command line exactly as `POST /me/deletion` does (same transaction,
 * notifications and confirmation email), for a deletion request emailed from the account's address
 * (the account-deletion page offers that to people who cannot use the app), or again after restoring
 * an older backup (by the id of an `account deleted` log line). See OPERATIONS.md §9. It asks for no
 * password, so check where the request came from first.
 *
 *   npm run delete-account -- noa@example.com      (reads .env)
 *   node dist/delete-account.js noa@example.com    (in the image, with the environment's variables; or a user id)
 */
import './models.js';
import { EnvError, parseEnv } from './config/env.js';
import { createDeps } from './deps.js';
import { connectMongo, disconnectMongo } from './infra/mongo.js';
import { closeRedis, createRedis } from './infra/redis.js';
import { createLogger } from './lib/logger.js';
import { deleteAccountOf } from './modules/users/account-deletion.service.js';

async function main(account: string): Promise<number> {
  const env = parseEnv();
  const logger = createLogger({ level: env.logLevel, pretty: false });
  await connectMongo(env.mongo);
  const redis = createRedis(env.redis.url, `delete-account-${env.appEnv}`);
  try {
    const deps = createDeps({ env, logger, redis });
    const deleted = await deleteAccountOf(deps, account);
    if (!deleted) {
      process.stderr.write(`No account ${account} (or it was deleted already).\n`);
      return 1;
    }
    // The confirmation email, image deletions and realtime fan-out run in the background.
    await deps.background.drain();
    process.stdout.write(`Deleted the ${deleted.role} account ${deleted._id.toHexString()}; confirmation email sent (a failure is logged).\n`);
    return 0;
  } finally {
    await disconnectMongo();
    await closeRedis(redis);
  }
}

const account = process.argv[2]?.trim();
if (!account) {
  process.stderr.write('Usage: delete-account <sign-in email or user id of the account>\n');
  process.exit(2);
}
main(account).then(
  (code) => process.exit(code),
  (error: unknown) => {
    process.stderr.write(`${error instanceof EnvError ? error.message : String(error instanceof Error ? (error.stack ?? error) : error)}\n`);
    process.exit(1);
  },
);
