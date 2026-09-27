import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useConfirm, useErrorText, useToast } from '@/components/ui';
import { useCompleteJob, useConfirmJob, useStartJob } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import type { JobDetails, UserRole } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

import { getCounterpartName } from './job-cards';
import type { JobActionKey } from './job-view-model';

export interface JobActionRunner {
  run: (action: JobActionKey) => Promise<void>;
  /** The state-changing action currently in flight. */
  pending: JobActionKey | null;
}

/**
 * Executes job actions: navigation actions (review, cancel via the request) go straight to their
 * screen; state changes (confirm, start, complete) ask for confirmation, run the mutation and
 * report the result with a toast.
 */
export function useJobActionRunner(job: JobDetails, role: UserRole): JobActionRunner {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const errorText = useErrorText();
  const format = useFormatters();
  const { t } = useTranslation('jobs');
  const confirmJob = useConfirmJob();
  const startJob = useStartJob();
  const completeJob = useCompleteJob();
  const name = isolateText(getCounterpartName(job, role));

  const pending: JobActionKey | null = confirmJob.isPending
    ? 'confirm'
    : startJob.isPending
      ? 'start'
      : completeJob.isPending
        ? 'complete'
        : null;

  const showError = (error: unknown) => {
    const { title, description } = errorText(error);
    toast.show({ title, message: description, tone: 'danger' });
  };

  const run = async (action: JobActionKey) => {
    switch (action) {
      case 'review':
        router.push(routes.reviewJob(job.id));
        return;
      case 'cancel':
        router.push(routes.request(job.requestId));
        return;
      case 'confirm': {
        const ok = await confirm({
          title: t('confirmDialogs.confirm.title'),
          message: t('confirmDialogs.confirm.message', { name, date: format.dateTime(job.scheduledStartAt, { casing: 'inline' }) }),
          confirmLabel: t('confirmDialogs.confirm.confirmLabel'),
          icon: 'calendar-check',
          tone: 'brand',
        });
        if (!ok) return;
        confirmJob.mutate(job.id, {
          onSuccess: () =>
            toast.show({ title: t('toasts.confirmed'), message: t('toasts.confirmedMessage'), tone: 'success', icon: 'calendar-check' }),
          onError: showError,
        });
        return;
      }
      case 'start': {
        const ok = await confirm({
          title: t('confirmDialogs.start.title'),
          message: t('confirmDialogs.start.message', { name }),
          confirmLabel: t('confirmDialogs.start.confirmLabel'),
          icon: 'progress-wrench',
          tone: 'warning',
        });
        if (!ok) return;
        startJob.mutate(job.id, {
          onSuccess: () => toast.show({ title: t('toasts.started'), message: t('toasts.startedMessage'), tone: 'success', icon: 'progress-wrench' }),
          onError: showError,
        });
        return;
      }
      case 'complete': {
        const customer = role === 'customer';
        const ok = await confirm({
          title: customer ? t('confirmDialogs.complete.titleCustomer') : t('confirmDialogs.complete.titleProfessional'),
          message: customer
            ? t('confirmDialogs.complete.messageCustomer', { name })
            : t('confirmDialogs.complete.messageProfessional', { name }),
          confirmLabel: t('confirmDialogs.complete.confirmLabel'),
          icon: 'check-decagram-outline',
          tone: 'success',
        });
        if (!ok) return;
        completeJob.mutate(job.id, {
          onSuccess: () =>
            toast.show({
              title: t('toasts.completed'),
              message: customer ? t('toasts.completedMessageCustomer') : t('toasts.completedMessageProfessional'),
              tone: 'success',
              icon: 'check-decagram',
              onPress: customer ? () => router.push(routes.reviewJob(job.id)) : undefined,
            }),
          onError: showError,
        });
        return;
      }
    }
  };

  return { run, pending };
}
