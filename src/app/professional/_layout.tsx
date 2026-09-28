import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequireRole } from '@/features/auth/role-guards';
import { useInboxCounts } from '@/features/notifications/inbox-counts';
import { buildTabScreenOptions, formatTabBadge, tabBarIcon } from '@/providers';
import { useTheme } from '@/theme';

export default function ProfessionalTabsLayout() {
  const access = useRequireRole('professional');
  if (access.state === 'pending') return null;
  if (access.state === 'redirect') return <Redirect href={access.href} />;
  return <ProfessionalTabs />;
}

/** Professional tabs: Home · Explore · Work · Inbox · Profile. */
function ProfessionalTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');
  // Inbox badge: unread updates + unread chat messages.
  const unread = useInboxCounts().total;
  const inboxLabel = t('tabs.inbox');

  return (
    <Tabs screenOptions={buildTabScreenOptions(theme, insets.bottom)}>
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: tabBarIcon({ idle: 'home-outline', focused: 'home' }),
          tabBarButtonTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.explore'),
          tabBarIcon: tabBarIcon({ idle: 'compass-outline', focused: 'compass' }),
          tabBarButtonTestID: 'tab-explore',
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: t('tabs.work'),
          tabBarIcon: tabBarIcon({ idle: 'briefcase-outline', focused: 'briefcase' }),
          tabBarButtonTestID: 'tab-work',
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: inboxLabel,
          tabBarIcon: tabBarIcon({ idle: 'chatbubble-ellipses-outline', focused: 'chatbubble-ellipses' }),
          tabBarBadge: formatTabBadge(unread),
          tabBarAccessibilityLabel: unread > 0 ? `${inboxLabel}, ${t('a11y.unreadCount', { count: unread })}` : inboxLabel,
          tabBarButtonTestID: 'tab-inbox',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: tabBarIcon({ idle: 'person-circle-outline', focused: 'person-circle' }),
          tabBarButtonTestID: 'tab-profile',
        }}
      />
    </Tabs>
  );
}
