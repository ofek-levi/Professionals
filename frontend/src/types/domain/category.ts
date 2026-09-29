import type { LocalizedText } from './common';
import type { CategoryGroupId, CategoryId } from '@/constants/professional-categories';

export type { CategoryGroupId, CategoryId };

/** Identifier of an icon in the MaterialCommunityIcons set (see components/ui/icon.tsx). */
export type IconName = string;

export interface ProfessionalCategoryGroup {
  id: CategoryGroupId;
  name: LocalizedText;
  icon: IconName;
  sortOrder: number;
}

export interface ProfessionalCategory {
  /** Stable unique identifier. Never use the display name for logic. */
  id: CategoryId;
  groupId: CategoryGroupId;
  name: LocalizedText;
  description: LocalizedText | null;
  icon: IconName;
  /** Additional search keywords per language. */
  keywords: Record<keyof LocalizedText, string[]>;
  /** Shown in "popular services" sections. */
  isPopular: boolean;
  sortOrder: number;
}

export interface CategoryCatalog {
  groups: ProfessionalCategoryGroup[];
  categories: ProfessionalCategory[];
  /** Catalog revision so clients can cache it safely. */
  version: string;
}
