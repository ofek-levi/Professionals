import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { darkColors, makeStyles } from '@/theme';

import { AppText } from '../ui/app-text';
import { Icon } from '../ui/icon';

const IS_WEB = Platform.OS === 'web';

/** Minimal photo shape accepted by `PhotoStrip` / `PhotoViewer` (compatible with `RequestPhoto`). */
export interface ViewerPhoto {
  id?: string;
  url: string;
  width?: number | null;
  height?: number | null;
}

export interface PhotoViewerProps {
  visible: boolean;
  photos: readonly ViewerPhoto[];
  initialIndex?: number;
  onClose: () => void;
}

/** Full-screen, swipeable photo pager (always dark, like native photo viewers). */
export function PhotoViewer({ visible, photos, initialIndex = 0, onClose }: PhotoViewerProps) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      {visible ? <ViewerContent photos={photos} initialIndex={initialIndex} onClose={onClose} /> : null}
    </Modal>
  );
}

function ViewerContent({ photos, initialIndex, onClose }: { photos: readonly ViewerPhoto[]; initialIndex: number; onClose: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<ViewerPhoto>>(null);
  const safeInitial = Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0));
  const [index, setIndex] = useState(safeInitial);

  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), photos.length - 1);
    if (!IS_WEB) listRef.current?.scrollToIndex({ index: clamped, animated: true });
    setIndex(clamped);
  };

  return (
    <View style={styles.root} accessibilityViewIsModal>
      {IS_WEB ? (
        // Web: one photo at a time with arrow buttons (scroll paging is unreliable in RTL browsers).
        <View style={{ width, height }}>
          <Image
            source={{ uri: photos[index]?.url }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={150}
            accessibilityLabel={t('a11y.photo', { index: index + 1 })}
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          // Paging math uses physical offsets; photos keep their natural order in RTL too.
          style={styles.pager}
          initialScrollIndex={safeInitial}
          getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
          keyExtractor={(photo, itemIndex) => photo.id ?? `${itemIndex}-${photo.url}`}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / width);
            if (next !== index && next >= 0 && next < photos.length) setIndex(next);
          }}
          renderItem={({ item, index: itemIndex }) => (
            <View style={{ width, height }}>
              <Image
                source={{ uri: item.url }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                transition={150}
                accessibilityLabel={t('a11y.photo', { index: itemIndex + 1 })}
              />
            </View>
          )}
        />
      )}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.counter}>
          <AppText variant="captionStrong" color={darkColors.text} tabular>
            {t('photos.viewerCounter', { index: index + 1, total: photos.length })}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('a11y.close')} onPress={onClose} hitSlop={8} style={styles.roundButton}>
          <Icon name="close" size={22} color={darkColors.text} />
        </Pressable>
      </View>

      {IS_WEB && photos.length > 1 ? (
        <>
          {index > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('a11y.previous')} onPress={() => goTo(index - 1)} style={[styles.roundButton, styles.navButton, styles.navLeft]}>
              <Icon name="chevron-left" size={26} color={darkColors.text} />
            </Pressable>
          ) : null}
          {index < photos.length - 1 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('a11y.next')} onPress={() => goTo(index + 1)} style={[styles.roundButton, styles.navButton, styles.navRight]}>
              <Icon name="chevron-right" size={26} color={darkColors.text} />
            </Pressable>
          ) : null}
        </>
      ) : null}

      {photos.length > 1 ? (
        <View style={[styles.dots, { bottom: insets.bottom + 20 }]}>
          {photos.map((photo, dotIndex) => (
            <View key={photo.id ?? `${dotIndex}`} style={[styles.dot, dotIndex === index ? styles.dotActive : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: darkColors.background,
  },
  pager: {
    // Keep a physical left-to-right pager in RTL so offsets map directly to indexes (native only).
    direction: 'ltr',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.lg,
  },
  counter: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
    borderRadius: t.radii.pill,
    backgroundColor: darkColors.surface,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: darkColors.surface,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
  },
  // Physical sides: the pager is always left-to-right.
  navLeft: {
    left: t.spacing.lg,
  },
  navRight: {
    right: t.spacing.lg,
  },
  dots: {
    position: 'absolute',
    pointerEvents: 'none',
    start: 0,
    end: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: t.spacing.xs + 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: darkColors.borderStrong,
  },
  dotActive: {
    width: 18,
    backgroundColor: darkColors.text,
  },
}));
