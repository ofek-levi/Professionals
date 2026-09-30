import type { Conversation, Message } from '@/types/domain';

import {
  buildChatRows,
  getConversationPreview,
  getCounterpart,
  getLatestIncomingUnreadId,
  getListTimeKind,
  type ChatMessageRow,
  type ChatRow,
} from '../chat-model';

const ME = 'user-me';
const THEM = 'user-them';
const NOW = new Date(2026, 8, 27, 15, 0);

const at = (day: number, hours: number, minutes = 0) => new Date(2026, 8, day, hours, minutes).toISOString();

function message(id: string, senderId: string, createdAt: string, overrides: Partial<Message> = {}): Message {
  return { id, conversationId: 'cnv-1', senderId, text: `text ${id}`, createdAt, readAt: null, clientMessageId: null, ...overrides };
}

const notPending = () => false;
const messageRows = (rows: ChatRow[]) => rows.filter((row): row is ChatMessageRow => row.kind === 'message');

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'cnv-1',
    jobId: 'job-1',
    requestId: 'req-1',
    participants: [
      { userId: ME, role: 'customer', displayName: 'Noa Levi', avatarUrl: null },
      { userId: THEM, role: 'professional', displayName: 'BrightSpark', avatarUrl: null },
    ],
    lastMessage: null,
    unreadCount: 0,
    isOpen: true,
    createdAt: at(20, 10),
    updatedAt: at(20, 10),
    ...overrides,
  };
}

describe('conversation helpers', () => {
  it('finds the other participant', () => {
    expect(getCounterpart(conversation(), ME)?.displayName).toBe('BrightSpark');
    expect(getCounterpart(conversation(), THEM)?.displayName).toBe('Noa Levi');
  });

  it('builds the last message preview and flags own messages', () => {
    expect(getConversationPreview(conversation(), ME)).toBeNull();
    const withMine = conversation({ lastMessage: message('m1', ME, at(27, 10), { text: 'Hello\n\nthere   friend' }) });
    expect(getConversationPreview(withMine, ME)).toEqual({ text: 'Hello there friend', mine: true });
    const long = conversation({ lastMessage: message('m2', THEM, at(27, 10), { text: 'x'.repeat(120) }) });
    const preview = getConversationPreview(long, ME, 20);
    expect(preview?.mine).toBe(false);
    expect(preview?.text).toHaveLength(20);
    expect(preview?.text.endsWith('…')).toBe(true);
  });

  it('picks the list timestamp style by calendar distance', () => {
    expect(getListTimeKind(at(27, 1), NOW)).toBe('time');
    expect(getListTimeKind(at(26, 23), NOW)).toBe('yesterday');
    expect(getListTimeKind(at(22, 12), NOW)).toBe('weekday');
    expect(getListTimeKind(at(10, 12), NOW)).toBe('date');
    expect(getListTimeKind('garbage', NOW)).toBe('date');
  });
});

