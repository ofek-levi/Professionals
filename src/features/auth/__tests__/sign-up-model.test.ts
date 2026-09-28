import { firstInvalidFieldOfStep, firstInvalidStep, initialSignUpStepIndex, signUpProgress } from '../components/sign-up/sign-up-model';

describe('sign-up model', () => {
  it('starts on the role step, or on the account step when the role is known', () => {
    expect(initialSignUpStepIndex(null)).toBe(0);
    expect(initialSignUpStepIndex('customer')).toBe(1);
    expect(initialSignUpStepIndex('professional')).toBe(1);
  });

  it('counts the steps the user sees, and leaves the total open until a role is chosen', () => {
    const customer = ['role', 'account'] as const;
    const professional = ['role', 'account', 'services', 'area'] as const;
    expect(signUpProgress(customer, 0, 0, null)).toEqual({ step: 1, total: null });
    expect(signUpProgress(customer, 0, 0, 'customer')).toEqual({ step: 1, total: 2 });
    expect(signUpProgress(professional, 2, 0, 'professional')).toEqual({ step: 3, total: 4 });
    // The role came with the link: the account step is the first one.
    expect(signUpProgress(customer, 1, 1, 'customer')).toEqual({ step: 1, total: 1 });
    expect(signUpProgress(professional, 3, 1, 'professional')).toEqual({ step: 3, total: 3 });
  });

  it('finds the first invalid field of a step in screen order', () => {
    expect(firstInvalidFieldOfStep('account', ['acceptedTerms', 'phone', 'email'])).toBe('email');
    expect(firstInvalidFieldOfStep('account', ['categoryIds'])).toBeNull();
    expect(firstInvalidFieldOfStep('area', ['serviceRadiusKm', 'baseLocation'])).toBe('baseLocation');
  });

  it('returns the earliest step of the flow that shows an invalid field', () => {
    const professional = ['role', 'account', 'services', 'area'] as const;
    expect(firstInvalidStep(professional, ['baseLocation', 'email'])).toBe('account');
    expect(firstInvalidStep(professional, ['categoryIds'])).toBe('services');
    // A customer flow has no services step: the error is not shown anywhere.
    expect(firstInvalidStep(['role', 'account'], ['categoryIds'])).toBeNull();
    expect(firstInvalidStep(professional, [])).toBeNull();
  });
});
