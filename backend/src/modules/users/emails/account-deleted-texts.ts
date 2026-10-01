/**
 * Copy of the "your account was deleted" email (English and Hebrew). What it lists must stay true
 * to `account-erasure.ts`, `account-purge.ts` and the Privacy Policy.
 */
import type { AppLanguage } from '../../../shared/domain.js';
import type { DeletionClosed } from '../account-deletion.impact.js';

/**
 * Who asked for the deletion: the holder in the app, the holder by email (the operator ran it), or
 * nobody (the operator closed the account under the Terms). The first sentence says which.
 */
export type DeletionOrigin = 'app' | 'email' | 'operator';

export interface AccountDeletedTexts {
  subject: string;
  greeting: (firstName: string) => string;
  intro: Record<DeletionOrigin, (email: string) => string>;
  /** What was in progress and closed (requests, offers, jobs); `null` when nothing was. */
  closed: (closed: DeletionClosed) => string | null;
  removedHeading: string;
  removed: string[];
  keptHeading: string;
  kept: (retention: { notificationDays: number; logDays: number; backupDays: number }) => string[];
  contact: (email: string) => string;
}

/**
 * The clauses that apply, as one sentence: "A, B and C" + `end`, capitalised (Hebrew has no case;
 * its "and" is the prefix ו). `null` when none applies.
 */
function sentence(clauses: (string | false)[], and: string, end: string): string | null {
  const said = clauses.filter((clause) => clause !== false);
  const last = said.pop();
  if (last === undefined) return null;
  const listed = said.length > 0 ? `${said.join(', ')}${and}${last}` : last;
  return `${listed.charAt(0).toUpperCase()}${listed.slice(1)}${end}`;
}

export const ACCOUNT_DELETED_TEXTS: Record<AppLanguage, AccountDeletedTexts> = {
  en: {
    subject: 'Your Professionals account was deleted',
    greeting: (firstName) => `Hi ${firstName},`,
    intro: {
      app: (email) => `As you asked in the app, the Professionals account ${email} was deleted. This can't be undone.`,
      email: (email) => `As you asked by email, the Professionals account ${email} was deleted. This can't be undone.`,
      operator: (email) => `The Professionals account ${email} was deleted. This can't be undone.`,
    },
    closed: (closed) =>
      closed.role === 'customer'
        ? sentence(
            [
              closed.requests > 0 && 'your active requests were cancelled',
              closed.offers > 0 && 'the pending offers on them were declined',
              closed.jobs > 0 && 'your active jobs were cancelled',
            ],
            ' and ',
            closed.offers + closed.jobs > 0 ? '; the professionals involved were notified, unless they turned those notifications off.' : '.',
          )
        : sentence(
            [closed.offers > 0 && 'your pending offers were withdrawn', closed.jobs > 0 && 'your active jobs were cancelled'],
            ' and ',
            '; the customers involved were notified, unless they turned those notifications off.',
          ),
    removedHeading: 'What was deleted',
    removed: [
      'Your name, email address, phone number, password, Google sign-in and profile photo.',
      'Your saved address, the requests no professional made an offer on, and the photos, exact addresses and apartment, floor and entrance details of your other requests.',
      'For professionals: your business profile, your contact details and the messages of your offers.',
      'Your notifications, the comments of the reviews you wrote, and your sign-ins on every device.',
    ],
    keptHeading: 'What stays, without your name',
    kept: ({ notificationDays, logDays, backupDays }) => [
      'Your jobs (service, dates, agreed price) stay in the other person’s history, shown as “Deleted user”.',
      'The ratings you gave (without comments), the descriptions of your requests that received offers and the chat messages you sent stay visible to the people involved, as you wrote them, from “Deleted user”.',
      'These records are deleted once everyone involved has deleted their account.',
      `Notifications other people received with your name in them are deleted within ${notificationDays} days.`,
      `Server logs are overwritten within ${logDays} days and backups within ${backupDays} days.`,
    ],
    contact: (email) => `Questions? Write to us at ${email}. If you did not delete your account, write to us right away.`,
  },
  he: {
    subject: 'החשבון שלכם ב-Professionals נמחק',
    greeting: (firstName) => `היי ${firstName},`,
    intro: {
      app: (email) => `לבקשתכם באפליקציה, החשבון ${email} ב-Professionals נמחק. אי אפשר לבטל את המחיקה.`,
      email: (email) => `לבקשתכם באימייל, החשבון ${email} ב-Professionals נמחק. אי אפשר לבטל את המחיקה.`,
      operator: (email) => `החשבון ${email} ב-Professionals נמחק. אי אפשר לבטל את המחיקה.`,
    },
    closed: (closed) =>
      closed.role === 'customer'
        ? sentence(
            [
              closed.requests > 0 && 'הבקשות הפעילות שלכם בוטלו',
              closed.offers > 0 && 'ההצעות הממתינות עליהן נדחו',
              closed.jobs > 0 && 'העבודות הפעילות שלכם בוטלו',
            ],
            ' ו',
            closed.offers + closed.jobs > 0 ? '; בעלי המקצוע המעורבים קיבלו על כך הודעה, אלא אם כיבו את ההתראות האלה.' : '.',
          )
        : sentence(
            [closed.offers > 0 && 'ההצעות הממתינות שלכם נמשכו', closed.jobs > 0 && 'העבודות הפעילות שלכם בוטלו'],
            ' ו',
            '; הלקוחות המעורבים קיבלו על כך הודעה, אלא אם כיבו את ההתראות האלה.',
          ),
    removedHeading: 'מה נמחק',
    removed: [
      'השם, כתובת האימייל, מספר הטלפון, הסיסמה, ההתחברות עם Google ותמונת הפרופיל.',
      'הכתובת השמורה, הבקשות שאף בעל מקצוע לא שלח עליהן הצעה, וגם התמונות, הכתובות המדויקות ופרטי הדירה, הקומה והכניסה של שאר הבקשות שלכם.',
      'לבעלי מקצוע: פרופיל העסק, פרטי הקשר וההודעות שצירפתם להצעות.',
      'ההתראות שלכם, הטקסט של הביקורות שכתבתם וההתחברות שלכם בכל המכשירים.',
    ],
    keptHeading: 'מה נשאר, בלי השם שלכם',
    kept: ({ notificationDays, logDays, backupDays }) => [
      'העבודות שלכם (השירות, התאריכים והמחיר המוסכם) נשארות בהיסטוריה של הצד השני, תחת ״משתמש שנמחק״.',
      'הדירוגים שנתתם (בלי הטקסט), תיאורי הבקשות שלכם שקיבלו הצעות והודעות הצ׳אט ששלחתם נשארים גלויים למעורבים כפי שנכתבו, תחת ״משתמש שנמחק״.',
      'הרשומות האלה נמחקות כשכל המעורבים בהן מחקו את החשבון שלהם.',
      `התראות שאנשים אחרים קיבלו ומופיע בהן השם שלכם נמחקות תוך ${notificationDays} ימים.`,
      `יומני השרת נמחקים תוך ${logDays} ימים, והגיבויים תוך ${backupDays} ימים.`,
    ],
    contact: (email) => `יש לכם שאלות? כתבו לנו לכתובת ${email}. אם לא אתם מחקתם את החשבון, כתבו לנו מיד.`,
  },
};
