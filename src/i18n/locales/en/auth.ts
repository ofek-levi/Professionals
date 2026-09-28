/** Demo sign-in copy. */
export const auth = {
  signIn: {
    languageLabel: 'Language',
    title: 'Choose a demo account',
    subtitle: 'Explore the marketplace as a customer or as a professional.',
    roleDescriptions: {
      customer: 'Post requests, compare offers and hire the right pro.',
      professional: 'Discover nearby jobs, send offers and manage your work.',
    },
    demoNote: 'No passwords needed. All data is simulated on this device and can be reset anytime in Settings.',
    signingIn: 'Signing in…',
    accountA11yLabel: '{{name}}, {{role}}, {{city}}',
    accountA11yHint: 'Signs in with this demo account',
    moreCategories_one: '+{{count}} more service',
    moreCategories_other: '+{{count}} more services',
    empty: {
      customer: 'There are no customer demo accounts right now.',
      professional: 'There are no professional demo accounts right now.',
      title: 'No demo accounts',
    },
    errors: {
      signInFailed: 'We couldn’t sign you in',
    },
  },
} as const;
