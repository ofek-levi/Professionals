/**
 * `/settings` – language, appearance and notification preferences, the legal documents and
 * deleting the account. Signing out lives in the Profile tab.
 */
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, ListItem, Screen, SegmentedControl, type SegmentedOption } from '@/components/ui';
import { useAppLanguage } from '@/i18n/hooks';
import { LEGAL_DOCUMENTS, routes } from '@/lib/routes';
import { SUPPORTED_LANGUAGES } from '@/types/domain';

import { useNotificationPreferenceRows } from '../components/notification-preference-rows';
import { SettingsSection } from '../components/settings-section';
import { settingsStore, useSettings, type ColorSchemePreference } from '../settings-store';
import { useChangeLanguage } from '../use-change-language';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function SettingsScreen() {
  const { t } = useTranslation(['settings', 'common', 'legal']);
  const router = useRouter();
  const language = useAppLanguage();
  const changeLanguage = useChangeLanguage();
  const { colorScheme } = useSettings();
  const notificationRows = useNotificationPreferenceRows();

  const schemeOptions: SegmentedOption<ColorSchemePreference>[] = [
    { value: 'system', label: t('settings:appearance.system') },
    { value: 'light', label: t('settings:appearance.light') },
    { value: 'dark', label: t('settings:appearance.dark') },
  ];

  return (
    <Screen edges={['left', 'right', 'bottom']} gap="xxxl" testID="settings-screen">
      <SettingsSection title={t('settings:language.sectionTitle')}>
        {SUPPORTED_LANGUAGES.map((option) => {
          const selected = option === language;
          return (
            <ListItem
              key={option}
              title={t(`common:languages.${option}`)}
              onPress={() => void changeLanguage(option)}
              showChevron={false}
              checked={selected}
              trailing={selected ? <Icon name="check" size={22} color="primary" /> : null}
              testID={`language-${option}`}
            />
          );
        })}
      </SettingsSection>

      <SettingsSection title={t('settings:appearance.sectionTitle')} grouped={false}>
        <SegmentedControl
          options={schemeOptions}
          value={colorScheme}
          onChange={(value) => void settingsStore.setColorScheme(value)}
          testID="appearance-control"
        />
      </SettingsSection>

      <SettingsSection title={t('settings:notifications.sectionTitle')}>{notificationRows}</SettingsSection>

      <SettingsSection title={t('settings:legal.sectionTitle')} testID="settings-legal">
        {LEGAL_DOCUMENTS.map((document) => (
          <ListItem
            key={document}
            title={t(`legal:documents.${document}`)}
            onPress={() => router.push(routes.legal(document))}
            testID={`settings-legal-${document}`}
          />
        ))}
      </SettingsSection>

      <SettingsSection title={t('settings:deleteAccount.sectionTitle')} testID="settings-account">
        <ListItem
          title={t('settings:deleteAccount.row')}
          destructive
          onPress={() => router.push(routes.deleteAccount)}
          testID="settings-delete-account"
        />
      </SettingsSection>

      <AppText variant="caption" color="muted" align="center">
        {t('settings:version', { version: APP_VERSION })}
      </AppText>
    </Screen>
  );
}
