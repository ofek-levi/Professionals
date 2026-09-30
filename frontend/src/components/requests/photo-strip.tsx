import { Image } from 'expo-image';
import { Pressable, ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme } from '@/theme';

import { PhotoViewer, usePhotoViewer, type ViewerPhoto } from './photo-viewer';

interface PhotoStripProps {
  photos: readonly ViewerPhoto[];
  /** Thumbnail edge length (default 76). */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Horizontal row of photo thumbnails that opens a full-screen viewer. */
export function PhotoStrip({ photos, size = 76, style }: PhotoStripProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const viewer = usePhotoViewer();

  if (photos.length === 0) return null;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={style}>
        {photos.map((photo, index) => (
          <Pressable
            key={`${index}-${photo.url}`}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('a11y.openPhoto', { index: index + 1, total: photos.length })}
            onPress={() => viewer.open(index)}
            style={({ pressed }) => [
              styles.thumb,
              { width: size, height: size, backgroundColor: theme.colors.skeleton },
              pressed ? styles.pressed : null,
            ]}
          >
            <Image source={{ uri: photo.url }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
          </Pressable>
        ))}
      </ScrollView>
      <PhotoViewer visible={viewer.index !== null} photos={photos} initialIndex={viewer.index ?? 0} onClose={viewer.close} />
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
}));
