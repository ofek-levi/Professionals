/**
 * Copy of the "your account was deleted" email (English and Hebrew). What it lists must stay true
 * to `account-erasure.ts` and the Privacy Policy.
 */
import type { AppLanguage } from '../../../shared/domain.js';

export interface AccountDeletedTexts {
  subject: string;
  greeting: (firstName: string) => string;
  intro: (email: string) => string;
  /** Requests, offers and jobs in progress. */
  closed: string;
  removedHeading: string;
  removed: string[];
  keptHeading: string;
  kept: (retention: { notificationDays: number; logDays: number; backupDays: number }) => string[];
  contact: (email: string) => string;
}

export const ACCOUNT_DELETED_TEXTS: Record<AppLanguage, AccountDeletedTexts> = {
  en: {
    subject: 'Your Professionals account was deleted',
    greeting: (firstName) => `Hi ${firstName},`,
    intro: (email) => `As you asked in the app, the Professionals account ${email} was deleted. This can't be undone.`,
    closed: 'Your open requests, pending offers and active jobs were cancelled, and the people involved were told.',
    removedHeading: 'What was deleted',
    removed: [
      'Your name, email address, phone number, password, Google sign-in and profile photo.',
      'Your saved address and drafts, and the photos, notes, access details and exact addresses of your requests.',
      'For professionals: your business profile, your contact details and the messages of your offers.',
      'Your notifications, the comments of the reviews you wrote, and your sign-ins on every device.',
    ],
    keptHeading: 'What stays, without your name',
    kept: ({ notificationDays, logDays, backupDays }) => [
      'Completed jobs (service, dates, agreed price) stay in the other person’s history, shown as “Deleted user”.',
      'The ratings you gave (without comments), the descriptions of your requests and the chat messages you sent stay visible to the people involved, from “Deleted user”.',
      `Notifications other people received with your name in them are deleted within ${notificationDays} days.`,
      `Server logs are overwritten within ${logDays} days and backups within ${backupDays} days.`,
    ],
    contact: (email) => `Questions? Write to us at ${email}. If you did not delete your account, write to us right away.`,
  },
  he: {
    subject: 'החשבון שלכם ב-Professionals נמחק',
    greeting: (firstName) => `היי ${firstName},`,
    intro: (email) => `לבקשתכם באפליקציה, החשבון ${email} ב-Professionals נמחק. אי אפשר לבטל את המחיקה.`,
    closed: 'בקשות פתוחות, הצעות ממתינות ועבודות פעילות בוטלו, והמעורבים קיבלו על כך הודעה.',
    removedHeading: 'מה נמחק',
    removed: [
      'השם, כתובת האימייל, מספר הטלפון, הסיסמה, ההתחברות עם Google ותמונת הפרופיל.',
      'הכתובת השמורה והטיוטות, וגם התמונות, ההערות, פרטי הגישה והכתובות המדויקות של הבקשות שלכם.',
      'לבעלי מקצוע: פרופיל העסק, פרטי הקשר וההודעות שצירפתם להצעות.',
      'ההתראות שלכם, הטקסט של הביקורות שכתבתם וההתחברות שלכם בכל המכשירים.',
    ],
    keptHeading: 'מה נשאר, בלי השם שלכם',
    kept: ({ notificationDays, logDays, backupDays }) => [
      'עבודות שהושלמו (השירות, התאריכים והמחיר המוסכם) נשארות בהיסטוריה של הצד השני, תחת ״משתמש שנמחק״.',
      'הדירוגים שנתתם (בלי הטקסט), תיאורי הבקשות והודעות הצ׳אט ששלחתם נשארים גלויים למעורבים, תחת ״משתמש שנמחק״.',
      `התראות שאנשים אחרים קיבלו ומופיע בהן השם שלכם נמחקות תוך ${notificationDays} ימים.`,
      `יומני השרת נמחקים תוך ${logDays} ימים, והגיבויים תוך ${backupDays} ימים.`,
    ],
    contact: (email) => `יש לכם שאלות? כתבו לנו לכתובת ${email}. אם לא אתם מחקתם את החשבון, כתבו לנו מיד.`,
  },
};
