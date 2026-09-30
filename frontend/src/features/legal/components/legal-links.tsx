import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui';
import { LEGAL_DOCUMENTS, routes } from '@/lib/routes';
import { makeStyles } from '@/theme';

interface LegalLinksProps {
  /** `center` for a footer line; `start` (default) under a form control. */
  align?: 'start' | 'center';
  style?: StyleProp<ViewStyle>;
  /** The links get `${testID}-terms` and `${testID}-privacy`. */
  testID?: string;
}

/**
 * "Terms of Use · Privacy Policy": links that open the documents on their own screen
 * (`/legal/:document`, pushed – the screen underneath keeps its state, e.g. a half-filled sign-up).
 */
export function LegalLinks({ align = 'start', style, testID }: LegalLinksProps) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation('legal');

  return (
    <View style={[styles.row, align === 'center' ? styles.centered : null, style]}>
      {LEGAL_DOCUMENTS.map((document, index) => (
        <Fragment key={document}>
          {index > 0 ? (
            <AppText variant="caption" color="muted" importantForAccessibility="no" accessibilityElementsHidden>
              ·
            </AppText>
          ) : null}
          <Pressable
            accessibilityRole="link"
            accessibilityHint={t('openHint')}
            onPress={() => router.push(routes.legal(document))}
            hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
            testID={testID ? `${testID}-${document}` : undefined}
          >
            <AppText variant="captionStrong" color="primary">
              {t(`documents.${document}`)}
            </AppText>
          </Pressable>
        </Fragment>
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  centered: {
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
}));
