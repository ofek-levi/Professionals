import { parseInboxTab, parseWorkTab, routes, TAB_PARAM } from '../routes';

describe('tab routes', () => {
  it('builds the tabs of each role', () => {
    expect(routes.customer.requests).toBe('/customer/requests');
    expect(routes.homeFor('customer')).toBe('/customer/home');
    expect(routes.homeFor('professional')).toBe('/professional/home');
  });

  it('builds the Work tab, optionally on a segment', () => {
    expect(TAB_PARAM).toBe('tab');
    expect(routes.professional.work()).toBe('/professional/work');
    expect(routes.professional.work('jobs')).toBe('/professional/work?tab=jobs');
  });

  it('parses segment params with a safe fallback', () => {
    expect(parseWorkTab('jobs')).toBe('jobs');
    expect(parseWorkTab('offers')).toBe('offers');
    expect(parseWorkTab('nope')).toBe('offers');
    expect(parseWorkTab(undefined)).toBe('offers');
    expect(parseInboxTab('messages')).toBe('messages');
    expect(parseInboxTab('updates')).toBe('updates');
    expect(parseInboxTab(['messages'])).toBe('updates');
    expect(parseInboxTab(null)).toBe('updates');
  });
});

describe('routes', () => {
  it('encodes ids and optional query params', () => {
    expect(routes.request('req 1')).toBe('/requests/req%201');
    expect(routes.submitOffer('req_1', 'off_2')).toBe('/requests/req_1/offer?offerId=off_2');
    expect(routes.newRequest({ categoryId: 'plumbing' })).toBe('/requests/new?categoryId=plumbing');
    expect(routes.newRequest({ draftId: 'd 1' })).toBe('/requests/new?draftId=d%201');
    expect(routes.conversation('conv 1')).toBe('/conversations/conv%201');
  });
});
