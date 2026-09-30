/**
 * Pro Home: shown while the public profile has no photo, headline or bio (sign-up asks for none of
 * them), with one action that opens the profile form.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card } from '@/components/ui';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';

import type { ProfileGap } from '../home-model';

export function CompleteProfileCard({ gaps }: { gaps: readonly ProfileGap[] }) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation('professional');
  if (gaps.length === 0) return null;
  const missing = gaps.map((gap) => t(`home.completeProfile.parts.${gap}`)).join(' · ');
  return (
    <Card padding="lg" testID="pro-home-complete-profile">
      <View style={styles.texts}>
        <AppText variant="bodyStrong">{t('home.completeProfile.title')}</AppText>
        <AppText variant="caption" color="secondary">
          {t('home.completeProfile.body', { missing })}
        </AppText>
      </View>
      <Button
        label={t('home.completeProfile.action')}
        // On the card's soft fill a `secondary` button would have no visible shape.
        variant="outline"
        size="sm"
        onPress={() => router.push(routes.editProfile)}
        testID="pro-home-complete-profile-action"
      />
    </Card>
  );
}

const useStyles = makeStyles((theme) => ({
  texts: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
}));
