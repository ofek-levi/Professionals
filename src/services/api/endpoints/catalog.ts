import type { CategoryCatalog } from '@/types/domain';
import type { ApiClient } from '../client';

export function createCatalogApi(client: ApiClient) {
  return {
    /** `GET /catalog/categories` */
    getProfessionalCategories: () => client.get<CategoryCatalog>('/catalog/categories'),
  };
}
