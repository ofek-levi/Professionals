import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme } from '@/theme';

import { AppText } from '../ui/app-text';
import { PhotoViewer, type ViewerPhoto } from './photo-viewer';

export interface PhotoStripProps {
  photos: readonly ViewerPhoto[];
  /** Thumbnail edge length (default 76). */
  size?: number;
  /** Show at most this many thumbnails; the last one gets a "+n" overlay. */
  maxVisible?: number;
  /** Custom press handler; by default a full-screen `PhotoViewer` opens. */
  onPressPhoto?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
}

/** Horizontal row of photo thumbnails that opens a full-screen viewer. */
export function PhotoStrip({ photos, size = 76, maxVisible, onPressPhoto, style }: PhotoStripProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;
  const visible = typeof maxVisible === 'number' ? photos.slice(0, maxVisible) : photos;
  const hidden = photos.length - visible.length;

  const open = (index: number) => {
    if (onPressPhoto) onPressPhoto(index);
    else setViewerIndex(index);
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={style}>
        {visible.map((photo, index) => {
          const isLast = index === visible.length - 1 && hidden > 0;
          return (
            <Pressable
              key={photo.id ?? `${index}-${photo.url}`}
              accessibilityRole="imagebutton"
              accessibilityLabel={t('a11y.openPhoto', { index: index + 1, total: photos.length })}
              onPress={() => open(index)}
              style={({ pressed }) => [
                styles.thumb,
                { width: size, height: size, backgroundColor: theme.colors.skeleton },
                pressed ? styles.pressed : null,
              ]}
            >
              <Image source={{ uri: photo.url }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
              {isLast ? (
                <View style={styles.more}>
                  <AppText variant="subheading" color="onPrimary">
                    {t('photos.more', { count: hidden })}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {!onPressPhoto ? (
        <PhotoViewer
          visible={viewerIndex !== null}
          photos={photos}
          initialIndex={viewerIndex ?? 0}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    gap: t.spacing.sm,
  },
  thumb: {
    borderRadius: t.radii.md,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  more: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.overlay,
  },
}));
