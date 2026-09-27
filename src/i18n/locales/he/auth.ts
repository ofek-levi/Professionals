import type { auth as enauth } from '../en/auth';
import type { LocaleNamespace } from '../../types';

export const auth: LocaleNamespace<typeof enauth> = {
  signIn: {
    languageLabel: 'שפה',
    highlights: {
      verified: 'בעלי מקצוע מאומתים',
      offers: 'השוואת הצעות מחיר',
      chat: 'צ׳אט ומעקב אחר עבודות',
    },
    title: 'בחירת חשבון הדגמה',
    subtitle: 'גלו את המערכת כלקוחות או כבעלי מקצוע.',
    roleSwitchLabel: 'סוג החשבון',
    roleDescriptions: {
      customer: 'פרסום בקשות, השוואת הצעות ובחירת בעל המקצוע המתאים.',
      professional: 'איתור עבודות בסביבה, שליחת הצעות וניהול העבודה.',
    },
    accountsCount_one: 'חשבון אחד',
    accountsCount_two: 'שני חשבונות',
    accountsCount_other: '{{count}} חשבונות',
    demoNoteTitle: 'מצב הדגמה',
    demoNote: 'אין צורך בסיסמה. כל הנתונים מדומים ונשמרים במכשיר הזה, ואפשר לאפס אותם בכל עת בהגדרות.',
    signingIn: 'מתחברים…',
    continue: 'המשך',
    accountA11yLabel: '{{name}}, {{role}}, {{city}}',
    accountA11yHint: 'התחברות עם חשבון ההדגמה הזה',
    moreCategories_one: 'ועוד שירות אחד',
    moreCategories_two: 'ועוד שני שירותים',
    moreCategories_other: 'ועוד {{count}} שירותים',
    empty: {
      customer: 'כרגע אין חשבונות הדגמה של לקוחות.',
      professional: 'כרגע אין חשבונות הדגמה של בעלי מקצוע.',
      title: 'אין חשבונות הדגמה',
    },
    errors: {
      signInFailed: 'לא הצלחנו לחבר אתכם',
    },
  },
  session: {
    signedOut: 'התנתקתם מהחשבון',
    switched: 'מחוברים כעת בתור {{name}}',
  },
};
