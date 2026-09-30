import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryChip } from '@/components/categories';
import { AppText, Card, SectionHeader } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { ProfessionalProfile } from '@/types/domain';

import { BIO_PREVIEW_LINES, groupWorkingHours, isLongBio } from './public-profile-model';

// ─────────────────────────────── Section shell ───────────────────────────────

export function ProfileSection({
  title,
  actionLabel,
  onAction,
  children,
  testID,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section} testID={testID}>
      <SectionHeader title={title} actionLabel={actionLabel} onAction={onAction} style={styles.sectionHeader} />
      {children}
    </View>
  );
}

// ─────────────────────────────── About ───────────────────────────────

export function AboutSection({ profile }: { profile: ProfessionalProfile }) {
  const styles = useStyles();
  const { t } = useTranslation(['profile', 'common']);
  const [expanded, setExpanded] = useState(false);
  const bio = profile.bio.trim();
  if (!bio) return null;
  const long = isLongBio(bio);
  return (
    <ProfileSection title={t('profile:public.about')} testID="profile-about">
      <AppText variant="body" color="secondary" numberOfLines={expanded || !long ? undefined : BIO_PREVIEW_LINES} userContent>
        {bio}
      </AppText>
      {long ? (
        <Pressable
          accessibilityRole="button"
          aria-expanded={expanded}
          onPress={() => setExpanded((value) => !value)}
          hitSlop={10}
          style={styles.more}
        >
          <AppText variant="captionStrong" color="primary">
            {expanded ? t('common:actions.showLess') : t('profile:public.readMore')}
          </AppText>
        </Pressable>
      ) : null}
    </ProfileSection>
  );
}

// ─────────────────────────────── Services ───────────────────────────────

export function ServicesSection({ profile }: { profile: ProfessionalProfile }) {
  const styles = useStyles();
  const { t } = useTranslation('profile');
  if (profile.categoryIds.length === 0) return null;
  return (
    <ProfileSection title={t('public.services')} testID="profile-services">
      <View style={styles.chips}>
        {profile.categoryIds.map((id) => (
          <CategoryChip key={id} categoryId={id} size="sm" />
        ))}
      </View>
    </ProfileSection>
  );
}

// ─────────────────────────────── Area & hours ───────────────────────────────

/** "Serves Tel Aviv-Yafo · within 20 km", credentials and the compact weekly hours. */
export function AreaAndHoursSection({ profile }: { profile: ProfessionalProfile }) {
  const styles = useStyles();
  const { t } = useTranslation(['profile', 'common']);
  const format = useFormatters();
  const { serviceArea, business, availability } = profile;
  const credentials: string[] = [];
  if (business.licenseNumber) credentials.push(t('profile:public.licensed'));
  if (business.isInsured) credentials.push(t('profile:public.insured'));
  const dayName = (day: keyof typeof availability.days) => t(`common:weekdaysShort.${day}`);

  return (
    <ProfileSection title={t('profile:public.areaAndHours')} testID="profile-area-hours">
      <Card padding="none" style={styles.card}>
        <View style={styles.row}>
          <AppText variant="body">
            {t('profile:public.serves', { area: serviceArea.label, radius: format.distance(serviceArea.radiusKm) })}
          </AppText>
          {credentials.length > 0 ? (
            <AppText variant="caption" color="secondary">
              {credentials.join(' · ')}
            </AppText>
          ) : null}
        </View>
        <View style={[styles.row, styles.divider]}>
          {groupWorkingHours(availability).map((row) => {
            const days = row.first === row.last ? dayName(row.first) : t('profile:public.dayRange', { first: dayName(row.first), last: dayName(row.last) });
            const hours = row.isOpen ? t('profile:public.hours', { start: row.start, end: row.end }) : t('profile:public.closed');
            return (
              <View key={row.first} style={styles.hoursRow} accessible accessibilityLabel={`${days}, ${hours}`}>
                <AppText variant="body">{days}</AppText>
                <AppText variant="body" color={row.isOpen ? 'default' : 'muted'} tabular>
                  {hours}
                </AppText>
              </View>
            );
          })}
          {availability.acceptsEmergencyCalls ? (
            <AppText variant="caption" color="secondary" style={styles.note}>
              {t('profile:public.emergencyHint')}
            </AppText>
          ) : null}
        </View>
      </Card>
    </ProfileSection>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.md,
  },
  sectionHeader: {
    marginBottom: 0,
  },
  more: {
    alignSelf: 'flex-start',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  card: {
    paddingHorizontal: t.spacing.lg,
  },
  row: {
    gap: t.spacing.xs,
    paddingVertical: t.spacing.md + 2,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: t.spacing.md,
  },
  note: {
    marginTop: t.spacing.xs,
  },
}));
