import type { customer as encustomer } from '../en/customer';
import type { LocaleNamespace } from '../../types';

export const customer: LocaleNamespace<typeof encustomer> = {
  home: {
    hello: 'היי, {{name}}',
    helloNeutral: 'שלום',
    request: {
      title: 'במה אפשר לעזור?',
      subtitle: 'מתארים את העבודה ומקבלים הצעות מאנשי מקצוע מהאזור.',
      action: 'הזמנת שירות',
    },
    active: {
      title: 'פעיל עכשיו',
      empty: 'אין כרגע משהו פעיל. הבקשות וההזמנות שלך יופיעו כאן.',
      rate: 'דרגו את {{name}}',
    },
  },
  requests: {
    newRequest: 'בקשה חדשה',
    tabs: {
      active: 'פעילות',
      past: 'קודמות',
    },
    empty: {
      active: {
        title: 'אין בקשות פעילות',
        description: 'ספרו לנו מה צריך ואנשי מקצוע מהאזור ישלחו לכם הצעות.',
        action: 'הזמנת שירות',
      },
      past: {
        title: 'עדיין אין כאן כלום',
        description: 'בקשות שהושלמו או בוטלו נשמרות כאן.',
      },
    },
  },
  details: {
    status: {
      draft: 'טיוטה – עדיין לא פורסמה',
      waiting: 'ממתינה להצעות',
      waitingHint_one: 'שלחנו את הבקשה לאיש מקצוע אחד באזור.',
      waitingHint_two: 'שלחנו את הבקשה לשני אנשי מקצוע באזור.',
      waitingHint_other: 'שלחנו את הבקשה ל־{{count}} אנשי מקצוע באזור.',
      waitingNoPros: 'עדיין אין באזור שלכם אנשי מקצוע שמציעים את השירות הזה. הבקשה נשארת פתוחה – אנשי מקצוע שיצטרפו באזור יראו אותה.',
      offersToReview_one: 'הצעה אחת לבדיקה',
      offersToReview_two: 'שתי הצעות לבדיקה',
      offersToReview_other: '{{count}} הצעות לבדיקה',
      booked: 'נקבע עם {{name}}',
      bookedPending: 'נקבע',
      inProgress: 'בביצוע על ידי {{name}}',
      completed: 'בוצעה על ידי {{name}}',
      completedPending: 'הושלמה',
      cancelled: 'בוטלה',
    },
    posted: 'פורסמה {{time}}',
    saved: 'נשמרה {{time}}',
    postedBanner: 'הכול מוכן. נעדכן אתכם כשיגיעו הצעות.',
    hired: {
      appointment: 'מועד',
      completed: 'הושלמה',
      price: 'מחיר',
      viewJob: 'לפרטי העבודה',
      message: 'הודעה ל{{name}}',
    },
    cancelRequest: 'ביטול הבקשה',
    requestAgain: 'לבקש שוב',
    draft: {
      continue: 'המשך',
      delete: 'מחיקת הטיוטה',
      deleteConfirmTitle: 'למחוק את הטיוטה?',
      deleteConfirmMessage: 'הטיוטה והתמונות שלה יימחקו. אי אפשר לבטל את הפעולה.',
      deleted: 'הטיוטה נמחקה',
    },
  },
  offers: {
    title: 'הצעות ({{count}})',
    sorts: {
      recommended: 'מומלץ',
      lowest_price: 'הכי זול',
      earliest_availability: 'הכי מוקדם',
    },
    viewProfile: 'לפרופיל',
    accept: 'בחירה',
    acceptConfirm: {
      title: 'לבחור ב-{{name}}?',
      summary: '{{price}} · {{date}}',
      othersDeclined_one: 'ההצעה השנייה תידחה.',
      othersDeclined_two: 'שתי ההצעות האחרות יידחו.',
      othersDeclined_other: '{{count}} ההצעות האחרות יידחו.',
      confirm: 'אישור ההצעה',
    },
    acceptedToast: {
      title: 'בחרת ב-{{name}}',
      message: 'בעל המקצוע קיבל הודעה. הקישו לפרטי העבודה.',
    },
  },
  cancel: {
    title: 'ביטול הבקשה',
    subtitle: 'ספרו לנו למה – זה עוזר לאנשי המקצוע ומשפר את ההתאמות.',
    reasonLabel: 'סיבה',
    commentLabel: 'רוצים להוסיף משהו?',
    commentPlaceholder: 'הערה לאנשי המקצוע (לא חובה)',
    proWarning: 'בעל המקצוע יקבל הודעה והביקור יבוטל.',
    submit: 'ביטול הבקשה',
    keep: 'השארת הבקשה',
    confirmTitle: 'לבטל את הבקשה?',
    confirmMessage: 'הצעות ממתינות יידחו ואנשי מקצוע לא יראו יותר את הבקשה.',
    confirmMessageWithPro: 'הביקור יבוטל ובעל המקצוע יקבל על כך הודעה.',
    confirmLabel: 'כן, לבטל',
    success: 'הבקשה בוטלה',
  },
};
