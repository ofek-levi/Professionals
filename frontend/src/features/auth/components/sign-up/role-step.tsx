import { useController } from 'react-hook-form';
import { View } from 'react-native';

import { useTranslatedError } from '@/components/forms';
import { Field } from '@/components/ui';
import { makeStyles } from '@/theme';
import { USER_ROLES } from '@/types/domain';

import { RoleOptionCard } from '../role-option-card';
import type { SignUpStepProps } from './step-props';

/** Step 1 – "How will you use Professionals?": customer or professional (required). */
export function RoleStep({ control, anchor }: SignUpStepProps) {
  const styles = useStyles();
  const translateError = useTranslatedError();
  const { field, fieldState } = useController({ control, name: 'role' });

  return (
    <View onLayout={anchor('role')}>
      <Field error={translateError(fieldState.error?.message)}>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {USER_ROLES.map((role) => (
            <RoleOptionCard
              key={role}
              role={role}
              selected={field.value === role}
              onSelect={(next) => {
                field.onChange(next);
                field.onBlur();
              }}
              testID={`sign-up-role-${role}`}
            />
          ))}
        </View>
      </Field>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  options: {
    gap: t.spacing.md,
  },
}));
