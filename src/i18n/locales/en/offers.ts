export const offers = {
  jobCancelled: {
    badge: 'Job cancelled',
    title: 'The customer cancelled this job',
    message: 'Your offer was accepted, but the customer cancelled the request afterwards. The appointment is off.',
  },
  actions: {
    edit: 'Edit',
    withdraw: 'Withdraw',
    viewJob: 'View job',
  },
  form: {
    title: 'Send offer',
    editTitle: 'Edit offer',
    price: 'Your price',
    date: 'Date',
    time: 'Time',
    /** Shown under "Date" when the urgency limits the days. */
    urgencyHint: '{{urgency}} – within {{hours}} hours',
    noTimes: 'No free times left on this day.',
    addMessage: 'Add a message',
    message: 'Message',
    messagePlaceholder: 'Hi! I can take care of this…',
    submit: 'Send offer',
    submitEdit: 'Save changes',
    sent: 'Offer sent',
    updated: 'Offer updated',
    fixFields: 'Please check the highlighted fields',
    /** Titles of the submit problems (worded for the professional, unlike the shared `errors:` titles). */
    problemTitle: {
      DUPLICATE_OFFER: 'You already sent an offer',
      REQUEST_NOT_ACCEPTING_OFFERS: 'This request is closed',
      OUTSIDE_SERVICE_AREA: 'Outside your service area',
      OFFER_EXPIRED: 'This offer has expired',
      UNSUPPORTED_CATEGORY: 'Not one of your services',
    },
    problem: {
      DUPLICATE_OFFER: 'You already have an active offer on this request. Edit it from the request page.',
      REQUEST_NOT_ACCEPTING_OFFERS: 'The customer has already chosen a professional or cancelled the request.',
      OUTSIDE_SERVICE_AREA: 'This job is outside your service area. Widen your service area to send an offer.',
      OFFER_EXPIRED: 'This offer expired, so it can’t be edited anymore. You can send a new one while the request is open.',
      UNSUPPORTED_CATEGORY: 'You don’t offer this service. Add it to your services to send an offer.',
      backToRequest: 'Back to the request',
      editProfile: 'Update my profile',
    },
    locked: {
      title: 'This offer can’t be edited',
      description: 'Only pending offers on open requests can be changed.',
    },
    duplicate: {
      title: 'You already sent an offer',
      description: 'You can have one active offer per request. Edit your pending offer instead.',
      edit: 'Edit my offer',
    },
    closed: {
      title: 'This request is closed',
      description: 'The customer is no longer accepting offers for this job.',
      browse: 'Browse other jobs',
    },
  },
  withdraw: {
    title: 'Withdraw this offer?',
    message: 'The customer will no longer see your quote. You can send a new offer while the request is still open.',
    confirm: 'Withdraw offer',
    keep: 'Keep offer',
    success: 'Offer withdrawn',
  },
} as const;
