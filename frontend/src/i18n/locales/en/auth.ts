/** Entry screen (create account / sign in), sign-in, sign-up and password reset. */
export const auth = {
  entry: {
    createAccount: 'Create account',
    signIn: 'Sign in',
  },
  /** Language switch (entry screen), language button (sign-in header) and the sheet it opens. */
  language: {
    label: 'Language',
    button: 'Language: {{language}}',
    sheetTitle: 'Choose language',
  },
  fields: {
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone',
    businessName: 'Business name',
  },
  login: {
    title: 'Welcome',
    // For both roles: customers hire pros, professionals find work.
    subtitle: 'Sign in to hire trusted pros or find your next job.',
    forgotPassword: 'Forgot password?',
    submit: 'Sign in',
    noAccount: 'New here?',
    createAccount: 'Create account',
    welcomeBack: 'Welcome back, {{name}}',
    /** 429 after too many failed attempts (also blocks the right password until the window ends). */
    paused: {
      title: 'Too many failed attempts',
      message_one: 'For your security, signing in to this account is paused for {{count}} minute. Reset your password to sign in right away.',
      message_other: 'For your security, signing in to this account is paused for {{count}} minutes. Reset your password to sign in right away.',
      messageSoon: 'For your security, signing in to this account is paused for a few minutes. Reset your password to sign in right away.',
      resetPassword: 'Reset password',
    },
  },
  /** The server ended the session (signed out elsewhere, password reset, expired). */
  sessionEnded: {
    title: 'You’ve been signed out',
    message: 'Your session has ended. Please sign in again.',
  },
  forgotPassword: {
    title: 'Reset your password',
    subtitle: 'Enter the email you signed up with and we’ll send you a link to set a new password.',
    submit: 'Send reset link',
    sentTitle: 'Check your email',
    sentMessage: 'If an account exists for {{email}}, we’ve sent a reset link.',
    backToSignIn: 'Back to sign in',
  },
  signUp: {
    progress: 'Step {{step}} of {{total}}',
    continue: 'Continue',
    submit: 'Create account',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
    fixFields: 'Check the highlighted fields',
    welcome: 'Welcome, {{name}}',
    welcomeMessage: {
      customer: 'Your account is ready. Post your first request whenever you need a pro.',
      professional: 'Your account is ready. Requests that match your services show up in Explore.',
    },
    role: {
      title: 'How will you use Professionals?',
      subtitle: 'Choose the option that fits you.',
      options: {
        customer: {
          title: 'I need a service',
          description: 'Post a request, compare offers from local pros and hire the right one.',
        },
        professional: {
          title: 'I offer services',
          description: 'Find jobs near you, send offers and grow your business.',
        },
      },
    },
    account: {
      title: 'Your details',
      subtitle: 'You’ll sign in with your email and password.',
      googleTitle: 'Finish your account',
      googleSubtitle: 'Add your phone number and accept the terms to finish signing up with Google.',
      googleConnected: 'Signing up with Google',
      useEmailInstead: 'Use email instead',
      orEmail: 'or sign up with email',
      signInInstead: 'Sign in with this email',
      emailFromGoogle: 'From your Google account',
      phonePlaceholder: '050-123-4567',
      /** The customer's phone is for their account only; a professional's is their contact phone. */
      phoneHelperCustomer: 'Not shown to other users.',
      phoneHelperProfessional: 'Shown to customers who hire you.',
      passwordHelper: 'At least 8 characters, with a letter and a number',
      terms: 'I’m 18 or older and I agree to the Terms of Use and the Privacy Policy',
    },
    services: {
      title: 'What services do you offer?',
      subtitle: 'Choose up to {{max}}. You’ll see requests for these services.',
      businessNameHelper: 'Shown to customers instead of your name.',
      servicesLabel: 'Services',
    },
    area: {
      title: 'Where do you work?',
      subtitle: 'You’ll see requests within this distance of your base address. Customers only see your area, never the address.',
      radius: 'How far will you travel?',
    },
  },
  google: {
    continue: 'Continue with Google',
    promptFailedTitle: 'Google sign-in didn’t open',
    promptFailedMessage: 'Check your connection and that pop-ups are allowed, then try again.',
  },
} as const;
