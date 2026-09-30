import type { profile as enprofile } from '../en/profile';
import type { LocaleNamespace } from '../../types';
import { isolateLtr } from '@/utils/bidi';

export const profile: LocaleNamespace<typeof enprofile> = {
  public: {
    about: 'אודות',
    readMore: 'קראו עוד',
    services: 'שירותים',
    reviews: 'ביקורות',
    areaAndHours: 'אזור ושעות פעילות',
    serves: 'אזור שירות: {{area}} · עד {{radius}}',
    licensed: 'יש רישיון',
    insured: 'יש ביטוח',
    dayRange: '{{first}}–{{last}}',
    hours: isolateLtr('{{start}}–{{end}}'),
    closed: 'סגור',
    emergencyHint: 'זמינות גם לקריאות חירום מחוץ לשעות האלה.',
  },
  edit: {
    personal: 'פרטים אישיים',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    phone: 'טלפון',
    phoneHelper: 'נמסר רק לבעל המקצוע שתבחרו.',
    address: 'כתובת ברירת מחדל',
    addAddress: 'הוספת כתובת',
    clearAddress: 'הסרת הכתובת',
    addPhoto: 'הוספת תמונה',
    changePhoto: 'החלפת תמונה',
    removePhoto: 'הסרה',
    removePhotoTitle: 'להסיר את תמונת הפרופיל?',
    photoFailed: 'לא הצלחנו לפתוח את התמונות. נסו שוב.',
    photoUpdated: 'תמונת הפרופיל עודכנה',
    photoRemoved: 'תמונת הפרופיל הוסרה',
    saved: 'הפרופיל עודכן',
    fixFields: 'נא לבדוק את השדות המסומנים',
    keepEditing: 'המשך עריכה',
  },
};
