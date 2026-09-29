import type { requests as enrequests } from '../en/requests';
import type { LocaleNamespace } from '../../types';

export const requests: LocaleNamespace<typeof enrequests> = {
  titleDraft: 'הטיוטה שלך',
  form: {
    service: 'שירות',
    changeServiceA11y: 'שירות: {{name}}. שינוי שירות',
    description: 'מה הבעיה?',
    placeholders: {
      home_repairs: 'למשל: הברז במטבח מטפטף כל הזמן ויש מים מתחת לכיור.',
      construction_renovation: 'למשל: שיפוץ חדר רחצה של 6 מ״ר: אריחים חדשים, מקלחון וארון.',
      moving_transportation: 'למשל: הובלת דירת 3 חדרים מקומה 2 (עם מעלית) לרמת גן.',
      other_services: 'למשל: ה-Wi-Fi חלש בחדרי השינה. מחפשים התקנת מערכת Mesh.',
      default: 'מה צריך לעשות, וכל דבר שחשוב שבעל המקצוע יידע.',
    },
    urgency: 'כמה זה דחוף?',
    urgencyHints: {
      emergency: 'עכשיו',
      urgent: 'היום',
      normal: 'השבוע',
      flexible: 'מתי שנוח',
    },
    where: 'איפה',
    addAddress: 'הוספת כתובת',
    changeAddressA11y: 'כתובת: {{address}}. שינוי כתובת',
    addressSheetSubtitle: 'אנשי מקצוע רואים רק את האזור המשוער עד שתבחרו באחד מהם.',
    photos: 'תמונות',
    addPhotos: 'הוספת תמונות',
    addMorePhotos: 'הוספה',
    photoProblems: {
      library_denied: 'כדי להוסיף תמונות צריך לאפשר גישה לתמונות בהגדרות המכשיר.',
      camera_denied: 'כדי לצלם צריך לאפשר גישה למצלמה בהגדרות המכשיר.',
      camera_unavailable: 'המצלמה לא זמינה במכשיר הזה.',
      failed: 'לא הצלחנו לפתוח את התמונות. נסו שוב.',
      limit: 'אפשר להוסיף עד {{max}} תמונות.',
    },
  },
  submit: {
    post: 'פרסום הבקשה',
    uploading: 'מעלה תמונות…',
    posted: 'הבקשה פורסמה',
    fixFields: 'נא לבדוק את הפרטים המסומנים',
  },
  leave: {
    message: 'הבקשה עדיין לא פורסמה. אם תצאו עכשיו, הפרטים שהזנתם יאבדו.',
    draftMessage: 'השינויים בטיוטה לא נשמרו.',
    keepEditing: 'המשך עריכה',
  },
  customersOnly: {
    title: 'בקשות שירות מפורסמות על ידי לקוחות',
    description: 'כדי לפרסם בקשת שירות צריך להתחבר עם חשבון לקוח.',
    action: 'חזרה לדף הבית',
  },
  alreadyPublished: {
    title: 'הבקשה הזו כבר פורסמה',
    description: 'אי אפשר לערוך בקשה שפורסמה. אפשר לצפות בה, להשוות הצעות או לבטל אותה.',
    action: 'לצפייה בבקשה',
  },
};
