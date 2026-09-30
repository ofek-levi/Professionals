import { useTranslation } from 'react-i18next';

import { useConfirm } from '@/components/ui';
import { useAppLanguage } from '@/i18n/hooks';
import type { AppLanguage } from '@/types/domain';

import { syncAccountLanguage } from './account-language';
import { applyLanguage, applyLanguageWithReload, requiresReloadForLanguage } from './language';

/**
 * Returns `changeLanguage(language)`. Switching between LTR and RTL on iOS/Android explains that
 * the app restarts and asks for confirmation first; on the web the change is instant.
 * While signed in the account's language follows (`PATCH /me`, for push and email texts).
 * Resolves `true` when the language was (or is being) applied.
 */
export function useChangeLanguage(): (language: AppLanguage) => Promise<boolean> {
  const { t } = useTranslation(['settings', 'common']);
  const confirm = useConfirm();
  const current = useAppLanguage();

  return async (language) => {
    if (language === current) return false;
    if (!requiresReloadForLanguage(language)) {
      await applyLanguage(language);
      void syncAccountLanguage(language);
      return true;
    }
    const confirmed = await confirm({
      title: t('settings:language.restartTitle'),
      message: t('settings:language.restartMessage', { language: t(`common:languages.${language}`) }),
      confirmLabel: t('settings:language.restartConfirm'),
      icon: 'translate',
    });
    if (!confirmed) return false;
    await syncAccountLanguage(language);
    await applyLanguageWithReload(language);
    return true;
  };
}
