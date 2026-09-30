import type { errors as enErrors } from '../en/errors';
import type { LocaleNamespace } from '../../types';

export const errors: LocaleNamespace<typeof enErrors> = {
  codes: {
    NETWORK_ERROR: {
      title: 'אין חיבור',
      description: 'לא הצלחנו להתחבר לשרת. בדקו את החיבור לאינטרנט ונסו שוב.',
    },
    TIMEOUT: {
      title: 'זה לוקח יותר מדי זמן',
      description: 'השרת לא הגיב בזמן. נסו שוב.',
    },
    UNAUTHORIZED: {
      title: 'יש להתחבר מחדש',
      description: 'פג תוקף ההתחברות. התחברו כדי להמשיך.',
    },
    INVALID_CREDENTIALS: {
      title: 'האימייל או הסיסמה שגויים',
      description: 'בדקו את האימייל והסיסמה ונסו שוב, או אפסו את הסיסמה.',
    },
    INVALID_GOOGLE_TOKEN: {
      title: 'ההתחברות עם Google לא הצליחה',
      description: 'לא הצלחנו לאמת את חשבון ה-Google שלכם. נסו שוב.',
    },
    FORBIDDEN: {
      title: 'אין הרשאה',
      description: 'אין לכם הרשאה לצפות בתוכן הזה או לשנות אותו.',
    },
    NOT_FOUND: {
      title: 'לא נמצא',
      description: 'ייתכן שהפריט הוסר או שאינו זמין עוד.',
    },
    VALIDATION_ERROR: {
      title: 'כדאי לבדוק את הפרטים',
      description: 'חלק מהפרטים חסרים או שגויים. עברו על הטופס ונסו שוב.',
    },
    CONFLICT: {
      title: 'משהו השתנה',
      description: 'הפריט עודכן בינתיים. רעננו ונסו שוב.',
    },
    EMAIL_ALREADY_REGISTERED: {
      title: 'כתובת האימייל כבר רשומה',
      description: 'התחברו עם האימייל הזה או השתמשו בכתובת אחרת.',
    },
    INVALID_STATE_TRANSITION: {
      title: 'הפעולה כבר אינה זמינה',
      description: 'הסטטוס השתנה בינתיים. רעננו כדי לראות את הפרטים העדכניים.',
    },
    DUPLICATE_OFFER: {
      title: 'כבר שלחתם הצעה',
      description: 'אפשר לערוך את ההצעה הקיימת לבקשה הזו או למשוך אותה.',
    },
    OFFER_EXPIRED: {
      title: 'תוקף ההצעה פג',
      description: 'ההצעה כבר אינה בתוקף. בחרו הצעה אחרת או המתינו להצעה חדשה.',
    },
    REQUEST_NOT_ACCEPTING_OFFERS: {
      title: 'הבקשה סגורה להצעות',
      description: 'הלקוח כבר לא מקבל הצעות לבקשה הזו.',
    },
    UNSUPPORTED_CATEGORY: {
      title: 'השירות אינו נתמך',
      description: 'תחום השירות הזה אינו זמין. בחרו תחום אחר.',
    },
    OUTSIDE_SERVICE_AREA: {
      title: 'מחוץ לאזור השירות שלכם',
      description: 'הבקשה נמצאת מחוץ לאזור שבו אתם עובדים. עדכנו את אזור השירות כדי להגיש הצעה.',
    },
    RATE_LIMITED: {
      title: 'יותר מדי ניסיונות',
      description: 'המתינו רגע לפני שתנסו שוב.',
    },
    SERVER_ERROR: {
      title: 'יש לנו תקלה',
      description: 'הבעיה אצלנו, לא אצלכם. נסו שוב בעוד כמה דקות.',
    },
    UNKNOWN: {
      title: 'משהו השתבש',
      description: 'אירעה שגיאה לא צפויה. נסו שוב.',
    },
  },
  retryAfter: {
    seconds_one: 'נסו שוב בעוד שנייה.',
    seconds_two: 'נסו שוב בעוד שתי שניות.',
    seconds_other: 'נסו שוב בעוד {{count}} שניות.',
    minutes_one: 'נסו שוב בעוד דקה.',
    minutes_two: 'נסו שוב בעוד שתי דקות.',
    minutes_other: 'נסו שוב בעוד {{count}} דקות.',
  },
  upload: {
    invalid: {
      title: 'אי אפשר להשתמש בתמונה הזו',
      description: 'בחרו תמונה מסוג JPEG‏, PNG‏, WebP או HEIC בגודל של עד 8MB.',
    },
    rateLimited: {
      title: 'יותר מדי תמונות כרגע',
      description: 'העליתם הרבה תמונות לאחרונה. נסו שוב מאוחר יותר.',
    },
  },
};
