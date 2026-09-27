/** Profile photo with change / remove actions (uploads through `useUploadImage`). */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { pickImagesFromLibrary } from '@/components/forms';
import { AppText, Avatar, Button, useConfirm, useErrorText, useToast } from '@/components/ui';
import { useUploadImage } from '@/hooks';
import { makeStyles } from '@/theme';

export interface AvatarFieldProps {
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
  const errorText = useErrorText();
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
      toast.show({ ...errorText(error), tone: 'danger' });
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: t('professional:form.photo.removeTitle'),
      confirmLabel: t('common:actions.remove'),
      destructive: true,
      icon: 'image-remove',
    });
    if (ok) onChange(null);
  };

  return (
    <View style={styles.container} testID="pro-form-photo">
      <Avatar name={name || '?'} uri={value} size="xl" verified={verified} />
      <View style={styles.texts}>
        <AppText variant="subheading">{t('professional:form.photo.title')}</AppText>
        <AppText variant="caption" color="secondary">
          {t('professional:form.photo.hint')}
        </AppText>
        <View style={styles.actions}>
          <Button
            label={value ? t('professional:form.photo.change') : t('professional:form.photo.add')}
            size="sm"
            variant="secondary"
            leftIcon="camera-outline"
            loading={upload.isPending}
            onPress={() => void pick()}
          />
          {value ? <Button label={t('common:actions.remove')} size="sm" variant="ghost" onPress={() => void remove()} /> : null}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.lg,
    padding: t.spacing.lg,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
    marginTop: t.spacing.xs,
  },
}));
