import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { useRequireRole } from '@/features/auth/role-guards';
import { useUnreadNotificationsCount } from '@/hooks/queries';
import { buildTabScreenOptions, formatTabBadge, tabBarIcon } from '@/providers';
import { useTheme } from '@/theme';

export default function ProfessionalTabsLayout() {
  const access = useRequireRole('professional');
  if (access.state === 'pending') return null;
  if (access.state === 'redirect') return <Redirect href={access.href} />;
  return <ProfessionalTabs />;
}

function ProfessionalTabs() {
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
        name="explore"
        options={{ title: t('tabs.explore'), tabBarIcon: tabBarIcon({ idle: 'map-search-outline', focused: 'map-search' }) }}
      />
      <Tabs.Screen
        name="offers"
        options={{ title: t('tabs.offers'), tabBarIcon: tabBarIcon({ idle: 'tag-outline', focused: 'tag' }) }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ title: t('tabs.jobs'), tabBarIcon: tabBarIcon({ idle: 'briefcase-outline', focused: 'briefcase' }) }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: notificationsLabel,
          // Six tabs leave no room for the full word under the icon.
          tabBarLabel: t('tabs.notificationsShort'),
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
