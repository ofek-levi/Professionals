import type { notifications as ennotifications } from '../en/notifications';
import type { LocaleNamespace } from '../../types';

export const notifications: LocaleNamespace<typeof ennotifications> = {
  title: 'התראות',
  subtitle: 'הצעות, עדכוני עבודות והודעות',
  markAllRead: 'סימון הכול כנקרא',
  markAllReadDone: 'כל ההתראות סומנו כנקראו',
  unreadSection: 'חדשות',
  earlierSection: 'קודמות',
  unreadCount_one: 'התראה אחת שלא נקראה',
  unreadCount_two: 'שתי התראות שלא נקראו',
  unreadCount_other: '{{count}} התראות שלא נקראו',
  filters: {
    all: 'הכול',
    unread: 'לא נקראו',
  },
  empty: {
    title: 'אין עדכונים חדשים',
    description: 'נעדכן אתכם כשיגיעו הצעות חדשות, עדכוני עבודות או הודעות.',
    unreadTitle: 'אין התראות שלא נקראו',
    unreadDescription: 'קראתם הכול. כל הכבוד!',
    customerAction: 'פרסום בקשה חדשה',
    professionalAction: 'חיפוש עבודות באזור',
    showAll: 'הצגת כל ההתראות',
  },
  groups: {
    weekdayDate: '{{weekday}}, {{date}}',
  },
  markAllReadShort: 'סימון הכול כנקרא',
  allRead: 'אין עדכונים חדשים',
  a11y: {
    unread: 'לא נקראה',
    openHint: 'פתיחת הפרטים הקשורים',
    filters: 'סינון התראות',
  },
  fallbacks: {
    customer: 'לקוח',
    professional: 'בעל מקצוע',
    service: 'שירות',
  },
  types: {
    new_matching_request: {
      title: 'קריאה חדשה באזור שלכם: {{category}}',
      body: 'קריאה חדשה במרחק {{distance}} מכם מתאימה לשירותים שלכם. היו הראשונים לשלוח הצעה.',
      bodyNoDistance: 'קריאה חדשה באזור השירות שלכם מתאימה לשירותים שלכם. היו הראשונים לשלוח הצעה.',
    },
    offer_received: {
      title: 'הצעה חדשה: {{price}}',
      body: 'התקבלה הצעה חדשה מאת {{professionalName}} לבקשה שלכם בנושא {{category}}.',
    },
    offer_updated: {
      title: 'הצעה עודכנה',
      body: 'ההצעה של {{professionalName}} לבקשה שלכם בנושא {{category}} עודכנה ל-{{price}}.',
    },
    offer_withdrawn: {
      title: 'הצעה נמשכה',
      body: 'ההצעה של {{professionalName}} לבקשה שלכם בנושא {{category}} נמשכה.',
    },
    offer_accepted: {
      title: 'ההצעה שלכם אושרה',
      body: 'ההצעה שלכם על סך {{price}} ({{category}}) אושרה על ידי {{customerName}}. נא לאשר את מועד הביקור: {{date}}.',
    },
    offer_not_selected: {
      title: 'ההצעה לא נבחרה',
      body: 'נבחר בעל מקצוע אחר לקריאה בנושא {{category}}.',
    },
    offer_expired: {
      title: 'תוקף ההצעה פג',
      body: 'תוקף ההצעה שלכם על סך {{price}} לקריאה בנושא {{category}} פג ללא מענה.',
    },
    request_cancelled: {
      title: 'הקריאה בוטלה',
      body: 'הקריאה בנושא {{category}} בוטלה על ידי {{customerName}}.',
    },
    job_confirmed: {
      title: 'מועד הביקור אושר',
      body: 'מועד הביקור של {{professionalName}} ({{category}}) אושר: {{date}}.',
    },
    job_started: {
      title: 'העבודה התחילה',
      body: 'העבודה בנושא {{category}} עם {{professionalName}} התחילה.',
    },
    appointment_reminder: {
      title: 'ביקור מתקרב',
      body: 'תזכורת: ביקור בנושא {{category}} עם {{name}}, {{date}}.',
    },
    job_completed: {
      title: 'העבודה הושלמה',
      bodyForCustomer: 'העבודה בנושא {{category}} עם {{name}} הושלמה. איך היה? נשמח לביקורת שלכם.',
      bodyForProfessional: 'העבודה בנושא {{category}} עבור {{name}} הושלמה. עבודה מצוינת!',
    },
    review_received: {
      title_one: 'ביקורת חדשה: כוכב אחד',
      title_two: 'ביקורת חדשה: שני כוכבים',
      title_other: 'ביקורת חדשה: {{count}} כוכבים',
      body: 'ביקורת חדשה מאת {{customerName}} על העבודה בנושא {{category}}.',
    },
    new_message: {
      title: 'הודעה חדשה מאת {{name}}',
      body: '{{preview}}',
      bodyEmpty: 'פתחו את הצ׳אט כדי לקרוא אותה.',
    },
  },
};
