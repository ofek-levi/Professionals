import type { notifications as ennotifications } from '../en/notifications';
import type { LocaleNamespace } from '../../types';

export const notifications: LocaleNamespace<typeof ennotifications> = {
  inbox: {
    title: 'הודעות',
    tabs: {
      updates: 'עדכונים',
      messages: 'שיחות',
    },
    emptyUpdates: 'אין עדכונים עדיין',
    emptyUpdatesDescription: {
      customer: 'הצעות לבקשות שלך, תזכורות לעבודות וביקורות יופיעו כאן.',
      professional: 'עבודות חדשות בסביבה, תשובות להצעות שלך ותזכורות לעבודות יופיעו כאן.',
    },
  },
  channel: {
    name: 'התראות',
  },
  markAllRead: 'סימון הכול כנקרא',
  markAllReadShort: 'סימון הכול כנקרא',
  groups: {
    weekdayDate: '{{weekday}}, {{date}}',
  },
  a11y: {
    unread: 'לא נקראה',
    openHint: 'פתיחת הפרטים הקשורים',
  },
  unknownType: {
    title: 'עדכון חדש',
    body: 'יש משהו חדש בחשבון שלכם.',
  },
  fallbacks: {
    customer: 'לקוח',
    professional: 'בעל מקצוע',
    service: 'שירות',
  },
  types: {
    new_matching_request: {
      title: 'בקשה חדשה באזור שלכם: {{category}}',
      body: 'במרחק {{distance}} מכם',
      bodyNoDistance: 'באזור השירות שלכם',
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
      body: 'נבחר בעל מקצוע אחר לבקשה בנושא {{category}}.',
    },
    offer_expired: {
      title: 'תוקף ההצעה פג',
      body: 'תוקף ההצעה שלכם על סך {{price}} לבקשה בנושא {{category}} פג ללא מענה.',
    },
    request_cancelled: {
      title: 'הבקשה בוטלה',
      body: 'הבקשה בנושא {{category}} בוטלה על ידי {{customerName}}.',
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
    job_cancelled: {
      title: 'העבודה בוטלה',
      body: 'העבודה בנושא {{category}} ({{date}}) בוטלה כי החשבון של בעל המקצוע נסגר.',
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
