import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestDeps } from '../../../test/app.js';
import { createCustomer } from '../../../test/factories.js';
import { newObjectId } from '../../lib/ids.js';
import { ConversationModel } from '../../modules/conversations/conversation.model.js';
import { ensureConversationForJob } from '../../modules/conversations/conversation-lifecycle.service.js';
import { UserModel } from '../../modules/users/user.model.js';
import { withTransaction } from '../mongo.js';

describe('withTransaction', () => {
  const deps = createTestDeps();
  beforeEach(clearDatabase);

  it('commits writes, then runs after-commit effects', async () => {
    const user = await createCustomer();
    const effects: string[] = [];
    const result = await withTransaction(deps.logger, async (tx) => {
      await UserModel.updateOne({ _id: user._id }, { $set: { firstName: 'Changed' } }, { session: tx.session });
      tx.afterCommit(() => {
        effects.push('published');
      });
      expect(effects).toEqual([]);
      return 'done';
    });
    expect(result).toBe('done');
    expect(effects).toEqual(['published']);
    expect((await UserModel.findById(user._id).lean())?.firstName).toBe('Changed');
  });

  it('rolls back and skips effects when the work throws', async () => {
    const user = await createCustomer();
    const effects: string[] = [];
    await expect(
      withTransaction(deps.logger, async (tx) => {
        await UserModel.updateOne({ _id: user._id }, { $set: { firstName: 'Changed' } }, { session: tx.session });
        tx.afterCommit(() => {
          effects.push('published');
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(effects).toEqual([]);
    expect((await UserModel.findById(user._id).lean())?.firstName).toBe(user.firstName);
  });

  it('ensureConversationForJob is idempotent and transactional', async () => {
    const input = { jobId: newObjectId(), requestId: newObjectId(), customerUserId: newObjectId(), professionalUserId: newObjectId(), now: deps.clock.now() };
    const first = await ensureConversationForJob(input);
    expect(await ensureConversationForJob(input)).toEqual(first);
    const conversation = await ConversationModel.findById(first).lean();
    expect(conversation).toMatchObject({ isOpen: true, lastMessage: null, lastActivityAt: input.now });
    expect(conversation?.participants.map((p) => [p.role, p.unreadCount])).toEqual([['customer', 0], ['professional', 0]]);

    const aborted = { ...input, jobId: newObjectId() };
    await expect(
      withTransaction(deps.logger, async (tx) => {
        await ensureConversationForJob(aborted, tx.session);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(await ConversationModel.countDocuments({ job: aborted.jobId })).toBe(0);
  });
});
