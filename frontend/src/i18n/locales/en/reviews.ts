/** Leave-a-review flow and the professional's reviews list. */
export const reviews = {
  create: {
    ratingTitle: 'How would you rate {{name}}?',
    commentLabel: 'Comment',
    commentPlaceholder: 'What went well? What could be better?',
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
  closed: {
    title: 'Reviews are closed',
    description: 'This professional deleted their account, so this job can no longer be reviewed.',
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
    emptyTitle: 'No reviews yet',
    emptyDescription: 'Reviews appear here after customers complete jobs with this professional.',
  },
} as const;
