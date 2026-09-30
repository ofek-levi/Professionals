/**
 * Messaging routes (participants of a job's conversation, either role). Sending is rate limited
 * per user after `requireAuth` (the limiter is keyed by the caller).
 */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { rateLimit, userKey, type RateLimitRule } from '../../middleware/rate-limit.js';
import { getOne, list, markRead, messages, send, unreadCount } from './conversations.controller.js';

/** Generous for a human typing, low enough to stop scripted flooding of a counterpart. */
const MESSAGES_PER_USER: RateLimitRule = { windowMs: 60_000, limit: 60, key: userKey };

export function createConversationsRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  router.get('/conversations', auth, asyncHandler(list()));
  // Before `/:conversationId`, which would otherwise take "unread-count" for an id.
  router.get('/conversations/unread-count', auth, asyncHandler(unreadCount()));
  router.get('/conversations/:conversationId', auth, asyncHandler(getOne()));
  router.get('/conversations/:conversationId/messages', auth, asyncHandler(messages()));
  router.post(
    '/conversations/:conversationId/messages',
    auth,
    rateLimit(deps, 'messages-user', MESSAGES_PER_USER),
    asyncHandler(send(deps), { status: 201 }),
  );
  router.post('/conversations/:conversationId/read', auth, asyncHandler(markRead(deps)));
  return router;
}
