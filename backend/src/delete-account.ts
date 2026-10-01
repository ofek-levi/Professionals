/**
 * Deletes an account from the command line exactly as `POST /me/deletion` does (same transaction,
 * notifications and confirmation email). See OPERATIONS.md §9. It asks for no password, so check
 * where the request came from first. The confirmation email says who asked:
 * - a deletion request emailed by the holder and confirmed from the account's address (the
 *   default, `--via-email`): "As you asked by email, …";
 * - closing the account under the Terms (`--closure`): only that the account was deleted;
 * - deleting again after restoring an older backup, by the id of an `account deleted` log line
 *   (`--no-email`): no email, the holder was told the first time.
 *
 *   npm run delete-account -- noa@example.com                 (reads .env)
 *   node dist/delete-account.js noa@example.com --closure     (in the image, with the environment's variables)
 *   node dist/delete-account.js 66f0c2a1b4e5d6f708192a3b --no-email
 */
import { deleteAccountOf, type DeletionOrigin } from './modules/users/account-deletion.service.js';
import { commandLine, runOperatorCommand, usageError } from './operator-command.js';

const USAGE = 'delete-account <sign-in email or user id> [--via-email | --closure] [--no-email]';

const { args, flags } = commandLine(USAGE, { required: 1, flags: ['via-email', 'closure', 'no-email'] });
if (flags.has('via-email') && flags.has('closure')) usageError(USAGE, '--via-email and --closure exclude each other.');
const [account = ''] = args;
const via: DeletionOrigin = flags.has('closure') ? 'operator' : 'email';
const sendEmail = !flags.has('no-email');

runOperatorCommand('delete-account', async (deps) => {
  const deleted = await deleteAccountOf(deps, account, { via, sendEmail });
  if (!deleted) {
    process.stderr.write(`No account ${account} (or it was deleted already).\n`);
    return 1;
  }
  // The confirmation email, image deletions and realtime fan-out run in the background.
  await deps.background.drain();
  const email = sendEmail ? `confirmation email sent (${via === 'email' ? 'deleted at their emailed request' : 'account closed'}; a failure is logged)` : 'no email sent';
  process.stdout.write(`Deleted the ${deleted.role} account ${deleted._id.toHexString()}; ${email}.\n`);
  return 0;
});
