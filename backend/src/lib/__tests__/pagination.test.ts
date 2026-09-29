import { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../test/app.js';
import { createCustomer } from '../../../test/factories.js';
import { NotificationModel, type NotificationDoc } from '../../modules/notifications/notification.model.js';
import { ApiError } from '../errors.js';
import { decodeCursor, encodeCursor, findPage, paginationQuerySchema, type SortSpec } from '../pagination.js';
import { parseInput } from '../validate.js';

const NEWEST_FIRST: SortSpec = [
  { path: 'createdAt', direction: -1 },
  { path: '_id', direction: -1 },
];

describe('pagination query', () => {
  it('defaults to 20 and accepts up to 100 (the app map asks for 100)', () => {
    expect(parseInput(paginationQuerySchema, {})).toEqual({ limit: 20 });
    expect(parseInput(paginationQuerySchema, { limit: '100', cursor: 'abc' })).toEqual({ limit: 100, cursor: 'abc' });
  });

  it.each(['0', '101', '2.5', 'ten'])('rejects limit=%s', (limit) => {
    expect(() => parseInput(paginationQuerySchema, { limit })).toThrow(ApiError);
  });
});

describe('cursors', () => {
  it('round-trip dates, ObjectIds, numbers and strings', () => {
    const id = new Types.ObjectId();
    const date = new Date('2026-10-01T10:00:00.000Z');
    const spec: SortSpec = [
      { path: 'a', direction: 1 },
      { path: 'b', direction: -1 },
      { path: 'c', direction: 1 },
      { path: '_id', direction: 1 },
    ];
    expect(decodeCursor(encodeCursor([date, 4.5, 'x', id]), spec)).toEqual([date, 4.5, 'x', id]);
  });

  it('reject tampered cursors with fieldErrors.cursor', () => {
    for (const cursor of ['%%%', Buffer.from('{"a":1}').toString('base64url'), encodeCursor(['only-one'])]) {
      try {
        decodeCursor(cursor, NEWEST_FIRST);
        throw new Error('expected failure');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).fieldErrors).toEqual({ cursor: ['validation:invalid'] });
      }
    }
  });
});

describe('findPage (keyset)', () => {
  const { deps } = createTestApp();
  beforeEach(clearDatabase);

  async function insert(user: Types.ObjectId, label: string, at: string): Promise<void> {
    deps.clock.set(at);
    await NotificationModel.create({ user, type: 'new_message', params: { messagePreview: label }, target: { kind: 'none' } });
  }

  const labels = (items: NotificationDoc[]) => items.map((item) => item.params.messagePreview);

  it('pages newest first, stable when new items arrive, with ties broken by _id', async () => {
    const user = await createCustomer();
    const other = await createCustomer();
    await insert(user._id, 'a', '2026-10-01T10:00:00Z');
    await insert(user._id, 'b', '2026-10-01T10:01:00Z');
    await insert(user._id, 'c', '2026-10-01T10:01:00Z'); // same time as b
    await insert(user._id, 'd', '2026-10-01T10:02:00Z');
    await insert(other._id, 'x', '2026-10-01T10:03:00Z');

    const filter = { user: user._id };
    const first = await findPage(NotificationModel, { filter, sort: NEWEST_FIRST, page: { cursor: undefined, limit: 2 } });
    expect(labels(first.items)).toEqual(['d', 'c']);
    expect(first.totalCount).toBe(4);
    expect(first.nextCursor).not.toBeNull();

    await insert(user._id, 'e', '2026-10-01T10:05:00Z'); // arrives while the client pages

    const second = await findPage(NotificationModel, { filter, sort: NEWEST_FIRST, page: { cursor: first.nextCursor ?? undefined, limit: 2 } });
    expect(labels(second.items)).toEqual(['b', 'a']);
    expect(second.nextCursor).toBeNull();
    expect(second.totalCount).toBe(5);
  });
});
