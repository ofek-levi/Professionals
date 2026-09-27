import { Controller, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DateSlotPicker, useTranslatedError } from '@/components/forms';
import { UrgencyPicker } from '@/components/requests';
import { AppText, Chip, Field, InlineAlert, type IconName } from '@/components/ui';
import { makeStyles } from '@/theme';
import { PREFERRED_TIME_WINDOWS, type PreferredTimeWindow } from '@/types/domain';

import type { RequestFormControl } from './form-types';
import { StepIntro } from './step-intro';

/** Days offered in the preferred-date strip. */
const DATE_DAYS = 21;

const WINDOW_ICONS: Record<PreferredTimeWindow, IconName> = {
  morning: 'weather-sunset-up',
  afternoon: 'white-balance-sunny',
  evening: 'weather-night',
  any: 'clock-outline',
};

export interface ScheduleStepProps {
  control: RequestFormControl;
}

/** Step 4 – urgency (how fast) and an optional preferred date + time window (when). */
export function ScheduleStep({ control }: ScheduleStepProps) {
  const styles = useStyles();
  const { t } = useTranslation(['requests', 'common']);
  const translateError = useTranslatedError();
  const preferredDate = useWatch({ control, name: 'preferredDate' });

  return (
    <View style={styles.container}>
      <StepIntro icon="clock-fast" title={t('requests:schedule.title')} subtitle={t('requests:schedule.subtitle')} />

      <Controller
        control={control}
        name="urgency"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <Field label={t('requests:schedule.urgencyLabel')} required error={translateError(error?.message)}>
            <UrgencyPicker value={value} onChange={onChange} />
          </Field>
        )}
      />

      <InlineAlert tone="info" icon="information-outline" title={t('requests:schedule.hintTitle')} message={t('requests:schedule.hint')} />

      <View style={styles.dateBlock}>
        <View style={styles.dateHeader}>
          <AppText variant="heading" accessibilityRole="header">
            {t('requests:schedule.dateTitle')}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('common:optional')}
          </AppText>
        </View>
        <AppText variant="caption" color="secondary">
          {t('requests:schedule.dateSubtitle')}
        </AppText>

        <Controller
          control={control}
          name="preferredDate"
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <View style={styles.dateBlock}>
              <Chip
                label={t('requests:schedule.flexible')}
                icon="calendar-range"
                selected={!value}
                onPress={() => onChange(null)}
                testID="wizard-date-flexible"
              />
              <DateSlotPicker value={value ?? null} onChange={onChange} days={DATE_DAYS} error={translateError(error?.message)} />
            </View>
          )}
        />

        {preferredDate ? (
          <Controller
            control={control}
            name="preferredTimeWindow"
            render={({ field: { value, onChange } }) => (
              <Field label={t('requests:schedule.timeWindowLabel')}>
                <View style={styles.windows} accessibilityRole="radiogroup">
                  {PREFERRED_TIME_WINDOWS.map((window) => (
                    <Chip
                      key={window}
                      label={t(`common:timeWindow.${window}`)}
                      icon={WINDOW_ICONS[window]}
                      selected={value === window}
                      onPress={() => onChange(window)}
                      testID={`wizard-window-${window}`}
                    />
                  ))}
                </View>
              </Field>
            )}
          />
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.xl,
  },
  dateBlock: {
    gap: t.spacing.md,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  windows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
}));
