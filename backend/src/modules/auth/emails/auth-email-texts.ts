/** Copy of the auth emails (English and Hebrew). */
import type { AppLanguage } from '../../../shared/domain.js';

export interface ActionEmailTexts {
  subject: string;
  heading: string;
  greeting: (firstName: string) => string;
  body: (email: string) => string;
  action: string;
  /** Shown under the button with the raw link, for clients that block buttons. */
  linkHint: string;
  expiry: string;
  ignore: string;
}

export const VERIFY_EMAIL_TEXTS: Record<AppLanguage, ActionEmailTexts> = {
  en: {
    subject: 'Confirm your email address',
    heading: 'Confirm your email address',
    greeting: (firstName) => `Hi ${firstName},`,
    body: (email) => `Thanks for joining Professionals. Please confirm that ${email} is your email address.`,
    action: 'Confirm email address',
    linkHint: 'Or open this link:',
    expiry: 'The link is valid for 48 hours.',
    ignore: "If you didn't create a Professionals account, you can ignore this email.",
  },
  he: {
    subject: 'אישור כתובת האימייל שלכם',
    heading: 'אישור כתובת האימייל',
    greeting: (firstName) => `היי ${firstName},`,
    body: (email) => `תודה שהצטרפתם ל-Professionals. אשרו בבקשה ש-${email} היא כתובת האימייל שלכם.`,
    action: 'אישור כתובת האימייל',
    linkHint: 'או לפתוח את הקישור הזה:',
    expiry: 'הקישור תקף ל-48 שעות.',
    ignore: 'אם לא יצרתם חשבון ב-Professionals, אפשר להתעלם מההודעה.',
  },
};

export const RESET_PASSWORD_TEXTS: Record<AppLanguage, ActionEmailTexts> = {
  en: {
    subject: 'Reset your password',
    heading: 'Reset your password',
    greeting: (firstName) => `Hi ${firstName},`,
    body: (email) => `We received a request to reset the password of the Professionals account ${email}.`,
    action: 'Choose a new password',
    linkHint: 'Or open this link:',
    expiry: 'The link is valid for 60 minutes and can be used once. Choosing a new password signs you out on all devices.',
    ignore: "If you didn't ask to reset your password, you can ignore this email: your password stays the same.",
  },
  he: {
    subject: 'איפוס הסיסמה שלכם',
    heading: 'איפוס סיסמה',
    greeting: (firstName) => `היי ${firstName},`,
    body: (email) => `קיבלנו בקשה לאפס את הסיסמה של החשבון ${email} ב-Professionals.`,
    action: 'בחירת סיסמה חדשה',
    linkHint: 'או לפתוח את הקישור הזה:',
    expiry: 'הקישור תקף ל-60 דקות ולשימוש חד-פעמי. בחירת סיסמה חדשה תנתק את החשבון בכל המכשירים.',
    ignore: 'אם לא ביקשתם לאפס את הסיסמה, אפשר להתעלם מההודעה: הסיסמה שלכם לא תשתנה.',
  },
};
