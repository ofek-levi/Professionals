import { useController } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTranslatedError } from '@/components/forms';
import { LocationPicker } from '@/components/location';
import { AppText, Field, haptics } from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import { formLocationToService, firstErrorMessage, serviceLocationToForm } from '@/features/requests/components/create/request-form-model';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';

import type { SignUpStepProps } from './step-props';

/** Step 4 (professionals) – the base address (search, current location or the map) and the travel radius. */
export function AreaStep({ control, anchor }: SignUpStepProps) {
  const styles = useStyles();
  const { t } = useTranslation('auth');
  const format = useFormatters();
  const translateError = useTranslatedError();
  const base = useController({ control, name: 'baseLocation' });
  const radius = useController({ control, name: 'serviceRadiusKm' });
  const baseHasError = base.fieldState.error !== undefined;
  const radiusLabel = t('signUp.area.radius');

  return (
    <>
      <View onLayout={anchor('baseLocation')}>
        <LocationPicker
          value={formLocationToService(base.field.value)}
          onChange={(location) => {
            const next = serviceLocationToForm(location);
            base.field.onChange(next);
            // Validate as soon as there is an address (or to clear an error), not while the pin
            // is still being resolved to one.
            if (baseHasError || next.addressLine) base.field.onBlur();
          }}
          required
          error={translateError(firstErrorMessage(base.fieldState.error))}
          showDetailsField={false}
          mapHeight={200}
          testID="sign-up-location"
        />
      </View>

      <View onLayout={anchor('serviceRadiusKm')}>
        <Field label={radiusLabel} required error={translateError(radius.fieldState.error?.message)}>
          {/* One row of equal options (a radio group), so no preset wraps alone onto a second line. */}
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={radiusLabel}>
            {APP_CONFIG.serviceRadiusPresetsKm.map((km) => {
              const selected = radius.field.value === km;
              return (
                <Pressable
                  key={km}
                  accessibilityRole="radio"
                  aria-checked={selected}
                  onPress={() => {
                    haptics.selection();
                    radius.field.onChange(km);
                    radius.field.onBlur();
                  }}
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={({ pressed }) => [styles.option, selected ? styles.optionSelected : null, pressed && !selected ? styles.pressed : null]}
                  testID={`sign-up-radius-${km}`}
                >
                  <AppText variant="captionStrong" color={selected ? 'primary' : 'default'} numberOfLines={1} align="center">
                    {format.distance(km)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Field>
      </View>
    </>
  );
}

const useStyles = makeStyles((t) => ({
  options: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  option: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.spacing.xs,
    borderRadius: t.radii.pill,
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.background,
  },
  optionSelected: {
    backgroundColor: t.colors.primarySoft,
    borderColor: t.colors.primary,
  },
  pressed: {
    opacity: 0.8,
  },
}));
