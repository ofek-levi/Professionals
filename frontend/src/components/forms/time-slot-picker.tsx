import { Pressable, View } from 'react-native';

import { makeStyles } from '@/theme';
import type { TimeOfDayString } from '@/types/domain';

import { AppText } from '../ui/app-text';
import { haptics } from '../ui/haptics';
import { buildTimeSlots } from './time-slots';

interface TimeSlotPickerProps {
  value: TimeOfDayString | null;
  onChange: (time: TimeOfDayString) => void;
  /** First slot (default `07:00`). */
  startTime?: TimeOfDayString;
  /** Slots start before this time (default `21:00`). */
  endTime?: TimeOfDayString;
  testID?: string;
}

/** Grid of 30-minute slots (24h clock), four per row. */
export function TimeSlotPicker({ value, onChange, startTime = '07:00', endTime = '21:00', testID }: TimeSlotPickerProps) {
  const styles = useStyles();
  const times = buildTimeSlots({ start: startTime, end: endTime, stepMinutes: 30 });

  return (
    <View style={styles.grid} accessibilityRole="radiogroup" testID={testID}>
      {times.map((time) => {
        const selected = time === value;
        return (
          <View key={time} style={styles.cell}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={time}
              aria-checked={selected}
              onPress={() => {
                haptics.selection();
                onChange(time);
              }}
              testID={`time-slot-${time}`}
              style={({ pressed }) => [styles.slot, selected ? styles.selected : null, pressed && !selected ? styles.pressed : null]}
            >
              <AppText variant="captionStrong" color={selected ? 'onPrimary' : 'default'} align="center" tabular>
                {time}
              </AppText>
            </Pressable>
          </View>
        );
      })}
    </View>
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
    width: '25%',
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
    backgroundColor: t.colors.primaryFill,
    borderColor: t.colors.primary,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
}));
