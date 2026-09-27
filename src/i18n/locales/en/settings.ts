/** Settings screen copy. */
export const settings = {
  title: 'Settings',
  account: {
    sectionTitle: 'Account',
    signedInAs: 'Signed in as',
    switchAccount: 'Switch account',
    switchAccountHint: 'Signs out and returns to the demo account list',
    signOut: 'Sign out',
    signOutConfirmTitle: 'Sign out?',
    signOutConfirmMessage: 'You can sign back in with any demo account.',
    loadError: 'We couldn’t load your account details.',
  },
  language: {
    sectionTitle: 'Language',
    description: 'Choose the language of the app.',
    restartTitle: 'Restart to switch language?',
    restartMessage: 'The app will restart to apply the {{language}} layout direction. Nothing you’ve saved will be lost.',
    restartConfirm: 'Restart now',
    changed: 'Language updated',
  },
  appearance: {
    sectionTitle: 'Appearance',
    description: 'Match your device or pick a fixed theme.',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  },
  notifications: {
    sectionTitle: 'Notifications',
    description: 'Choose what you want to hear about.',
    pushEnabled: {
      title: 'Notification banners',
      description: 'Show alerts while you use the app',
    },
    jobUpdates: {
      title: 'Offers & job updates',
      description: 'New offers, acceptances, schedule changes and cancellations',
    },
    newRequests: {
      title: 'New matching requests',
      description: 'Requests nearby that match your services',
    },
    messages: {
      title: 'Messages',
      description: 'New chat messages from customers and pros',
    },
    reminders: {
      title: 'Appointment reminders',
      description: 'A reminder before each scheduled appointment',
    },
    emailEnabled: {
      title: 'Email updates',
      description: 'A copy of important updates by email',
    },
    saveFailed: 'Your notification preferences weren’t saved',
  },
  demo: {
    sectionTitle: 'Demo tools',
    description: 'Tools for exploring the app. They only affect the data on this device.',
    simulation: {
      title: 'Simulated activity',
      description: 'Other pros send offers and chat partners reply automatically',
    },
    networkFailures: {
      title: 'Unreliable network',
      description: 'About 1 in 5 requests fails, to try error handling',
    },
    reset: {
      title: 'Reset demo data',
      description: 'Restore all requests, offers, jobs and messages to their original state',
      confirmTitle: 'Reset all demo data?',
      confirmMessage: 'Every change made on this device will be lost. This can’t be undone.',
      confirmLabel: 'Reset data',
      success: 'Demo data was reset',
      failed: 'We couldn’t reset the demo data',
    },
  },
  about: {
    sectionTitle: 'About',
    version: 'Version',
    dataSource: 'Data source',
    dataSources: {
      mock: 'Demo data on this device',
      http: 'Live server',
    },
  },
} as const;
