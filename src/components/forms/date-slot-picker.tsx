import { Pressable, ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { ISODateString } from '@/types/domain';
import { addDays, startOfLocalDay, toDateKey } from '@/utils/dates';

import { AppText } from '../ui/app-text';
import { Field } from '../ui/field';
import { haptics } from '../ui/haptics';
import { useNow } from '../ui/value-text';

export interface DateSlotPickerProps {
  value: ISODateString | null;
  onChange: (date: ISODateString) => void;
  /** Number of selectable days starting today (default 14). */
  days?: number;
  /** First selectable day (default: today). */
  startDate?: Date;
  /** Disable specific days (e.g. outside working days). */
  isDateDisabled?: (date: ISODateString) => boolean;
  label?: string;
  required?: boolean;
  optional?: boolean;
  helperText?: string;
  error?: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Horizontal day chips: "Today", "Tomorrow", then weekday + date. Scrolls naturally in RTL. */
export function DateSlotPicker({
  value,
  onChange,
  days = 14,
  startDate,
  isDateDisabled,
  label,
  required,
  optional,
  helperText,
  error,
  style,
  testID,
}: DateSlotPickerProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();
  const now = useNow(60_000);
  const first = startOfLocalDay(startDate ?? now);
  const dates = Array.from({ length: Math.max(1, days) }, (_, index) => addDays(first, index));
  const todayKey = toDateKey(now);
  const tomorrowKey = toDateKey(addDays(now, 1));

  return (
    <Field label={label} required={required} optional={optional} helperText={helperText} error={error} style={style}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        testID={testID}
        accessibilityRole="radiogroup"
      >
        {dates.map((date) => {
          const key = toDateKey(date);
          const selected = key === value;
          const disabled = isDateDisabled?.(key) ?? false;
          const top =
            key === todayKey ? t('time.today') : key === tomorrowKey ? t('time.tomorrow') : format.date(date, 'weekdayShort');
          const color = selected ? 'onPrimary' : disabled ? 'muted' : 'default';
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityLabel={`${top}, ${format.date(date, 'long')}`}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => {
                haptics.selection();
                onChange(key);
              }}
              testID={`date-slot-${key}`}
              style={({ pressed }) => [
                styles.chip,
                selected ? styles.selected : null,
                disabled ? styles.disabled : null,
                pressed && !selected ? styles.pressed : null,
              ]}
            >
              <AppText variant="label" color={selected ? 'onPrimary' : 'secondary'} numberOfLines={1} align="center">
                {top}
              </AppText>
              <AppText variant="title" color={color} align="center" tabular>
                {format.date(date, 'dayOfMonth')}
              </AppText>
              <AppText variant="tiny" color={selected ? 'onPrimary' : 'muted'} align="center">
                {format.date(date, 'monthShort')}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </Field>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xxs,
  },
  chip: {
    minWidth: 68,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.sm + 2,
    borderRadius: t.radii.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    gap: t.spacing.xxs,
  },
  selected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
}));
