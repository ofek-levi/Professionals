import type { ApiClient } from './client';
import { createAuthApi } from './endpoints/auth';
import { createCatalogApi } from './endpoints/catalog';
import { createConversationsApi } from './endpoints/conversations';
import { createCustomersApi } from './endpoints/customers';
import { createDashboardApi } from './endpoints/dashboard';
import { createGeoApi } from './endpoints/geo';
import { createJobsApi } from './endpoints/jobs';
import { createLegalApi } from './endpoints/legal';
import { createNotificationsApi } from './endpoints/notifications';
import { createOffersApi } from './endpoints/offers';
import { createProfessionalsApi } from './endpoints/professionals';
import { createRequestsApi } from './endpoints/requests';
import { createUsersApi } from './endpoints/users';

/** Builds the full typed API surface on top of an `ApiClient` (dependency injection friendly). */
export function createMarketplaceApi(client: ApiClient) {
  return {
    auth: createAuthApi(client),
    users: createUsersApi(client),
    catalog: createCatalogApi(client),
    requests: createRequestsApi(client),
    offers: createOffersApi(client),
    jobs: createJobsApi(client),
    professionals: createProfessionalsApi(client),
    customers: createCustomersApi(client),
    dashboard: createDashboardApi(client),
    notifications: createNotificationsApi(client),
    conversations: createConversationsApi(client),
    geo: createGeoApi(client),
    legal: createLegalApi(client),
  };
}

export type MarketplaceApi = ReturnType<typeof createMarketplaceApi>;
