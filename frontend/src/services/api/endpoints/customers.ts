import type { CustomerProfileResponse, UpdateCustomerProfilePayload } from '@/types/api';
import type { ApiClient } from '../client';

export function createCustomersApi(client: ApiClient) {
  return {
    /** `GET /customer/profile` */
    getCustomerProfile: (signal?: AbortSignal) =>
      client.get<CustomerProfileResponse>('/customer/profile', { signal }),
    /** `PATCH /customer/profile` */
    updateCustomerProfile: (payload: UpdateCustomerProfilePayload) =>
      client.patch<CustomerProfileResponse>('/customer/profile', payload),
  };
}
