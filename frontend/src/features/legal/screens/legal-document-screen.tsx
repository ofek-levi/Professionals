/**
 * `/legal/terms` and `/legal/privacy` – the Terms of Use and the Privacy Policy as the backend serves
 * them (`GET /legal/:document`, in the app's language): the effective date, the intro and the
 * sections. Open to everyone: linked from the entry screen, the sign-up terms and Settings, and
 * reachable by URL on the web.
 */
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, EmptyState, QueryState, Screen, Skeleton } from '@/components/ui';
import { useLegalDocument, useRouteParam } from '@/hooks';
import { isRTLLanguage } from '@/i18n/direction';
import { useFormatters } from '@/i18n/hooks';
import { parseLegalDocument } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { LegalDocumentResponse } from '@/types/api/legal';

import { LegalSectionView } from '../components/legal-section';
import { LegalText } from '../components/legal-text';
import { useOpenLegalLink } from '../use-open-legal-link';

export default function LegalDocumentScreen() {
  const { t } = useTranslation(['legal', 'common']);
  const document = parseLegalDocument(useRouteParam('document'));
  const query = useLegalDocument(document);
  const openLink = useOpenLegalLink(document);
  const title = query.data?.title ?? (document ? t(`legal:documents.${document}`) : t('common:screens.notFound'));

  return (
    <Screen edges={['left', 'right', 'bottom']} testID="legal-screen">
      <Stack.Screen options={{ title }} />
      {document === null ? (
        <EmptyState icon="file-search-outline" title={t('common:states.notFoundTitle')} description={t('common:states.notFoundDescription')} />
      ) : (
        <QueryState query={query} loading={<LegalDocumentSkeleton />}>
          {(data) => <LegalDocumentBody document={data} onOpenLink={openLink} />}
        </QueryState>
      )}
    </Screen>
  );
}

function LegalDocumentBody({ document, onOpenLink }: { document: LegalDocumentResponse; onOpenLink: (url: string) => void }) {
  const styles = useStyles();
  const { t } = useTranslation('legal');
  const format = useFormatters();
  const content = { direction: isRTLLanguage(document.language) ? 'rtl' : 'ltr', onOpenLink } as const;

  return (
    <View style={styles.body} testID="legal-document">
      <View style={styles.intro}>
        <AppText variant="caption" color="muted" testID="legal-effective-date">
          {t('effectiveDate', { date: format.date(document.effectiveDate, 'medium') })}
        </AppText>
        {document.intro?.map((text, index) => (
          <LegalText key={index} text={text} {...content} />
        ))}
      </View>
      {document.sections.map((section) => (
        <LegalSectionView key={section.id} section={section} {...content} />
      ))}
    </View>
  );
}

function LegalDocumentSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.body} testID="legal-loading">
      <Skeleton width="40%" height={12} />
      {[0, 1, 2].map((section) => (
        <View key={section} style={styles.skeletonSection}>
          <Skeleton width="55%" height={18} />
          <Skeleton height={12} />
          <Skeleton height={12} />
          <Skeleton width="75%" height={12} />
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  body: {
    gap: t.spacing.xxl,
    paddingTop: t.spacing.md,
  },
  intro: {
    gap: t.spacing.md,
  },
  skeletonSection: {
    gap: t.spacing.sm,
  },
}));
