import type { CustomerDashboard, ProfessionalDashboard } from '@/types/api';
import type { ApiClient } from '../client';

export function createDashboardApi(client: ApiClient) {
  return {
    /** `GET /customer/dashboard` */
    getCustomerDashboard: (signal?: AbortSignal) => client.get<CustomerDashboard>('/customer/dashboard', { signal }),
    /** `GET /professional/dashboard` */
    getProfessionalDashboard: (signal?: AbortSignal) =>
      client.get<ProfessionalDashboard>('/professional/dashboard', { signal }),
  };
}
