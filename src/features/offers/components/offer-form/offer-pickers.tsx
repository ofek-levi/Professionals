/**
 * Compact inputs of the offer form: a large price field, day tiles and the time slots of one part
 * of the day. Filled surfaces without borders; the selected tile uses the primary fill.
 */
import { useRef, useState, type Ref } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { parsePriceInput } from '@/components/forms';
import { AppText, haptics, resolveTextAlign, SegmentedControl, type SegmentedOption } from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { CurrencyCode, ISODateString, TimeOfDayString } from '@/types/domain';
import { addDays, parseDateKey, toDateKey } from '@/utils/dates';

import { groupTimesByPeriod, offerDayPeriod, type OfferDateOption, type OfferDayPeriod } from './offer-form-model';

// ─────────────────────────────── Price ───────────────────────────────

interface LargePriceInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  currency: CurrencyCode;
  accessibilityLabel: string;
  invalid?: boolean;
  ref?: Ref<TextInput>;
  testID?: string;
}

/** Big whole-unit price field with the currency symbol; grouping separators are added as you type. */
export function LargePriceInput({ value, onChange, onBlur, currency, accessibilityLabel, invalid = false, ref, testID }: LargePriceInputProps) {
  const styles = useStyles();
  const theme = useTheme();
  const format = useFormatters();
  const inputRef = useRef<TextInput | null>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessible={false}
      onPress={() => inputRef.current?.focus()}
      style={[styles.priceBox, focused ? styles.priceFocused : null, invalid ? styles.priceInvalid : null]}
    >
      <AppText variant="title" color={value === null ? 'muted' : 'default'}>
        {format.currencySymbol(currency)}
      </AppText>
      <TextInput
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as { current: TextInput | null }).current = node;
        }}
        accessibilityLabel={accessibilityLabel}
        aria-invalid={invalid}
        value={value === null ? '' : format.number(value)}
        onChangeText={(text) => {
          const parsed = parsePriceInput(text);
          onChange(parsed === null ? null : Math.min(parsed, APP_CONFIG.maxOfferPrice));
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        placeholder="0"
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.primary}
        cursorColor={theme.colors.primary}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={9}
        selectTextOnFocus
        maxFontSizeMultiplier={1.3}
        // Digits would align by their own (LTR) direction on the web; keep them next to the symbol.
        style={[styles.priceInput, { textAlign: resolveTextAlign('start', theme) }]}
        testID={testID}
      />
    </Pressable>
  );
}

// ─────────────────────────────── Date ───────────────────────────────

interface DayTilesProps {
  options: readonly OfferDateOption[];
  value: ISODateString | null;
  onChange: (date: ISODateString) => void;
  now: Date;
  testID?: string;
}

/**
 * One tile per day: "Today" / "Tomorrow" / weekday on top, the date below. Scrolls sideways and
 * starts scrolled so that the preselected day is visible.
 */
