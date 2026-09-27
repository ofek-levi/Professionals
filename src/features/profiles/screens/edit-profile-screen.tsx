/** `/profile/edit` – edits the signed-in user's own profile with the form for their role. */
import { CustomerProfileForm } from '@/features/profiles/components/customer-profile-form';
import { ProfessionalProfileForm } from '@/features/profiles/components/professional-profile-form';
import { useSession } from '@/features/auth/session-provider';

export default function EditProfileScreen() {
  const { role } = useSession();
  if (role === 'professional') return <ProfessionalProfileForm />;
  if (role === 'customer') return <CustomerProfileForm />;
  return null;
}
