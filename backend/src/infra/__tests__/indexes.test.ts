import mongoose from 'mongoose';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import { createTestDeps } from '../../../test/app.js';
import { ensureIndexes } from '../mongo.js';

interface IndexInfo {
  key: Record<string, unknown>;
  unique?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, unknown>;
}

async function indexesOf(collection: string): Promise<IndexInfo[]> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('not connected');
  const indexes: IndexInfo[] = await db.collection(collection).indexes();
  return indexes;
}

describe('declared indexes exist after ensureIndexes', () => {
  createTestDeps();

  it('creates every collection', async () => {
    const names = (await mongoose.connection.db?.listCollections().toArray())?.map((c) => c.name).sort();
    expect(names).toEqual(
      ['conversations', 'emailtokens', 'jobs', 'messages', 'notifications', 'offers', 'professionals', 'requests', 'reviews', 'sessions', 'users'],
    );
  });

  it('has the unique, partial, geo and TTL indexes the rules rely on', async () => {
    expect(await indexesOf('offers')).toContainEqual(
      expect.objectContaining({ key: { request: 1, professional: 1 }, unique: true, partialFilterExpression: { status: { $in: ['pending', 'accepted'] } } }),
    );
    expect(await indexesOf('jobs')).toContainEqual(expect.objectContaining({ key: { request: 1 }, unique: true }));
    expect(await indexesOf('reviews')).toContainEqual(expect.objectContaining({ key: { job: 1 }, unique: true }));
    expect(await indexesOf('messages')).toContainEqual(expect.objectContaining({ key: { conversation: 1, sender: 1, clientMessageId: 1 }, unique: true }));
    expect(await indexesOf('users')).toContainEqual(
      expect.objectContaining({ key: { googleSub: 1 }, unique: true, partialFilterExpression: { googleSub: { $exists: true } } }),
    );
    expect(await indexesOf('requests')).toContainEqual(expect.objectContaining({ key: { status: 1, categoryId: 1, publicPoint: '2dsphere' } }));
    // `$exists` so that the retry lookup of POST /requests can use it (see query-plans.test.ts).
    expect(await indexesOf('requests')).toContainEqual(
      expect.objectContaining({ key: { customer: 1, clientRequestId: 1 }, unique: true, partialFilterExpression: { clientRequestId: { $exists: true } } }),
    );
    expect(await indexesOf('professionals')).toContainEqual(
      expect.objectContaining({ key: { categoryIds: 1, 'serviceArea.radiusKm': 1, 'serviceArea.center': '2dsphere' } }),
    );
    // Public searches measure from the approximate center only.
    expect(await indexesOf('professionals')).toContainEqual(
      expect.objectContaining({ key: { categoryIds: 1, 'serviceArea.radiusKm': 1, 'serviceArea.publicCenter': '2dsphere' } }),
    );
    expect(await indexesOf('professionals')).toContainEqual(expect.objectContaining({ key: { 'serviceArea.publicCenter': '2dsphere', categoryIds: 1 } }));
    expect(await indexesOf('professionals')).not.toContainEqual(expect.objectContaining({ key: { 'serviceArea.center': '2dsphere', categoryIds: 1 } }));
    expect(await indexesOf('conversations')).toContainEqual(expect.objectContaining({ key: { 'participants.user': 1, 'participants.unreadCount': 1 } }));
    // Refresh tokens carry their session id: sessions are read by _id, no token-hash index.
    expect((await indexesOf('sessions')).map((index) => Object.keys(index.key).join())).toEqual(['_id', 'user,pushToken', 'pushToken', 'expiresAt']);
    // A push token belongs to one session; `$exists` so that equality and `$in` lookups can use it.
    expect(await indexesOf('sessions')).toContainEqual(
      expect.objectContaining({ key: { pushToken: 1 }, unique: true, partialFilterExpression: { pushToken: { $exists: true } } }),
    );
    expect(await indexesOf('sessions')).toContainEqual(expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }));
    expect(await indexesOf('emailtokens')).toContainEqual(expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }));
    expect(await indexesOf('notifications')).toContainEqual(expect.objectContaining({ key: { createdAt: 1 }, expireAfterSeconds: 90 * 24 * 3600 }));
  });

  it('never drops an index the code does not declare (rolling deploys); it only reports it', async () => {
    const db = mongoose.connection.db;
    if (!db) throw new Error('not connected');
    await db.collection('reviews').createIndex({ rating: 1 }, { name: 'from_another_release' });
    const lines: string[] = [];
    await ensureIndexes(pino({ level: 'warn' }, { write: (line: string) => void lines.push(line) }));
    expect(await indexesOf('reviews')).toContainEqual(expect.objectContaining({ key: { rating: 1 } }));
    expect(lines.some((line) => line.includes('stale indexes') && line.includes('from_another_release'))).toBe(true);
    await db.collection('reviews').dropIndex('from_another_release');
  });
});
