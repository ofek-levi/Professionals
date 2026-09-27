import type { jobs as enjobs } from '../en/jobs';
import type { LocaleNamespace } from '../../types';

export const jobs: LocaleNamespace<typeof enjobs> = {
  details: {
    headline: {
      awaiting_confirmation: {
        customer: 'ממתינים לאישור המועד מ-{{name}}',
        professional: 'אשרו את המועד כדי ש-{{name}} יידעו שאתם מגיעים',
      },
      scheduled: {
        customer: 'המועד עם {{name}} נקבע ל{{date}}',
        professional: 'העבודה שלכם נקבעה ל{{date}}',
      },
      in_progress: {
        customer: '{{name}} עובדים על העבודה שלכם',
        professional: 'העבודה בביצוע. סמנו אותה כהושלמה כשתסיימו.',
      },
      completed: {
        customer: 'העבודה הושלמה ב-{{date}}. מקווים שהכול עבר מצוין!',
        professional: 'עבודה מצוינת! העבודה הושלמה ב-{{date}}.',
      },
      cancelled: {
        customer: 'העבודה בוטלה. הפגישה לא תתקיים והצ׳אט נסגר.',
        professional: 'הלקוח ביטל את העבודה. הפגישה לא תתקיים והצ׳אט נסגר.',
      },
    },
    timeline: {
      steps: {
        accepted: 'ההצעה אושרה',
        confirmed: 'המועד אושר',
        in_progress: 'בביצוע',
        completed: 'הושלמה',
        cancelled: 'בוטלה',
      },
      hints: {
        confirmedNext: {
          customer: 'בעל המקצוע יאשר את המועד בקרוב',
          professional: 'ממתין לאישור שלכם',
        },
        inProgressNext: 'מתוכנן ל{{date}}',
        inProgressActive: 'התחילה {{relative}}',
        completedNext: 'סמנו כהושלמה כשהעבודה תסתיים',
        skipped: 'הושלמה ללא סימון התחלה',
      },
    },
    appointment: {
      title: 'מועד הפגישה',
      timeRange: '{{start}}–{{end}}',
      startsIn: 'מתחילה {{relative}}',
      startsTomorrow: 'מתחילה מחר',
      startsInDays_one: 'מתחילה בעוד יום',
      startsInDays_two: 'מתחילה בעוד יומיים',
      startsInDays_other: 'מתחילה בעוד {{count}} ימים',
      startedAgo: 'הייתה אמורה להתחיל {{relative}}',
      completedAt: 'הושלמה ב{{date}}',
      cancelledAt: 'בוטלה ב{{date}}',
    },
    price: {
      title: 'המחיר שסוכם',
      hint: 'מחיר קבוע מההצעה שאושרה',
      viewOffer: 'להצעה',
    },
    location: {
      title: 'מיקום',
      mapLabel: 'מפת מיקום העבודה',
    },
    counterpart: {
      professional: 'בעל המקצוע שלכם',
      customer: 'לקוח',
      memberSince: 'חבר/ה מאז {{date}}',
      jobsCompleted_one: 'עבודה אחת הושלמה',
      jobsCompleted_two: 'שתי עבודות הושלמו',
      jobsCompleted_other: '{{count}} עבודות הושלמו',
    },
    request: {
      title: 'פרטי הבקשה',
      notes: 'הערות',
      viewRequest: 'לבקשה',
    },
    review: {
      customerTitle: 'הביקורת שלכם',
      professionalTitle: 'ביקורת הלקוח',
      promptTitle: 'איך היה עם {{name}}?',
      promptDescription: 'הביקורת שלכם עוזרת ללקוחות אחרים לבחור בביטחון, ולוקחת פחות מדקה.',
      pendingProfessional: 'הלקוח עדיין לא השאיר ביקורת.',
    },
    nextStep: {
      title: 'השלב הבא',
      customerScheduled: 'כשהעבודה תסתיים תוכלו לסמן אותה כהושלמה ולהשאיר ביקורת.',
      cancelHint: 'התוכניות השתנו? אפשר לבטל מדף הבקשה לפני תחילת העבודה.',
    },
    notFoundTitle: 'העבודה לא נמצאה',
    notFoundDescription: 'ייתכן שהעבודה הוסרה או שאין לכם גישה אליה.',
  },
  actions: {
    confirm: 'אישור המועד',
    start: 'התחלת עבודה',
    complete: 'סימון כהושלמה',
    review: 'כתיבת ביקורת',
    message: 'הודעה',
    cancel: 'ביטול ההזמנה',
  },
  confirmDialogs: {
    confirm: {
      title: 'לאשר את המועד?',
      confirmLabel: 'אישור',
      message: 'נעדכן את {{name}} שתגיעו {{date}}.',
    },
    start: {
      title: 'להתחיל את העבודה עכשיו?',
      confirmLabel: 'להתחיל',
      message: 'נעדכן את {{name}} שהעבודה התחילה.',
    },
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
