/** Settings screen and account menu (Profile tab) copy. */
export const settings = {
  title: 'Settings',
  version: 'Version {{version}}',
  account: {
    editProfile: 'Edit profile',
    viewPublicProfile: 'View public profile',
    switchAccount: 'Switch account',
    signOut: 'Sign out',
    signOutFailed: 'We couldn’t sign you out. Please try again.',
  },
  language: {
    sectionTitle: 'Language',
    restartTitle: 'Restart to switch language?',
    restartMessage: 'The app will restart to apply the {{language}} layout direction. Nothing you’ve saved will be lost.',
    restartConfirm: 'Restart now',
  },
  appearance: {
    sectionTitle: 'Appearance',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  },
  notifications: {
    sectionTitle: 'Notifications',
    pushEnabled: 'In-app banners',
    jobUpdates: 'Offers & job updates',
    newRequests: 'New requests nearby',
    messages: 'Messages',
    reminders: 'Appointment reminders',
    emailEnabled: 'Email updates',
    saveFailed: 'Your notification preferences weren’t saved',
  },
  demo: {
    sectionTitle: 'Demo tools',
    simulation: {
      title: 'Simulated activity',
      description: 'Pros send offers and chats reply automatically',
    },
    networkFailures: {
      title: 'Unreliable network',
      description: 'About 1 in 5 requests fails',
    },
    reset: {
      title: 'Reset demo data',
      confirmTitle: 'Reset all demo data?',
      confirmMessage: 'Every change made on this device will be lost. This can’t be undone.',
      confirmLabel: 'Reset data',
      success: 'Demo data was reset',
      failed: 'We couldn’t reset the demo data',
    },
  },
} as const;
