import type { settings as ensettings } from '../en/settings';
import type { LocaleNamespace } from '../../types';

export const settings: LocaleNamespace<typeof ensettings> = {
  title: 'הגדרות',
  version: 'גרסה {{version}}',
  account: {
    editProfile: 'עריכת פרופיל',
    viewPublicProfile: 'צפייה בפרופיל הציבורי',
    signOut: 'התנתקות',
    signOutConfirmTitle: 'להתנתק?',
    signOutConfirmMessage: 'עד שתתחברו שוב, התראות החשבון לא יגיעו למכשיר הזה.',
    signOutFailed: 'לא הצלחנו לנתק אתכם. נסו שוב.',
  },
  language: {
    sectionTitle: 'שפה',
    restartTitle: 'להפעיל מחדש כדי להחליף שפה?',
    restartMessage: 'האפליקציה תופעל מחדש כדי להחיל את כיוון התצוגה של {{language}}. שום דבר ששמרתם לא יאבד.',
    restartConfirm: 'הפעלה מחדש',
  },
  appearance: {
    sectionTitle: 'מראה',
    system: 'אוטומטי',
    light: 'בהיר',
    dark: 'כהה',
  },
  notifications: {
    sectionTitle: 'התראות',
    pushEnabled: 'התראות פוש',
    pushBlocked: 'ההתראות של האפליקציה כבויות בהגדרות הטלפון',
    jobUpdates: 'הצעות ועדכוני עבודות',
    newRequests: 'בקשות חדשות באזור',
    messages: 'הודעות',
    reminders: 'תזכורות לביקורים',
    emailEnabled: 'עדכונים במייל',
    saveFailed: 'העדפות ההתראות לא נשמרו',
  },
};
