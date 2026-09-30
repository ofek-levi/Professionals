/**
 * The Terms of Service and the Privacy Policy, readable before accepting them on sign-up: a sheet
 * with the document's sections. The texts describe how the app actually handles data (e.g.
 * approximate locations, contact details only for the people you work with).
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Sheet } from '@/components/ui';
import { makeStyles } from '@/theme';

export type LegalDocument = 'terms' | 'privacy';

const SECTIONS = {
  terms: ['marketplace', 'customers', 'professionals', 'conduct', 'account'],
  privacy: ['collected', 'locations', 'contact', 'use', 'control'],
} as const satisfies Record<LegalDocument, readonly string[]>;

interface LegalDocumentSheetProps {
  /** The document to show, or `null` (closed). */
  document: LegalDocument | null;
  onClose: () => void;
}

export function LegalDocumentSheet({ document, onClose }: LegalDocumentSheetProps) {
  const styles = useStyles();
  const { t } = useTranslation(['auth', 'common']);

  return (
    <Sheet
      visible={document !== null}
      onClose={onClose}
      title={document ? t(`auth:legal.${document}.title`) : undefined}
      footer={<Button label={t('common:actions.done')} fullWidth onPress={onClose} testID="legal-document-done" />}
      testID="legal-document-sheet"
    >
      {document ? (
        <View style={styles.body}>
          {document === 'terms'
            ? SECTIONS.terms.map((section) => <Section key={section} title={t(`auth:legal.terms.sections.${section}.title`)} text={t(`auth:legal.terms.sections.${section}.text`)} />)
            : SECTIONS.privacy.map((section) => (
                <Section key={section} title={t(`auth:legal.privacy.sections.${section}.title`)} text={t(`auth:legal.privacy.sections.${section}.text`)} />
              ))}
        </View>
      ) : null}
    </Sheet>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <AppText variant="bodyStrong" accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="body" color="secondary">
        {text}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  body: {
    gap: t.spacing.lg,
    paddingBottom: t.spacing.md,
  },
  section: {
    gap: t.spacing.xs,
  },
}));
