import type { messaging as enmessaging } from '../en/messaging';
import type { LocaleNamespace } from '../../types';

export const messaging: LocaleNamespace<typeof enmessaging> = {
  conversations: {
    you: 'אתם: {{text}}',
    noMessages: 'עדיין אין הודעות. תגידו שלום!',
    closed: 'סגור',
    unread_one: 'הודעה אחת שלא נקראה',
    unread_two: 'שתי הודעות שלא נקראו',
    unread_other: '{{count}} הודעות שלא נקראו',
    empty: {
      title: 'עדיין אין שיחות',
      customerDescription: 'צ׳אט נפתח אוטומטית כשאתם מאשרים הצעה, כדי שתוכלו לתאם את הפרטים עם בעל המקצוע.',
      professionalDescription: 'צ׳אט נפתח אוטומטית כשלקוח מאשר את ההצעה שלכם, כדי שתוכלו לתאם יחד את הפרטים.',
      customerAction: 'לבקשות שלי',
      professionalAction: 'חיפוש עבודות באזור',
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
    failed: 'לא נשלחה · הקישו לניסיון חוזר',
    failedA11y: 'ההודעה לא נשלחה. הקישו פעמיים כדי לנסות שוב.',
    discardTitle: 'למחוק את ההודעה?',
    discardMessage: 'ההודעה לא נשלחה ותוסר מהצ׳אט.',
    closedTitle: 'הצ׳אט סגור',
    closedMessage: 'הצ׳אט נסגר כי העבודה בוטלה.',
    closedPlaceholder: 'הצ׳אט סגור',
    charactersLeft_one: 'נותר תו אחד',
    charactersLeft_two: 'נותרו שני תווים',
    charactersLeft_other: 'נותרו {{count}} תווים',
    beginningTitle: 'תגידו שלום ל-{{name}}',
    startTitle: 'הצ׳אט שלכם עם {{name}}',
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
