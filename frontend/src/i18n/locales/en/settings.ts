/** Settings screen and account menu (Profile tab) copy. */
export const settings = {
  title: 'Settings',
  version: 'Version {{version}}',
  account: {
    editProfile: 'Edit profile',
    viewPublicProfile: 'View public profile',
    signOut: 'Sign out',
    signOutConfirmTitle: 'Sign out?',
    signOutConfirmMessage: 'Notifications for your account stop on this device until you sign in again.',
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
    pushEnabled: 'Push notifications',
    pushBlocked: 'Notifications are turned off for this app in your phone’s settings',
    jobUpdates: 'Offers & job updates',
    newRequests: 'New requests nearby',
    messages: 'Messages',
    reminders: 'Appointment reminders',
    emailEnabled: 'Email updates',
    saveFailed: 'Your notification preferences weren’t saved',
    /** Email updates only go to a verified address. */
    verifyEmail: {
      message: 'Verify {{email}} to receive email updates. The link we sent when you signed up may have expired.',
      resend: 'Send a new link',
      sent: 'We’ve sent a new link to {{email}}',
    },
  },
} as const;
