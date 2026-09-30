/**
 * The professional category catalog served by `GET /v1/catalog/categories`. It is code, not data:
 * the app and the API ship the same ids (a drift test compares them with the app's copy), and a
 * change is a deploy. Bump `CATALOG_VERSION` whenever the content changes (it feeds the ETag).
 */
import { CONSTRUCTION } from './data/construction.js';
import { HOME_REPAIRS } from './data/home-repairs.js';
import { MOVING } from './data/moving.js';
import { OTHER_SERVICES } from './data/other-services.js';
import { CATEGORY_GROUPS } from './groups.js';
import type { CategoryCatalog, CategoryInput, ProfessionalCategory } from './types.js';

export { CATEGORY_GROUP_IDS, CATEGORY_IDS, type CategoryGroupId, type CategoryId } from './ids.js';
export { CATEGORY_GROUPS } from './groups.js';
export type { CategoryCatalog, LocalizedText, ProfessionalCategory, ProfessionalCategoryGroup } from './types.js';

export const CATALOG_VERSION = '2026.09.1';

const define = (items: CategoryInput[]): ProfessionalCategory[] =>
  items.map((item, index) => ({ ...item, isPopular: item.isPopular ?? false, sortOrder: index + 1 }));

export const PROFESSIONAL_CATEGORIES: readonly ProfessionalCategory[] = define([
  ...HOME_REPAIRS,
  ...CONSTRUCTION,
  ...MOVING,
  ...OTHER_SERVICES,
]);

export const CATEGORY_CATALOG: CategoryCatalog = {
  groups: [...CATEGORY_GROUPS],
  categories: [...PROFESSIONAL_CATEGORIES],
  version: CATALOG_VERSION,
};

const CATEGORY_BY_ID = new Map<string, ProfessionalCategory>(PROFESSIONAL_CATEGORIES.map((c) => [c.id, c]));

export function getCategoryById(id: string): ProfessionalCategory | undefined {
  return CATEGORY_BY_ID.get(id);
}
