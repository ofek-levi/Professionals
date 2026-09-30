import { Linking, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { normalizeWebsite } from '@/lib/validation/common';
import { makeStyles } from '@/theme';
import type { ProfessionalContact } from '@/types/domain';

import { AppText } from '../ui/app-text';
import { Card } from '../ui/card';

interface ProfessionalContactCardProps {
  contact: ProfessionalContact;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface ContactRow {
  key: 'phone' | 'email' | 'website';
  value: string;
  url: string;
  a11y: string;
}

/** `tel:` link of a phone number as typed ("050-123 4567" → `tel:0501234567`). */
export function phoneUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** Opens a `tel:`, `mailto:` or web link in the phone, mail app or browser (nothing when none can). */
export function openContactLink(url: string): void {
  void Linking.openURL(url).catch(() => undefined);
}

/**
 * A hired professional's phone, email and website – the API sends them only to a customer who
 * hired them while the job is not cancelled. Each row opens the phone, the mail app or the browser.
 */
export function ProfessionalContactCard({ contact, style, testID }: ProfessionalContactCardProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const rows: ContactRow[] = [];
  if (contact.phone) {
    rows.push({
      key: 'phone',
      value: contact.phone,
      url: phoneUrl(contact.phone),
      a11y: t('contact.callA11y', { phone: contact.phone }),
    });
  }
  if (contact.email) {
    rows.push({
      key: 'email',
      value: contact.email,
      url: `mailto:${contact.email}`,
      a11y: t('contact.emailA11y', { email: contact.email }),
    });
  }
  if (contact.website) {
    rows.push({
      key: 'website',
      value: contact.website,
      url: normalizeWebsite(contact.website),
      a11y: t('contact.websiteA11y', { website: contact.website }),
    });
  }
  if (rows.length === 0) return null;

  return (
    <Card padding="none" style={[styles.card, style]} testID={testID}>
      <AppText variant="captionStrong" color="secondary" accessibilityRole="header" style={styles.title}>
        {t('contact.title')}
      </AppText>
      {rows.map((row) => (
        <Pressable
          key={row.key}
          accessibilityRole="link"
          accessibilityLabel={row.a11y}
          onPress={() => openContactLink(row.url)}
          style={({ pressed }) => [styles.row, styles.divider, pressed ? styles.pressed : null]}
          testID={testID ? `${testID}-${row.key}` : undefined}
        >
          <AppText variant="caption" color="muted">
            {t(`contact.${row.key}`)}
          </AppText>
          <AppText variant="bodyStrong" color="primary" numberOfLines={1}>
            {row.value}
          </AppText>
        </Pressable>
      ))}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    paddingHorizontal: t.spacing.lg,
  },
  title: {
    paddingTop: t.spacing.md + 2,
    paddingBottom: t.spacing.sm,
  },
  row: {
    gap: t.spacing.xxs,
    paddingVertical: t.spacing.md,
    minHeight: t.layout.minTouchSize,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
}));
