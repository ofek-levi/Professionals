import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';

import { queryKeys } from './query-keys';
import { useQueryScope } from './query-scope';

/** `GET /customer/dashboard` (customers only). */
export function useCustomerDashboard() {
  const { userId, enabled } = useQueryScope('customer');
  return useQuery({
    queryKey: queryKeys.dashboard.customer(userId),
    queryFn: ({ signal }) => api.dashboard.getCustomerDashboard(signal),
    enabled,
  });
}

/** `GET /professional/dashboard` (professionals only). */
export function useProfessionalDashboard() {
  const { userId, enabled } = useQueryScope('professional');
  return useQuery({
    queryKey: queryKeys.dashboard.professional(userId),
    queryFn: ({ signal }) => api.dashboard.getProfessionalDashboard(signal),
    enabled,
  });
}
