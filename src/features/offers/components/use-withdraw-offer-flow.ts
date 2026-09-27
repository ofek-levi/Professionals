import { useTranslation } from 'react-i18next';

import { useConfirm, useErrorText, useToast } from '@/components/ui';
import { useWithdrawOffer } from '@/hooks';

/**
 * Withdraw with confirmation and result toasts, shared by "My offers", the request details and the
 * offer details. `pendingOfferId` tells which offer is being withdrawn (for button spinners).
 */
export function useWithdrawOfferFlow() {
  const { t } = useTranslation('offers');
  const confirm = useConfirm();
  const toast = useToast();
  const errorText = useErrorText();
  const mutation = useWithdrawOffer();

  const withdraw = async (offerId: string, onDone?: () => void): Promise<void> => {
    const ok = await confirm({
      title: t('withdraw.title'),
      message: t('withdraw.message'),
      confirmLabel: t('withdraw.confirm'),
      cancelLabel: t('withdraw.keep'),
      icon: 'undo-variant',
      destructive: true,
    });
    if (!ok) return;
    mutation.mutate(offerId, {
      onSuccess: () => {
        toast.show({ title: t('withdraw.success'), message: t('withdraw.successMessage'), tone: 'neutral', icon: 'undo-variant' });
        onDone?.();
      },
      onError: (error) => toast.show({ ...errorText(error), tone: 'danger' }),
    });
  };

  return {
    withdraw,
    pendingOfferId: mutation.isPending ? (mutation.variables ?? null) : null,
  };
}
