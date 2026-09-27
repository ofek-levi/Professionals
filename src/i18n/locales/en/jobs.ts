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
    },
    timeline: {
      steps: {
        accepted: 'Offer accepted',
        confirmed: 'Appointment confirmed',
        in_progress: 'In progress',
        completed: 'Completed',
        cancelled: 'Cancelled',
      },
      hints: {
        confirmedNext: {
          customer: 'The professional will confirm shortly',
          professional: 'Waiting for your confirmation',
        },
        inProgressNext: 'Scheduled for {{date}}',
        inProgressActive: 'Started {{relative}}',
        completedNext: 'Mark as completed once the work is done',
        skipped: 'Completed without a separate start',
      },
    },
    appointment: {
      title: 'Appointment',
      timeRange: '{{start}}–{{end}}',
      startsIn: 'Starts {{relative}}',
      startsTomorrow: 'Starts tomorrow',
      startsInDays_one: 'Starts in {{count}} day',
      startsInDays_other: 'Starts in {{count}} days',
      startedAgo: 'Was due {{relative}}',
      completedAt: 'Completed on {{date}}',
      cancelledAt: 'Cancelled on {{date}}',
    },
    price: {
      title: 'Agreed price',
      hint: 'Fixed price from the accepted offer',
      viewOffer: 'View offer',
    },
    location: {
      title: 'Location',
      mapLabel: 'Map of the job location',
    },
    counterpart: {
      professional: 'Your professional',
      customer: 'Customer',
      memberSince: 'Member since {{date}}',
      jobsCompleted_one: '{{count}} job completed',
      jobsCompleted_other: '{{count}} jobs completed',
    },
    request: {
      title: 'Request details',
      notes: 'Notes',
      viewRequest: 'View request',
    },
    review: {
      customerTitle: 'Your review',
      professionalTitle: 'Customer review',
      promptTitle: 'How did it go with {{name}}?',
      promptDescription: 'Your review helps other customers choose with confidence and takes less than a minute.',
      pendingProfessional: 'The customer hasn’t left a review yet.',
    },
    nextStep: {
      title: 'Next step',
      customerScheduled: 'Once the work is done you can mark the job as completed and leave a review.',
      cancelHint: 'Plans changed? You can cancel from the request page before the work starts.',
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
    cancel: 'Cancel booking',
  },
  confirmDialogs: {
    confirm: {
      title: 'Confirm the appointment?',
      confirmLabel: 'Confirm appointment',
      message: '{{name}} will be notified that you’ll arrive {{date}}.',
    },
    start: {
      title: 'Start the job now?',
      confirmLabel: 'Start now',
      message: '{{name}} will be notified that the work has started.',
    },
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
