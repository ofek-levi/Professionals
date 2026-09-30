/** Profile photo with change / remove actions (saved at once through `PUT` / `DELETE /me/avatar`). */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar, Button } from '@/components/ui';
import { makeStyles } from '@/theme';

import { useAvatarActions } from '../use-avatar-actions';

interface AvatarFieldProps {
  name: string;
  value: string | null;
  verified: boolean;
}

export function AvatarField({ name, value, verified }: AvatarFieldProps) {
  const styles = useStyles();
  const { t } = useTranslation(['professional', 'common']);
  const avatar = useAvatarActions({
    pickFailed: t('professional:form.photo.failed'),
    removeTitle: t('professional:form.photo.removeTitle'),
    removeLabel: t('common:actions.remove'),
    updated: t('professional:form.photo.updated'),
    removed: t('professional:form.photo.removed'),
  });
  const busy = avatar.uploading || avatar.removing;

  return (
    <View style={styles.container} testID="pro-form-photo">
      <Avatar name={name || '?'} uri={value} size="xl" verified={verified} />
      <View style={styles.actions}>
        <Button
          label={value ? t('professional:form.photo.change') : t('professional:form.photo.add')}
          size="sm"
          variant="ghost"
          loading={avatar.uploading}
          disabled={busy}
          onPress={() => void avatar.pick()}
          testID="pro-form-change-photo"
        />
        {value ? (
          <Button
            label={t('common:actions.remove')}
            size="sm"
            variant="ghost"
            loading={avatar.removing}
            disabled={busy}
            onPress={() => void avatar.remove()}
            testID="pro-form-remove-photo"
          />
        ) : null}
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
