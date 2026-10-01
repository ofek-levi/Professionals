/**
 * Notification copy. `types.<NotificationType>` is rendered by
 * `features/notifications/notification-presenter.ts` with interpolation values built from the
 * notification's structured `params` (category name, formatted price/date, names…).
 */
export const notifications = {
  inbox: {
    title: 'Inbox',
    tabs: {
      updates: 'Updates',
      messages: 'Messages',
    },
    emptyUpdates: 'No updates yet',
    /** What will appear in Updates, per role. */
    emptyUpdatesDescription: {
      customer: 'Offers on your requests, job reminders and reviews will show up here.',
      professional: 'New jobs near you, answers to your offers and job reminders will show up here.',
    },
  },
  /** Android notification channel (shown in the system's app notification settings). */
  channel: {
    name: 'Notifications',
  },
  markAllRead: 'Mark all as read',
  markAllReadShort: 'Mark all read',
  groups: {
    weekdayDate: '{{weekday}}, {{date}}',
  },
  a11y: {
    unread: 'Unread',
    openHint: 'Opens the related details',
  },
  /** A notification type this app version does not know yet (sent by a newer server). */
  unknownType: {
    title: 'New update',
    body: 'There’s something new in your account.',
  },
  fallbacks: {
    customer: 'A customer',
    professional: 'A professional',
    service: 'service',
  },
  types: {
    new_matching_request: {
      title: 'New {{category}} request nearby',
      body: '{{distance}} from you',
      bodyNoDistance: 'In your service area',
    },
    offer_received: {
      title: 'New offer: {{price}}',
      body: '{{professionalName}} sent an offer for your {{category}} request.',
    },
    offer_updated: {
      title: 'Offer updated',
      body: '{{professionalName}} updated their offer for your {{category}} request to {{price}}.',
    },
    offer_withdrawn: {
      title: 'Offer withdrawn',
      body: '{{professionalName}} withdrew their offer for your {{category}} request.',
    },
    offer_accepted: {
      title: 'Your offer was accepted',
      body: '{{customerName}} accepted your {{price}} offer for {{category}}. Please confirm the appointment on {{date}}.',
    },
    offer_not_selected: {
      title: 'Offer not selected',
      body: 'The customer chose another professional for the {{category}} request.',
    },
    offer_expired: {
      title: 'Your offer expired',
      body: 'Your {{price}} offer for the {{category}} request expired without a response.',
    },
    request_cancelled: {
      title: 'Request cancelled',
      body: '{{customerName}} cancelled the {{category}} request.',
      /** `params.reason === 'account_deleted'`: the customer did not cancel it themselves. */
      bodyAccountDeleted: 'The customer deleted their account, so the {{category}} request was cancelled.',
    },
    job_confirmed: {
      title: 'Appointment confirmed',
      body: '{{professionalName}} confirmed your {{category}} appointment for {{date}}.',
    },
    job_started: {
      title: 'Work has started',
      body: '{{professionalName}} started working on your {{category}} job.',
    },
    appointment_reminder: {
      title: 'Upcoming appointment',
      body: 'Reminder: {{category}} with {{name}} on {{date}}.',
    },
    job_completed: {
      title: 'Job completed',
      bodyForCustomer: 'Your {{category}} job with {{name}} is complete. How did it go? Leave a review.',
      bodyForProfessional: 'The {{category}} job for {{name}} is complete. Great work!',
    },
    job_cancelled: {
      title: 'Job cancelled',
      body: 'Your {{category}} job on {{date}} was cancelled because the professional deleted their account.',
    },
    review_received: {
      title_one: 'New {{count}}-star review',
      title_other: 'New {{count}}-star review',
      body: '{{customerName}} reviewed your {{category}} work.',
    },
    new_message: {
      title: 'New message from {{name}}',
      body: '{{preview}}',
      bodyEmpty: 'Open the chat to read it.',
    },
  },
} as const;
