import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, Icon } from '@/components/ui';
import { makeStyles } from '@/theme';
import { isolateLtr } from '@/utils/bidi';

interface GoogleIdentityNoteProps {
  /** The Google account's email. */
  email: string;
  /** "Use email instead": leaves the Google identity (omit to show the note only). */
  onUseEmailInstead?: () => void;
  testID?: string;
}

/**
 * "Signing up with Google · maya.katz@gmail.com" – shown on the sign-up steps while a new Google
 * identity is being turned into an account, so the Google tap visibly took effect.
 */
export function GoogleIdentityNote({ email, onUseEmailInstead, testID }: GoogleIdentityNoteProps) {
  const styles = useStyles();
  const { t } = useTranslation('auth');

  return (
    <Card padding="none" style={styles.card} testID={testID}>
      <Icon name="google" size={22} color="default" />
      <View style={styles.texts}>
        <AppText variant="bodyStrong">{t('signUp.account.googleConnected')}</AppText>
        <AppText variant="caption" color="secondary" numberOfLines={1}>
          {isolateLtr(email)}
        </AppText>
        {onUseEmailInstead ? (
          <Pressable
            accessibilityRole="button"
            onPress={onUseEmailInstead}
            hitSlop={12}
            style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
            testID="sign-up-use-email"
          >
            <AppText variant="captionStrong" color="primary">
              {t('signUp.account.useEmailInstead')}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 60,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: t.spacing.xxs,
  },
  pressed: {
    opacity: 0.6,
  },
}));
