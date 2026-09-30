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
      phoneHelper: 'Shared only with the people you work with.',
      passwordHelper: 'At least 8 characters, with a letter and a number',
      terms: 'I agree to the Terms of Service and Privacy Policy',
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
  legal: {
    openHint: 'Opens the document',
    terms: {
      title: 'Terms of Service',
      sections: {
        marketplace: {
          title: 'The marketplace',
          text: 'Professionals connects people who need a service with independent professionals. The agreement for a job is between the customer and the professional; we are not a party to it.',
        },
        customers: {
          title: 'Customers',
          text: 'Describe the job and its location accurately, and pay the professional you hire as agreed with them.',
        },
        professionals: {
          title: 'Professionals',
          text: 'Offer only services you are qualified (and, where required, licensed) to provide, and stand behind the offers you send.',
        },
        conduct: {
          title: 'Respect',
          text: 'Be courteous in messages. Reviews must describe a real job. We may remove content or suspend accounts that break these rules.',
        },
        account: {
          title: 'Your account',
          text: 'Keep your sign-in details to yourself; you are responsible for what happens in your account. You can close it at any time.',
        },
      },
    },
    privacy: {
      title: 'Privacy Policy',
      sections: {
        collected: {
          title: 'What we collect',
          text: 'Your name, email and phone; for jobs, the address and a description of the work; for professionals, their services and base address.',
        },
        locations: {
          title: 'Locations',
          text: 'Professionals see only the approximate area of a request until the customer hires them. Customers never see a professional’s exact base address.',
        },
        contact: {
          title: 'Contact details',
          text: 'Your phone and email are shared only with the people you work with.',
        },
        use: {
          title: 'How we use it',
          text: 'To match requests with professionals, send notifications and keep the marketplace safe. We don’t sell your data.',
        },
        control: {
          title: 'Your choices',
          text: 'You can update your details in your profile and ask us to delete your account and data at any time.',
        },
      },
    },
  },
} as const;
