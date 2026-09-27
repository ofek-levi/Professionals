/**
 * `/requests/:requestId` – the same URL serves both roles (deep links and notifications don't need
 * to know the viewer): customers see their request with offers, professionals the job view.
 */
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/ui';
import { CustomerRequestDetails } from '@/features/customer/components/customer-request-details';
import { useSession } from '@/features/auth/session-provider';
import { ProfessionalRequestDetails } from '@/features/professional/components/professional-request-details';
import { useRouteParam } from '@/hooks/use-route-param';

export default function RequestDetailsScreen() {
  const { t } = useTranslation('common');
  const requestId = useRouteParam('requestId');
  const { role } = useSession();

  if (!requestId || !role) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <EmptyState icon="file-search-outline" title={t('states.notFoundTitle')} description={t('states.notFoundDescription')} />
      </Screen>
    );
  }

  return role === 'customer' ? (
    <CustomerRequestDetails requestId={requestId} />
  ) : (
    <ProfessionalRequestDetails requestId={requestId} />
  );
}
