/** Copy of the pages opened from auth emails (English and Hebrew, same tone as the app). */
import type { AppLanguage } from '../../../shared/domain.js';
import type { ValidationMessage } from '../../../shared/validation-messages.js';

export interface MessagePageTexts {
  title: string;
  message: string;
}

export interface PageTexts {
  /** Shown by `GET /auth/verify-email`: only the button (a deliberate POST) verifies the address. */
  verifyConfirm: { title: string; message: string; submit: string; notYou: string };
  emailVerified: MessagePageTexts;
  verifyLinkInvalid: MessagePageTexts;
  resetLinkInvalid: MessagePageTexts;
  passwordChanged: MessagePageTexts;
  /** Over the pages' rate limit. */
  tooManyRequests: MessagePageTexts;
  resetForm: { title: string; password: string; confirmPassword: string; hint: string; submit: string };
  /** Password errors of the reset form (same wording as the app's validation messages). */
  errors: Partial<Record<ValidationMessage, string>>;
}

export const PAGE_TEXTS: Record<AppLanguage, PageTexts> = {
  en: {
    verifyConfirm: {
      title: 'Confirm your email address',
      message: 'Confirm that this is your email address for your Professionals account:',
      submit: 'Confirm email address',
      notYou: 'Didn’t create a Professionals account? Don’t confirm: just ignore this email.',
    },
    emailVerified: {
      title: 'Email address confirmed',
      message: 'Thanks! Your email address is confirmed. You can go back to the Professionals app.',
    },
    verifyLinkInvalid: {
      title: 'This link is no longer valid',
      message: 'The link has expired or was already used. If you already confirmed your email address, there is nothing else to do.',
    },
    resetLinkInvalid: {
      title: 'This link is no longer valid',
      message: 'The password reset link has expired or was already used. You can ask for a new one in the app: “Forgot password?” on the sign-in screen.',
    },
    passwordChanged: {
      title: 'Your password was changed',
      message: 'You can now sign in to the Professionals app with your new password. For your security, you were signed out on all devices.',
    },
    tooManyRequests: {
      title: 'Too many attempts',
      message: 'Please wait a few minutes, then open the link in the email again.',
    },
    resetForm: {
      title: 'Choose a new password',
      password: 'New password',
      confirmPassword: 'Repeat the new password',
      hint: '8–64 characters, with at least one letter and one number.',
      submit: 'Save new password',
    },
    errors: {
      'validation:auth.passwordRequired': 'Enter your password',
      'validation:auth.passwordTooShort': 'Use at least 8 characters',
      'validation:auth.passwordTooLong': 'Use up to 64 characters',
      'validation:auth.passwordLetterAndNumber': 'Include at least one letter and one number',
      'validation:auth.passwordTooCommon': 'This password is too easy to guess. Try a less common one',
      'validation:auth.confirmPasswordRequired': 'Enter your password again',
      'validation:auth.passwordMismatch': 'The passwords don’t match',
    },
  },
  he: {
    verifyConfirm: {
      title: 'אישור כתובת האימייל',
      message: 'אשרו שזו כתובת האימייל שלכם בחשבון Professionals:',
      submit: 'אישור כתובת האימייל',
      notYou: 'לא פתחתם חשבון ב־\u2060Professionals? אל תאשרו, פשוט התעלמו מהאימייל הזה.',
    },
    emailVerified: {
      title: 'כתובת האימייל אושרה',
      message: 'תודה! כתובת האימייל שלכם אושרה. אפשר לחזור לאפליקציית Professionals.',
    },
    verifyLinkInvalid: {
      title: 'הקישור כבר לא בתוקף',
      message: 'תוקף הקישור פג או שכבר השתמשו בו. אם כבר אישרתם את כתובת האימייל, אין צורך לעשות דבר נוסף.',
    },
    resetLinkInvalid: {
      title: 'הקישור כבר לא בתוקף',
      message: 'תוקף הקישור לאיפוס הסיסמה פג או שכבר השתמשו בו. אפשר לבקש קישור חדש באפליקציה: ״שכחתם את הסיסמה?״ במסך ההתחברות.',
    },
    passwordChanged: {
      title: 'הסיסמה שונתה',
      message: 'אפשר להתחבר לאפליקציית Professionals עם הסיסמה החדשה. לביטחונכם, החשבון נותק בכל המכשירים.',
    },
    tooManyRequests: {
      title: 'יותר מדי ניסיונות',
      message: 'המתינו כמה דקות ואז פתחו שוב את הקישור שבאימייל.',
    },
    resetForm: {
      title: 'בחירת סיסמה חדשה',
      password: 'סיסמה חדשה',
      confirmPassword: 'הזנת הסיסמה החדשה שוב',
      hint: '8–64 תווים, עם לפחות אות אחת וספרה אחת.',
      submit: 'שמירת הסיסמה החדשה',
    },
    errors: {
      'validation:auth.passwordRequired': 'יש להזין סיסמה',
      'validation:auth.passwordTooShort': 'הסיסמה צריכה להכיל לפחות 8 תווים',
      'validation:auth.passwordTooLong': 'הסיסמה יכולה להכיל עד 64 תווים',
      'validation:auth.passwordLetterAndNumber': 'הסיסמה צריכה לכלול לפחות אות אחת וספרה אחת',
      'validation:auth.passwordTooCommon': 'קל מדי לנחש את הסיסמה הזו. כדאי לבחור סיסמה פחות נפוצה',
      'validation:auth.confirmPasswordRequired': 'יש להזין את הסיסמה שוב',
      'validation:auth.passwordMismatch': 'הסיסמאות אינן תואמות',
    },
  },
};
