import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';
import { Linking, Platform } from 'react-native';

import { useAppLanguage } from '@/i18n/hooks';
import { routes, type LegalDocument } from '@/lib/routes';
import { apiConfig } from '@/services/api/config';

import { legalDocumentOfUrl, withLegalPageLanguage } from './legal-markup';

/**
 * Web pages open in the in-app browser (a new tab on the web) – or with the system's handler where
 * there is none (an Android device without a Custom Tabs browser) – and `mailto:` in the mail app.
 */
function openExternally(url: string): void {
  const opening: Promise<unknown> =
    Platform.OS !== 'web' && /^https?:/i.test(url)
      ? WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url))
      : Linking.openURL(url);
  void opening.catch(() => undefined);
}

/**
 * Opens a link of the document being read (`current`): the other legal document opens in the app,
 * anything else (web pages, email addresses, the web page of this document – in the app's
 * language) outside it.
 */
export function useOpenLegalLink(current: LegalDocument | null): (url: string) => void {
  const router = useRouter();
  const language = useAppLanguage();
  return useCallback(
    (url: string) => {
      const document = legalDocumentOfUrl(url, apiConfig.baseUrl);
      if (document && document !== current) router.push(routes.legal(document));
      else openExternally(withLegalPageLanguage(url, apiConfig.baseUrl, language));
    },
    [current, language, router],
  );
}
