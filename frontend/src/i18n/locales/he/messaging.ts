import type { messaging as enmessaging } from '../en/messaging';
import type { LocaleNamespace } from '../../types';

export const messaging: LocaleNamespace<typeof enmessaging> = {
  conversations: {
    you: 'אתם: {{text}}',
    youPrefix: 'אתם:',
    noMessages: 'עדיין אין הודעות. תגידו שלום!',
    unread_one: 'הודעה אחת שלא נקראה',
    unread_two: 'שתי הודעות שלא נקראו',
    unread_other: '{{count}} הודעות שלא נקראו',
    empty: 'עדיין אין שיחות',
    emptyDescription: {
      customer: 'צ׳אט עם בעל המקצוע נפתח כשמקבלים הצעה.',
      professional: 'צ׳אט עם הלקוח נפתח כשהוא מקבל את ההצעה שלך.',
    },
    a11y: {
      openHint: 'פתיחת הצ׳אט',
    },
  },
  chat: {
    placeholder: 'כתבו הודעה…',
    send: 'שליחת הודעה',
    sending: 'שולח…',
    sent: 'נשלחה',
    read: 'נקראה',
    failedReason: {
      offline: 'לא נשלחה: אין חיבור',
      rateLimited: 'לא נשלחה: יותר מדי הודעות, המתינו דקה',
      closed: 'לא נשלחה: הצ׳אט סגור',
      rejected: 'לא נשלחה: ההודעה נדחתה',
    },
    tapToRetry: 'הקישו לשליחה חוזרת',
    retry: 'שליחה חוזרת',
    retryHint: 'שולח את ההודעה שוב',
    delete: 'מחיקה',
    deleteA11y: 'מחיקת ההודעה שלא נשלחה',
    discardTitle: 'למחוק את ההודעה?',
    discardMessage: 'ההודעה לא נשלחה ותוסר מהצ׳אט.',
    closedMessage: 'הצ׳אט נסגר כי העבודה בוטלה.',
    closedAccountDeleted: 'הצ׳אט נסגר כי החשבון של הצד השני נמחק.',
    closedPlaceholder: 'הצ׳אט סגור',
    charactersLeft_one: 'נותר תו אחד',
    charactersLeft_two: 'נותרו שני תווים',
    charactersLeft_other: 'נותרו {{count}} תווים',
    beginningTitle: 'תגידו שלום ל-{{name}}',
    beginningDescription: 'השתמשו בצ׳אט כדי לתאם את הפרטים: גישה, חניה, חומרים או שינוי בתוכניות.',
    viewJob: 'לפרטי העבודה',
    notFoundTitle: 'הצ׳אט לא נמצא',
    notFoundDescription: 'ייתכן שהשיחה הוסרה או שאין לכם עוד גישה אליה.',
    a11y: {
      fromYou: 'אתם, {{time}}: {{text}}',
      fromOther: '{{name}}, {{time}}: {{text}}',
      jobDetails: 'פתיחת פרטי העבודה',
    },
  },
};
