import { DomainError, isDomainError } from '../domain-error';
import { assertTransition, canTransition } from '../state-machine';

describe('DomainError', () => {
  it('maps codes to HTTP statuses', () => {
    expect(DomainError.notFound('Request', 'r1')).toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(DomainError.forbidden()).toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(DomainError.unauthorized()).toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(DomainError.conflict('x', 'DUPLICATE_OFFER')).toMatchObject({ code: 'DUPLICATE_OFFER', status: 409 });
    expect(DomainError.invalidTransition('offer', 'accepted', 'pending')).toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      status: 409,
    });
    expect(new DomainError('NETWORK_ERROR', 'offline')).toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });

  it('serializes validation errors with field errors', () => {
    const error = DomainError.validation({ description: ['validation:request.descriptionTooShort'] });
    // The backend answers 400 for payload errors and 422 for the domain codes.
    expect(error.status).toBe(400);
    expect(DomainError.validation({}, 'x', 'UNSUPPORTED_CATEGORY').status).toBe(422);
    expect(DomainError.validation({}, 'x', 'OUTSIDE_SERVICE_AREA').status).toBe(422);
    expect(error.toBody()).toEqual({
      code: 'VALIDATION_ERROR',
      message: expect.any(String),
      fieldErrors: { description: ['validation:request.descriptionTooShort'] },
    });
    expect(DomainError.forbidden().toBody()).not.toHaveProperty('fieldErrors');
    expect(isDomainError(error)).toBe(true);
    expect(isDomainError(new Error('x'))).toBe(false);
  });
});

describe('state machine helpers', () => {
  const table = { a: ['b'], b: ['c'], c: [] } as const;
  it('checks and asserts transitions', () => {
    expect(canTransition(table, 'a', 'b')).toBe(true);
    expect(canTransition(table, 'a', 'c')).toBe(false);
    expect(() => assertTransition(table, 'thing', 'b', 'a')).toThrow(DomainError);
  });
});
