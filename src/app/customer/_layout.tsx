import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { useRequireRole } from '@/features/auth/role-guards';
import { useUnreadNotificationsCount } from '@/hooks/queries';
import { buildTabScreenOptions, formatTabBadge, tabBarIcon } from '@/providers';
import { useTheme } from '@/theme';

export default function CustomerTabsLayout() {
  const access = useRequireRole('customer');
  if (access.state === 'pending') return null;
  if (access.state === 'redirect') return <Redirect href={access.href} />;
  return <CustomerTabs />;
}

function CustomerTabs() {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const unread = useUnreadNotificationsCount().data ?? 0;
  const notificationsLabel = t('tabs.notifications');

  return (
    <Tabs screenOptions={buildTabScreenOptions(theme)}>
      <Tabs.Screen
        name="home"
        options={{ title: t('tabs.home'), tabBarIcon: tabBarIcon({ idle: 'home-outline', focused: 'home' }) }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: t('tabs.requests'),
          tabBarIcon: tabBarIcon({ idle: 'clipboard-text-outline', focused: 'clipboard-text' }),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: notificationsLabel,
          tabBarIcon: tabBarIcon({ idle: 'bell-outline', focused: 'bell' }),
          tabBarBadge: formatTabBadge(unread),
          tabBarAccessibilityLabel:
            unread > 0 ? `${notificationsLabel}, ${t('a11y.unreadCount', { count: unread })}` : notificationsLabel,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: tabBarIcon({ idle: 'account-circle-outline', focused: 'account-circle' }),
        }}
      />
    </Tabs>
  );
}
