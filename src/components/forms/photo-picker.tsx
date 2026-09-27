import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { APP_CONFIG } from '@/constants/app-config';
import { makeStyles, useTheme } from '@/theme';

import { PhotoViewer } from '../requests/photo-viewer';
import { AppText } from '../ui/app-text';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { IconButton } from '../ui/icon-button';
import { InlineAlert } from '../ui/inline-alert';
import { ListItem } from '../ui/list-item';
import { Sheet } from '../ui/sheet';
import {
  isCameraSupported,
  openAppSettings,
  pickImagesFromLibrary,
  takePhotoWithCamera,
  type PickImagesResult,
  type PickedPhoto,
} from './pick-images';

export interface PhotoPickerProps {
  value: readonly PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  /** Maximum number of photos (default `APP_CONFIG.maxRequestPhotos`). */
  max?: number;
  label?: string;
  required?: boolean;
  optional?: boolean;
  helperText?: string;
  error?: string | null;
  /** Thumbnails per row (default 3). */
  columns?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

type PickerProblem = 'library_denied' | 'camera_denied' | 'camera_unavailable' | 'failed' | 'limit';

/**
 * Pick multiple photos from the library (and the camera on devices), preview them in a grid,
 * remove or open them full-screen. Permission problems are explained inline.
 */
export function PhotoPicker({
  value,
  onChange,
  max = APP_CONFIG.maxRequestPhotos,
  label,
  required,
  optional,
  helperText,
  error,
  columns = 3,
  style,
  testID,
}: PhotoPickerProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [problem, setProblem] = useState<PickerProblem | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const remaining = Math.max(0, max - value.length);
  const tileWidth = `${100 / columns}%` as const;

  const handleResult = (result: PickImagesResult, source: 'library' | 'camera') => {
    switch (result.status) {
      case 'picked': {
        const merged = [...value, ...result.photos];
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
    setSourceSheetOpen(false);
    handleResult(await pickImagesFromLibrary(remaining), 'library');
  };

  const takePhoto = async () => {
    setSourceSheetOpen(false);
    handleResult(await takePhotoWithCamera(), 'camera');
  };

  const add = () => {
    if (remaining === 0) {
      setProblem('limit');
      return;
    }
    setProblem(null);
    if (isCameraSupported()) setSourceSheetOpen(true);
    else void pickFromLibrary();
  };

  const remove = (index: number) => {
    setProblem(null);
    onChange(value.filter((_, photoIndex) => photoIndex !== index));
  };

  const problemMessage: Record<PickerProblem, string> = {
    library_denied: t('photos.libraryPermissionDenied'),
    camera_denied: t('photos.cameraPermissionDenied'),
    camera_unavailable: t('photos.cameraUnavailable'),
    failed: t('photos.pickerFailed'),
    limit: t('photos.limitReached', { max }),
  };

  return (
    <Field
      label={label}
      required={required}
      optional={optional}
      helperText={helperText ?? t('photos.hint', { max })}
      error={error}
      counter={t('photos.counter', { count: value.length, max })}
      style={style}
    >
      <View style={styles.grid} testID={testID}>
        {value.map((photo, index) => (
          <View key={`${photo.uri}-${index}`} style={[styles.cell, { width: tileWidth }]}>
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={t('a11y.openPhoto', { index: index + 1, total: value.length })}
              onPress={() => setViewerIndex(index)}
              style={({ pressed }) => [styles.tile, { backgroundColor: theme.colors.skeleton }, pressed ? styles.pressed : null]}
            >
              <Image source={{ uri: photo.uri }} style={styles.image} contentFit="cover" transition={120} />
            </Pressable>
            <IconButton
              icon="close"
              size="sm"
              variant="filled"
              tone="neutral"
              accessibilityLabel={t('a11y.removePhoto', { index: index + 1 })}
              onPress={() => remove(index)}
              style={styles.remove}
            />
          </View>
        ))}
        {remaining > 0 ? (
          <View style={[styles.cell, { width: tileWidth }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('photos.add')}
              onPress={add}
              style={({ pressed }) => [styles.tile, styles.addTile, pressed ? styles.addPressed : null]}
              testID="photo-picker-add"
            >
              <Icon name="camera-plus-outline" size={28} color="primary" />
              <AppText variant="label" color="primary" align="center">
                {value.length === 0 ? t('photos.add') : t('photos.addShort')}
              </AppText>
            </Pressable>
          </View>
        ) : null}
      </View>

      {problem ? (
        <InlineAlert
          tone={problem === 'limit' ? 'info' : 'warning'}
          message={problemMessage[problem]}
          actionLabel={problem === 'library_denied' || problem === 'camera_denied' ? t('photos.openSettings') : undefined}
          onAction={() => void openAppSettings()}
          onDismiss={() => setProblem(null)}
        />
      ) : null}

      <Sheet visible={sourceSheetOpen} onClose={() => setSourceSheetOpen(false)} title={t('photos.sourceTitle')}>
        <ListItem icon="image-multiple-outline" iconTone="brand" title={t('photos.fromLibrary')} onPress={() => void pickFromLibrary()} showChevron={false} />
        <ListItem icon="camera-outline" iconTone="accent" title={t('photos.takePhoto')} onPress={() => void takePhoto()} showChevron={false} />
      </Sheet>

      <PhotoViewer
        visible={viewerIndex !== null}
        photos={value.map((photo) => ({ url: photo.uri, width: photo.width, height: photo.height }))}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </Field>
  );
}

const useStyles = makeStyles((t) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -t.spacing.xs,
    rowGap: t.spacing.sm,
  },
  cell: {
    paddingHorizontal: t.spacing.xs,
  },
  tile: {
    aspectRatio: 1,
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
    opacity: 0.85,
  },
  addTile: {
    gap: t.spacing.xs,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primarySoft,
    padding: t.spacing.sm,
  },
  addPressed: {
    opacity: 0.75,
  },
  remove: {
    position: 'absolute',
    top: t.spacing.xs,
    end: t.spacing.sm,
  },
}));
