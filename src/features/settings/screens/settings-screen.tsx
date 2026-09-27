/**
 * `/settings` – account, language, appearance, notification preferences, demo tools and app info.
 */
import Constants from 'expo-constants';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Divider,
  Icon,
  KeyValueRow,
  ListItem,
  Screen,
  SegmentedControl,
  SwitchRow,
  useConfirm,
  useToast,
  type SegmentedOption,
} from '@/components/ui';
import { useAppLanguage } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import { SUPPORTED_LANGUAGES } from '@/types/domain';

import { AccountCard } from '../components/account-card';
import { NotificationPreferencesCard } from '../components/notification-preferences-card';
import { SettingsSection } from '../components/settings-section';
import { settingsStore, useSettings, type ColorSchemePreference } from '../settings-store';
import { useChangeLanguage } from '../use-change-language';
import { useDemoTools } from '../use-demo-tools';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function SettingsScreen() {
  const styles = useStyles();
  const { t } = useTranslation(['settings', 'common']);
  const confirm = useConfirm();
  const toast = useToast();
  const language = useAppLanguage();
  const changeLanguage = useChangeLanguage();
  const { colorScheme } = useSettings();
  const demo = useDemoTools();

  const schemeOptions: SegmentedOption<ColorSchemePreference>[] = [
    { value: 'system', label: t('settings:appearance.system'), icon: 'theme-light-dark' },
    { value: 'light', label: t('settings:appearance.light'), icon: 'white-balance-sunny' },
    { value: 'dark', label: t('settings:appearance.dark'), icon: 'weather-night' },
  ];

  const confirmReset = async () => {
    const confirmed = await confirm({
      title: t('settings:demo.reset.confirmTitle'),
      message: t('settings:demo.reset.confirmMessage'),
      confirmLabel: t('settings:demo.reset.confirmLabel'),
      icon: 'database-refresh-outline',
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
    <Screen edges={['left', 'right', 'bottom']} gap="xxl" testID="settings-screen">
      <AccountCard />

      <SettingsSection title={t('settings:language.sectionTitle')} description={t('settings:language.description')} icon="translate">
        <View accessibilityRole="radiogroup">
          {SUPPORTED_LANGUAGES.map((option, index) => {
            const selected = option === language;
            return (
              <Fragment key={option}>
                {index > 0 ? <Divider /> : null}
                <ListItem
                  title={t(`common:languages.${option}`)}
                  onPress={() => void changeLanguage(option)}
                  showChevron={false}
                  checked={selected}
                  trailing={selected ? <Icon name="check-circle" size={22} color="primary" /> : null}
                  testID={`language-${option}`}
                />
              </Fragment>
            );
          })}
        </View>
      </SettingsSection>

      <SettingsSection
        title={t('settings:appearance.sectionTitle')}
        description={t('settings:appearance.description')}
        icon="palette-outline"
      >
        <SegmentedControl
          options={schemeOptions}
          value={colorScheme}
          onChange={(value) => void settingsStore.setColorScheme(value)}
          style={styles.segmented}
          testID="appearance-control"
        />
      </SettingsSection>

      <SettingsSection
        title={t('settings:notifications.sectionTitle')}
        description={t('settings:notifications.description')}
        icon="bell-outline"
      >
        <NotificationPreferencesCard />
      </SettingsSection>

      {demo.isAvailable ? (
        <SettingsSection title={t('settings:demo.sectionTitle')} description={t('settings:demo.description')} icon="flask-outline">
          <SwitchRow
            icon="robot-outline"
            iconTone="accent"
            title={t('settings:demo.simulation.title')}
            description={t('settings:demo.simulation.description')}
            value={demo.simulationEnabled}
            onValueChange={demo.setSimulationEnabled}
            testID="demo-simulation"
          />
          <Divider inset={48} />
          <SwitchRow
            icon="wifi-strength-1-alert"
            iconTone="warning"
            title={t('settings:demo.networkFailures.title')}
            description={t('settings:demo.networkFailures.description')}
            value={demo.networkFailuresEnabled}
            onValueChange={demo.setNetworkFailuresEnabled}
            testID="demo-network-failures"
          />
          <Divider inset={52} />
          <ListItem
            icon="database-refresh-outline"
            destructive
            title={t('settings:demo.reset.title')}
            subtitle={t('settings:demo.reset.description')}
            onPress={() => void confirmReset()}
            showChevron={false}
            testID="demo-reset"
          />
        </SettingsSection>
      ) : null}

      <SettingsSection title={t('settings:about.sectionTitle')} icon="information-outline">
        <KeyValueRow icon="tag-outline" label={t('settings:about.version')} value={APP_VERSION} />
        <Divider />
        <KeyValueRow
          icon="database-outline"
          label={t('settings:about.dataSource')}
          value={t(demo.isAvailable ? 'settings:about.dataSources.mock' : 'settings:about.dataSources.http')}
        />
      </SettingsSection>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  segmented: {
    marginVertical: t.spacing.md,
  },
}));
