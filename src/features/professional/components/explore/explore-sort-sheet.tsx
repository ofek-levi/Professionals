import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { Divider, Icon, ListItem, Sheet } from '@/components/ui';
import { NEARBY_REQUEST_SORTS, type NearbyRequestSort } from '@/types/api';

export const SORT_ICONS: Record<NearbyRequestSort, string> = {
  newest: 'clock-outline',
  nearest: 'map-marker-distance',
  most_urgent: 'alarm-light-outline',
  fewest_offers: 'tag-outline',
};

export interface ExploreSortSheetProps {
  visible: boolean;
  onClose: () => void;
  value: NearbyRequestSort;
  onChange: (sort: NearbyRequestSort) => void;
}

/** Sort options of the job list (radio list). */
export function ExploreSortSheet({ visible, onClose, value, onChange }: ExploreSortSheetProps) {
  const { t } = useTranslation(['explore', 'common']);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('explore:sort.title')} testID="explore-sort-sheet">
      {NEARBY_REQUEST_SORTS.map((sort, index) => {
        const selected = sort === value;
        return (
          <Fragment key={sort}>
            {index > 0 ? <Divider inset={52} /> : null}
            <ListItem
              icon={SORT_ICONS[sort]}
              iconTone={selected ? 'brand' : 'neutral'}
              title={t(`explore:sort.options.${sort}`)}
              subtitle={t(`explore:sort.descriptions.${sort}`)}
              showChevron={false}
              trailing={selected ? <Icon name="check-circle" size={22} color="primary" /> : null}
              accessibilityHint={selected ? t('common:a11y.selected') : undefined}
              onPress={() => {
                onChange(sort);
                onClose();
              }}
              testID={`explore-sort-${sort}`}
            />
          </Fragment>
        );
      })}
    </Sheet>
  );
}
