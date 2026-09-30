/**
 * Messaging routes (participants of a job's conversation, either role). Every route is rate
 * limited per user after `requireAuth` (the limiters are keyed by the caller).
 */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { RATE_LIMITS, rateLimit, userKey, userRouteLimits } from '../../middleware/rate-limit.js';
import { getOne, list, markRead, messages, send, unreadCount } from './conversations.controller.js';

export function createConversationsRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  const limit = userRouteLimits(deps);
  router.get('/conversations', auth, limit.read('conversations-list'), asyncHandler(list()));
  // Before `/:conversationId`, which would otherwise take "unread-count" for an id.
  router.get('/conversations/unread-count', auth, limit.read('conversations-unread-count'), asyncHandler(unreadCount()));
  router.get('/conversations/:conversationId', auth, limit.read('conversations-get'), asyncHandler(getOne()));
  router.get('/conversations/:conversationId/messages', auth, limit.read('messages-list'), asyncHandler(messages()));
  router.post(
    '/conversations/:conversationId/messages',
    auth,
    rateLimit(deps, 'messages-user', { ...RATE_LIMITS.messagesPerUser, key: userKey }),
    asyncHandler(send(deps), { status: 201 }),
  );
  router.post('/conversations/:conversationId/read', auth, limit.readMarker('conversations-read'), asyncHandler(markRead(deps)));
  return router;
}
