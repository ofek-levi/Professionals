/** Shape of the category catalog (same as the app's `CategoryCatalog`, `types/domain/category.ts`). */
import type { CategoryGroupId, CategoryId } from './ids.js';

/** Text delivered in every supported language. */
export interface LocalizedText {
  en: string;
  he: string;
}

export interface ProfessionalCategoryGroup {
  id: CategoryGroupId;
  name: LocalizedText;
  /** MaterialCommunityIcons glyph name. */
  icon: string;
  sortOrder: number;
}

export interface ProfessionalCategory {
  id: CategoryId;
  groupId: CategoryGroupId;
  name: LocalizedText;
  description: LocalizedText | null;
  icon: string;
  keywords: Record<keyof LocalizedText, string[]>;
  isPopular: boolean;
  sortOrder: number;
}

export interface CategoryCatalog {
  groups: ProfessionalCategoryGroup[];
  categories: ProfessionalCategory[];
  version: string;
}

/** Catalog entry as written in `data/*` (sort order and popularity are derived). */
export type CategoryInput = Omit<ProfessionalCategory, 'sortOrder' | 'isPopular'> & { isPopular?: boolean };