describe('buildChatRows', () => {
  it('inserts a day separator after the oldest message of each day (inverted list order)', () => {
    const messages = [message('m3', THEM, at(27, 9)), message('m2', ME, at(26, 18)), message('m1', THEM, at(26, 17))];
    const rows = buildChatRows({ messages, currentUserId: ME, now: NOW, isPending: notPending });
    expect(rows.map((row) => (row.kind === 'day' ? `day:${row.daysAgo}` : row.message.id))).toEqual(['m3', 'day:0', 'm2', 'm1', 'day:1']);
  });

  it('groups consecutive messages of one sender within a few minutes', () => {
    const messages = [
      message('m4', ME, at(27, 10, 20)),
      message('m3', ME, at(27, 10, 2)),
      message('m2', ME, at(27, 10, 0)),
      message('m1', THEM, at(27, 9, 59)),
    ];
    const rows = messageRows(buildChatRows({ messages, currentUserId: ME, now: NOW, isPending: notPending }));
    const byId = Object.fromEntries(rows.map((row) => [row.message.id, row]));
    expect(byId.m2.groupedWithPrevious).toBe(false);
    expect(byId.m2.groupedWithNext).toBe(true);
    expect(byId.m3.groupedWithPrevious).toBe(true);
    expect(byId.m3.groupedWithNext).toBe(false);
    expect(byId.m4.groupedWithPrevious).toBe(false);
    expect(byId.m1.groupedWithNext).toBe(false);
  });

  it('derives the delivery state of own messages from the server read receipt', () => {
    const messages = [
      message('optimistic:c3', ME, at(27, 12), { clientMessageId: 'c3' }),
      message('m3', ME, at(27, 11)),
      message('m2', THEM, at(27, 10)),
      message('m1', ME, at(27, 9), { readAt: at(27, 9, 58) }),
      message('m0', ME, at(27, 8), { readAt: at(27, 8, 30) }),
    ];
    const rows = messageRows(
      buildChatRows({ messages, currentUserId: ME, now: NOW, isPending: (item) => item.id.startsWith('optimistic:') }),
    );
    const delivery = Object.fromEntries(rows.map((row) => [row.message.id, row.delivery]));
    expect(delivery).toEqual({ 'optimistic:c3': 'sending', m3: 'sent', m2: null, m1: 'read', m0: 'read' });
  });

  it('does not guess read state from replies (only `readAt` counts)', () => {
    const messages = [message('m2', THEM, at(27, 10)), message('m1', ME, at(27, 9))];
    const rows = messageRows(buildChatRows({ messages, currentUserId: ME, now: NOW, isPending: () => false }));
    expect(rows.find((row) => row.message.id === 'm1')?.delivery).toBe('sent');
  });

  it('merges failed messages by time and drops those the server already has', () => {
    const messages = [message('m2', THEM, at(27, 11)), message('m1', ME, at(27, 9), { clientMessageId: 'sent-ok' })];
    const rows = messageRows(
      buildChatRows({
        messages,
        failed: [
          { clientMessageId: 'f1', text: 'retry me', createdAt: at(27, 10), reason: 'offline' },
          { clientMessageId: 'sent-ok', text: 'duplicate', createdAt: at(27, 9), reason: 'offline' },
        ],
        currentUserId: ME,
        now: NOW,
        isPending: notPending,
      }),
    );
    expect(rows.map((row) => row.message.text)).toEqual(['text m2', 'retry me', 'text m1']);
    const failedRow = rows[1];
    expect(failedRow.mine).toBe(true);
    expect(failedRow.delivery).toBe('failed');
    expect(failedRow.failed?.clientMessageId).toBe('f1');
    expect(failedRow.key).toBe('c:f1');
  });

  it('keeps the same key for an optimistic message and its server copy', () => {
    const optimistic = buildChatRows({
      messages: [message('optimistic:abc', ME, at(27, 12), { clientMessageId: 'abc' })],
      currentUserId: ME,
      now: NOW,
      isPending: () => true,
    });
    const saved = buildChatRows({
      messages: [message('msg-9', ME, at(27, 12), { clientMessageId: 'abc' })],
      currentUserId: ME,
      now: NOW,
      isPending: notPending,
    });
    expect(optimistic[0].key).toBe(saved[0].key);
  });
});

describe('getLatestIncomingUnreadId', () => {
  it('returns the newest counterpart message only while it is unread', () => {
    const unread = [message('m3', ME, at(27, 12)), message('m2', THEM, at(27, 11)), message('m1', THEM, at(27, 10))];
    expect(getLatestIncomingUnreadId(unread, ME)).toBe('m2');
    const read = [message('m2', THEM, at(27, 11), { readAt: at(27, 11, 5) })];
    expect(getLatestIncomingUnreadId(read, ME)).toBeNull();
    expect(getLatestIncomingUnreadId([message('m1', ME, at(27, 9))], ME)).toBeNull();
  });
});
