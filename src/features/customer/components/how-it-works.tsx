import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, Icon, type IconName } from '@/components/ui';
import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme } from '@/theme';

const STEPS: readonly { key: 'post' | 'compare' | 'hire'; icon: IconName; tone: StatusTone }[] = [
  { key: 'post', icon: 'clipboard-edit-outline', tone: 'brand' },
  { key: 'compare', icon: 'scale-balance', tone: 'accent' },
  { key: 'hire', icon: 'handshake-outline', tone: 'warning' },
];

export interface HowItWorksProps {
  /** Shows the "Post your first request" CTA. */
  onStart?: () => void;
  /** Render without the card surface (e.g. inside a sheet). */
  plain?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Three-step explainer for customers who haven't posted a request yet. */
export function HowItWorks({ onStart, plain = false, style }: HowItWorksProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation('customer');

  const content = (
    <View style={styles.content}>
      {!plain ? (
        <View style={styles.header}>
          <AppText variant="heading" accessibilityRole="header">
            {t('howItWorks.title')}
          </AppText>
          <AppText variant="caption" color="secondary">
            {t('howItWorks.subtitle')}
          </AppText>
        </View>
      ) : null}
      <View>
        {STEPS.map((step, index) => {
          const tone = theme.colors.tones[step.tone];
          const isLast = index === STEPS.length - 1;
          return (
            <View key={step.key} style={styles.step}>
              <View style={styles.rail}>
                <View style={[styles.iconCircle, { backgroundColor: tone.bg }]}>
                  <Icon name={step.icon} size={22} color={tone.fg} />
                </View>
                {!isLast ? <View style={[styles.connector, { backgroundColor: theme.colors.border }]} /> : null}
              </View>
              <View style={[styles.stepTexts, isLast ? null : styles.stepSpacing]}>
                <AppText variant="label" color={tone.fg}>
                  {t('howItWorks.stepLabel', { number: index + 1 })}
                </AppText>
                <AppText variant="bodyStrong">{t(`howItWorks.steps.${step.key}.title`)}</AppText>
                <AppText variant="caption" color="secondary">
                  {t(`howItWorks.steps.${step.key}.description`)}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>
      {onStart ? (
        <Button label={t('howItWorks.cta')} leftIcon="plus" onPress={onStart} fullWidth style={styles.cta} />
      ) : null}
    </View>
  );

  if (plain) return <View style={style}>{content}</View>;
  return (
    <Card padding="xl" style={style}>
      {content}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  content: {
    gap: t.spacing.md,
  },
  header: {
    gap: t.spacing.xxs,
    marginBottom: t.spacing.xs,
  },
  step: {
    flexDirection: 'row',
    gap: t.spacing.md,
  },
  rail: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: t.spacing.lg,
    marginTop: t.spacing.xs,
    borderRadius: 1,
  },
  stepTexts: {
    flex: 1,
    gap: t.spacing.xxs,
    paddingTop: t.spacing.xxs,
  },
  stepSpacing: {
    paddingBottom: t.spacing.md,
  },
  cta: {
    marginTop: t.spacing.xs,
  },
}));
