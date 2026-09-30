import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Field, haptics, Icon } from '@/components/ui';
import { LegalLinks } from '@/features/legal/components/legal-links';
import { makeStyles } from '@/theme';

interface TermsCheckboxProps {
  value: boolean;
  onChange: (accepted: boolean) => void;
  /** Already translated error. */
  error?: string;
  testID?: string;
}

/** Checkbox size + gap to the label: the document links line up with the label text. */
const BOX_SIZE = 22;

/**
 * "I'm 18 or older and I agree to the Terms of Use and the Privacy Policy" – a checkbox row with an
 * inline error, and links under it that open both documents on their own screen (the row toggles
 * the checkbox, the links don't; the form keeps its values while a document is open).
 */
export function TermsCheckbox({ value, onChange, error, testID }: TermsCheckboxProps) {
  const styles = useStyles();
  const { t } = useTranslation('auth');
  const label = t('signUp.account.terms');

  return (
    <Field error={error}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        aria-checked={value}
        aria-invalid={Boolean(error)}
        onPress={() => {
          haptics.selection();
          onChange(!value);
        }}
        hitSlop={4}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID={testID}
      >
        <View style={[styles.box, value ? styles.boxChecked : null, error && !value ? styles.boxError : null]}>
          {value ? <Icon name="check" size={16} color="onPrimary" /> : null}
        </View>
        <AppText variant="body" style={styles.label}>
          {label}
        </AppText>
      </Pressable>
      <LegalLinks style={styles.links} testID={testID} />
    </Field>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
    minHeight: t.layout.minTouchSize,
    paddingVertical: t.spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: t.radii.xs,
    borderWidth: 2,
    borderColor: t.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: t.colors.primaryFill,
    borderColor: t.colors.primaryFill,
  },
  boxError: {
    borderColor: t.colors.danger,
  },
  label: {
    flex: 1,
  },
  links: {
    marginStart: BOX_SIZE + t.spacing.md,
    marginTop: -t.spacing.sm,
  },
}));
