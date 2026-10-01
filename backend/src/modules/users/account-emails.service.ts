/**
 * The address book for a notice to every user (a new version of the Terms of Use or the Privacy
 * Policy, at least 14 days before it takes effect: OPERATIONS.md §10; `src/list-user-emails.ts`):
 * one CSV line per account that is not deleted, with its language (write to each in it) and first
 * name, oldest account first.
 */
import { NOT_DELETED, UserModel, type UserDoc } from './user.model.js';

type Row = Pick<UserDoc, 'email' | 'language' | 'firstName' | 'role'>;

const COLUMNS = ['email', 'language', 'firstName', 'role'] as const satisfies readonly (keyof Row)[];

/** A CSV field, quoted when it holds a comma, a quote or a line break. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export async function activeAccountEmailsCsv(): Promise<{ csv: string; count: number }> {
  const rows = await UserModel.find(NOT_DELETED, { _id: 0, email: 1, language: 1, firstName: 1, role: 1 }).sort({ _id: 1 }).lean<Row[]>();
  const lines = [COLUMNS.join(','), ...rows.map((row) => COLUMNS.map((column) => csvField(row[column])).join(','))];
  return { csv: `${lines.join('\n')}\n`, count: rows.length };
}
