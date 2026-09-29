/** `/conversations/*` routes. */
import { created, route } from '../router';
import {
  getConversation,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
} from '../services/messaging-service';
import { paginationFrom, SUCCESS } from './shared';

export const conversationRoutes = [
  route({ method: 'GET', path: '/conversations', auth: 'user', handler: ({ ctx, actor }) => listConversations(ctx, actor.userId) }),
  route({
    method: 'GET',
    path: '/conversations/:conversationId',
    auth: 'user',
    handler: ({ ctx, actor, params }) => getConversation(ctx, actor.userId, params.conversationId),
  }),
  route({
    method: 'GET',
    path: '/conversations/:conversationId/messages',
    auth: 'user',
    handler: ({ ctx, actor, params, query }) => listMessages(ctx, actor.userId, params.conversationId, paginationFrom(query)),
  }),
  route({
    method: 'POST',
    path: '/conversations/:conversationId/messages',
    auth: 'user',
    handler: ({ ctx, actor, params, body }) => created(sendMessage(ctx, actor, params.conversationId, body)),
  }),
  route({
    method: 'POST',
    path: '/conversations/:conversationId/read',
    auth: 'user',
    handler: ({ ctx, actor, params }) => {
      markConversationRead(ctx, actor.userId, params.conversationId);
      return SUCCESS;
    },
  }),
];
