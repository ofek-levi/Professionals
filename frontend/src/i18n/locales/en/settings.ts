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
  /** Rows: the document names (`legal:documents.*`). */
  legal: {
    sectionTitle: 'Legal',
  },
  /** Settings → Account → Delete account, and its screen (`/settings/delete-account`). */
  deleteAccount: {
    sectionTitle: 'Account',
    row: 'Delete account',
    warningTitle: 'This can’t be undone',
    warningMessage:
      'Your account and your personal details are deleted right away. You can sign up again with the same email, but as a new account.',
    changesTitle: 'What happens now',
    nothingInProgress: 'Nothing is in progress: no requests, offers or jobs need to be cancelled.',
    /** Requests nobody made an offer on are deleted, not kept as cancelled. */
    requests_one: '{{count}} request will be cancelled (or deleted, if it has no offers)',
    requests_other: '{{count}} requests will be cancelled (those without offers are deleted)',
    offersDeclined_one: '{{count}} offer on them will be declined',
    offersDeclined_other: '{{count}} offers on them will be declined',
    drafts_one: '{{count}} draft will be deleted',
    drafts_other: '{{count}} drafts will be deleted',
    customerJobs_one: '{{count}} job will be cancelled',
    customerJobs_other: '{{count}} jobs will be cancelled',
    offersWithdrawn_one: '{{count}} offer will be withdrawn',
    offersWithdrawn_other: '{{count}} offers will be withdrawn',
    professionalJobs_one: '{{count}} job will be cancelled',
    professionalJobs_other: '{{count}} jobs will be cancelled',
    more_one: 'and {{count}} more',
    more_other: 'and {{count}} more',
    /** Under the changes that reach someone else (not for drafts or requests without offers alone). */
    notifiedHint: 'The other people involved are notified, unless they turned off “Offers & job updates” notifications.',
    keepsTitle: 'What stays',
    /** The same records as the account-deletion page ("What we keep"), per role. */
    keepsJobsCustomer: 'Your jobs, including completed and cancelled ones, stay in the professionals’ history, with you shown as “Deleted user”.',
    keepsJobsProfessional: 'Your jobs, including completed and cancelled ones, stay in the customers’ history, with you shown as “Deleted user”.',
    keepsRequests:
      'Requests that received offers stay with their description as you wrote it, city and approximate location, but without the street address, apartment details, photos or cancellation comments.',
    keepsRatings: 'Your ratings stay, without your comments.',
    keepsOffers: 'Your offers keep their price and proposed time, without your message, for the customers who received them.',
    keepsReviews: 'Reviews about you stay in the job history of the customers who wrote them, but are no longer shown publicly.',
    keepsMessages: 'The messages you sent stay visible to the other person. Your chats are closed.',
    privacyHint: 'The Privacy Policy explains what is deleted and what is kept.',
    confirmTitle: 'Confirm it’s you',
    passwordLabel: 'Password',
    googleHint: 'To confirm, sign in with the Google account linked to this account.',
    googleButton: 'Confirm with Google and delete',
    googleUnavailable: 'Confirming with Google isn’t available here. Delete the account in the app where you sign in with Google.',
    googleMismatchTitle: 'That’s a different Google account',
    googleMismatchMessage: 'Choose the Google account you use to sign in to Professionals.',
    submit: 'Delete account',
    finalTitle: 'Delete your account?',
    finalMessage: 'Everything above happens right away. This can’t be undone.',
    deleted: 'Your account was deleted',
    /** `POST /me/deletion` answered 401: deleted on another device, or by an earlier attempt. */
    alreadyGone: 'This account no longer exists',
  },
} as const;
