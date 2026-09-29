/**
 * Building blocks of the Profile tab (both roles): the identity header and the account menu
 * (profile shortcuts, Settings, Switch account, Sign out). Signing out needs no confirmation: the
 * demo accounts are one tap away on the sign-in screen.
 */
import { useRouter } from 'expo-router';
import { Fragment, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Avatar, Card, ListItem, Skeleton, useToast } from '@/components/ui';
import { useAuthActions } from '@/features/auth';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';

interface AccountHeaderProps {
  name: string;
  avatarUrl: string | null;
  /** One line of secondary info (email, "★ 4.8 · 12 jobs done"). */
  subtitle?: ReactNode;
  verified?: boolean;
}

export function AccountHeader({ name, avatarUrl, subtitle, verified = false }: AccountHeaderProps) {
  const styles = useStyles();
  return (
    <View style={styles.header} testID="account-header">
      <Avatar name={name} uri={avatarUrl} size={64} verified={verified} />
      <View style={styles.headerTexts}>
        <AppText variant="heading" numberOfLines={2}>
          {name}
        </AppText>
        {typeof subtitle === 'string' ? (
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : (
          subtitle
        )}
      </View>
    </View>
  );
}

export function AccountHeaderSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Skeleton circle height={64} />
      <View style={[styles.headerTexts, styles.skeletonTexts]}>
        <Skeleton width="55%" height={18} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );
}

export interface AccountMenuItem {
  key: string;
  title: string;
  onPress: () => void;
}

/** Profile shortcuts (role specific) followed by Settings, Switch account and Sign out. */
export function AccountMenu({ items }: { items: readonly AccountMenuItem[] }) {
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation('settings');
  const { signOut } = useAuthActions();
  const [leaving, setLeaving] = useState(false);

  // Signing out resets the stack; the sign-in screen lists the demo accounts to switch to.
  const leave = async () => {
    setLeaving(true);
    try {
      await signOut();
    } catch {
      setLeaving(false);
      toast.show({ title: t('account.signOutFailed'), tone: 'danger' });
    }
  };

  const main: AccountMenuItem[] = [...items, { key: 'settings', title: t('title'), onPress: () => router.push(routes.settings) }];

  return (
    <View style={styles.menu}>
      <Card padding="none" style={styles.group}>
        {main.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <ListItem title={item.title} onPress={item.onPress} testID={`account-${item.key}`} />
          </Fragment>
        ))}
      </Card>
      <Card padding="none" style={styles.group}>
        <ListItem title={t('account.switchAccount')} onPress={() => void leave()} disabled={leaving} testID="account-switch" />
        <View style={styles.divider} />
        <ListItem
          title={t('account.signOut')}
          destructive
          showChevron={false}
          onPress={() => void leave()}
          disabled={leaving}
          testID="account-sign-out"
        />
      </Card>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.lg,
  },
  headerTexts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  skeletonTexts: {
    gap: t.spacing.sm,
  },
  menu: {
    gap: t.spacing.xl,
  },
  group: {
    paddingHorizontal: t.spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
}));
