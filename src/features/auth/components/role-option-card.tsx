import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, haptics, Icon, type IconName } from '@/components/ui';
import { makeStyles, useTheme } from '@/theme';
import type { UserRole } from '@/types/domain';

/** The glyph of each role (role switch on the entry screen, role cards of the sign-up flow). */
export const ROLE_ICONS: Record<UserRole, IconName> = {
  customer: 'account-outline',
  professional: 'hammer-wrench',
};

interface RoleOptionCardProps {
  role: UserRole;
  selected: boolean;
  onSelect: (role: UserRole) => void;
  testID?: string;
}

/**
 * One large choice of the sign-up role step ("I need a service" / "I offer services"): an icon, a
 * title and a short description, with a radio mark. Selected cards take the brand tint, like the
 * other single-choice tiles of the app.
 */
export function RoleOptionCard({ role, selected, onSelect, testID }: RoleOptionCardProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('auth');
  const title = t(`signUp.role.options.${role}.title`);
  const description = t(`signUp.role.options.${role}.description`);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${title}, ${description}`}
      accessibilityState={{ checked: selected }}
      onPress={() => {
        haptics.selection();
        onSelect(role);
      }}
      style={({ pressed }) => [
        styles.card,
        selected ? { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary } : null,
        pressed && !selected ? styles.pressed : null,
      ]}
      testID={testID}
    >
      <View style={[styles.iconBox, { backgroundColor: selected ? theme.colors.background : theme.colors.primarySoft }]}>
        <Icon name={ROLE_ICONS[role]} size={24} color="primary" />
      </View>
      <View style={styles.texts}>
        <AppText variant="subheading" color={selected ? 'primary' : 'default'}>
          {title}
        </AppText>
        <AppText variant="caption" color="secondary">
          {description}
        </AppText>
      </View>
      <View style={[styles.radio, selected ? { borderColor: theme.colors.primary } : null]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md + 2,
    minHeight: 92,
    padding: t.spacing.lg,
    borderRadius: t.radii.lg,
    borderWidth: 1.5,
    borderColor: t.colors.surface,
    backgroundColor: t.colors.surface,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
    borderColor: t.colors.surfacePressed,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: t.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: t.radii.pill,
    borderWidth: 2,
    borderColor: t.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.primary,
  },
}));
