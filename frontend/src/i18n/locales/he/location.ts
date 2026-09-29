import type { location as enLocation } from '../en/location';
import type { LocaleNamespace } from '../../types';

export const location: LocaleNamespace<typeof enLocation> = {
  search: {
    label: 'כתובת השירות',
    placeholder: 'חיפוש רחוב, מספר ועיר',
    searching: 'מחפש…',
    noResults: 'לא נמצאו כתובות מתאימות. נסו להוסיף את שם העיר.',
    suggestions: 'הצעות לכתובת',
  },
  currentLocation: {
    action: 'שימוש במיקום הנוכחי שלי',
    locating: 'מאתר את המיקום שלך…',
    usedLastKnown: 'השתמשנו במיקום האחרון הידוע. אפשר לגרור את הסיכה אם הוא לא מדויק.',
  },
  errors: {
    permissionDenied: {
      title: 'הגישה למיקום כבויה',
      message: 'אשרו גישה למיקום כדי להשתמש במיקום הנוכחי, או חפשו את הכתובת במקום זאת.',
    },
    permissionBlocked: {
      title: 'הגישה למיקום חסומה',
      message: 'הפעילו את הרשאת המיקום לאפליקציה בהגדרות המכשיר, או חפשו את הכתובת במקום זאת.',
    },
    servicesDisabled: {
      title: 'שירותי המיקום כבויים',
      message: 'הפעילו את שירותי המיקום בהגדרות המכשיר ונסו שוב.',
    },
    timeout: {
      title: 'לא הצלחנו לאתר אותך',
      message: 'איתור המיקום לקח יותר מדי זמן. נסו שוב או חפשו את הכתובת.',
    },
    unavailable: {
      title: 'המיקום אינו זמין',
      message: 'המיקום הנוכחי אינו זמין במכשיר הזה. חפשו את הכתובת במקום זאת.',
    },
    reverseGeocode: 'לא הצלחנו לזהות את הכתובת בנקודה הזו. אפשר להקליד אותה למטה.',
    search: 'חיפוש הכתובות אינו זמין כרגע. נסו שוב בעוד רגע.',
  },
  openSettings: 'פתיחת ההגדרות',
  turnOnLocation: 'הפעלת המיקום',
  map: {
    label: 'מפה',
    hint: 'הקישו על המפה או גררו את הסיכה כדי לסמן את המקום המדויק',
    pin: 'המיקום שנבחר',
    zoomIn: 'התקרבות',
    zoomOut: 'התרחקות',
    marker: 'סמן במפה: {{label}}',
    unavailable: 'לא הצלחנו לטעון את המפה',
  },
  fields: {
    addressLine: 'רחוב ומספר',
    addressLinePlaceholder: 'לדוגמה: דיזנגוף 120',
    city: 'עיר',
    cityPlaceholder: 'לדוגמה: תל אביב-יפו',
    details: 'דירה, קומה, כניסה',
    detailsPlaceholder: 'לדוגמה: דירה 12, קומה 3, קוד שער 1234',
    detailsHelper: 'יוצג רק לבעל המקצוע שתבחרו.',
  },
  resolving: 'מאתר את הכתובת…',
};
