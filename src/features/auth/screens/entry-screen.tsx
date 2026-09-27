/** `/` – sends the user to the sign-in screen or to the home tab of their role. */
import { Redirect } from 'expo-router';

import { routes } from '@/lib/routes';

import { useSession } from '../session-provider';

export default function EntryScreen() {
  const { status, role } = useSession();
  if (status === 'loading') return null;
  return <Redirect href={status === 'signedIn' && role ? routes.homeFor(role) : routes.signIn} />;
}
