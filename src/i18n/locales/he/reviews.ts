import type { reviews as enreviews } from '../en/reviews';
import type { LocaleNamespace } from '../../types';

export const reviews: LocaleNamespace<typeof enreviews> = {
  create: {
    jobDate: 'עבודה מ-{{date}}',
    ratingTitle: 'איך תדרגו את {{name}}?',
    ratingSubtitle: 'דירוג כן עוזר ללקוחות אחרים.',
    commentLabel: 'ספרו לאחרים על החוויה שלכם',
    commentPlaceholder: 'האם בעל המקצוע הגיע בזמן? איך היו איכות העבודה והתקשורת?',
    commentHelper: 'הביקורת פומבית ומוצג בה השם הפרטי שלכם והאות הראשונה של שם המשפחה.',
    highlightsTitle: 'הדגשים מהירים',
    highlights: {
      punctual: 'הגעה בזמן',
      quality: 'עבודה איכותית',
      tidy: 'ניקיון בסיום העבודה',
      communication: 'תקשורת ברורה',
      price: 'מחיר הוגן',
    },
    submit: 'שליחת הביקורת',
    ratingRequiredHint: 'בחרו דירוג כדי להמשיך',
    errorTitle: 'לא הצלחנו לשלוח את הביקורת',
  },
  success: {
    title: 'תודה על הביקורת!',
    description: 'המשוב שלכם עוזר ל-{{name}} וללקוחות אחרים באזור שלכם.',
    backToJob: 'חזרה לעבודה',
    home: 'למסך הבית',
  },
  alreadyReviewed: {
    title: 'כבר כתבתם ביקורת על העבודה הזו',
    description: 'אפשר לכתוב ביקורת אחת לכל עבודה. זה מה שכתבתם.',
    descriptionNoReview: 'אפשר לכתוב ביקורת אחת לכל עבודה.',
  },
  notCompleted: {
    title: 'עדיין מוקדם לביקורת',
    description: 'תוכלו לכתוב ביקורת אחרי שהעבודה תסומן כהושלמה.',
  },
  notAllowed: {
    title: 'ביקורות נכתבות על ידי לקוחות',
    description: 'רק הלקוח של עבודה שהושלמה יכול לכתוב ביקורת.',
  },
  list: {
    title: 'ביקורות על {{name}}',
    count_one: 'ביקורת אחת',
    count_two: 'שתי ביקורות',
    count_other: '{{count}} ביקורות',
    emptyTitle: 'עדיין אין ביקורות',
    emptyDescription: 'ביקורות יופיעו כאן אחרי שלקוחות יסיימו עבודות עם בעל המקצוע.',
    viewProfile: 'לפרופיל',
  },
};
