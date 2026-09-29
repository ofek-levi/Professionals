/**
 * Google's native sign-in redirect, `<applicationId>:/oauthredirect?…` (expo-auth-session), comes
 * back into the app as a deep link. The browser auth session consumes it; it is not a screen.
 */
const NATIVE_OAUTH_REDIRECT = /^(?:[a-z][a-z0-9+.-]*:)?\/*oauthredirect(?:[/?#]|$)/i;

/** `true` for the native OAuth redirect URL (with or without its scheme). */
export function isNativeOAuthRedirect(url: string): boolean {
  return NATIVE_OAUTH_REDIRECT.test(url);
}
