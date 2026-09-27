import type { settings as ensettings } from '../en/settings';
import type { LocaleNamespace } from '../../types';

export const settings: LocaleNamespace<typeof ensettings> = {
  title: 'הגדרות',
  account: {
    sectionTitle: 'חשבון',
    signedInAs: 'מחוברים בתור',
    switchAccount: 'החלפת חשבון',
    switchAccountHint: 'ניתוק וחזרה לרשימת חשבונות ההדגמה',
    signOut: 'התנתקות',
    signOutConfirmTitle: 'להתנתק מהחשבון?',
    signOutConfirmMessage: 'אפשר להתחבר שוב עם כל חשבון הדגמה.',
    loadError: 'לא הצלחנו לטעון את פרטי החשבון.',
  },
  language: {
    sectionTitle: 'שפה',
    description: 'בחירת שפת האפליקציה.',
    restartTitle: 'להפעיל מחדש כדי להחליף שפה?',
    restartMessage: 'האפליקציה תופעל מחדש כדי להחיל את כיוון התצוגה של {{language}}. שום דבר ששמרתם לא יאבד.',
    restartConfirm: 'הפעלה מחדש',
    changed: 'השפה עודכנה',
  },
  appearance: {
    sectionTitle: 'מראה',
    description: 'התאמה להגדרות המכשיר או ערכת נושא קבועה.',
    system: 'לפי המכשיר',
    light: 'בהיר',
    dark: 'כהה',
  },
  notifications: {
    sectionTitle: 'התראות',
    description: 'בחרו על מה תרצו לקבל עדכונים.',
    pushEnabled: {
      title: 'באנרים של התראות',
      description: 'הצגת התראות בזמן השימוש באפליקציה',
    },
    jobUpdates: {
      title: 'הצעות ועדכוני עבודות',
      description: 'הצעות חדשות, אישורים, שינויי מועד וביטולים',
    },
    newRequests: {
      title: 'בקשות חדשות מתאימות',
      description: 'בקשות בסביבה שתואמות לשירותים שלכם',
    },
    messages: {
      title: 'הודעות',
      description: 'הודעות צ׳אט חדשות מלקוחות ומבעלי מקצוע',
    },
    reminders: {
      title: 'תזכורות לפגישות',
      description: 'תזכורת לפני כל פגישה מתוכננת',
    },
    emailEnabled: {
      title: 'עדכונים במייל',
      description: 'עותק של עדכונים חשובים בדואר אלקטרוני',
    },
    saveFailed: 'העדפות ההתראות לא נשמרו',
  },
  demo: {
    sectionTitle: 'כלי הדגמה',
    description: 'כלים להתנסות באפליקציה. הם משפיעים רק על הנתונים במכשיר הזה.',
    simulation: {
      title: 'פעילות מדומה',
      description: 'בעלי מקצוע אחרים שולחים הצעות, והצד השני בצ׳אט עונה אוטומטית',
    },
    networkFailures: {
      title: 'רשת לא יציבה',
      description: 'כאחת מכל חמש בקשות נכשלת, כדי לבדוק את הטיפול בשגיאות',
    },
    reset: {
      title: 'איפוס נתוני ההדגמה',
      description: 'החזרת כל הבקשות, ההצעות, העבודות וההודעות למצבן המקורי',
      confirmTitle: 'לאפס את כל נתוני ההדגמה?',
      confirmMessage: 'כל השינויים שבוצעו במכשיר הזה יימחקו. אי אפשר לבטל את הפעולה.',
      confirmLabel: 'איפוס הנתונים',
      success: 'נתוני ההדגמה אופסו',
      failed: 'לא הצלחנו לאפס את נתוני ההדגמה',
    },
  },
  about: {
    sectionTitle: 'אודות',
    version: 'גרסה',
    dataSource: 'מקור הנתונים',
    dataSources: {
      mock: 'נתוני הדגמה במכשיר',
      http: 'שרת פעיל',
    },
  },
};
