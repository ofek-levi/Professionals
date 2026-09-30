/**
 * The app's realtime connection (WebSocket to the backend, see websocket-realtime-client.ts). The
 * session lifecycle connects it while signed in; the access token comes from `sessionTokens`.
 */
import { apiConfig } from '@/services/api/config';
import { sessionTokens } from '@/services/api';

import type { RealtimeClient } from './types';
import { createWebSocketRealtimeClient } from './websocket-realtime-client';

export const realtimeClient: RealtimeClient = createWebSocketRealtimeClient({
  url: apiConfig.realtimeUrl,
  auth: sessionTokens,
});

export type { RealtimeClient, RealtimeEvent, RealtimeListener } from './types';
