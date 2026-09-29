import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  isCameraSupported,
  openAppSettings,
  pickImagesFromLibrary,
  takePhotoWithCamera,
  type PickImagesResult,
} from '@/components/forms';
import { PhotoViewer, usePhotoViewer } from '@/components/requests';
import { AppText, Card, Icon, ListItem, Sheet } from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import type { RequestFormPhoto } from '@/lib/validation';
import { makeStyles, useTheme } from '@/theme';

import { pickedPhotosToForm } from './request-form-model';

const THUMB_SIZE = 64;

type PhotoProblem = 'library_denied' | 'camera_denied' | 'camera_unavailable' | 'failed' | 'limit';
type PhotoSource = 'library' | 'camera';

interface PhotosFieldProps {
  value: readonly RequestFormPhoto[];
  onChange: (photos: RequestFormPhoto[]) => void;
}

/** Optional photos: one "Add photos" row, then small thumbnails (tap to view, × to remove). */
export function PhotosField({ value, onChange }: PhotosFieldProps) {
  const max = APP_CONFIG.maxRequestPhotos;
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['requests', 'common']);
  const [sourceOpen, setSourceOpen] = useState(false);
  // The source picked in the sheet; the picker opens once the sheet has closed (see `Sheet.onClosed`).
  const pendingSource = useRef<PhotoSource | null>(null);
  const [problem, setProblem] = useState<PhotoProblem | null>(null);
  const viewer = usePhotoViewer();
  const remaining = Math.max(0, max - value.length);

  const handleResult = (result: PickImagesResult, source: PhotoSource) => {
    switch (result.status) {
      case 'picked': {
        const merged = [...value, ...pickedPhotosToForm(result.photos)];
        setProblem(merged.length > max ? 'limit' : null);
        onChange(merged.slice(0, max));
        return;
      }
      case 'permission_denied':
        setProblem(source === 'camera' ? 'camera_denied' : 'library_denied');
        return;
      case 'unavailable':
        setProblem('camera_unavailable');
        return;
      case 'error':
        setProblem('failed');
        return;
      case 'cancelled':
        return;
    }
  };

  const pickFromLibrary = async () => {
    handleResult(await pickImagesFromLibrary(remaining), 'library');
  };

  const takePhoto = async () => {
    handleResult(await takePhotoWithCamera(), 'camera');
  };

  const chooseSource = (source: PhotoSource) => {
    pendingSource.current = source;
    setSourceOpen(false);
  };

  const openPendingSource = () => {
    const source = pendingSource.current;
    pendingSource.current = null;
    if (source === 'library') void pickFromLibrary();
    else if (source === 'camera') void takePhoto();
  };

  const add = () => {
    if (remaining === 0) {
      setProblem('limit');
      return;
    }
    setProblem(null);
    if (isCameraSupported()) setSourceOpen(true);
    else void pickFromLibrary();
  };

  const remove = (index: number) => {
    setProblem(null);
    onChange(value.filter((_, photoIndex) => photoIndex !== index));
  };

  const permissionProblem = problem === 'library_denied' || problem === 'camera_denied';

  return (
    <View style={styles.container}>
      {value.length === 0 ? (
        <Card padding="none" onPress={add} accessibilityLabel={t('requests:form.addPhotos')} style={styles.addRow} testID="request-form-add-photos">
          <Icon name="camera-plus-outline" size={22} color="primary" />
          <AppText variant="bodyStrong" color="primary" style={styles.flex}>
            {t('requests:form.addPhotos')}
          </AppText>
        </Card>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs} style={styles.thumbsScroller}>
          {value.map((photo, index) => (
            <View key={`${photo.uri}-${index}`}>
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={t('common:a11y.openPhoto', { index: index + 1, total: value.length })}
                onPress={() => viewer.open(index)}
                style={({ pressed }) => [styles.thumb, { backgroundColor: theme.colors.skeleton }, pressed ? styles.pressed : null]}
              >
                <Image source={{ uri: photo.uri }} style={styles.image} contentFit="cover" transition={120} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common:a11y.removePhoto', { index: index + 1 })}
                onPress={() => remove(index)}
                hitSlop={8}
                style={[styles.remove, { backgroundColor: theme.colors.overlay }]}
              >
                <Icon name="close" size={14} color={theme.colors.textInverse} />
              </Pressable>
            </View>
          ))}
          {remaining > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('requests:form.addPhotos')}
              onPress={add}
              style={({ pressed }) => [styles.thumb, styles.addTile, pressed ? styles.pressed : null]}
              testID="request-form-add-photos"
            >
              <Icon name="plus" size={22} color="primary" />
              <AppText variant="label" color="primary">
                {t('requests:form.addMorePhotos')}
              </AppText>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      {problem ? (
        <Pressable
          accessibilityRole={permissionProblem ? 'button' : 'text'}
          disabled={!permissionProblem}
          onPress={() => void openAppSettings()}
        >
          <AppText variant="caption" color={problem === 'limit' ? 'muted' : 'warning'}>
            {t(`requests:form.photoProblems.${problem}`, { max })}
            {permissionProblem ? <AppText variant="captionStrong" color="primary">{` ${t('common:photos.openSettings')}`}</AppText> : null}
          </AppText>
        </Pressable>
      ) : null}

      <Sheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onClosed={openPendingSource}
        title={t('common:photos.sourceTitle')}
        testID="photo-source-sheet"
      >
        <ListItem title={t('common:photos.fromLibrary')} onPress={() => chooseSource('library')} showChevron={false} />
        <ListItem title={t('common:photos.takePhoto')} onPress={() => chooseSource('camera')} showChevron={false} />
      </Sheet>

      <PhotoViewer
        visible={viewer.index !== null}
        photos={value.map((photo) => ({ url: photo.uri, width: photo.width, height: photo.height }))}
        initialIndex={viewer.index ?? 0}
        onClose={viewer.close}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    minHeight: 56,
  },
  flex: {
    flex: 1,
  },
  thumbsScroller: {
    marginHorizontal: -t.spacing.screen,
  },
  thumbs: {
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.xs,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: t.radii.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.8,
  },
  addTile: {
    backgroundColor: t.colors.surface,
    gap: t.spacing.xxs,
  },
  remove: {
    position: 'absolute',
    top: -t.spacing.xs,
    end: -t.spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
