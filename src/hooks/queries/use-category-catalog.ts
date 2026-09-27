/**
 * The professional category catalog.
 *
 * The bundled `DEFAULT_CATEGORY_CATALOG` is used as initial data (marked stale with
 * `initialDataUpdatedAt: 0`) so the UI renders instantly and offline, while the server copy
 * (`GET /catalog/categories`) replaces it in the background. A backend can therefore add or rename
 * categories without an app release.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { DEFAULT_CATEGORY_CATALOG } from '@/constants/professional-categories';
import { api } from '@/services/api';
import type {
  AppLanguage,
  CategoryCatalog,
  CategoryGroupId,
  CategoryId,
  ProfessionalCategory,
  ProfessionalCategoryGroup,
} from '@/types/domain';

import { queryKeys } from './query-keys';

const CATALOG_STALE_TIME_MS = 12 * 60 * 60 * 1000;

export function useCategoryCatalog() {
  return useQuery({
    queryKey: queryKeys.catalog.categories(),
    queryFn: () => api.catalog.getProfessionalCategories(),
    initialData: DEFAULT_CATEGORY_CATALOG,
    initialDataUpdatedAt: 0,
    staleTime: CATALOG_STALE_TIME_MS,
    gcTime: Infinity,
  });
}

// ─────────────────────────────── Search ───────────────────────────────

const HEBREW_FINAL_LETTERS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/**
 * Normalizes text for matching: lower case, no Latin diacritics, no Hebrew niqqud, Hebrew final
 * letters folded to their regular form, punctuation (incl. geresh/gershayim) removed.
 */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, (letter) => HEBREW_FINAL_LETTERS[letter] ?? letter)
    .replace(/[׳״'"`׳״.,/()&+\-–—_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface SearchEntry {
  category: ProfessionalCategory;
  /** Names in the preferred language first. */
  names: string[];
  keywords: string[];
  secondary: string[];
}

function scoreToken(entry: SearchEntry, token: string): number {
  let best = 0;
  const consider = (score: number) => {
    if (score > best) best = score;
  };
  entry.names.forEach((name, index) => {
    const languageBoost = index === 0 ? 5 : 0;
    if (name === token) consider(100 + languageBoost);
    else if (name.startsWith(token)) consider(80 + languageBoost);
    else if (name.split(' ').some((word) => word.startsWith(token))) consider(65 + languageBoost);
    else if (name.includes(token)) consider(40 + languageBoost);
  });
  for (const keyword of entry.keywords) {
    if (keyword === token) consider(60);
    else if (keyword.startsWith(token)) consider(50);
    else if (keyword.split(' ').some((word) => word.startsWith(token))) consider(45);
    else if (token.length >= 3 && keyword.includes(token)) consider(25);
  }
  for (const text of entry.secondary) {
    if (token.length >= 3 && text.includes(token)) consider(10);
  }
  return best;
}

/**
 * Searches localized names, descriptions and keywords in **both** languages (users often type an
 * English term in the Hebrew UI and vice versa); matches in `language` rank higher. Every query word
 * must match. Results are ordered by relevance, then catalog order.
 */
export function searchCategoryCatalog(
  categories: readonly ProfessionalCategory[],
  query: string,
  language: AppLanguage,
): ProfessionalCategory[] {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return [...categories];
  const other: AppLanguage = language === 'he' ? 'en' : 'he';

  const results: { category: ProfessionalCategory; score: number }[] = [];
  for (const category of categories) {
    const entry: SearchEntry = {
      category,
      names: [normalizeSearchText(category.name[language]), normalizeSearchText(category.name[other])],
      keywords: [...category.keywords[language], ...category.keywords[other]].map(normalizeSearchText),
      secondary: category.description
        ? [normalizeSearchText(category.description[language]), normalizeSearchText(category.description[other])]
        : [],
    };
    let total = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const score = scoreToken(entry, token);
      if (score === 0) {
        matchedAll = false;
        break;
      }
      total += score;
    }
    if (matchedAll) results.push({ category, score: total });
  }
  return results
    .sort((a, b) => b.score - a.score || a.category.sortOrder - b.category.sortOrder)
    .map((result) => result.category);
}

// ─────────────────────────────── Lookup ───────────────────────────────

export interface CategoryLookup {
  catalog: CategoryCatalog;
  /** Groups ordered by `sortOrder`. */
  groups: ProfessionalCategoryGroup[];
  /** All categories ordered by group, then by `sortOrder`. */
  categories: ProfessionalCategory[];
  popularCategories: ProfessionalCategory[];
  getCategory: (id: CategoryId | string | null | undefined) => ProfessionalCategory | undefined;
  getGroup: (id: CategoryGroupId | string | null | undefined) => ProfessionalCategoryGroup | undefined;
  getCategoriesByGroup: (groupId: CategoryGroupId | string) => ProfessionalCategory[];
  searchCategories: (query: string, language: AppLanguage) => ProfessionalCategory[];
}

/** Builds lookup helpers for a catalog (pure; exported for tests and non-React code). */
export function createCategoryLookup(catalog: CategoryCatalog): CategoryLookup {
  const groups = [...catalog.groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const groupOrder = new Map<string, number>(groups.map((group, index) => [group.id, index]));
  const categories = [...catalog.categories].sort(
    (a, b) =>
      (groupOrder.get(a.groupId) ?? Number.MAX_SAFE_INTEGER) - (groupOrder.get(b.groupId) ?? Number.MAX_SAFE_INTEGER) ||
      a.sortOrder - b.sortOrder,
  );
  const categoryById = new Map<string, ProfessionalCategory>(categories.map((category) => [category.id, category]));
  const groupById = new Map<string, ProfessionalCategoryGroup>(groups.map((group) => [group.id, group]));

  return {
    catalog,
    groups,
    categories,
    popularCategories: categories.filter((category) => category.isPopular),
    getCategory: (id) => (id ? categoryById.get(id) : undefined),
    getGroup: (id) => (id ? groupById.get(id) : undefined),
    getCategoriesByGroup: (groupId) => categories.filter((category) => category.groupId === groupId),
    searchCategories: (query, language) => searchCategoryCatalog(categories, query, language),
  };
}

/** Catalog lookups bound to the latest catalog (bundled first, then server data). */
export function useCategoryLookup(): CategoryLookup {
  const { data } = useCategoryCatalog();
  return useMemo(() => createCategoryLookup(data), [data]);
}
