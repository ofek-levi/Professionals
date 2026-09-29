/** Messaging endpoints (thin: validate → service → DTO). Any signed-in participant may call them. */
import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { validateRequest } from '../../lib/validate.js';
import { authOf } from '../../middleware/auth.js';
import type { SuccessResponse } from '../../shared/contract/index.js';
import { parseConversationId } from './conversation-access.js';
import { markConversationRead } from './conversation-read.service.js';
import { conversationParams, conversationsPageQuery, sendMessageBody } from './conversations.schemas.js';
import { getConversation, listConversations, listMessages } from './conversations.service.js';
import { sendMessage } from './send-message.service.js';

const SUCCESS: SuccessResponse = { success: true };

export const list = () => async (req: Request) => {
  const { query } = validateRequest(req, { query: conversationsPageQuery });
  return listConversations(authOf(req).userId, { cursor: query.cursor, limit: query.limit });
};

export const getOne = () => async (req: Request) => {
  const { params } = validateRequest(req, { params: conversationParams });
  return getConversation(authOf(req).userId, parseConversationId(params.conversationId));
};

export const messages = () => async (req: Request) => {
  const { params, query } = validateRequest(req, { params: conversationParams, query: conversationsPageQuery });
  return listMessages(authOf(req).userId, parseConversationId(params.conversationId), { cursor: query.cursor, limit: query.limit });
};

export const send = (deps: AppDeps) => async (req: Request) => {
  const { params, body } = validateRequest(req, { params: conversationParams, body: sendMessageBody });
  return sendMessage(deps, authOf(req), parseConversationId(params.conversationId), body);
};

export const markRead = (deps: AppDeps) => async (req: Request) => {
  const { params } = validateRequest(req, { params: conversationParams });
  await markConversationRead(deps, authOf(req).userId, parseConversationId(params.conversationId));
  return SUCCESS;
};
