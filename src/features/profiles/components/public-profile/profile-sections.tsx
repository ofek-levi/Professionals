import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppMap } from '@/components/map';
import { AppText, Badge, Button, Card, Chip, Divider, Icon, KeyValueRow, PriceText, useNow, type IconName } from '@/components/ui';
import type { StatusTone } from '@/constants/tones';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { ProfessionalProfile } from '@/types/domain';
import { regionForRadius } from '@/utils/geo';

import { BIO_PREVIEW_LINES, buildWeeklySchedule, isKnownLanguageCode, isLongBio } from './public-profile-model';

// ─────────────────────────────── Section shell ───────────────────────────────

export function ProfileSection({
  title,
  icon,
  trailing,
  children,
  testID,
}: {
  title: string;
  icon: IconName;
  trailing?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <Card padding="lg" testID={testID}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Icon name={icon} size={18} color="primary" />
        </View>
        <AppText variant="heading" accessibilityRole="header" style={styles.flex}>
          {title}
        </AppText>
        {trailing}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Card>
  );
}

// ─────────────────────────────── Stats ───────────────────────────────

function StatBox({ icon, tone, value, label }: { icon: IconName; tone: StatusTone; value: string; label: string }) {
  const theme = useTheme();
  const styles = useStyles();
  const colors = theme.colors.tones[tone];
  return (
    <View style={styles.statBox} accessible accessibilityLabel={`${value} ${label}`}>
      <View style={[styles.statIcon, { backgroundColor: colors.bg }]}>
        <Icon name={icon} size={18} color={colors.fg} />
      </View>
      <AppText variant="heading" tabular numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" color="secondary" numberOfLines={2} align="center">
        {label}
      </AppText>
    </View>
  );
}

/** Years of experience, completed jobs and typical response time. */
export function ProfileStats({ profile }: { profile: ProfessionalProfile }) {
  const styles = useStyles();
  const { t } = useTranslation('profile');
  const format = useFormatters();
  const response = profile.stats.responseTimeMinutes;
  return (
    <View style={styles.stats}>
      <StatBox
        icon="briefcase-outline"
        tone="brand"
        value={format.number(profile.yearsOfExperience)}
        label={t('public.stats.years', { count: profile.yearsOfExperience })}
      />
      <StatBox
        icon="check-decagram-outline"
        tone="success"
        value={format.number(profile.stats.completedJobsCount)}
        label={t('public.stats.jobs', { count: profile.stats.completedJobsCount })}
      />
      <StatBox
        icon="lightning-bolt-outline"
        tone="warning"
        value={response !== null ? format.duration(response, 'short') : t('public.stats.noResponseTime')}
        label={t('public.stats.response')}
      />
    </View>
  );
}

// ─────────────────────────────── About ───────────────────────────────

export function AboutSection({ profile }: { profile: ProfessionalProfile }) {
  const { t } = useTranslation(['profile', 'common']);
  const [expanded, setExpanded] = useState(false);
  const bio = profile.bio.trim();
  const long = isLongBio(bio);
  return (
    <ProfileSection title={t('profile:public.about')} icon="account-details-outline" testID="profile-about">
      {bio ? (
        <>
          <AppText variant="body" color="secondary" numberOfLines={expanded || !long ? undefined : BIO_PREVIEW_LINES} userContent>
            {bio}
          </AppText>
          {long ? (
            <Button
              label={expanded ? t('common:actions.showLess') : t('profile:public.readMore')}
              variant="ghost"
              size="sm"
              rightIcon={expanded ? 'chevron-up' : 'chevron-down'}
              onPress={() => setExpanded((value) => !value)}
            />
          ) : null}
        </>
      ) : (
        <AppText variant="body" color="muted">
          {t('profile:public.noBio')}
        </AppText>
      )}
    </ProfileSection>
  );
}

// ─────────────────────────────── Service area ───────────────────────────────

export function ServiceAreaSection({ profile }: { profile: ProfessionalProfile }) {
  const styles = useStyles();
  const { t } = useTranslation('profile');
  const format = useFormatters();
  const { center, radiusKm, label } = profile.serviceArea;
  return (
    <ProfileSection title={t('public.serviceArea')} icon="map-marker-radius-outline" testID="profile-service-area">
      <AppMap
        style={styles.map}
        interactive={false}
        initialRegion={regionForRadius(center, radiusKm * 1.1)}
        circles={[{ center, radiusKm, tone: 'accent' }]}
        markers={[{ id: 'base', coordinate: center, icon: 'account-hard-hat', tone: 'accent' }]}
        accessibilityLabel={t('public.serviceAreaA11y', { area: label, radius: format.distance(radiusKm) })}
      />
      <View style={styles.areaRow}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{label}</AppText>
          <AppText variant="caption" color="secondary">
            {t('public.radius', { radius: format.distance(radiusKm) })}
          </AppText>
        </View>
        <Badge label={format.distance(radiusKm)} icon="radius-outline" tone="accent" />
      </View>
    </ProfileSection>
  );
}

// ─────────────────────────────── Availability ───────────────────────────────