export function DayTiles({ options, value, onChange, now, testID }: DayTilesProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation('common');
  const format = useFormatters();
  const todayKey = toDateKey(now);
  const tomorrowKey = toDateKey(addDays(now, 1));
  const scrollRef = useRef<ScrollView>(null);
  const measured = useRef({ viewport: 0, widths: {} as Record<string, number>, touched: false });

  // Scroll just enough to show the preselected tile. Tile widths settle over a few layouts (web
  // fonts), so this runs on each of them until the user touches the row. Positions are summed
  // from the widths along the reading direction, so it works the same in LTR and RTL.
  const revealSelected = () => {
    const m = measured.current;
    const index = options.findIndex((option) => option.date === value);
    const widths = options.map((option) => m.widths[option.date]);
    if (m.touched || !m.viewport || index < 0 || widths.some((width) => width === undefined)) return;
    const pad = theme.spacing.screen;
    const gap = theme.spacing.sm;
    const start = pad + widths.slice(0, index).reduce((sum, width) => sum + (width ?? 0) + gap, 0);
    const overflow = Math.max(0, start + (widths[index] ?? 0) + pad - m.viewport);
    // RTL web counts the horizontal offset negative from the start (right) edge; native RTL
    // mirrors the scroll view itself.
    if (theme.isRTL && Platform.OS !== 'web') return;
    scrollRef.current?.scrollTo({ x: theme.isRTL ? -overflow : overflow, animated: false });
  };
  const markTouched = () => {
    measured.current.touched = true;
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.dayRow}
      style={styles.dayScroll}
      onLayout={(event) => {
        measured.current.viewport = event.nativeEvent.layout.width;
        revealSelected();
      }}
      onTouchStart={markTouched}
      onScrollBeginDrag={markTouched}
      accessibilityRole="radiogroup"
      testID={testID}
    >
      {options.map((option) => {
        const day = parseDateKey(option.date);
        if (!day) return null;
        const selected = option.date === value;
        const top = option.date === todayKey ? t('time.today') : option.date === tomorrowKey ? t('time.tomorrow') : format.date(day, 'weekdayShort');
        const color = selected ? 'onPrimary' : option.disabled ? 'muted' : 'default';
        return (
          <Pressable
            key={option.date}
            accessibilityRole="radio"
            accessibilityLabel={`${top}, ${format.date(day, 'long')}`}
            accessibilityState={{ checked: selected, disabled: option.disabled }}
            aria-checked={selected}
            disabled={option.disabled}
            onPress={() => {
              haptics.selection();
              onChange(option.date);
            }}
            onLayout={(event) => {
              measured.current.widths[option.date] = event.nativeEvent.layout.width;
              revealSelected();
            }}
            style={({ pressed }) => [
              styles.tile,
              styles.dayTile,
              selected ? styles.selected : null,
              option.disabled ? styles.disabled : null,
              pressed && !selected ? styles.pressed : null,
            ]}
            testID={`date-slot-${option.date}`}
          >
            <AppText variant="label" color={selected ? 'onPrimary' : 'secondary'} numberOfLines={1}>
              {top}
            </AppText>
            <AppText variant="bodyStrong" color={color} numberOfLines={1} tabular>
              {format.date(day, 'dayMonth')}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─────────────────────────────── Time ───────────────────────────────

interface TimeGridProps {
  times: readonly TimeOfDayString[];
  value: TimeOfDayString | null;
  onChange: (time: TimeOfDayString) => void;
  testID?: string;
}

const TIME_COLUMNS = 5;

/**
 * The selectable 30-minute slots (24h clock), one part of the day at a time: a small
 * "Morning | Afternoon | Evening" switch (only the parts with free slots; hidden when there is one)
 * above a grid of at most two rows. It opens on the part that holds the selected time.
 */
export function TimeGrid({ times, value, onChange, testID }: TimeGridProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const groups = groupTimesByPeriod(times);
  // The chosen part follows the value: a new value (e.g. after picking another day) reopens its part.
  const [chosen, setChosen] = useState<{ period: OfferDayPeriod; forValue: TimeOfDayString | null } | null>(null);
  const preferred = chosen && chosen.forValue === value ? chosen.period : value ? offerDayPeriod(value) : null;
  const current = groups.find((group) => group.period === preferred) ?? groups[0];
  if (!current) return null;

  const options: SegmentedOption<OfferDayPeriod>[] = groups.map((group) => ({
    value: group.period,
    label: t(`timeWindowShort.${group.period}`),
  }));

  return (
    <View style={styles.timeBlock}>
      {groups.length > 1 ? (
        <SegmentedControl
          options={options}
          value={current.period}
          onChange={(period) => setChosen({ period, forValue: value })}
          size="sm"
          testID={testID ? `${testID}-period` : undefined}
        />
      ) : null}
      <View style={styles.grid} accessibilityRole="radiogroup" testID={testID}>
        {current.times.map((time) => {
          const selected = time === value;
          return (
            <View key={time} style={styles.cell}>
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={time}
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() => {
                  haptics.selection();
                  onChange(time);
                }}
                style={({ pressed }) => [styles.tile, styles.timeTile, selected ? styles.selected : null, pressed && !selected ? styles.pressed : null]}
                testID={`time-slot-${time}`}
              >
                <AppText variant="captionStrong" color={selected ? 'onPrimary' : 'default'} tabular>
                  {time}
                </AppText>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: 64,
    paddingHorizontal: t.spacing.lg,
    borderRadius: t.radii.lg,
    borderWidth: 1.5,
    borderColor: t.colors.surface,
    backgroundColor: t.colors.surface,
  },
  priceFocused: {
    borderColor: t.colors.primary,
  },
  priceInvalid: {
    borderColor: t.colors.danger,
  },
  priceInput: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    ...t.typography.display,
    color: t.colors.text,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: 0,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null),
  },
  dayScroll: {
    marginHorizontal: -t.spacing.screen,
    flexGrow: 0,
  },
  dayRow: {
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.screen,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radii.md,
    backgroundColor: t.colors.surface,
  },
  dayTile: {
    minWidth: 72,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    gap: t.spacing.xxs,
  },
  timeTile: {
    height: 40,
  },
  selected: {
    backgroundColor: t.colors.primaryFill,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  timeBlock: {
    gap: t.spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -t.spacing.xs,
    rowGap: t.spacing.sm,
  },
  cell: {
    width: `${100 / TIME_COLUMNS}%`,
    paddingHorizontal: t.spacing.xs,
  },
}));
