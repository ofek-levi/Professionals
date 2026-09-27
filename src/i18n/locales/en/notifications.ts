/**
 * Notification copy. `types.<NotificationType>` is rendered by
 * `features/notifications/notification-presenter.ts` with interpolation values built from the
 * notification's structured `params` (category name, formatted price/date, names…).
 */
export const notifications = {
  title: 'Notifications',
  subtitle: 'Offers, job updates and messages',
  markAllRead: 'Mark all as read',
  markAllReadDone: 'All notifications marked as read',
  unreadSection: 'New',
  earlierSection: 'Earlier',
  unreadCount_one: '{{count}} unread notification',
  unreadCount_other: '{{count}} unread notifications',
  filters: {
    all: 'All',
    unread: 'Unread',
  },
  empty: {
    title: 'You’re all caught up',
    description: 'We’ll let you know when there are new offers, job updates or messages.',
    unreadTitle: 'No unread notifications',
    unreadDescription: 'Everything has been read. Nice!',
    customerAction: 'Post a request',
    professionalAction: 'Find jobs nearby',
    showAll: 'Show all notifications',
  },
  groups: {
    weekdayDate: '{{weekday}}, {{date}}',
  },
  markAllReadShort: 'Mark all read',
  allRead: 'You’re all caught up',
  a11y: {
    unread: 'Unread',
    openHint: 'Opens the related details',
    filters: 'Filter notifications',
  },
  fallbacks: {
    customer: 'A customer',
    professional: 'A professional',
    service: 'service',
  },
  types: {
    new_matching_request: {
      title: 'New {{category}} request nearby',
      body: 'A new request {{distance}} from you matches your services. Be the first to send an offer.',
      bodyNoDistance: 'A new request in your service area matches your services. Be the first to send an offer.',
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
