/**
 * MongoDB's profiler on this test file's database: records every operation an action runs, with its
 * plan summary and how many index keys and documents it examined. Query-plan tests use it on the real
 * endpoints, so they check the queries the services actually build.
 */
import mongoose from 'mongoose';

export interface ProfiledOp {
  op: string;
  ns: string;
  command: Record<string, unknown>;
  planSummary?: string;
  keysExamined?: number;
  docsExamined?: number;
  /** Present (true) when the plan sorted in memory. */
  hasSortStage?: boolean;
  /** The executed plan (index names, per-stage counts). */
  execStats?: Record<string, unknown>;
}

function database() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('not connected');
  return db;
}

/** Runs `action` with the profiler on and returns every operation it ran on this database. */
export async function profiled(action: () => Promise<unknown>): Promise<ProfiledOp[]> {
  const db = database();
  await db.command({ profile: 0 });
  await db
    .collection('system.profile')
    .drop()
    .catch(() => undefined);
  await db.command({ profile: 2 });
  try {
    await action();
  } finally {
    await db.command({ profile: 0 });
  }
  const ops = (await db.collection('system.profile').find({}).toArray()) as unknown as ProfiledOp[];
  return ops.filter((op) => !op.ns.endsWith('.system.profile') && !op.ns.endsWith('.$cmd'));
}

/** The operations of `ops` on `collection`, optionally only of one kind (`query`, `update`, …). */
export function on(ops: ProfiledOp[], collection: string, kind?: string): ProfiledOp[] {
  return ops.filter((op) => op.ns.endsWith(`.${collection}`) && (kind === undefined || op.op === kind));
}
