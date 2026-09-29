import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryGrid, CategoryIcon, CategoryPickerSheet } from '@/components/categories';
import { AppText, Card } from '@/components/ui';
import { useCategoryName } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { CategoryId } from '@/types/domain';

/** Popular services offered before a service is chosen (plus an "All services" tile). */
const POPULAR_LIMIT = 7;

interface ServiceFieldProps {
  value: CategoryId | null;
  onChange: (id: CategoryId) => void;
}

/**
 * The chosen service as one row ("Plumbing · Change"), or – before one is chosen – a grid of
 * popular services and "All services" (the searchable catalog in a sheet).
 */
export function ServiceField({ value, onChange }: ServiceFieldProps) {
  const styles = useStyles();
  const { t } = useTranslation(['requests', 'common']);
  const [pickerOpen, setPickerOpen] = useState(false);
  const name = useCategoryName(value) || t('common:category.unknown');

  return (
    <View>
      {value ? (
        <Card
          padding="none"
          onPress={() => setPickerOpen(true)}
          accessibilityLabel={t('requests:form.changeServiceA11y', { name })}
          style={styles.row}
          testID="request-form-service"
        >
          <CategoryIcon categoryId={value} size="sm" />
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
            {name}
          </AppText>
          <AppText variant="captionStrong" color="primary">
            {t('common:actions.change')}
          </AppText>
        </Card>
      ) : (
        <CategoryGrid limit={POPULAR_LIMIT} onSelect={onChange} onShowAll={() => setPickerOpen(true)} />
      )}
      <CategoryPickerSheet mode="single" visible={pickerOpen} value={value} onClose={() => setPickerOpen(false)} onChange={onChange} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    minHeight: 60,
  },
  flex: {
    flex: 1,
  },
}));