export function AvailabilitySection({ profile }: { profile: ProfessionalProfile }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['profile', 'common']);
  const now = useNow(10 * 60_000);
  const rows = buildWeeklySchedule(profile.availability, now);
  return (
    <ProfileSection
      title={t('profile:public.availability')}
      icon="calendar-clock"
      testID="profile-availability"
      trailing={
        profile.availability.acceptsEmergencyCalls ? (
          <Badge label={t('profile:public.emergencyShort')} icon="alarm-light-outline" tone="danger" size="sm" style={styles.centered} />
        ) : undefined
      }
    >
      <View style={styles.table}>
        {rows.map((row) => (
          <View
            key={row.day}
            style={[styles.dayRow, row.isToday ? { backgroundColor: theme.colors.primarySoft } : null]}
            accessible
            accessibilityLabel={`${t(`common:weekdays.${row.day}`)}, ${
              row.isOpen ? t('profile:public.hours', { start: row.start, end: row.end }) : t('profile:public.closed')
            }`}
          >
            <View style={styles.dayName}>
              <AppText variant={row.isToday ? 'bodyStrong' : 'body'} color={row.isToday ? 'primary' : 'default'}>
                {t(`common:weekdays.${row.day}`)}
              </AppText>
              {row.isToday ? <Badge label={t('common:time.today')} tone="brand" size="sm" variant="solid" /> : null}
            </View>
            {row.isOpen ? (
              <AppText variant={row.isToday ? 'bodyStrong' : 'body'} tabular color={row.isToday ? 'primary' : 'default'}>
                {t('profile:public.hours', { start: row.start, end: row.end })}
              </AppText>
            ) : (
              <AppText variant="body" color="muted">
                {t('profile:public.closed')}
              </AppText>
            )}
          </View>
        ))}
      </View>
      {profile.availability.acceptsEmergencyCalls ? (
        <AppText variant="caption" color="secondary">
          {t('profile:public.emergencyHint')}
        </AppText>
      ) : null}
    </ProfileSection>
  );
}

// ─────────────────────────────── Business ───────────────────────────────

export function BusinessSection({ profile }: { profile: ProfessionalProfile }) {
  const styles = useStyles();
  const { t } = useTranslation(['profile', 'common']);
  const { business } = profile;
  const languageName = (code: string) => {
    const normalized = code.toLowerCase();
    return isKnownLanguageCode(normalized) ? t(`profile:public.languages.${normalized}`) : code.toUpperCase();
  };
  return (
    <ProfileSection title={t('profile:public.business')} icon="domain" testID="profile-business">
      <KeyValueRow icon="store-outline" label={t('profile:public.businessName')} value={business.businessName ?? t('profile:public.notProvided')} />
      <Divider />
      <KeyValueRow icon="card-account-details-outline" label={t('profile:public.license')} value={business.licenseNumber ?? t('profile:public.notProvided')} />
      <Divider />
      <KeyValueRow
        icon="shield-check-outline"
        label={t('profile:public.insurance')}
        value={
          <Badge
            label={business.isInsured ? t('profile:public.insured') : t('profile:public.notInsured')}
            tone={business.isInsured ? 'success' : 'neutral'}
            icon={business.isInsured ? 'check' : 'minus'}
            size="sm"
          />
        }
      />
      {business.languages.length > 0 ? (
        <>
          <Divider />
          <View style={styles.languages}>
            <View style={styles.languagesLabel}>
              <Icon name="translate" size={18} color="muted" />
              <AppText variant="caption" color="muted">
                {t('profile:public.languagesLabel')}
              </AppText>
            </View>
            <View style={styles.languageChips}>
              {business.languages.map((code) => (
                <Chip key={code} label={languageName(code)} size="sm" />
              ))}
            </View>
          </View>
        </>
      ) : null}
    </ProfileSection>
  );
}

// ─────────────────────────────── Starting price ───────────────────────────────

export function StartingPriceCard({ profile }: { profile: ProfessionalProfile }) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('profile');
  if (!profile.startingPrice) return null;
  return (
    <View style={[styles.price, { backgroundColor: theme.colors.tones.accent.bg }]} testID="profile-starting-price">
      <View style={[styles.priceIcon, { backgroundColor: theme.colors.surface }]}>
        <Icon name="tag-outline" size={22} color="accent" />
      </View>
      <View style={styles.flex}>
        <AppText variant="caption" color="secondary">
          {t('public.startingPrice')}
        </AppText>
        <PriceText amount={profile.startingPrice.amount} currency={profile.startingPrice.currency} variant="title" />
      </View>
      <AppText variant="caption" color="secondary" style={styles.priceNote}>
        {t('public.priceNote')}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  // Badges align to the top by default; in the header they sit on the title's center line.
  centered: {
    alignSelf: 'center',
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBody: {
    marginTop: t.spacing.md,
    gap: t.spacing.md,
  },
  stats: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    height: 170,
    borderRadius: t.radii.md,
    overflow: 'hidden',
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  table: {
    gap: t.spacing.xxs,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radii.sm,
  },
  dayName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  languages: {
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  },
  languagesLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  languageChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.xs,
  },
  price: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.lg,
    borderRadius: t.radii.lg,
  },
  priceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceNote: {
    maxWidth: 120,
  },
}));
