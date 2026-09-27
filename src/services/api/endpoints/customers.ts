import type { UpdateCustomerProfilePayload } from '@/types/api';
import type { CustomerProfile, User } from '@/types/domain';
import type { ApiClient } from '../client';

export function createCustomersApi(client: ApiClient) {
  return {
    /** `GET /customer/profile` */
    getCustomerProfile: (signal?: AbortSignal) =>
      client.get<{ user: User; profile: CustomerProfile }>('/customer/profile', { signal }),
    /** `PATCH /customer/profile` */
    updateCustomerProfile: (payload: UpdateCustomerProfilePayload) =>
      client.patch<{ user: User; profile: CustomerProfile }>('/customer/profile', payload),
  };
}
