/** Job tracking screen copy (both roles). */
export const jobs = {
  details: {
    headline: {
      awaiting_confirmation: {
        customer: 'Waiting for {{name}} to confirm the appointment',
        professional: 'Confirm the appointment so {{name}} knows you’re coming',
      },
      scheduled: {
        customer: '{{name}} is booked for {{date}}',
        professional: 'You’re booked for {{date}}',
      },
      in_progress: {
        customer: '{{name}} is working on your job',
        professional: 'Work in progress. Mark the job as completed when you’re done.',
      },
      completed: {
        customer: 'Job completed on {{date}}. We hope it went great!',
        professional: 'Great work! Job completed on {{date}}.',
      },
      cancelled: {
        customer: 'This job was cancelled. The appointment is off and messaging is closed.',
        professional: 'The customer cancelled this job. The appointment is off and messaging is closed.',
      },
      /** Cancelled because the other party deleted their account (also while it was in progress). */
      cancelledAccountDeleted: {
        customer: 'This job was cancelled because the professional deleted their account. The appointment is off and messaging is closed.',
        professional: 'This job was cancelled because the customer deleted their account. The appointment is off and messaging is closed.',
      },
    },
    progress: {
      accepted: 'Booked',
      confirmed: 'Confirmed',
      in_progress: 'Started',
      completed: 'Done',
    },
    appointment: {
      title: 'Appointment',
      timeRange: '{{start}}–{{end}}',
    },
    price: {
      title: 'Price',
    },
    location: {
      title: 'Address',
    },
    counterpart: {
      professional: 'Your professional',
      customer: 'Customer',
    },
    request: {
      viewRequest: 'View request',
    },
    review: {
      customerTitle: 'Your review',
      professionalTitle: 'Customer review',
      pendingProfessional: 'The customer hasn’t left a review yet.',
    },
    notFoundTitle: 'Job not found',
    notFoundDescription: 'This job may have been removed or you don’t have access to it.',
  },
  actions: {
    confirm: 'Confirm appointment',
    start: 'Start job',
    complete: 'Mark as completed',
    review: 'Leave a review',
    message: 'Message',
  },
  confirmDialogs: {
    complete: {
      confirmLabel: 'Yes, it’s done',
      titleCustomer: 'Is the work done?',
      messageCustomer: 'Mark the job as completed only when everything is finished. You’ll be able to review {{name}} next.',
      titleProfessional: 'Mark the job as completed?',
      messageProfessional: '{{name}} will be notified and asked to review your work.',
    },
  },
  toasts: {
    confirmed: 'Appointment confirmed',
    confirmedMessage: 'The customer has been notified.',
    started: 'Job started',
    startedMessage: 'Good luck! Mark it as completed when you’re done.',
    completed: 'Job completed',
    completedMessageCustomer: 'Tap to leave a review.',
    completedMessageProfessional: 'Great work! The customer has been asked for a review.',
  },
} as const;
