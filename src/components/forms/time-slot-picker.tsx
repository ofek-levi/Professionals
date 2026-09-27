import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles } from '@/theme';
import type { ISODateString, TimeOfDayString } from '@/types/domain';

import { AppText } from '../ui/app-text';
import { Field } from '../ui/field';
import { haptics } from '../ui/haptics';
import { InlineAlert } from '../ui/inline-alert';
import { useNow } from '../ui/value-text';
import { buildTimeSlots } from './time-slots';

export interface TimeSlotPickerProps {
  value: TimeOfDayString | null;
  onChange: (time: TimeOfDayString) => void;
  /** The selected date – slots already in the past are disabled when it is today. */
  date?: ISODateString | null;
  /** First slot (default `07:00`). */
  startTime?: TimeOfDayString;
  /** Slots start before this time (default `21:00`). */
  endTime?: TimeOfDayString;
  stepMinutes?: number;
  /** Minimum notice for today's slots (default 60 minutes). */
  minLeadMinutes?: number;
  columns?: number;
  label?: string;
  required?: boolean;
  helperText?: string;
  error?: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Grid of 30-minute slots (24h clock). */
export function TimeSlotPicker({
  value,
  onChange,
  date,
  startTime = '07:00',
  endTime = '21:00',
  stepMinutes = 30,
  minLeadMinutes = 60,
  columns = 4,
  label,
  required,
  helperText,
  error,
  style,
  testID,
}: TimeSlotPickerProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const now = useNow(60_000);
  const slots = buildTimeSlots({ start: startTime, end: endTime, stepMinutes, date, now, minLeadMinutes });
  const noneLeft = slots.length > 0 && slots.every((slot) => slot.disabled);

  return (
    <Field label={label} required={required} helperText={helperText} error={error} style={style}>
      {noneLeft ? (
        <InlineAlert tone="info" icon="clock-alert-outline" message={t('schedule.noTimesLeft')} />
      ) : (
        <View style={styles.grid} accessibilityRole="radiogroup" testID={testID}>
          {slots.map((slot) => {
            const selected = slot.time === value;
            return (
              <View key={slot.time} style={[styles.cell, { width: `${100 / columns}%` }]}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={slot.time}
                  accessibilityState={{ checked: selected, disabled: slot.disabled }}
                  disabled={slot.disabled}
                  onPress={() => {
                    haptics.selection();
                    onChange(slot.time);
                  }}
                  testID={`time-slot-${slot.time}`}
                  style={({ pressed }) => [
                    styles.slot,
                    selected ? styles.selected : null,
                    slot.disabled ? styles.disabled : null,
                    pressed && !selected ? styles.pressed : null,
                  ]}
                >
                  <AppText
                    variant="captionStrong"
                    color={selected ? 'onPrimary' : slot.disabled ? 'muted' : 'default'}
                    align="center"
                    tabular
                    style={slot.disabled ? styles.strike : null}
                  >
                    {slot.time}
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </Field>
  );
}

const useStyles = makeStyles((t) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -t.spacing.xs,
    rowGap: t.spacing.sm,
  },
  cell: {
    paddingHorizontal: t.spacing.xs,
  },
  slot: {
    minHeight: 44,
    borderRadius: t.radii.sm,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  disabled: {
    backgroundColor: t.colors.surfaceMuted,
    borderColor: t.colors.surfaceMuted,
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
}));
