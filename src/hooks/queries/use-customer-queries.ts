import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';

import { queryKeys } from './query-keys';
import { useQueryScope } from './query-scope';

/** `GET /customer/profile` – `{ user, profile }` of the signed-in customer. */
export function useCustomerProfile() {
  const { userId, enabled } = useQueryScope('customer');
  return useQuery({
    queryKey: queryKeys.customer.profile(userId),
    queryFn: ({ signal }) => api.customers.getCustomerProfile(signal),
    enabled,
  });
}
