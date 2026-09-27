import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { DECORATIVE_TONES, hashToIndex } from './colors';
import { Icon } from './icon';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, number> = { xs: 28, sm: 36, md: 44, lg: 64, xl: 88 };

export interface AvatarProps {
  /** Used for initials, the deterministic color and the accessibility label. */
  name: string;
  uri?: string | null;
  size?: AvatarSize | number;
  /** Shows a verified check on the bottom-end corner. */
  verified?: boolean;
  /** Hide from screen readers when the name is already announced next to it. */
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** First letters of the first two words (works for Hebrew and Latin names). */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words[words.length - 1][0]];
  return letters.join('').toUpperCase();
}

export function Avatar({ name, uri, size = 'md', verified = false, decorative = false, style, testID }: AvatarProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const dimension = typeof size === 'number' ? size : SIZES[size];
  const tone = theme.colors.tones[DECORATIVE_TONES[hashToIndex(name, DECORATIVE_TONES.length)]];
  const showImage = Boolean(uri) && failedUri !== uri;
  const fontSize = Math.round(dimension * 0.38);
  const badgeSize = Math.max(14, Math.round(dimension * 0.34));

  return (
    <View
      testID={testID}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : verified ? `${name}, ${t('verified')}` : name}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      style={[{ width: dimension, height: dimension }, style]}
    >
      <View
        style={[
          styles.circle,
          { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: tone.bg },
        ]}
      >
        {showImage ? (
          <Image
            source={{ uri: uri ?? undefined }}
            style={{ width: dimension, height: dimension }}
            contentFit="cover"
            transition={150}
            onError={() => setFailedUri(uri ?? null)}
            accessible={false}
          />
        ) : (
          <AppText
            variant="subheading"
            color={tone.fg}
            align="center"
            maxFontSizeMultiplier={1}
            style={{ fontSize, lineHeight: Math.round(fontSize * 1.2) }}
          >
            {getInitials(name)}
          </AppText>
        )}
      </View>
      {verified ? (
        <View
          style={[
            styles.verified,
            { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 },
          ]}
        >
          <Icon name="check-decagram" size={badgeSize - 2} color={theme.colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  circle: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verified: {
    position: 'absolute',
    bottom: -1,
    end: -1,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
