/**
 * Native deep links, before Expo Router turns them into routes (iOS/Android only).
 *
 * Google's native sign-in redirect (`com.professionals.marketplace:/oauthredirect?…`) reaches the app
 * as a deep link while the browser auth session that consumes it is still open. Returning `null`
 * keeps the router where it is instead of opening the "not found" screen.
 */
import { isNativeOAuthRedirect } from '@/services/auth/oauth-redirect';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  return isNativeOAuthRedirect(path) ? null : path;
}
