/** Leave-a-review flow and the professional's reviews list. */
export const reviews = {
  create: {
    jobDate: 'Job on {{date}}',
    ratingTitle: 'How would you rate {{name}}?',
    ratingSubtitle: 'Your honest rating helps other customers.',
    commentLabel: 'Tell others about your experience',
    commentPlaceholder: 'Was the pro on time? How was the quality of the work and the communication?',
    commentHelper: 'Your review is public and shows your first name and last initial.',
    highlightsTitle: 'Quick highlights',
    highlights: {
      punctual: 'Arrived on time',
      quality: 'Great quality work',
      tidy: 'Left everything clean',
      communication: 'Clear communication',
      price: 'Fair price',
    },
    submit: 'Submit review',
    ratingRequiredHint: 'Choose a rating to continue',
    errorTitle: 'We couldn’t submit your review',
  },
  success: {
    title: 'Thanks for your review!',
    description: 'Your feedback helps {{name}} and other customers in your area.',
    backToJob: 'Back to the job',
    home: 'Go to home',
  },
  alreadyReviewed: {
    title: 'You already reviewed this job',
    description: 'Each job can be reviewed once. Here’s what you wrote.',
    descriptionNoReview: 'Each job can be reviewed once.',
  },
  notCompleted: {
    title: 'Not ready for a review yet',
    description: 'You can review the job once it’s marked as completed.',
  },
  notAllowed: {
    title: 'Reviews are written by customers',
    description: 'Only the customer of a completed job can leave a review.',
  },
  list: {
    title: 'Reviews for {{name}}',
    count_one: '{{count}} review',
    count_other: '{{count}} reviews',
    emptyTitle: 'No reviews yet',
    emptyDescription: 'Reviews appear here after customers complete jobs with this professional.',
    viewProfile: 'View profile',
  },
} as const;
