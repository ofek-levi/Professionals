/**
 * Writes everything stored about one account to a JSON file, for an access request (Privacy
 * Protection Law s.13; `account-export.service.ts`). See OPERATIONS.md §9: check where the request
 * came from first, and send the file only to the account's address. The file is created readable by
 * its owner only, and an existing file is never overwritten.
 *
 *   npm run export-account -- noa@example.com                          (reads .env; writes ./account-export-<id>.json)
 *   node dist/export-account.js noa@example.com /tmp/noa-export.json   (in the image; then `docker cp` it out)
 */
import { writeFile } from 'node:fs/promises';

import { exportAccount } from './modules/users/account-export.service.js';
import { commandLine, runOperatorCommand } from './operator-command.js';

const USAGE = 'export-account <sign-in email or user id> [output file]';

const [account = '', output] = commandLine(USAGE, { required: 1, optional: 1 }).args;

runOperatorCommand('export-account', async (deps) => {
  const exported = await exportAccount(account, deps.clock.now());
  if (!exported) {
    process.stderr.write(`No account ${account} (or it was deleted).\n`);
    return 1;
  }
  const file = output ?? `account-export-${exported.account._id.toHexString()}.json`;
  await writeFile(file, `${JSON.stringify(exported, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  const counts = (['requests', 'offers', 'jobs', 'reviews', 'messages', 'notifications', 'images'] as const)
    .map((list) => `${exported[list].length} ${list}`)
    .join(', ');
  process.stdout.write(`Wrote the ${exported.account.role} account ${exported.account._id.toHexString()} to ${file} (${counts}).\n`);
  return 0;
});
