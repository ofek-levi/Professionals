import type { ReactNode } from 'react';
import { useFormState, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon, CategoryName } from '@/components/categories';
import { LocationSummary } from '@/components/location';
import { PhotoStrip, PreferredScheduleText, UrgencyBadge } from '@/components/requests';
import { AppText, Card, Icon, InlineAlert, type IconName } from '@/components/ui';
import { makeStyles, useTheme } from '@/theme';

import type { RequestFormControl } from './form-types';
import { StepIntro } from './step-intro';
import { formLocationToService, REQUEST_WIZARD_STEPS, STEP_FIELDS, type RequestWizardStep } from './wizard-model';

const NEXT_STEPS = [
  { key: 'notify', icon: 'bell-ring-outline' },
  { key: 'compare', icon: 'scale-balance' },
  { key: 'choose', icon: 'handshake-outline' },
] as const satisfies readonly { key: string; icon: IconName }[];

export interface ReviewStepProps {
  control: RequestFormControl;
  onEdit: (stepIndex: number) => void;
  /** General (non-field) problem from the last submit attempt. */
  submitError: string | null;
}

/** Step 5 – everything at a glance with "Edit" shortcuts, then publish or save as draft. */
export function ReviewStep({ control, onEdit, submitError }: ReviewStepProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['requests', 'common']);
  const [categoryId, description, formLocation, urgency, preferredDate, preferredTimeWindow, notesValue, formPhotos] = useWatch({
    control,
    name: ['categoryId', 'description', 'location', 'urgency', 'preferredDate', 'preferredTimeWindow', 'notes', 'photos'],
  });
  const { errors } = useFormState({ control });
  const location = formLocationToService(formLocation);
  const photos = formPhotos.map((photo) => ({ url: photo.uri }));
  const notes = notesValue.trim();

  const hasErrors = (step: RequestWizardStep) => STEP_FIELDS[step].some((field) => Boolean(errors[field]));

  const section = (step: RequestWizardStep, icon: IconName, children: ReactNode) => {
    const invalid = hasErrors(step);
    const index = REQUEST_WIZARD_STEPS.indexOf(step);
    const title = t(`requests:steps.${step}`);
    return (
      <Card padding="lg" style={invalid ? { borderColor: theme.colors.danger } : null} testID={`review-${step}`}>
        <View style={styles.sectionHeader}>
          <Icon name={icon} size={18} color={invalid ? 'danger' : 'primary'} />
          <AppText variant="subheading" style={styles.flex}>
            {title}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('requests:review.editA11y', { section: title })}
            onPress={() => onEdit(index)}
            hitSlop={12}
            style={({ pressed }) => [styles.edit, pressed ? styles.pressed : null]}
            testID={`review-edit-${step}`}
          >
            <Icon name="pencil-outline" size={15} color="primary" />
            <AppText variant="captionStrong" color="primary">
              {t('common:actions.edit')}
            </AppText>
          </Pressable>
        </View>
        {invalid ? (
          <AppText variant="caption" color="danger" style={styles.invalid}>
            {t('requests:review.needsAttention')}
          </AppText>
        ) : null}
        <View style={styles.sectionBody}>{children}</View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <StepIntro icon="clipboard-check-outline" title={t('requests:review.title')} subtitle={t('requests:review.subtitle')} />

      {submitError ? <InlineAlert tone="danger" title={t('requests:review.submitFailed')} message={submitError} /> : null}

      {section(
        'service',
        'toolbox-outline',
        <View style={styles.row}>
          <CategoryIcon categoryId={categoryId} size="md" />
          <CategoryName categoryId={categoryId} variant="bodyStrong" style={styles.flex} />
        </View>,
      )}

      {section(
        'details',
        'text-box-outline',
        <>
          <AppText variant="body" color={description ? 'default' : 'muted'} numberOfLines={6}>
            {description.trim() || t('requests:review.noDescription')}
          </AppText>
          {photos.length > 0 ? <PhotoStrip photos={photos} size={64} /> : null}
          {notes ? (
            <View style={styles.notes}>
              <Icon name="note-text-outline" size={16} color="muted" />
              <AppText variant="caption" color="secondary" style={styles.flex}>
                {notes}
              </AppText>
            </View>
          ) : null}
        </>,
      )}

      {section(
        'location',
        'map-marker-outline',
        location ? (
          <LocationSummary location={location} />
        ) : (
          <AppText variant="body" color="muted">
            {t('requests:review.noLocation')}
          </AppText>
        ),
      )}

      {section(
        'schedule',
        'clock-outline',
        <>
          {urgency ? (
            <View style={styles.row}>
              <UrgencyBadge level={urgency} />
              <AppText variant="caption" color="secondary" style={styles.flex}>
                {t(`common:urgency.${urgency}.description`)}
              </AppText>
            </View>
          ) : (
            <AppText variant="body" color="muted">
              {t('requests:review.noUrgency')}
            </AppText>
          )}
          <PreferredScheduleText
            schedule={preferredDate ? { date: preferredDate, timeWindow: preferredTimeWindow } : null}
            format="full"
            variant="bodyStrong"
            color="default"
            numberOfLines={2}
          />
        </>,
      )}

      <Card variant="flat" padding="lg">
        <AppText variant="subheading" style={styles.nextTitle}>
          {t('requests:review.next.title')}
        </AppText>
        {NEXT_STEPS.map((item) => (
          <View key={item.key} style={styles.nextRow}>
            <View style={[styles.nextIcon, { backgroundColor: theme.colors.surface }]}>
              <Icon name={item.icon} size={18} color="primary" />
            </View>
            <AppText variant="caption" color="secondary" style={styles.flex}>
              {t(`requests:review.next.${item.key}`)}
            </AppText>
          </View>
        ))}
      </Card>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.lg,
  },
  flex: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xxs,
    minHeight: 32,
    paddingHorizontal: t.spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  invalid: {
    marginTop: t.spacing.xs,
  },
  sectionBody: {
    marginTop: t.spacing.md,
    gap: t.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  notes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
  },
  nextTitle: {
    marginBottom: t.spacing.sm,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.xs,
  },
  nextIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
