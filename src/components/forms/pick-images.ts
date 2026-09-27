/**
 * Thin wrapper around `expo-image-picker` returning typed outcomes instead of throwing, so the
 * PhotoPicker can show friendly messages for every case.
 */
import * as ImagePicker from 'expo-image-picker';
import { Linking, Platform } from 'react-native';

import type { UploadImagePayload } from '@/types/api';

/** A locally picked image, ready for `POST /uploads/images`. */
export type PickedPhoto = UploadImagePayload;

export type PickImagesResult =
  | { status: 'picked'; photos: PickedPhoto[] }
  | { status: 'cancelled' }
  | { status: 'permission_denied'; canAskAgain: boolean }
  | { status: 'unavailable' }
  | { status: 'error' };

const IMAGE_QUALITY = 0.8;

function toPickedPhoto(asset: ImagePicker.ImagePickerAsset): PickedPhoto {
  return {
    uri: asset.uri,
    width: asset.width || null,
    height: asset.height || null,
    mimeType: asset.mimeType ?? null,
    fileName: asset.fileName ?? null,
  };
}

function toResult(result: ImagePicker.ImagePickerResult): PickImagesResult {
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  return { status: 'picked', photos: result.assets.map(toPickedPhoto) };
}

/** The camera is only offered on devices (not on web). */
export function isCameraSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Opens the system photo picker (no permission prompt needed on modern iOS/Android). */
export async function pickImagesFromLibrary(limit: number): Promise<PickImagesResult> {
  if (limit <= 0) return { status: 'cancelled' };
  try {
    return toResult(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: limit > 1,
        selectionLimit: limit,
        orderedSelection: true,
        quality: IMAGE_QUALITY,
      }),
    );
  } catch {
    // Older Android versions may require the media permission.
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return { status: 'permission_denied', canAskAgain: permission.canAskAgain };
    } catch {
      return { status: 'error' };
    }
    return { status: 'error' };
  }
}

/** Takes a photo with the camera, asking for permission first. */
export async function takePhotoWithCamera(): Promise<PickImagesResult> {
  if (!isCameraSupported()) return { status: 'unavailable' };
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'permission_denied', canAskAgain: permission.canAskAgain };
    return toResult(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: IMAGE_QUALITY }));
  } catch {
    return { status: 'unavailable' };
  }
}

/** Opens the app's page in system settings (to re-enable a denied permission). No-op on web. */
export async function openAppSettings(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Linking.openSettings();
  } catch {
    // Nothing else we can do.
  }
}
