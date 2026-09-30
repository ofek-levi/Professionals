export const customer = {
  home: {
    hello: 'Hi, {{name}}',
    /** When the account could not be loaded (offline, server down). */
    helloNeutral: 'Hi there',
    request: {
      title: 'What do you need help with?',
      subtitle: 'Describe the job and get offers from local pros.',
      action: 'Request a service',
    },
    active: {
      title: 'Active',
      empty: 'Nothing active right now. Your requests and bookings will show up here.',
      rate: 'Rate {{name}}',
    },
  },
  requests: {
    newRequest: 'New request',
    tabs: {
      active: 'Active',
      past: 'Past',
    },
    empty: {
      active: {
        title: 'No active requests',
        description: 'Tell us what you need and pros nearby will send you offers.',
        action: 'Request a service',
      },
      past: {
        title: 'Nothing here yet',
        description: 'Completed and cancelled requests are kept here.',
      },
    },
  },
  details: {
    status: {
      draft: 'Draft – not posted yet',
      waiting: 'Waiting for offers',
      waitingHint_one: 'We’ve notified {{count}} pro nearby.',
      waitingHint_other: 'We’ve notified {{count}} pros nearby.',
      waitingNoPros: 'No pros offer this service in your area yet. Your request stays open – pros who join nearby will see it.',
      offersToReview_one: '{{count}} offer to review',
      offersToReview_other: '{{count}} offers to review',
      booked: 'Booked with {{name}}',
      bookedPending: 'Booked',
      inProgress: 'In progress with {{name}}',
      completed: 'Completed by {{name}}',
      completedPending: 'Completed',
      cancelled: 'Cancelled',
    },
    posted: 'Posted {{time}}',
    saved: 'Saved {{time}}',
    postedBanner: 'You’re all set. We’ll let you know when offers arrive.',
    hired: {
      appointment: 'Appointment',
      completed: 'Completed',
      price: 'Price',
      viewJob: 'View job',
      message: 'Message {{name}}',
    },
    cancelRequest: 'Cancel request',
    /** Cancelled request: start a new one for the same service. */
    requestAgain: 'Request again',
    draft: {
      continue: 'Continue',
      delete: 'Delete draft',
      deleteConfirmTitle: 'Delete this draft?',
      deleteConfirmMessage: 'The draft and its photos will be removed. This can’t be undone.',
      deleted: 'Draft deleted',
    },
  },
  offers: {
    title: 'Offers ({{count}})',
    sorts: {
      recommended: 'Recommended',
      lowest_price: 'Lowest price',
      earliest_availability: 'Earliest',
    },
    viewProfile: 'View profile',
    accept: 'Accept',
    acceptConfirm: {
      title: 'Hire {{name}}?',
      summary: '{{price}} · {{date}}',
      othersDeclined_one: 'The other offer will be declined.',
      othersDeclined_other: 'The other {{count}} offers will be declined.',
      confirm: 'Accept offer',
    },
    acceptedToast: {
      title: 'You hired {{name}}',
      message: 'We let them know. Tap to view the job.',
    },
  },
  cancel: {
    title: 'Cancel request',
    subtitle: 'Tell us why – it helps pros and improves our matches.',
    reasonLabel: 'Reason',
    commentLabel: 'Anything to add?',
    commentPlaceholder: 'Optional comment for the pros',
    proWarning: 'Your pro will be notified and the appointment will be cancelled.',
    submit: 'Cancel request',
    keep: 'Keep request',
    confirmTitle: 'Cancel this request?',
    confirmMessage: 'Pending offers will be declined and pros will no longer see this request.',
    confirmMessageWithPro: 'The appointment with your pro will be cancelled and they will be notified.',
    confirmLabel: 'Yes, cancel',
    success: 'Request cancelled',
  },
} as const;
