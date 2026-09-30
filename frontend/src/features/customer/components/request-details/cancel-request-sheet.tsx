import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FormTextField, useTranslatedError } from '@/components/forms';
import { AppText, Button, Icon, InlineAlert, Sheet, useConfirm, useErrorToast, useToast } from '@/components/ui';
import { useCancelRequest } from '@/hooks';
import { CANCEL_COMMENT_MAX_LENGTH, cancelRequestSchema } from '@/lib/validation';
import { makeStyles, useTheme } from '@/theme';
import { REQUEST_CANCELLATION_REASONS, type CustomerRequestView } from '@/types/domain';

interface CancelRequestSheetProps {
  request: CustomerRequestView;
  visible: boolean;
  onClose: () => void;
}

/** Cancellation with a reason and an optional comment (confirmed before submitting). */
export function CancelRequestSheet({ request, visible, onClose }: CancelRequestSheetProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['customer', 'common']);
  const translateError = useTranslatedError();
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const cancelRequest = useCancelRequest();
  const { control, handleSubmit, reset } = useForm({
    resolver: zodResolver(cancelRequestSchema),
    defaultValues: { comment: '' },
  });
  const hasPro = Boolean(request.jobId || request.acceptedOfferId);

  const close = () => {
    if (cancelRequest.isPending) return;
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    const confirmed = await confirm({
      title: t('customer:cancel.confirmTitle'),
      message: hasPro ? t('customer:cancel.confirmMessageWithPro') : t('customer:cancel.confirmMessage'),
      confirmLabel: t('customer:cancel.confirmLabel'),
      cancelLabel: t('customer:cancel.keep'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await cancelRequest.mutateAsync({ requestId: request.id, payload: values });
      onClose();
      reset();
      toast.show({ title: t('customer:cancel.success'), tone: 'neutral' });
    } catch (error) {
      showError(error);
    }
  });

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={t('customer:cancel.title')}
      subtitle={t('customer:cancel.subtitle')}
      footer={
        <View style={styles.footer}>
          <Button
            label={t('customer:cancel.submit')}
            variant="danger"
            fullWidth
            loading={cancelRequest.isPending}
            onPress={() => void submit()}
            testID="cancel-request-submit"
          />
          <Button label={t('customer:cancel.keep')} variant="ghost" fullWidth onPress={close} disabled={cancelRequest.isPending} />
        </View>
      }
      testID="cancel-request-sheet"
    >
      <View style={styles.content}>
        {hasPro ? <InlineAlert tone="warning" message={t('customer:cancel.proWarning')} /> : null}
        <Controller
          control={control}
          name="reason"
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <View style={styles.reasons} accessibilityRole="radiogroup">
              <AppText variant="captionStrong" color="secondary">
                {t('customer:cancel.reasonLabel')}
              </AppText>
              {REQUEST_CANCELLATION_REASONS.map((reason) => {
                const selected = value === reason;
                return (
                  <Pressable
                    key={reason}
                    accessibilityRole="radio"
                    aria-checked={selected}
                    onPress={() => onChange(reason)}
                    testID={`cancel-reason-${reason}`}
                    style={({ pressed }) => [
                      styles.reason,
                      selected ? { backgroundColor: theme.colors.dangerSoft } : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Icon
                      name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={22}
                      color={selected ? 'danger' : 'muted'}
                    />
                    <AppText variant="body" style={styles.flex}>
                      {t(`common:cancellationReason.${reason}`)}
                    </AppText>
                  </Pressable>
                );
              })}
              {error ? (
                <AppText variant="caption" color="danger">
                  {translateError(error.message)}
                </AppText>
              ) : null}
            </View>
          )}
        />
        <FormTextField
          control={control}
          name="comment"
          label={t('customer:cancel.commentLabel')}
          placeholder={t('customer:cancel.commentPlaceholder')}
          optional
          multiline
          minRows={3}
          maxLength={CANCEL_COMMENT_MAX_LENGTH}
        />
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((t) => ({
  content: {
    gap: t.spacing.lg,
    paddingBottom: t.spacing.md,
  },
  reasons: {
    gap: t.spacing.sm,
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 50,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.surface,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  flex: {
    flex: 1,
  },
  footer: {
    gap: t.spacing.xs,
  },
}));
