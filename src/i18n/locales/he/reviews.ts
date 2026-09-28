import type { reviews as enreviews } from '../en/reviews';
import type { LocaleNamespace } from '../../types';

export const reviews: LocaleNamespace<typeof enreviews> = {
  create: {
    ratingTitle: 'איך תדרגו את {{name}}?',
    commentLabel: 'תגובה',
    commentPlaceholder: 'מה היה טוב? מה אפשר לשפר?',
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
    emptyTitle: 'עדיין אין ביקורות',
    emptyDescription: 'ביקורות יופיעו כאן אחרי שלקוחות יסיימו עבודות עם בעל המקצוע.',
  },
};
