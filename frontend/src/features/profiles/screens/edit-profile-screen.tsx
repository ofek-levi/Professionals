/** `/profile/edit` – edits the signed-in user's own profile with the form for their role. */
import { useLocalSearchParams } from 'expo-router';

import { CustomerProfileForm } from '@/features/profiles/components/customer-profile-form';
import { ProfessionalProfileForm } from '@/features/profiles/components/professional-profile-form';
import { useSession } from '@/features/auth/session-provider';

export default function EditProfileScreen() {
  const { role } = useSession();
  // `?section=area`: opened to widen the service area (Explore's empty state).
  const { section } = useLocalSearchParams<{ section?: string }>();
  if (role === 'professional') return <ProfessionalProfileForm focus={section === 'area' ? 'area' : undefined} />;
  if (role === 'customer') return <CustomerProfileForm />;
  return null;
}
