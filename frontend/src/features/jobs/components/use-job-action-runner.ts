import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useConfirm, useErrorToast, useToast } from '@/components/ui';
import { useCompleteJob, useConfirmJob, useStartJob } from '@/hooks';
import { usePersonName } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import type { JobDetails, UserRole } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

import { getCounterpart } from './job-cards';
import type { JobActionKey } from './job-view-model';

interface JobActionRunner {
  run: (action: JobActionKey) => Promise<void>;
  /** The state-changing action currently in flight. */
  pending: JobActionKey | null;
}

/**
 * Executes job actions: leaving a review opens its screen; confirming the appointment and starting the job run immediately, while completing the
 * job (irreversible) asks for confirmation first. Results are reported with a toast.
 */
export function useJobActionRunner(job: JobDetails, role: UserRole): JobActionRunner {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const { t } = useTranslation('jobs');
  const confirmJob = useConfirmJob();
  const startJob = useStartJob();
  const completeJob = useCompleteJob();
  const personName = usePersonName();
  const name = isolateText(personName(getCounterpart(job, role)));

  const pending: JobActionKey | null = confirmJob.isPending
    ? 'confirm'
    : startJob.isPending
      ? 'start'
      : completeJob.isPending
        ? 'complete'
        : null;

  const run = async (action: JobActionKey) => {
    switch (action) {
      case 'review':
        router.push(routes.reviewJob(job.id));
        return;
      case 'confirm':
        confirmJob.mutate(job.id, {
          onSuccess: () => toast.show({ title: t('toasts.confirmed'), message: t('toasts.confirmedMessage'), tone: 'success' }),
          onError: (error) => showError(error),
        });
        return;
      case 'start':
        startJob.mutate(job.id, {
          onSuccess: () => toast.show({ title: t('toasts.started'), message: t('toasts.startedMessage'), tone: 'success' }),
          onError: (error) => showError(error),
        });
        return;
      case 'complete': {
        const customer = role === 'customer';
        const ok = await confirm({
          title: customer ? t('confirmDialogs.complete.titleCustomer') : t('confirmDialogs.complete.titleProfessional'),
          message: customer
            ? t('confirmDialogs.complete.messageCustomer', { name })
            : t('confirmDialogs.complete.messageProfessional', { name }),
          confirmLabel: t('confirmDialogs.complete.confirmLabel'),
          tone: 'success',
        });
        if (!ok) return;
        completeJob.mutate(job.id, {
          onSuccess: () =>
            toast.show({
              title: t('toasts.completed'),
              message: customer ? t('toasts.completedMessageCustomer') : t('toasts.completedMessageProfessional'),
              tone: 'success',
              onPress: customer ? () => router.push(routes.reviewJob(job.id)) : undefined,
            }),
          onError: (error) => showError(error),
        });
        return;
      }
    }
  };

  return { run, pending };
}
