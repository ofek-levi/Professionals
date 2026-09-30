/** Profile photo with change / remove actions (uploads through `useUploadImage`). */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { pickImagesFromLibrary, useUploadErrorToast } from '@/components/forms';
import { Avatar, Button, useConfirm, useToast } from '@/components/ui';
import { useUploadImage } from '@/hooks';
import { makeStyles } from '@/theme';

interface AvatarFieldProps {
  name: string;
  value: string | null;
  verified: boolean;
  onChange: (url: string | null) => void;
}

export function AvatarField({ name, value, verified, onChange }: AvatarFieldProps) {
  const styles = useStyles();
  const { t } = useTranslation(['professional', 'common']);
  const confirm = useConfirm();
  const toast = useToast();
  const showUploadError = useUploadErrorToast();
  const upload = useUploadImage();

  const pick = async () => {
    const result = await pickImagesFromLibrary(1);
    if (result.status === 'cancelled') return;
    if (result.status !== 'picked') {
      toast.show({ title: t('professional:form.photo.failed'), tone: 'warning' });
      return;
    }
    const [photo] = result.photos;
    try {
      const uploaded = await upload.mutateAsync({
        ...photo,
        width: photo.width && photo.width > 0 ? photo.width : null,
        height: photo.height && photo.height > 0 ? photo.height : null,
      });
      onChange(uploaded.url);
    } catch (error) {
      showUploadError(error);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: t('professional:form.photo.removeTitle'),
      confirmLabel: t('common:actions.remove'),
      destructive: true,
    });
    if (ok) onChange(null);
  };

  return (
    <View style={styles.container} testID="pro-form-photo">
      <Avatar name={name || '?'} uri={value} size="xl" verified={verified} />
      <View style={styles.actions}>
        <Button
          label={value ? t('professional:form.photo.change') : t('professional:form.photo.add')}
          size="sm"
          variant="ghost"
          loading={upload.isPending}
          onPress={() => void pick()}
        />
        {value ? <Button label={t('common:actions.remove')} size="sm" variant="ghost" onPress={() => void remove()} /> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingTop: t.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
}));
