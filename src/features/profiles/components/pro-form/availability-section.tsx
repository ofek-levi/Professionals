/**
 * Weekly working hours: one row per day with an on/off switch and start–end times (picked in a
 * sheet), plus "accepts emergency calls".
 */
import { useState } from 'react';
import { useController, useWatch, type Control } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FormSection, TimeSlotPicker, useTranslatedError } from '@/components/forms';
import { AppSwitch, AppText, Divider, InlineAlert, Sheet, SwitchRow } from '@/components/ui';
import type { ProfessionalProfileFormValues } from '@/lib/validation';
import { makeStyles } from '@/theme';
import { WEEKDAYS, type Weekday } from '@/types/domain';

import { adjustEndForStart, firstEndOption, firstNestedMessage, LATEST_DAY_END, LATEST_DAY_START } from './pro-form-model';

type Editing = { day: Weekday; edge: 'start' | 'end' } | null;

export function AvailabilitySection({ control }: { control: Control<ProfessionalProfileFormValues> }) {
  const styles = useStyles();
  const { t } = useTranslation(['professional', 'common']);
  const translateError = useTranslatedError();
  const days = useController({ control, name: 'availability.days' });
  const emergency = useController({ control, name: 'availability.acceptsEmergencyCalls' });
  const values = useWatch({ control, name: 'availability.days' });
  const [editing, setEditing] = useState<Editing>(null);

  const updateDay = (day: Weekday, patch: Partial<(typeof values)[Weekday]>) => {
    days.field.onChange({ ...values, [day]: { ...values[day], ...patch } });
  };

  const daysError = days.fieldState.error?.message ?? firstNestedMessage(days.fieldState.error);
  const editingDay = editing ? values[editing.day] : null;

  return (
    <FormSection title={t('professional:form.hours.title')} description={t('professional:form.hours.description')} icon="calendar-clock-outline">
      <View style={styles.days}>
        {WEEKDAYS.map((day, index) => (
          <View key={day}>
            {index > 0 ? <Divider /> : null}
            <DayRow
              label={t(`common:weekdays.${day}`)}
              enabled={values[day].enabled}
              start={values[day].start}
              end={values[day].end}
              offLabel={t('professional:form.hours.dayOff')}
              onToggle={(enabled) => updateDay(day, { enabled })}
              onEditStart={() => setEditing({ day, edge: 'start' })}
              onEditEnd={() => setEditing({ day, edge: 'end' })}
              testID={`pro-form-day-${day}`}
            />
          </View>
        ))}
      </View>
      {daysError ? <InlineAlert tone="danger" message={translateError(daysError) ?? ''} /> : null}

      <SwitchRow
        icon="alarm-light-outline"
        iconTone="danger"
        title={t('professional:form.hours.emergency')}
        description={t('professional:form.hours.emergencyDescription')}
        value={emergency.field.value}
        onValueChange={emergency.field.onChange}
        testID="pro-form-emergency"
      />

      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing
            ? t(editing.edge === 'start' ? 'professional:form.hours.pickStart' : 'professional:form.hours.pickEnd', {
                day: t(`common:weekdays.${editing.day}`),
              })
            : undefined
        }
      >
        {editing && editingDay ? (
          <TimeSlotPicker
            value={editing.edge === 'start' ? editingDay.start : editingDay.end}
            startTime={editing.edge === 'start' ? '05:00' : firstEndOption(editingDay.start)}
            endTime={editing.edge === 'start' ? LATEST_DAY_START : '23:59'}
            onChange={(time) => {
              if (editing.edge === 'start') {
                updateDay(editing.day, { start: time, end: adjustEndForStart(time, editingDay.end, editingDay.start) });
              } else {
                updateDay(editing.day, { end: time > LATEST_DAY_END ? LATEST_DAY_END : time });
              }
              setEditing(null);
            }}
          />
        ) : null}
      </Sheet>
    </FormSection>
  );
}

interface DayRowProps {
  label: string;
  enabled: boolean;
  start: string;
  end: string;
  offLabel: string;
  onToggle: (enabled: boolean) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  testID?: string;
}

function DayRow({ label, enabled, start, end, offLabel, onToggle, onEditStart, onEditEnd, testID }: DayRowProps) {
  const styles = useStyles();
  const { t } = useTranslation('professional');
  return (
    <View style={styles.dayRow} testID={testID}>
      <AppSwitch value={enabled} onValueChange={onToggle} accessibilityLabel={t('form.hours.toggleA11y', { day: label })} />
      <AppText variant="bodyStrong" style={styles.dayName} numberOfLines={1}>
        {label}
      </AppText>
      {enabled ? (
        <View style={styles.times}>
          <TimeButton value={start} label={t('form.hours.startA11y', { day: label })} onPress={onEditStart} />
          <AppText variant="caption" color="muted">
            –
          </AppText>
          <TimeButton value={end} label={t('form.hours.endA11y', { day: label })} onPress={onEditEnd} />
        </View>
      ) : (
        <AppText variant="caption" color="muted" style={styles.off}>
          {offLabel}
        </AppText>
      )}
    </View>
  );
}

function TimeButton({ value, label, onPress }: { value: string; label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.timeButton, pressed ? styles.pressed : null]}
    >
      <AppText variant="captionStrong" tabular>
        {value}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  days: {
    borderRadius: t.radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: t.spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: 56,
  },
  dayName: {
    flex: 1,
  },
  times: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  off: {
    paddingHorizontal: t.spacing.sm,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.surfaceMuted,
  },
  pressed: {
    opacity: 0.7,
  },
}));
