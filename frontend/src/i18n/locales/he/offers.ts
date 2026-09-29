import type { offers as enoffers } from '../en/offers';
import type { LocaleNamespace } from '../../types';

export const offers: LocaleNamespace<typeof enoffers> = {
  jobCancelled: {
    badge: 'העבודה בוטלה',
    title: 'הלקוח ביטל את העבודה',
    message: 'ההצעה שלך התקבלה, אבל הלקוח ביטל אחר כך את הבקשה. המועד בוטל ואין צורך להגיע.',
  },
  actions: {
    edit: 'עריכה',
    withdraw: 'משיכת ההצעה',
    viewJob: 'לצפייה בעבודה',
  },
  form: {
    title: 'שליחת הצעה',
    editTitle: 'עריכת ההצעה',
    price: 'המחיר שלך',
    date: 'תאריך',
    time: 'שעה',
    urgencyHint: '{{urgency}} – בתוך {{hours}} שעות',
    noTimes: 'לא נשארו שעות פנויות ביום הזה.',
    addMessage: 'הוספת הודעה',
    message: 'הודעה',
    messagePlaceholder: 'היי! אשמח לטפל בזה…',
    submit: 'שליחת ההצעה',
    submitEdit: 'שמירת השינויים',
    sent: 'ההצעה נשלחה',
    updated: 'ההצעה עודכנה',
    fixFields: 'כדאי לבדוק את השדות המסומנים',
    problemTitle: {
      DUPLICATE_OFFER: 'כבר שלחתם הצעה',
      REQUEST_NOT_ACCEPTING_OFFERS: 'הבקשה סגורה להצעות',
      OUTSIDE_SERVICE_AREA: 'מחוץ לאזור השירות שלכם',
      OFFER_EXPIRED: 'תוקף ההצעה פג',
      UNSUPPORTED_CATEGORY: 'השירות לא ברשימה שלכם',
    },
    problem: {
      DUPLICATE_OFFER: 'כבר יש לכם הצעה פעילה לבקשה הזו. אפשר לערוך אותה מעמוד הבקשה.',
      REQUEST_NOT_ACCEPTING_OFFERS: 'הלקוח כבר בחר בעל מקצוע או ביטל את הבקשה.',
      OUTSIDE_SERVICE_AREA: 'העבודה הזו מחוץ לאזור השירות שלכם. כדי לשלוח הצעה יש להרחיב את אזור השירות.',
      OFFER_EXPIRED: 'תוקף ההצעה פג ולכן אי אפשר לערוך אותה. כל עוד הבקשה פתוחה אפשר לשלוח הצעה חדשה.',
      UNSUPPORTED_CATEGORY: 'השירות הזה לא מופיע ברשימת השירותים שלכם. הוסיפו אותו כדי לשלוח הצעה.',
      backToRequest: 'חזרה לבקשה',
      editProfile: 'עדכון הפרופיל',
    },
    locked: {
      title: 'אי אפשר לערוך את ההצעה',
      description: 'אפשר לשנות רק הצעות ממתינות לבקשות פתוחות.',
    },
    duplicate: {
      title: 'כבר שלחת הצעה',
      description: 'אפשר להגיש הצעה פעילה אחת לכל בקשה. במקום זאת, ערכו את ההצעה הממתינה.',
      edit: 'עריכת ההצעה שלי',
    },
    closed: {
      title: 'הבקשה סגורה',
      description: 'הלקוח כבר לא מקבל הצעות לעבודה הזו.',
      browse: 'לעבודות אחרות',
    },
  },
  withdraw: {
    title: 'למשוך את ההצעה?',
    message: 'הלקוח לא יראה עוד את הצעת המחיר שלכם. כל עוד הבקשה פתוחה אפשר לשלוח הצעה חדשה.',
    confirm: 'משיכת ההצעה',
    keep: 'השארת ההצעה',
    success: 'ההצעה נמשכה',
  },
};
