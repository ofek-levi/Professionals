import { useTranslation } from 'react-i18next';

import { useCategoryName } from '@/i18n/hooks';
import type { CategoryId } from '@/types/domain';

import { AppText, type AppTextProps } from '../ui/app-text';

interface CategoryNameProps extends Omit<AppTextProps, 'children'> {
  categoryId: CategoryId | string | null | undefined;
}

/** Localized category name from the live catalog (falls back to a generic "Service"). */
export function CategoryName({ categoryId, variant = 'bodyStrong', ...textProps }: CategoryNameProps) {
  const { t } = useTranslation('common');
  const name = useCategoryName(categoryId);
  return (
    <AppText variant={variant} {...textProps}>
      {name || t('category.unknown')}
    </AppText>
  );
}
