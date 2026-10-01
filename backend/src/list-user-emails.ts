/**
 * Writes the email address, language, first name and role of every account that is not deleted to
 * a CSV file (`account-emails.service.ts`), for the notice of a new version of the legal documents
 * (OPERATIONS.md §10). The file is created readable by its owner only, and an existing file is never
 * overwritten; delete it once the notice is sent.
 *
 *   npm run list-user-emails                                (reads .env; writes ./user-emails-<date>.csv)
 *   node dist/list-user-emails.js /tmp/user-emails.csv      (in the image; then `docker cp` it out)
 */
import { writeFile } from 'node:fs/promises';

import { activeAccountEmailsCsv } from './modules/users/account-emails.service.js';
import { commandLine, runOperatorCommand } from './operator-command.js';

const [output] = commandLine('list-user-emails [output file]', { required: 0, optional: 1 }).args;

runOperatorCommand('list-user-emails', async (deps) => {
  const { csv, count } = await activeAccountEmailsCsv();
  const file = output ?? `user-emails-${deps.clock.now().toISOString().slice(0, 10)}.csv`;
  await writeFile(file, csv, { mode: 0o600, flag: 'wx' });
  process.stdout.write(`Wrote ${count} accounts to ${file}.\n`);
  return 0;
});
