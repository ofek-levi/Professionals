/**
 * Changes the email address an account signs in with, on its holder's request
 * (`sign-in-email.service.ts`): the account must verify the new address (a link is sent to it), the
 * links sent to the old one stop working, sessions stay. See OPERATIONS.md §9: confirm the request
 * from the current address and the new one first.
 *
 *   npm run change-email -- noa@example.com noa.levi@example.org        (reads .env)
 *   node dist/change-email.js noa@example.com noa.levi@example.org      (in the image; or a user id first)
 */
import { changeSignInEmail } from './modules/users/sign-in-email.service.js';
import { commandLine, runOperatorCommand } from './operator-command.js';

const USAGE = 'change-email <current sign-in email or user id> <new email>';

const [current = '', next = ''] = commandLine(USAGE, { required: 2 }).args;

const REFUSED = {
  no_account: `No account ${current} (or it was deleted).`,
  invalid_email: `Not a valid email address: ${next}`,
  unchanged: `${current} already signs in with ${next}.`,
  email_taken: `Another account signs in with ${next}: nothing changed.`,
} as const;

runOperatorCommand('change-email', async (deps) => {
  const result = await changeSignInEmail(deps, current, next);
  if (result.status !== 'changed') {
    process.stderr.write(`${REFUSED[result.status]}\n`);
    return 1;
  }
  const notes = [
    'it is unverified until the link sent to the new address is opened',
    'its sessions stay signed in',
    ...(result.contactEmailChanged ? ['the professional contact email followed'] : []),
    ...(result.linkedToGoogle ? ['Google sign-in stays linked to the same Google account'] : []),
  ];
  process.stdout.write(`The ${result.role} account ${result.userId.toHexString()} now signs in with ${next.trim().toLowerCase()}: ${notes.join('; ')}.\n`);
  return 0;
});
