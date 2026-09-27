import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryChip } from '@/components/categories';
import { AppText, Avatar, Badge, Card, Chip, Icon } from '@/components/ui';
import { makeStyles, useTheme } from '@/theme';
import type { DemoAccount } from '@/types/domain';

/** Categories shown on a professional's card before collapsing into "+N". */
const MAX_VISIBLE_CATEGORIES = 3;

export interface DemoAccountCardProps {
  account: DemoAccount;
  onPress: () => void;
  /** This account is signing in. */
  loading?: boolean;
  /** Another account is signing in. */
  disabled?: boolean;
}

/** A demo identity to sign in with: who they are, where, and what the account showcases. */
export function DemoAccountCard({ account, onPress, loading = false, disabled = false }: DemoAccountCardProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['auth', 'common']);
  const roleLabel = t(`common:roles.${account.role}`);
  const isProfessional = account.role === 'professional';
  const visibleCategories = account.categoryIds.slice(0, MAX_VISIBLE_CATEGORIES);
  const hiddenCategories = account.categoryIds.length - visibleCategories.length;

  return (
    <Card
      onPress={onPress}
      disabled={disabled || loading}
      highlighted={loading}
      accessibilityLabel={t('auth:signIn.accountA11yLabel', { name: account.displayName, role: roleLabel, city: account.city })}
      accessibilityHint={t('auth:signIn.accountA11yHint')}
      testID={`demo-account-${account.userId}`}
    >
      <View style={styles.header}>
        <Avatar name={account.displayName} uri={account.avatarUrl} size="lg" decorative />
        <View style={styles.identity}>
          <AppText variant="subheading" numberOfLines={1}>
            {account.displayName}
          </AppText>
          <View style={styles.metaRow}>
            <Badge
              label={roleLabel}
              tone={isProfessional ? 'accent' : 'brand'}
              icon={isProfessional ? 'hammer-wrench' : 'account-outline'}
              size="sm"
            />
            {account.city ? (
              <View style={styles.city}>
                <Icon name="map-marker-outline" size={14} color="muted" />
                <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.shrink}>
                  {account.city}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} accessibilityLabel={t('auth:signIn.signingIn')} />
        ) : (
          <View style={styles.chevron}>
            <Icon name="chevron-right" size={20} color="primary" flipInRTL />
          </View>
        )}
      </View>

      {account.description ? (
        <AppText variant="body" color="secondary" style={styles.description}>
          {account.description}
        </AppText>
      ) : null}

      {isProfessional && visibleCategories.length > 0 ? (
        <View style={styles.categories}>
          {visibleCategories.map((categoryId) => (
            <CategoryChip key={categoryId} categoryId={categoryId} size="sm" />
          ))}
          {hiddenCategories > 0 ? (
            <Chip
              label={t('common:pro.moreCategories', { count: hiddenCategories })}
              accessibilityLabel={t('auth:signIn.moreCategories', { count: hiddenCategories })}
              size="sm"
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  identity: {
    flex: 1,
    gap: t.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  city: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xxs,
    flexShrink: 1,
  },
  shrink: {
    flexShrink: 1,
  },
  chevron: {
    width: 32,
    height: 32,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    marginTop: t.spacing.md,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.xs + 2,
    marginTop: t.spacing.md,
  },
}));
