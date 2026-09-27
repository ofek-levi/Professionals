import { REQUESTS_SECTION_PARAM, routes } from '../routes';

describe('routes.customerRequests', () => {
  it('opens My Requests without a section by default', () => {
    expect(routes.customerRequests()).toBe('/customer/requests');
    expect(routes.customerRequests(null)).toBe(routes.customer.requests);
  });

  it('preselects a section through the search param', () => {
    expect(REQUESTS_SECTION_PARAM).toBe('section');
    expect(routes.customerRequests('has_offers')).toBe('/customer/requests?section=has_offers');
    expect(routes.customerRequests('completed')).toBe('/customer/requests?section=completed');
  });
});

describe('routes', () => {
  it('encodes ids and optional query params', () => {
    expect(routes.request('req 1')).toBe('/requests/req%201');
    expect(routes.submitOffer('req_1', 'off_2')).toBe('/requests/req_1/offer?offerId=off_2');
    expect(routes.newRequest({ categoryId: 'plumbing' })).toBe('/requests/new?categoryId=plumbing');
  });
});
