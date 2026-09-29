import type { GoogleIdentity, GoogleVerifier } from './google-verifier.js';

/** Test double: `issue()` returns a token that `verify()` accepts until `revoke()`. */
export class MemoryGoogleVerifier implements GoogleVerifier {
  readonly configured = true;
  private readonly tokens = new Map<string, GoogleIdentity>();
  private next = 1;

  issue(identity: Partial<GoogleIdentity> & Pick<GoogleIdentity, 'email'>): string {
    const token = `google-test-token-${this.next++}`;
    this.tokens.set(token, {
      sub: identity.sub ?? `google-sub-${identity.email}`,
      email: identity.email.toLowerCase(),
      firstName: identity.firstName ?? 'Test',
      lastName: identity.lastName ?? 'User',
      avatarUrl: identity.avatarUrl ?? null,
    });
    return token;
  }

  revoke(token: string): void {
    this.tokens.delete(token);
  }

  verify(idToken: string): Promise<GoogleIdentity | null> {
    return Promise.resolve(this.tokens.get(idToken) ?? null);
  }
}
