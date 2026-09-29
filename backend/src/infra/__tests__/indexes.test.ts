import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import { createTestDeps } from '../../../test/app.js';

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

describe('declared indexes exist after syncIndexes', () => {
  createTestDeps();

  it('creates every collection', async () => {
    const names = (await mongoose.connection.db?.listCollections().toArray())?.map((c) => c.name).sort();
    expect(names).toEqual(
      ['conversations', 'devices', 'emailtokens', 'jobs', 'messages', 'notifications', 'offers', 'professionals', 'requests', 'reviews', 'sessions', 'uploads', 'users'],
    );
  });

  it('has the unique, partial, geo and TTL indexes the rules rely on', async () => {
    expect(await indexesOf('offers')).toContainEqual(
      expect.objectContaining({ key: { request: 1, professional: 1 }, unique: true, partialFilterExpression: { status: { $in: ['pending', 'accepted'] } } }),
    );
    expect(await indexesOf('jobs')).toContainEqual(expect.objectContaining({ key: { request: 1 }, unique: true }));
    expect(await indexesOf('reviews')).toContainEqual(expect.objectContaining({ key: { job: 1 }, unique: true }));
    expect(await indexesOf('messages')).toContainEqual(expect.objectContaining({ key: { conversation: 1, sender: 1, clientMessageId: 1 }, unique: true }));
    expect(await indexesOf('users')).toContainEqual(expect.objectContaining({ key: { googleSub: 1 }, unique: true }));
    expect(await indexesOf('requests')).toContainEqual(expect.objectContaining({ key: { 'location.point': '2dsphere', status: 1, categoryId: 1 } }));
    expect(await indexesOf('professionals')).toContainEqual(expect.objectContaining({ key: { 'serviceArea.center': '2dsphere', categoryIds: 1 } }));
    expect(await indexesOf('sessions')).toContainEqual(expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }));
    expect(await indexesOf('emailtokens')).toContainEqual(expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }));
    expect(await indexesOf('notifications')).toContainEqual(expect.objectContaining({ key: { createdAt: 1 }, expireAfterSeconds: 90 * 24 * 3600 }));
  });
});
