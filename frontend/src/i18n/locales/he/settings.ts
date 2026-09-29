import type { settings as ensettings } from '../en/settings';
import type { LocaleNamespace } from '../../types';

export const settings: LocaleNamespace<typeof ensettings> = {
  title: 'הגדרות',
  version: 'גרסה {{version}}',
  account: {
    editProfile: 'עריכת פרופיל',
    viewPublicProfile: 'צפייה בפרופיל הציבורי',
    switchAccount: 'החלפת חשבון',
    signOut: 'התנתקות',
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
    pushEnabled: 'באנרים בתוך האפליקציה',
    jobUpdates: 'הצעות ועדכוני עבודות',
    newRequests: 'בקשות חדשות באזור',
    messages: 'הודעות',
    reminders: 'תזכורות לביקורים',
    emailEnabled: 'עדכונים במייל',
    saveFailed: 'העדפות ההתראות לא נשמרו',
  },
  demo: {
    sectionTitle: 'כלי הדגמה',
    simulation: {
      title: 'פעילות מדומה',
      description: 'בעלי מקצוע שולחים הצעות והצ׳אטים עונים אוטומטית',
    },
    networkFailures: {
      title: 'רשת לא יציבה',
      description: 'בערך אחת מכל חמש פניות נכשלת',
    },
    reset: {
      title: 'איפוס נתוני ההדגמה',
      confirmTitle: 'לאפס את כל נתוני ההדגמה?',
      confirmMessage: 'כל השינויים שבוצעו במכשיר הזה יימחקו. אי אפשר לבטל את הפעולה.',
      confirmLabel: 'איפוס הנתונים',
      success: 'נתוני ההדגמה אופסו',
      failed: 'לא הצלחנו לאפס את נתוני ההדגמה',
    },
  },
};
