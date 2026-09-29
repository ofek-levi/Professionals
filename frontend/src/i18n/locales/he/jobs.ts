import type { jobs as enjobs } from '../en/jobs';
import type { LocaleNamespace } from '../../types';
import { isolateLtr } from '@/utils/bidi';

export const jobs: LocaleNamespace<typeof enjobs> = {
  details: {
    headline: {
      awaiting_confirmation: {
        customer: 'ממתינים לאישור המועד מ-{{name}}',
        professional: 'אשרו את המועד כדי לעדכן את {{name}} שאתם מגיעים',
      },
      scheduled: {
        customer: 'המועד עם {{name}} נקבע ל{{date}}',
        professional: 'העבודה שלכם נקבעה ל{{date}}',
      },
      in_progress: {
        customer: 'העבודה שלכם בביצוע על ידי {{name}}',
        professional: 'העבודה בביצוע. סמנו אותה כהושלמה כשתסיימו.',
      },
      completed: {
        customer: 'העבודה הושלמה ב-{{date}}. מקווים שהכול עבר מצוין!',
        professional: 'עבודה מצוינת! העבודה הושלמה ב-{{date}}.',
      },
      cancelled: {
        customer: 'העבודה בוטלה. הביקור לא יתקיים והצ׳אט נסגר.',
        professional: 'הלקוח ביטל את העבודה. הביקור לא יתקיים והצ׳אט נסגר.',
      },
    },
    progress: {
      accepted: 'הוזמן',
      confirmed: 'אושר',
      in_progress: 'בביצוע',
      completed: 'הושלם',
      cancelled: 'בוטל',
    },
    appointment: {
      title: 'מועד הביקור',
      timeRange: isolateLtr('{{start}}–{{end}}'),
    },
    price: {
      title: 'מחיר',
    },
    location: {
      title: 'כתובת',
    },
    counterpart: {
      professional: 'בעל המקצוע שלכם',
      customer: 'לקוח',
    },
    request: {
      viewRequest: 'לפרטי הבקשה',
    },
    review: {
      customerTitle: 'הביקורת שלכם',
      professionalTitle: 'ביקורת הלקוח',
      pendingProfessional: 'הלקוח עדיין לא השאיר ביקורת.',
    },
    notFoundTitle: 'העבודה לא נמצאה',
    notFoundDescription: 'ייתכן שהעבודה הוסרה או שאין לכם גישה אליה.',
  },
  actions: {
    confirm: 'אישור המועד',
    start: 'התחלת עבודה',
    complete: 'סימון כהושלמה',
    review: 'כתיבת ביקורת',
    message: 'שליחת הודעה',
  },
  confirmDialogs: {
    complete: {
      confirmLabel: 'כן, הסתיימה',
      titleCustomer: 'העבודה הסתיימה?',
      messageCustomer: 'סמנו את העבודה כהושלמה רק כשהכול גמור. לאחר מכן תוכלו לכתוב ביקורת על {{name}}.',
      titleProfessional: 'לסמן את העבודה כהושלמה?',
      messageProfessional: 'נעדכן את {{name}} ונבקש ביקורת על העבודה שלכם.',
    },
  },
  toasts: {
    confirmed: 'המועד אושר',
    confirmedMessage: 'הלקוח קיבל עדכון.',
    started: 'העבודה התחילה',
    startedMessage: 'בהצלחה! סמנו אותה כהושלמה כשתסיימו.',
    completed: 'העבודה הושלמה',
    completedMessageCustomer: 'הקישו כדי לכתוב ביקורת.',
    completedMessageProfessional: 'עבודה מצוינת! ביקשנו מהלקוח לכתוב ביקורת.',
  },
};
