import { redirectSystemPath } from '@/app/+native-intent';

import { isNativeOAuthRedirect } from '../oauth-redirect';

describe('native OAuth redirect', () => {
  it('recognizes the Google redirect with or without its scheme', () => {
    expect(isNativeOAuthRedirect('com.professionals.marketplace:/oauthredirect?code=4%2F0Ab&state=x')).toBe(true);
    expect(isNativeOAuthRedirect('com.professionals.marketplace://oauthredirect')).toBe(true);
    expect(isNativeOAuthRedirect('/oauthredirect?code=1')).toBe(true);
  });

  it('leaves the app routes alone', () => {
    expect(isNativeOAuthRedirect('professionals://requests/req_1')).toBe(false);
    expect(isNativeOAuthRedirect('professionals://conversations/oauthredirects')).toBe(false);
    expect(isNativeOAuthRedirect('/customer/home')).toBe(false);
  });

  it('keeps the router in place for the redirect and passes other links through', () => {
    expect(redirectSystemPath({ path: 'com.professionals.marketplace:/oauthredirect?code=1', initial: false })).toBeNull();
    expect(redirectSystemPath({ path: 'professionals://settings', initial: true })).toBe('professionals://settings');
  });
});
