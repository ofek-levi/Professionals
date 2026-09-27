import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Avatar, Badge, Button, Card, ErrorState, Skeleton, useConfirm, useToast } from '@/components/ui';
import { useAuthActions } from '@/features/auth/session-provider';
import { useCurrentUser } from '@/hooks/queries/use-auth-queries';
import { makeStyles } from '@/theme';

/** The signed-in demo identity with "Switch account" and "Sign out". */
export function AccountCard() {
  const styles = useStyles();
  const { t } = useTranslation(['settings', 'auth', 'common']);
  const confirm = useConfirm();
  const toast = useToast();
  const { signOut } = useAuthActions();
  const currentUser = useCurrentUser();
  const user = currentUser.data?.user;

  // Signing out removes the signed-in routes; the entry route then shows the sign-in screen.
  const switchAccount = () => {
    void signOut();
  };

  const confirmSignOut = async () => {
    const confirmed = await confirm({
      title: t('settings:account.signOutConfirmTitle'),
      message: t('settings:account.signOutConfirmMessage'),
      confirmLabel: t('settings:account.signOut'),
      icon: 'logout',
      destructive: true,
    });
    if (!confirmed) return;
    await signOut();
    toast.show({ title: t('auth:session.signedOut'), tone: 'neutral', icon: 'logout' });
  };

  return (
    <Card variant="elevated" padding="lg" style={styles.card}>
      {user ? (
        <View style={styles.identity}>
          <Avatar name={user.displayName} uri={user.avatarUrl} size="lg" decorative />
          <View style={styles.texts}>
            <AppText variant="caption" color="muted">
              {t('settings:account.signedInAs')}
            </AppText>
            <AppText variant="heading" numberOfLines={1}>
              {user.displayName}
            </AppText>
            <View style={styles.meta}>
              <Badge
                label={t(`common:roles.${user.role}`)}
                tone={user.role === 'professional' ? 'accent' : 'brand'}
                icon={user.role === 'professional' ? 'hammer-wrench' : 'account-outline'}
                size="sm"
                style={styles.noShrink}
              />
              <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.shrink}>
                {user.email}
              </AppText>
            </View>
          </View>
        </View>
      ) : currentUser.isError ? (
        <ErrorState
          compact
          error={currentUser.error}
          description={t('settings:account.loadError')}
          onRetry={() => void currentUser.refetch()}
          retrying={currentUser.isRefetching}
        />
      ) : (
        <View style={styles.identity}>
          <Skeleton circle height={64} />
          <View style={styles.texts}>
            <Skeleton width="30%" height={12} />
            <Skeleton width="60%" height={18} />
            <Skeleton width="45%" height={12} />
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <Button
          label={t('settings:account.switchAccount')}
          accessibilityHint={t('settings:account.switchAccountHint')}
          variant="secondary"
          leftIcon="account-switch-outline"
          onPress={switchAccount}
          style={styles.action}
          fullWidth
        />
        <Button
          label={t('settings:account.signOut')}
          variant="outline"
          leftIcon="logout"
          flipIconsInRTL
          onPress={() => void confirmSignOut()}
          style={styles.action}
          fullWidth
        />
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    gap: t.spacing.lg,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.lg,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginTop: t.spacing.xxs,
  },
  shrink: {
    flexShrink: 1,
  },
  // The role badge keeps its full label; a long email is truncated instead.
  noShrink: {
    flexShrink: 0,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.md,
  },
  action: {
    flexGrow: 1,
    flexBasis: 140,
  },
}));
