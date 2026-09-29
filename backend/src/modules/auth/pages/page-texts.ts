/** Copy of the pages opened from auth emails (English and Hebrew, same tone as the app). */
import type { AppLanguage } from '../../../shared/domain.js';
import type { ValidationMessage } from '../../../shared/validation-messages.js';

export interface MessagePageTexts {
  title: string;
  message: string;
}

export interface PageTexts {
  emailVerified: MessagePageTexts;
  verifyLinkInvalid: MessagePageTexts;
  resetLinkInvalid: MessagePageTexts;
  passwordChanged: MessagePageTexts;
  resetForm: { title: string; password: string; confirmPassword: string; hint: string; submit: string };
  /** Password errors of the reset form (same wording as the app's validation messages). */
  errors: Partial<Record<ValidationMessage, string>>;
}

export const PAGE_TEXTS: Record<AppLanguage, PageTexts> = {
  en: {
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
