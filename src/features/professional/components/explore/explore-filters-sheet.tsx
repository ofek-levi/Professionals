/**
 * Job-explorer filters: services, distance, urgency, preferred date, competition and "hide jobs I
 * already offered on". Edits a draft and shows a live result count on the Apply button.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryChip } from '@/components/categories';
import { Button, Chip, Divider, Sheet, SwitchRow } from '@/components/ui';
import { URGENCY_LEVELS, URGENCY_META } from '@/constants/urgency-levels';
import { useNearbyRequestsForMap } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import { OFFER_PRESENCE_FILTERS } from '@/types/api';
import type { CategoryId } from '@/types/domain';

import {
  countActiveFilters,
  DATE_WINDOWS,
  DEFAULT_EXPLORE_FILTERS,
  distanceOptionsForRadius,
  filtersToParams,
  toggleInList,
  type ExploreFilters,
} from '../../explore-filters';
import { FilterSection } from './filter-section';

export interface ExploreFiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  draft: ExploreFilters;
  onChangeDraft: (filters: ExploreFilters) => void;
  onApply: () => void;
  ownCategoryIds: readonly CategoryId[];
  serviceRadiusKm: number | null;
  now: Date;
}

const DATE_WINDOW_ICONS = {
  any: 'calendar-blank-outline',
  today: 'calendar-today',
  next3days: 'calendar-range',
  thisWeek: 'calendar-week',
} as const;

export function ExploreFiltersSheet({
  visible,
  onClose,
  draft,
  onChangeDraft,
  onApply,
  ownCategoryIds,
  serviceRadiusKm,
  now,
}: ExploreFiltersSheetProps) {
  const styles = useStyles();
  const { t } = useTranslation(['explore', 'common']);
  const format = useFormatters();
  // Live result count for the draft (shares the cache with the map once applied).
  const preview = useNearbyRequestsForMap(filtersToParams(draft, now));
  // While the draft's count loads, the query still holds the previous filters' result: never show
  // that stale number on the Apply button.
  const count = preview.isPlaceholderData ? undefined : preview.data?.totalCount;
  const counting = preview.isFetching || preview.isPlaceholderData;
  const activeCount = countActiveFilters(draft);
  const update = (patch: Partial<ExploreFilters>) => onChangeDraft({ ...draft, ...patch });

  const applyLabel =
    count === undefined
      ? t('explore:filters.applyPlain')
      : count === 0
        ? t('explore:filters.applyNone')
        : t('explore:filters.apply', { count });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('explore:filters.title')}
      subtitle={activeCount > 0 ? t('explore:filters.activeCount', { count: activeCount }) : t('explore:filters.subtitle')}
      testID="explore-filters-sheet"
      footer={
        <View style={styles.footer}>
          <Button
            label={t('common:actions.reset')}
            variant="outline"
            onPress={() => onChangeDraft(DEFAULT_EXPLORE_FILTERS)}
            disabled={activeCount === 0}
            style={styles.reset}
          />
          <Button
            label={applyLabel}
            onPress={onApply}
            loading={counting && count === undefined}
            leftIcon={count === 0 ? 'filter-remove-outline' : 'check'}
            style={styles.apply}
            fullWidth
            testID="explore-filters-apply"
          />
        </View>
      }
    >
      <FilterSection
        title={t('explore:filters.categories')}
        icon="toolbox-outline"
        hint={draft.categoryIds.length === 0 ? t('explore:filters.categoriesAll') : undefined}
      >
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
      <Divider />

      <FilterSection title={t('explore:filters.distance')} icon="map-marker-distance">
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
          icon="map-marker-radius-outline"
          label={
            serviceRadiusKm
              ? t('explore:filters.wholeAreaWithRadius', { distance: format.distance(serviceRadiusKm) })
              : t('explore:filters.wholeArea')
          }
          selected={draft.maxDistanceKm === null}
          onPress={() => update({ maxDistanceKm: null })}
        />
      </FilterSection>
      <Divider />

      <FilterSection
        title={t('explore:filters.urgency')}
        icon="alarm"
        hint={draft.urgencies.length === 0 ? t('explore:filters.urgencyAll') : undefined}
      >
        {URGENCY_LEVELS.map((level) => (
          <Chip
            key={level}
            size="sm"
            icon={URGENCY_META[level].icon}
            label={t(`common:urgency.${level}.label`)}
            selected={draft.urgencies.includes(level)}
            onPress={() => update({ urgencies: toggleInList(draft.urgencies, level) })}
          />
        ))}
      </FilterSection>
      <Divider />

      <FilterSection title={t('explore:filters.date')} icon="calendar-month-outline" hint={t('explore:filters.dateHint')}>
        {DATE_WINDOWS.map((window) => (
          <Chip
            key={window}
            size="sm"
            icon={DATE_WINDOW_ICONS[window]}
            label={t(`explore:filters.dateWindows.${window}`)}
            selected={draft.dateWindow === window}
            onPress={() => update({ dateWindow: window })}
          />
        ))}
      </FilterSection>
      <Divider />

      <FilterSection title={t('explore:filters.offers')} icon="tag-multiple-outline">
        {OFFER_PRESENCE_FILTERS.map((presence) => (
          <Chip
            key={presence}
            size="sm"
            label={t(`explore:filters.offerPresence.${presence}`)}
            selected={draft.offerPresence === presence}
            onPress={() => update({ offerPresence: presence })}
          />
        ))}
      </FilterSection>
      <Divider />

      <SwitchRow
        icon="eye-off-outline"
        iconTone="accent"
        title={t('explore:filters.hideOffered')}
        description={t('explore:filters.hideOfferedDescription')}
        value={draft.hideWithMyOffer}
        onValueChange={(value) => update({ hideWithMyOffer: value })}
        testID="explore-filter-hide-offered"
      />
    </Sheet>
  );
}

const useStyles = makeStyles((t) => ({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  reset: {
    minWidth: 96,
  },
  apply: {
    flex: 1,
  },
}));
