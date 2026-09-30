import type {
  ConversationMessagesParams,
  ConversationsParams,
  Paginated,
  SendMessagePayload,
  SuccessResponse,
  UnreadCountResponse,
} from '@/types/api';
import type { Conversation, Message } from '@/types/domain';
import type { ApiClient } from '../client';

const id = (value: string) => encodeURIComponent(value);

export function createConversationsApi(client: ApiClient) {
  return {
    /** `GET /conversations` – most recent activity first, cursor paginated. */
    getConversations: (params: ConversationsParams = {}, signal?: AbortSignal) =>
      client.get<Paginated<Conversation>>('/conversations', { signal, query: { cursor: params.cursor, limit: params.limit } }),
    /** `GET /conversations/unread-count` – unread messages over all conversations (the inbox badge). */
    getUnreadMessagesCount: (signal?: AbortSignal) => client.get<UnreadCountResponse>('/conversations/unread-count', { signal }),
    /** `GET /conversations/:id` */
    getConversationById: (conversationId: string, signal?: AbortSignal) =>
      client.get<Conversation>(`/conversations/${id(conversationId)}`, { signal }),
    /** `GET /conversations/:id/messages` – newest first, cursor paginated. */
    getConversationMessages: (conversationId: string, params: ConversationMessagesParams = {}, signal?: AbortSignal) =>
      client.get<Paginated<Message>>(`/conversations/${id(conversationId)}/messages`, {
        signal,
        query: { cursor: params.cursor, limit: params.limit },
      }),
    /** `POST /conversations/:id/messages` → 201. 409 once the chat closed, 429 over 60 per minute. */
    sendMessage: (conversationId: string, payload: SendMessagePayload) =>
      client.post<Message>(`/conversations/${id(conversationId)}/messages`, payload),
    /** `POST /conversations/:id/read` */
    markConversationAsRead: (conversationId: string) =>
      client.post<SuccessResponse>(`/conversations/${id(conversationId)}/read`),
  };
}
