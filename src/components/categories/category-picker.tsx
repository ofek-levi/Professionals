import { useState } from 'react';
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCategoryLookup } from '@/hooks/queries/use-category-catalog';
import { useAppLanguage, useLocalizedText } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { CategoryId, ProfessionalCategory } from '@/types/domain';

import { AppText } from '../ui/app-text';
import { Button } from '../ui/button';
import { Chip } from '../ui/chip';
import { haptics } from '../ui/haptics';
import { Icon } from '../ui/icon';
import { InlineAlert } from '../ui/inline-alert';
import { Sheet } from '../ui/sheet';
import { EmptyState } from '../ui/states';
import { TextField } from '../ui/text-field';
import { CategoryChip } from './category-chip';
import { CategoryIcon } from './category-icon';

interface CategoryPickerBaseProps {
  /** Restrict the choice (e.g. to a professional's own categories). */
  allowedCategoryIds?: readonly CategoryId[];
  /** Focus the search field on mount. */
  autoFocusSearch?: boolean;
  /** Hide the search field (short lists). */
  hideSearch?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface CategoryPickerSingleProps extends CategoryPickerBaseProps {
  /** Customer request: exactly one category. */
  mode: 'single';
  value: CategoryId | null;
  onChange: (id: CategoryId) => void;
}

export interface CategoryPickerMultipleProps extends CategoryPickerBaseProps {
  /** Professional profile: any number of categories. */
  mode: 'multiple';
  value: readonly CategoryId[];
  onChange: (ids: CategoryId[]) => void;
  maxSelected?: number;
}

export type CategoryPickerProps = CategoryPickerSingleProps | CategoryPickerMultipleProps;

type GroupFilter = 'all' | string;

/**
 * Searchable category picker grouped by catalog group. Search covers localized names, descriptions
 * and keywords in both languages. Renders plain views (no virtualized list) so it can be embedded in
 * a `Screen` or a `Sheet` scroll view.
 */
export function CategoryPicker(props: CategoryPickerProps) {
  const { allowedCategoryIds, autoFocusSearch = false, hideSearch = false, style, testID } = props;
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation('common');
  const language = useAppLanguage();
  const localize = useLocalizedText();
  const lookup = useCategoryLookup();
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');

  const available = allowedCategoryIds
    ? lookup.categories.filter((category) => allowedCategoryIds.includes(category.id))
    : lookup.categories;
  const selectedIds: readonly CategoryId[] = props.mode === 'single' ? (props.value ? [props.value] : []) : props.value;
  const maxSelected = props.mode === 'multiple' ? props.maxSelected : undefined;
  const limitReached = typeof maxSelected === 'number' && selectedIds.length >= maxSelected;
  const searching = query.trim().length > 0;
  const results = searching ? lookup.searchCategories(query, language).filter((category) => available.includes(category)) : [];
  const groups = lookup.groups
    .filter((group) => groupFilter === 'all' || group.id === groupFilter)
    .map((group) => ({ group, items: available.filter((category) => category.groupId === group.id) }))
    .filter((section) => section.items.length > 0);
  const showGroupFilter = !searching && lookup.groups.filter((group) => available.some((c) => c.groupId === group.id)).length > 1;

  const toggle = (id: CategoryId) => {
    haptics.selection();
    if (props.mode === 'single') {
      props.onChange(id);
      return;
    }
    if (props.value.includes(id)) {
      props.onChange(props.value.filter((value) => value !== id));
    } else if (!limitReached) {
      props.onChange([...props.value, id]);
    }
  };

  const renderRow = (category: ProfessionalCategory, showGroup: boolean) => {
    const selected = selectedIds.includes(category.id);
    const disabled = !selected && limitReached;
    const name = localize(category.name);
    const subtitle = showGroup ? localize(lookup.getGroup(category.groupId)?.name) : localize(category.description);
    return (
      <Pressable
        key={category.id}
        accessibilityRole={props.mode === 'single' ? 'radio' : 'checkbox'}
        accessibilityLabel={subtitle ? `${name}, ${subtitle}` : name}
        accessibilityState={{ checked: selected, disabled }}
        disabled={disabled}
        onPress={() => toggle(category.id)}
        style={({ pressed }) => [
          styles.row,
          selected ? styles.rowSelected : null,
          pressed ? styles.rowPressed : null,
          disabled ? styles.rowDisabled : null,
        ]}
        testID={`category-option-${category.id}`}
      >
        <CategoryIcon categoryId={category.id} size="sm" />
        <View style={styles.rowTexts}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {name}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {props.mode === 'single' ? (
          <View style={[styles.radio, selected ? { borderColor: theme.colors.primary } : null]}>
            {selected ? <View style={styles.radioDot} /> : null}
          </View>
        ) : (
          <View style={[styles.checkbox, selected ? styles.checkboxSelected : null]}>
            {selected ? <Icon name="check" size={16} color="onPrimary" /> : null}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {!hideSearch ? (
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t('categoryPicker.searchPlaceholder')}
          accessibilityLabel={t('categoryPicker.searchLabel')}
          leftIcon="magnify"
          clearable
          autoFocus={autoFocusSearch}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          testID="category-search"
        />
      ) : null}

      {props.mode === 'multiple' && props.value.length > 0 ? (
        <View style={styles.summary}>
          <View style={styles.summaryHeader}>
            <AppText variant="captionStrong" color="secondary">
              {t('categoryPicker.selectedCount', { count: props.value.length })}
            </AppText>
            <Pressable accessibilityRole="button" onPress={() => props.onChange([])} hitSlop={10}>
              <AppText variant="captionStrong" color="primary">
                {t('actions.clearAll')}
              </AppText>
            </Pressable>
          </View>
          <View style={styles.chips}>
            {props.value.map((id) => (
              <CategoryChip key={id} categoryId={id} size="sm" selected onRemove={() => toggle(id)} />
            ))}
          </View>
          {limitReached && maxSelected ? (
            <InlineAlert tone="info" message={t('categoryPicker.maxReached', { max: maxSelected })} />
          ) : null}
        </View>
      ) : null}

      {showGroupFilter ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} keyboardShouldPersistTaps="handled">
          <Chip label={t('categoryPicker.allServices')} size="sm" selected={groupFilter === 'all'} onPress={() => setGroupFilter('all')} />
          {lookup.groups
            .filter((group) => available.some((category) => category.groupId === group.id))
            .map((group) => (
              <Chip
                key={group.id}
                label={localize(group.name)}
                icon={group.icon}
                size="sm"
                selected={groupFilter === group.id}
                onPress={() => setGroupFilter(groupFilter === group.id ? 'all' : group.id)}
              />
            ))}
        </ScrollView>
      ) : null}

      {searching ? (
        results.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="label" color="muted" accessibilityLiveRegion="polite">
              {t('categoryPicker.resultsCount', { count: results.length })}
            </AppText>
            <View style={styles.list}>{results.map((category) => renderRow(category, true))}</View>
          </View>
        ) : (
          <EmptyState
            compact
            icon="magnify-close"
            tone="neutral"
            title={t('categoryPicker.noResultsTitle')}
            description={t('categoryPicker.noResultsDescription')}
          />
        )
      ) : (
        groups.map(({ group, items }) => (
          <View key={group.id} style={styles.section}>
            <View style={styles.groupHeader}>
              <CategoryIcon icon={group.icon} groupId={group.id} size="xs" />
              <AppText variant="subheading" accessibilityRole="header" style={styles.groupTitle} numberOfLines={1}>
                {localize(group.name)}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('categoryPicker.servicesCount', { count: items.length })}
              </AppText>
            </View>
            <View style={styles.list}>{items.map((category) => renderRow(category, false))}</View>
          </View>
        ))
      )}
    </View>
  );
}

