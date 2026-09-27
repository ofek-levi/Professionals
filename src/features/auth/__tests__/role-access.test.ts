import { routes } from '@/lib/routes';

import { resolveRoleAccess } from '../role-access';

describe('resolveRoleAccess', () => {
  it('waits while the session is loading', () => {
    expect(resolveRoleAccess({ status: 'loading', userId: null, role: null }, 'customer')).toEqual({ state: 'pending' });
  });

  it('sends signed-out users to sign-in', () => {
    expect(resolveRoleAccess({ status: 'signedOut', userId: null, role: null }, 'professional')).toEqual({
      state: 'redirect',
      href: routes.signIn,
    });
    expect(resolveRoleAccess({ status: 'signedOut', userId: null, role: null }, 'any')).toEqual({
      state: 'redirect',
      href: routes.signIn,
    });
  });

  it('grants access to the matching role', () => {
    expect(resolveRoleAccess({ status: 'signedIn', userId: 'u1', role: 'customer' }, 'customer')).toEqual({
      state: 'granted',
      userId: 'u1',
      role: 'customer',
    });
    expect(resolveRoleAccess({ status: 'signedIn', userId: 'u2', role: 'professional' }, 'any')).toEqual({
      state: 'granted',
      userId: 'u2',
      role: 'professional',
    });
  });

  it('redirects the other role to its own home', () => {
    expect(resolveRoleAccess({ status: 'signedIn', userId: 'u1', role: 'customer' }, 'professional')).toEqual({
      state: 'redirect',
      href: routes.customer.home,
    });
    expect(resolveRoleAccess({ status: 'signedIn', userId: 'u2', role: 'professional' }, 'customer')).toEqual({
      state: 'redirect',
      href: routes.professional.home,
    });
  });

  it('treats an incomplete signed-in session as signed out', () => {
    expect(resolveRoleAccess({ status: 'signedIn', userId: null, role: 'customer' }, 'customer')).toEqual({
      state: 'redirect',
      href: routes.signIn,
    });
  });
});
