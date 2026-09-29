/**
 * `/requests/:requestId` – the same URL serves both roles (deep links and notifications don't need
 * to know the viewer): customers see their request with offers, professionals the job view.
 * `?posted=1` (right after posting) shows the customer a one-time success banner.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/ui';
import { CustomerRequestDetails } from '@/features/customer/components/customer-request-details';
import { useSession } from '@/features/auth/session-provider';
import { ProfessionalRequestDetails } from '@/features/professional/components/professional-request-details';
import { useRouteParam } from '@/hooks/use-route-param';

import { POSTED_PARAM } from '../components/create/request-form-model';

export default function RequestDetailsScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const requestId = useRouteParam('requestId');
  const postedParam = useRouteParam(POSTED_PARAM);
  const { role } = useSession();
  // Read once: the param is dropped from the URL so going back or reloading doesn't repeat it.
  const [justPosted] = useState(postedParam === '1');

  useEffect(() => {
    if (postedParam) router.setParams({ [POSTED_PARAM]: undefined });
  }, [postedParam, router]);

  if (!requestId || !role) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <EmptyState title={t('states.notFoundTitle')} description={t('states.notFoundDescription')} />
      </Screen>
    );
  }

  return role === 'customer' ? (
    <CustomerRequestDetails requestId={requestId} justPosted={justPosted} />
  ) : (
    <ProfessionalRequestDetails requestId={requestId} />
  );
}
