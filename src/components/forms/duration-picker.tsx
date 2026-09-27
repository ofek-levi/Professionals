import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';

import { AppText } from '../ui/app-text';
import { Chip } from '../ui/chip';
import { Field } from '../ui/field';
import { IconButton } from '../ui/icon-button';

export const DEFAULT_DURATION_OPTIONS: readonly number[] = [30, 60, 90, 120, 180, 240];
export const FULL_DAY_MINUTES = 480;
const CUSTOM_STEP = 30;
const CUSTOM_MIN = 30;
const CUSTOM_MAX = 16 * 60;

export interface DurationPickerProps {
  /** Minutes, or `null` when not specified. */
  value: number | null;
  onChange: (minutes: number | null) => void;
  options?: readonly number[];
  /** Adds a "Full day" chip (default `true`). */
  allowFullDay?: boolean;
  /** Adds an "Other" chip with a custom ±30 min control (default `true`). */
  allowCustom?: boolean;
  label?: string;
  required?: boolean;
  optional?: boolean;
  helperText?: string;
  error?: string | null;
  style?: StyleProp<ViewStyle>;
}

/** Duration chips: 30m, 1h, 1.5h, 2h, 3h, 4h, full day, other (custom stepper). */
export function DurationPicker({
  value,
  onChange,
  options = DEFAULT_DURATION_OPTIONS,
  allowFullDay = true,
  allowCustom = true,
  label,
  required,
  optional,
  helperText,
  error,
  style,
}: DurationPickerProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();
  const [customMode, setCustomMode] = useState(false);
  const isPreset = value !== null && (options.includes(value) || (allowFullDay && value === FULL_DAY_MINUTES));
  const showCustom = allowCustom && (customMode || (value !== null && !isPreset));

  const select = (minutes: number) => {
    setCustomMode(false);
    // Tapping the selected chip again clears an optional value.
    onChange(value === minutes && !required ? null : minutes);
  };

  const adjust = (delta: number) => {
    const base = value ?? 60;
    onChange(Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, base + delta)));
  };

  return (
    <Field label={label} required={required} optional={optional} helperText={helperText} error={error} style={style}>
      <View style={styles.chips}>
        {options.map((minutes) => (
          <Chip key={minutes} label={format.duration(minutes)} selected={!showCustom && value === minutes} onPress={() => select(minutes)} />
        ))}
        {allowFullDay ? (
          <Chip
            label={t('duration.fullDay')}
            icon="weather-sunny"
            selected={!showCustom && value === FULL_DAY_MINUTES}
            onPress={() => select(FULL_DAY_MINUTES)}
          />
        ) : null}
        {allowCustom ? (
          <Chip
            label={t('duration.other')}
            icon="tune-variant"
            selected={showCustom}
            onPress={() => {
              setCustomMode(true);
              if (value === null) onChange(150);
            }}
          />
        ) : null}
      </View>
      {showCustom ? (
        <View style={styles.custom}>
          <AppText variant="caption" color="secondary" style={styles.customLabel}>
            {t('duration.custom')}
          </AppText>
          <IconButton
            icon="minus"
            variant="outline"
            accessibilityLabel={t('a11y.decrease')}
            disabled={(value ?? 0) <= CUSTOM_MIN}
            onPress={() => adjust(-CUSTOM_STEP)}
          />
          <AppText variant="subheading" tabular align="center" style={styles.customValue} accessibilityLiveRegion="polite">
            {format.duration(value ?? 60)}
          </AppText>
          <IconButton
            icon="plus"
            variant="outline"
            accessibilityLabel={t('a11y.increase')}
            disabled={(value ?? 0) >= CUSTOM_MAX}
            onPress={() => adjust(CUSTOM_STEP)}
          />
        </View>
      ) : null}
    </Field>
  );
}

const useStyles = makeStyles((t) => ({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  custom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    marginTop: t.spacing.sm,
    padding: t.spacing.md,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.surfaceMuted,
  },
  customLabel: {
    flex: 1,
  },
  customValue: {
    minWidth: 96,
  },
}));
