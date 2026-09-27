import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme } from '@/theme';
import type { ServiceLocation } from '@/types/domain';

import { AppText } from '../ui/app-text';
import { Badge } from '../ui/badge';
import { Icon } from '../ui/icon';

export interface LocationSummaryProps {
  location: ServiceLocation;
  /** Show apartment/floor details (only for the parties of a job). Defaults to `true`. */
  showDetails?: boolean;
  /** Explain why the location is approximate. Defaults to `true`. */
  showApproximateHint?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Address block: street, neighborhood/city, details and an "approximate" indicator. */
export function LocationSummary({ location, showDetails = true, showApproximateHint = true, onPress, style }: LocationSummaryProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['location', 'common']);
  const area = [location.neighborhood, location.city].filter(Boolean).join(', ');
  const title = location.addressLine || area || t('location:pinnedLocation');
  const subtitle = location.addressLine ? area : null;
  const tone = theme.colors.tones[location.isApproximate ? 'neutral' : 'brand'];

  const content = (
    <>
      <View style={[styles.iconBox, { backgroundColor: tone.bg }]}>
        <Icon name={location.isApproximate ? 'map-marker-radius-outline' : 'map-marker'} size={22} color={tone.fg} />
      </View>
      <View style={styles.texts}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
        {showDetails && location.details ? (
          <View style={styles.details}>
            <Icon name="door" size={14} color="muted" />
            <AppText variant="caption" color="muted" style={styles.flexShrink}>
              {location.details}
            </AppText>
          </View>
        ) : null}
        {location.isApproximate ? (
          <View style={styles.approximate}>
            <Badge label={t('common:approximateLocation')} icon="eye-off-outline" size="sm" />
            {showApproximateHint ? (
              <AppText variant="caption" color="muted">
                {t('location:approximateHint')}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
      {onPress ? <Icon name="chevron-right" size={20} color="muted" flipInRTL /> : null}
    </>
  );

  if (!onPress) return <View style={[styles.row, style]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null, style]}
    >
      {content}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: t.radii.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    marginTop: t.spacing.xxs,
  },
  approximate: {
    gap: t.spacing.xs,
    marginTop: t.spacing.xs,
  },
  flexShrink: {
    flexShrink: 1,
  },
}));
