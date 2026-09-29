/**
 * `/settings` – language, appearance, notification preferences and demo tools. The account
 * (switch account, sign out) lives in the Profile tab.
 */
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Icon,
  ListItem,
  Screen,
  SegmentedControl,
  SwitchRow,
  useConfirm,
  useToast,
  type SegmentedOption,
} from '@/components/ui';
import { useAppLanguage } from '@/i18n/hooks';
import { SUPPORTED_LANGUAGES } from '@/types/domain';

import { useNotificationPreferenceRows } from '../components/notification-preference-rows';
import { SettingsSection } from '../components/settings-section';
import { settingsStore, useSettings, type ColorSchemePreference } from '../settings-store';
import { useChangeLanguage } from '../use-change-language';
import { useDemoTools } from '../use-demo-tools';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function SettingsScreen() {
  const { t } = useTranslation(['settings', 'common']);
  const confirm = useConfirm();
  const toast = useToast();
  const language = useAppLanguage();
  const changeLanguage = useChangeLanguage();
  const { colorScheme } = useSettings();
  const demo = useDemoTools();
  const notificationRows = useNotificationPreferenceRows();

  const schemeOptions: SegmentedOption<ColorSchemePreference>[] = [
    { value: 'system', label: t('settings:appearance.system') },
    { value: 'light', label: t('settings:appearance.light') },
    { value: 'dark', label: t('settings:appearance.dark') },
  ];

  const confirmReset = async () => {
    const confirmed = await confirm({
      title: t('settings:demo.reset.confirmTitle'),
      message: t('settings:demo.reset.confirmMessage'),
      confirmLabel: t('settings:demo.reset.confirmLabel'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await demo.resetDemoData();
      toast.show({ title: t('settings:demo.reset.success'), tone: 'success' });
    } catch {
      toast.show({ title: t('settings:demo.reset.failed'), tone: 'danger' });
    }
  };

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

      {demo.isAvailable ? (
        <SettingsSection title={t('settings:demo.sectionTitle')}>
          <SwitchRow
            key="simulation"
            title={t('settings:demo.simulation.title')}
            description={t('settings:demo.simulation.description')}
            value={demo.simulationEnabled}
            onValueChange={demo.setSimulationEnabled}
            testID="demo-simulation"
          />
          <SwitchRow
            key="network"
            title={t('settings:demo.networkFailures.title')}
            description={t('settings:demo.networkFailures.description')}
            value={demo.networkFailuresEnabled}
            onValueChange={demo.setNetworkFailuresEnabled}
            testID="demo-network-failures"
          />
          <ListItem
            key="reset"
            destructive
            title={t('settings:demo.reset.title')}
            onPress={() => void confirmReset()}
            showChevron={false}
            testID="demo-reset"
          />
        </SettingsSection>
      ) : null}

      <AppText variant="caption" color="muted" align="center">
        {t('settings:version', { version: APP_VERSION })}
      </AppText>
    </Screen>
  );
}