export type CategoryPickerSheetProps = CategoryPickerProps & {
  visible: boolean;
  onClose: () => void;
  title?: string;
};

/**
 * `CategoryPicker` in a bottom sheet. Single mode closes on selection; multiple mode has a
 * "Done (n)" footer.
 */
export function CategoryPickerSheet(props: CategoryPickerSheetProps) {
  const { t } = useTranslation('common');
  const { visible, onClose, title } = props;

  if (props.mode === 'single') {
    const { onChange } = props;
    return (
      <Sheet visible={visible} onClose={onClose} title={title ?? t('categoryPicker.titleSingle')} fullHeight>
        <CategoryPicker
          mode="single"
          value={props.value}
          allowedCategoryIds={props.allowedCategoryIds}
          hideSearch={props.hideSearch}
          onChange={(id) => {
            onChange(id);
            onClose();
          }}
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title ?? t('categoryPicker.titleMultiple')}
      fullHeight
      footer={<Button label={t('categoryPicker.doneWithCount', { count: props.value.length })} onPress={onClose} fullWidth />}
    >
      <CategoryPicker
        mode="multiple"
        value={props.value}
        onChange={props.onChange}
        maxSelected={props.maxSelected}
        allowedCategoryIds={props.allowedCategoryIds}
        hideSearch={props.hideSearch}
      />
    </Sheet>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.lg,
  },
  summary: {
    gap: t.spacing.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  filters: {
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xxs,
  },
  section: {
    gap: t.spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingTop: t.spacing.xs,
  },
  groupTitle: {
    flex: 1,
  },
  list: {
    gap: t.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 60,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  rowSelected: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primarySoft,
  },
  rowPressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowTexts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: t.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.colors.primary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: t.radii.xs,
    borderWidth: 2,
    borderColor: t.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
}));
