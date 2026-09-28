/**
 * Job-explorer filters: services, distance and urgency. Edits a draft and shows a live result
 * count on the Apply button.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryChip } from '@/components/categories';
import { Button, Chip, Sheet } from '@/components/ui';
import { URGENCY_LEVELS } from '@/constants/urgency-levels';
import { useNearbyRequestsForMap } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { CategoryId } from '@/types/domain';

import {
  countActiveFilters,
  DEFAULT_EXPLORE_FILTERS,
  distanceOptionsForRadius,
  filtersToParams,
  toggleInList,
  type ExploreFilters,
} from '../../explore-filters';
import { FilterSection } from './filter-section';

interface ExploreFiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  draft: ExploreFilters;
  onChangeDraft: (filters: ExploreFilters) => void;
  onApply: () => void;
  ownCategoryIds: readonly CategoryId[];
  serviceRadiusKm: number | null;
}

export function ExploreFiltersSheet({ visible, onClose, draft, onChangeDraft, onApply, ownCategoryIds, serviceRadiusKm }: ExploreFiltersSheetProps) {
  const styles = useStyles();
  const { t } = useTranslation(['explore', 'common']);
  const format = useFormatters();
  // Live result count for the draft (shares the cache with the map once applied).
  const preview = useNearbyRequestsForMap(filtersToParams(draft));
  // While the draft's count loads, the query still holds the previous filters' result: never show
  // that stale number on the Apply button.
  const count = preview.isPlaceholderData ? undefined : preview.data?.totalCount;
  const counting = preview.isFetching || preview.isPlaceholderData;
  const update = (patch: Partial<ExploreFilters>) => onChangeDraft({ ...draft, ...patch });

  const applyLabel =
    count === undefined ? t('explore:filters.applyPlain') : count === 0 ? t('explore:filters.applyNone') : t('explore:filters.apply', { count });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('explore:filters.title')}
      testID="explore-filters-sheet"
      footer={
        <View style={styles.footer}>
          <Button
            label={t('common:actions.reset')}
            variant="ghost"
            onPress={() => onChangeDraft(DEFAULT_EXPLORE_FILTERS)}
            disabled={countActiveFilters(draft) === 0}
          />
          <Button
            label={applyLabel}
            onPress={onApply}
            loading={counting && count === undefined}
            style={styles.apply}
            fullWidth
            testID="explore-filters-apply"
          />
        </View>
      }
    >
      <FilterSection title={t('explore:filters.categories')}>
        {ownCategoryIds.map((id) => (
          <CategoryChip
            key={id}
            categoryId={id}
            size="sm"
            selected={draft.categoryIds.includes(id)}
            onPress={() => update({ categoryIds: toggleInList(draft.categoryIds, id) })}
          />
        ))}
      </FilterSection>

      <FilterSection title={t('explore:filters.distance')}>
        {distanceOptionsForRadius(serviceRadiusKm).map((km) => (
          <Chip
            key={km}
            size="sm"
            label={t('explore:filters.withinDistance', { distance: format.distance(km) })}
            selected={draft.maxDistanceKm === km}
            onPress={() => update({ maxDistanceKm: draft.maxDistanceKm === km ? null : km })}
          />
        ))}
        <Chip
          size="sm"
          label={
            serviceRadiusKm
              ? t('explore:filters.wholeAreaWithRadius', { distance: format.distance(serviceRadiusKm) })
              : t('explore:filters.wholeArea')
          }
          selected={draft.maxDistanceKm === null}
          onPress={() => update({ maxDistanceKm: null })}
        />
      </FilterSection>

      <FilterSection title={t('explore:filters.urgency')}>
        {URGENCY_LEVELS.map((level) => (
          <Chip
            key={level}
            size="sm"
            label={t(`common:urgency.${level}.label`)}
            selected={draft.urgencies.includes(level)}
            onPress={() => update({ urgencies: toggleInList(draft.urgencies, level) })}
            testID={`explore-filter-urgency-${level}`}
          />
        ))}
      </FilterSection>
    </Sheet>
  );
}

const useStyles = makeStyles((t) => ({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  apply: {
    flex: 1,
  },
}));
