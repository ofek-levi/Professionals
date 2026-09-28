/**
 * "Continue with Google (demo)": our own sheet standing in for Google's sign-in while no Google
 * client id is configured. It is clearly labelled as a demo and does not imitate Google's account
 * chooser: it lists a few sample identities (a sample new user and the emails of demo accounts,
 * labelled neutrally – whether an account exists is decided by the backend) and "Use another
 * account" (name + email; the subtitle says that an existing email signs straight in, which only
 * this demo allows). The choice becomes a demo id token.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { FormTextField } from '@/components/forms';
import { AppText, Avatar, Badge, Button, Card, Divider, haptics, Icon, Sheet } from '@/components/ui';
import { simulatedGoogleAccountSchema, type SimulatedGoogleAccountFormValues } from '@/lib/validation/auth';
import { buildMockGoogleIdToken, SIMULATED_GOOGLE_ACCOUNTS, type SimulatedGoogleAccount } from '@/services/auth/google-auth';
import { makeStyles } from '@/theme';

type SimulatedGoogleAccountOutput = z.output<typeof simulatedGoogleAccountSchema>;

const EMPTY_ACCOUNT: SimulatedGoogleAccountFormValues = { firstName: '', lastName: '', email: '' };

/** Row avatars sit 16 + 40 + 12 from the start edge; dividers start under the texts. */
const ROW_DIVIDER_INSET = 68;

interface SimulatedGoogleSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Receives the demo id token of the chosen identity (the sheet closes itself first). */
  onIdToken: (idToken: string) => void;
}

export function SimulatedGoogleSheet({ visible, onClose, onIdToken }: SimulatedGoogleSheetProps) {
  const styles = useStyles();
  const { t } = useTranslation('auth');
  const [mode, setMode] = useState<'accounts' | 'another'>('accounts');
  const form = useForm<SimulatedGoogleAccountFormValues, unknown, SimulatedGoogleAccountOutput>({
    resolver: zodResolver(simulatedGoogleAccountSchema),
    defaultValues: EMPTY_ACCOUNT,
    mode: 'onTouched',
  });

  const close = () => {
    onClose();
    setMode('accounts');
    form.reset(EMPTY_ACCOUNT);
  };

  const choose = (identity: { firstName: string; lastName: string; email: string; avatarUrl?: string | null }) => {
    close();
    onIdToken(buildMockGoogleIdToken(identity));
  };

  const submitAnother = form.handleSubmit((values) => choose(values));

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={t('google.demoSheet.title')}
      subtitle={mode === 'accounts' ? t('google.demoSheet.subtitle') : t('google.demoSheet.anotherSubtitle')}
      footer={
        mode === 'another' ? (
          <Button label={t('google.demoSheet.continue')} fullWidth onPress={() => void submitAnother()} testID="google-demo-continue" />
        ) : undefined
      }
      testID="google-demo-sheet"
    >
      {mode === 'accounts' ? (
        <Card padding="none" style={styles.group}>
          {SIMULATED_GOOGLE_ACCOUNTS.map((account, index) => (
            <View key={account.id}>
              {index > 0 ? <Divider inset={ROW_DIVIDER_INSET} /> : null}
              <IdentityRow account={account} onPress={() => choose(account)} />
            </View>
          ))}
          <Divider inset={ROW_DIVIDER_INSET} />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptics.selection();
              setMode('another');
            }}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
            testID="google-demo-another"
          >
            <View style={styles.iconCircle}>
              <Icon name="account-plus-outline" size={22} color="primary" />
            </View>
            <AppText variant="bodyStrong" color="primary" style={styles.flex}>
              {t('google.demoSheet.another')}
            </AppText>
          </Pressable>
        </Card>
      ) : (
        <View style={styles.form}>
          <View style={styles.nameRow}>
            <FormTextField
              control={form.control}
              name="firstName"
              label={t('fields.firstName')}
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => form.setFocus('lastName')}
              containerStyle={styles.flex}
              testID="google-demo-first-name"
            />
            <FormTextField
              control={form.control}
              name="lastName"
              label={t('fields.lastName')}
              autoComplete="family-name"
              textContentType="familyName"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => form.setFocus('email')}
              containerStyle={styles.flex}
              testID="google-demo-last-name"
            />
          </View>
          <FormTextField
            control={form.control}
            name="email"
            label={t('fields.email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="done"
            onSubmitEditing={() => void submitAnother()}
            testID="google-demo-email"
          />
          <Button
            label={t('google.demoSheet.backToAccounts')}
            variant="ghost"
            size="sm"
            onPress={() => setMode('accounts')}
            style={styles.back}
          />
        </View>
      )}
    </Sheet>
  );
}

function IdentityRow({ account, onPress }: { account: SimulatedGoogleAccount; onPress: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation('auth');
  const name = `${account.firstName} ${account.lastName}`;
  const status = account.kind === 'new' ? t('google.demoSheet.newUser') : t('google.demoSheet.existingUser');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${account.email}, ${status}`}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={`google-demo-account-${account.id}`}
    >
      <Avatar name={name} uri={account.avatarUrl} size={40} decorative />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" color="muted" numberOfLines={1}>
          {account.email}
        </AppText>
      </View>
      <Badge label={status} tone={account.kind === 'new' ? 'brand' : 'neutral'} size="sm" style={styles.badge} />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  group: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 64,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  badge: {
    alignSelf: 'center',
  },
  form: {
    gap: t.spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  back: {
    alignSelf: 'center',
  },
}));
