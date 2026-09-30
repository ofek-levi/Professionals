import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCategoryLookup } from '@/hooks/queries/use-category-catalog';
import { useAppLanguage, useLocalizedText } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { CategoryId, ProfessionalCategory } from '@/types/domain';

import { AppText } from '../ui/app-text';
import { Button } from '../ui/button';
import { haptics } from '../ui/haptics';
import { Icon } from '../ui/icon';
import { InlineAlert } from '../ui/inline-alert';
import { Sheet } from '../ui/sheet';
import { EmptyState } from '../ui/states';
import { TextField } from '../ui/text-field';
import { CategoryChip } from './category-chip';
import { CategoryIcon } from './category-icon';

interface CategoryPickerBaseProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface CategoryPickerSingleProps extends CategoryPickerBaseProps {
  /** Customer request: exactly one category. */
  mode: 'single';
  value: CategoryId | null;
  onChange: (id: CategoryId) => void;
}

interface CategoryPickerMultipleProps extends CategoryPickerBaseProps {
  /** Professional profile: any number of categories. */
  mode: 'multiple';
  value: readonly CategoryId[];
  onChange: (ids: CategoryId[]) => void;
  maxSelected?: number;
}

type CategoryPickerProps = CategoryPickerSingleProps | CategoryPickerMultipleProps;

/**
 * Searchable category picker: plain rows (icon + name) in one soft group per catalog group, with a
 * check on the selected one (single) or checkboxes (multiple). Search covers localized names,
 * descriptions and keywords in both languages. Renders plain views (no virtualized list) so it can
 * be embedded in a `Screen` or a `Sheet` scroll view.
 */
export function CategoryPicker(props: CategoryPickerProps) {
  const { style, testID } = props;
  const styles = useStyles();
  const { t } = useTranslation('common');
  const language = useAppLanguage();
  const localize = useLocalizedText();
  const lookup = useCategoryLookup();
  const [query, setQuery] = useState('');

  const selectedIds: readonly CategoryId[] = props.mode === 'single' ? (props.value ? [props.value] : []) : props.value;
  const maxSelected = props.mode === 'multiple' ? props.maxSelected : undefined;
  const limitReached = typeof maxSelected === 'number' && selectedIds.length >= maxSelected;
  const searching = query.trim().length > 0;
  const results = searching ? lookup.searchCategories(query, language) : [];
  const groups = lookup.groups
    .map((group) => ({ group, items: lookup.categories.filter((category) => category.groupId === group.id) }))
    .filter((section) => section.items.length > 0);

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

  const renderRow = (category: ProfessionalCategory, index: number) => {
    const selected = selectedIds.includes(category.id);
    const disabled = !selected && limitReached;
    const name = localize(category.name);
    return (
      <Pressable
        key={category.id}
        accessibilityRole={props.mode === 'single' ? 'radio' : 'checkbox'}
        accessibilityLabel={name}
        aria-checked={selected}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={() => toggle(category.id)}
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null, disabled ? styles.rowDisabled : null]}
        testID={`category-option-${category.id}`}
      >
        <CategoryIcon categoryId={category.id} size="sm" />
        <View style={[styles.rowMain, index > 0 ? styles.divider : null]}>
          <AppText variant={selected ? 'bodyStrong' : 'body'} color={selected ? 'primary' : 'default'} numberOfLines={1} style={styles.rowName}>
            {name}
          </AppText>
          {props.mode === 'single' ? (
            selected ? <Icon name="check" size={20} color="primary" /> : null
          ) : (
            <View style={[styles.checkbox, selected ? styles.checkboxSelected : null]}>
              {selected ? <Icon name="check" size={16} color="onPrimary" /> : null}
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder={t('categoryPicker.searchPlaceholder')}
        accessibilityLabel={t('categoryPicker.searchLabel')}
        leftIcon="magnify"
        clearable
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        testID="category-search"
      />

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

      {searching ? (
        results.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="label" color="muted" accessibilityLiveRegion="polite">
              {t('categoryPicker.resultsCount', { count: results.length })}
            </AppText>
            <View style={styles.group}>{results.map(renderRow)}</View>
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
            <AppText variant="label" color="muted" accessibilityRole="header" numberOfLines={1}>
              {localize(group.name)}
            </AppText>
            <View style={styles.group}>{items.map(renderRow)}</View>
          </View>
        ))
      )}
    </View>
  );
}

type CategoryPickerSheetProps = CategoryPickerProps & {
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
  section: {
    gap: t.spacing.sm,
  },
  group: {
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingStart: t.spacing.lg,
  },
  rowPressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 56,
    paddingEnd: t.spacing.lg,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  rowName: {
    flex: 1,
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
    backgroundColor: t.colors.primaryFill,
    borderColor: t.colors.primary,
  },
}));
