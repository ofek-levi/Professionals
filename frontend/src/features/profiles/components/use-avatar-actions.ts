/**
 * The profile photo's actions: pick a photo → `PUT /me/avatar`, remove (after a confirmation) →
 * `DELETE /me/avatar`. Saved at once, apart from the profile form's "Save changes": the photo is
 * the account's, and the answer updates `/me` and the own profile everywhere.
 */
import { pickImagesFromLibrary, useUploadErrorToast } from '@/components/forms';
import { useConfirm, useErrorToast, useToast } from '@/components/ui';
import { useRemoveAvatar, useSetAvatar } from '@/hooks';

export interface AvatarTexts {
  /** The photo library could not be opened. */
  pickFailed: string;
  removeTitle: string;
  removeLabel: string;
  updated: string;
  removed: string;
}

export function useAvatarActions(texts: AvatarTexts) {
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const showUploadError = useUploadErrorToast();
  const setAvatar = useSetAvatar();
  const removeAvatar = useRemoveAvatar();

  const pick = async () => {
    const result = await pickImagesFromLibrary(1);
    if (result.status === 'cancelled') return;
    const [photo] = result.status === 'picked' ? result.photos : [];
    if (!photo) {
      toast.show({ title: texts.pickFailed, tone: 'warning' });
      return;
    }
    try {
      await setAvatar.mutateAsync(photo);
      toast.show({ title: texts.updated, tone: 'success', icon: 'check-circle-outline' });
    } catch (error) {
      showUploadError(error);
    }
  };

  const remove = async () => {
    const confirmed = await confirm({ title: texts.removeTitle, confirmLabel: texts.removeLabel, destructive: true, icon: 'image-remove' });
    if (!confirmed) return;
    try {
      await removeAvatar.mutateAsync();
      toast.show({ title: texts.removed, tone: 'neutral' });
    } catch (error) {
      showError(error);
    }
  };

  return { pick, remove, uploading: setAvatar.isPending, removing: removeAvatar.isPending };
}
