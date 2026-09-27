/** Spoken languages as multi-select chips. */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip, Field } from '@/components/ui';
import { makeStyles } from '@/theme';

import { isLanguageOption, LANGUAGE_OPTIONS } from './pro-form-model';

export interface LanguagesFieldProps {
  value: readonly string[];
  onChange: (languages: string[]) => void;
  error?: string | null;
}

export function LanguagesField({ value, onChange, error }: LanguagesFieldProps) {
  const styles = useStyles();
  const { t } = useTranslation('professional');
  // Keep languages from the backend that aren't in the default list.
  const options = [...LANGUAGE_OPTIONS, ...value.filter((code) => !isLanguageOption(code))];
  return (
    <Field label={t('form.business.languages')} required error={error}>
      <View style={styles.chips}>
        {options.map((code) => {
          const selected = value.includes(code);
          return (
            <Chip
              key={code}
              size="sm"
              label={isLanguageOption(code) ? t(`form.languageNames.${code}`) : code.toUpperCase()}
              selected={selected}
              icon={selected ? 'check' : undefined}
              onPress={() => onChange(selected ? value.filter((item) => item !== code) : [...value, code])}
              testID={`pro-form-language-${code}`}
            />
          );
        })}
      </View>
    </Field>
  );
}

const useStyles = makeStyles((t) => ({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
}));
