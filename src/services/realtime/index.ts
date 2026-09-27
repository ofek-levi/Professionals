/**
 * Realtime (server push) client. In mock mode events come straight from the in-app mock backend;
 * in HTTP mode a WebSocket connection is used (see websocket-realtime-client.ts).
 */
import { getMockServer } from '@/mocks/server';
import { createMockRealtimeClient } from '@/mocks/realtime';
import { apiConfig } from '@/services/api/config';

import type { RealtimeClient } from './types';
import { createWebSocketRealtimeClient } from './websocket-realtime-client';

export const realtimeClient: RealtimeClient =
  apiConfig.mode === 'mock'
    ? createMockRealtimeClient(getMockServer())
    : createWebSocketRealtimeClient(apiConfig.baseUrl.replace(/^http/, 'ws') + '/realtime');

export type { RealtimeClient, RealtimeEvent, RealtimeListener } from './types';
