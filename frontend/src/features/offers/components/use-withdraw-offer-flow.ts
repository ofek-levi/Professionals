import { useTranslation } from 'react-i18next';

import { useConfirm, useErrorToast, useToast } from '@/components/ui';
import { useWithdrawOffer } from '@/hooks';

/**
 * Withdraw with a confirmation and a result toast (the professional's request details).
 * `pendingOfferId` tells which offer is being withdrawn (for button spinners).
 */
export function useWithdrawOfferFlow() {
  const { t } = useTranslation('offers');
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const mutation = useWithdrawOffer();

  const withdraw = async (offerId: string, onDone?: () => void): Promise<void> => {
    const ok = await confirm({
      title: t('withdraw.title'),
      message: t('withdraw.message'),
      confirmLabel: t('withdraw.confirm'),
      cancelLabel: t('withdraw.keep'),
      destructive: true,
    });
    if (!ok) return;
    mutation.mutate(offerId, {
      onSuccess: () => {
        toast.show({ title: t('withdraw.success'), tone: 'neutral' });
        onDone?.();
      },
      onError: (error) => showError(error),
    });
  };

  return {
    withdraw,
    pendingOfferId: mutation.isPending ? (mutation.variables ?? null) : null,
  };
}
