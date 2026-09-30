import type { auth as enauth } from '../en/auth';
import type { LocaleNamespace } from '../../types';

export const auth: LocaleNamespace<typeof enauth> = {
  entry: {
    createAccount: 'יצירת חשבון',
    signIn: 'התחברות',
  },
  language: {
    label: 'שפה',
    button: 'שפה: {{language}}',
    sheetTitle: 'בחירת שפה',
  },
  fields: {
    email: 'אימייל',
    password: 'סיסמה',
    confirmPassword: 'אימות סיסמה',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    phone: 'טלפון',
    businessName: 'שם העסק',
  },
  login: {
    title: 'ברוכים הבאים',
    subtitle: 'התחברו כדי למצוא בעלי מקצוע אמינים או את העבודה הבאה שלכם.',
    forgotPassword: 'שכחתם את הסיסמה?',
    submit: 'התחברות',
    noAccount: 'חדשים כאן?',
    createAccount: 'יצירת חשבון',
    welcomeBack: 'ברוכים השבים, {{name}}',
    paused: {
      title: 'יותר מדי ניסיונות כושלים',
      message_one: 'לביטחונכם, ההתחברות לחשבון הזה מושהית לדקה אחת. אפסו את הסיסמה כדי להתחבר מיד.',
      message_two: 'לביטחונכם, ההתחברות לחשבון הזה מושהית לשתי דקות. אפסו את הסיסמה כדי להתחבר מיד.',
      message_other: 'לביטחונכם, ההתחברות לחשבון הזה מושהית ל־{{count}} דקות. אפסו את הסיסמה כדי להתחבר מיד.',
      messageSoon: 'לביטחונכם, ההתחברות לחשבון הזה מושהית לכמה דקות. אפסו את הסיסמה כדי להתחבר מיד.',
      resetPassword: 'איפוס סיסמה',
    },
  },
  sessionEnded: {
    title: 'התנתקתם מהחשבון',
    message: 'החיבור שלכם הסתיים. התחברו שוב כדי להמשיך.',
  },
  forgotPassword: {
    title: 'איפוס סיסמה',
    subtitle: 'הזינו את האימייל שאיתו נרשמתם, ונשלח אליו קישור להגדרת סיסמה חדשה.',
    submit: 'שליחת קישור לאיפוס',
    sentTitle: 'בדקו את תיבת הדואר',
    sentMessage: 'אם קיים חשבון עם הכתובת {{email}}, שלחנו אליה קישור לאיפוס הסיסמה.',
    backToSignIn: 'חזרה להתחברות',
  },
  signUp: {
    progress: 'שלב {{step}} מתוך {{total}}',
    continue: 'המשך',
    submit: 'יצירת חשבון',
    haveAccount: 'כבר יש לכם חשבון?',
    signIn: 'התחברות',
    fixFields: 'יש לתקן את השדות המסומנים',
    welcome: 'ברוכים הבאים, {{name}}',
    welcomeMessage: {
      customer: 'החשבון מוכן. אפשר לפרסם בקשה ראשונה כשתצטרכו בעל מקצוע.',
      professional: 'החשבון מוכן. בקשות שמתאימות לשירותים שלכם יופיעו בלשונית ״חיפוש״.',
    },
    role: {
      title: 'איך תשתמשו ב-Professionals?',
      subtitle: 'בחרו את האפשרות שמתאימה לכם.',
      options: {
        customer: {
          title: 'צריכים שירות',
          description: 'פרסמו בקשה, השוו הצעות מבעלי מקצוע באזור ובחרו את המתאים.',
        },
        professional: {
          title: 'מציעים שירותים',
          description: 'מצאו עבודות בסביבה, שלחו הצעות והגדילו את העסק.',
        },
      },
    },
    account: {
      title: 'הפרטים שלכם',
      subtitle: 'בהמשך תתחברו עם האימייל והסיסמה האלה.',
      googleTitle: 'השלמת החשבון',
      googleSubtitle: 'כדי לסיים את ההרשמה עם Google, הוסיפו מספר טלפון ואשרו את התנאים.',
      googleConnected: 'נרשמים עם Google',
      useEmailInstead: 'הרשמה עם אימייל',
      orEmail: 'או הרשמה עם אימייל',
      signInInstead: 'התחברות עם האימייל הזה',
      emailFromGoogle: 'מחשבון ה-Google שלכם',
      phonePlaceholder: '050-1234567',
      phoneHelperCustomer: 'המספר לא מוצג למשתמשים אחרים.',
      phoneHelperProfessional: 'המספר יוצג ללקוחות שיבחרו בכם.',
      passwordHelper: 'לפחות 8 תווים, כולל אות וספרה',
      terms: 'אני בגיל 18 ומעלה, וקראתי ואישרתי את תנאי השימוש ואת מדיניות הפרטיות',
    },
    services: {
      title: 'אילו שירותים אתם נותנים?',
      subtitle: 'אפשר לבחור עד {{max}}. תקבלו בקשות לשירותים האלה.',
      businessNameHelper: 'יוצג ללקוחות במקום השם שלכם.',
      servicesLabel: 'שירותים',
    },
    area: {
      title: 'איפה אתם עובדים?',
      subtitle: 'תקבלו בקשות במרחק הזה מכתובת הבסיס שלכם. לקוחות רואים רק את האזור, לא את הכתובת.',
      radius: 'עד כמה רחוק אתם מגיעים?',
    },
  },
  google: {
    continue: 'המשך עם Google',
    promptFailedTitle: 'לא הצלחנו לפתוח את ההתחברות עם Google',
    promptFailedMessage: 'בדקו את החיבור לאינטרנט ושחלונות קופצים מותרים, ונסו שוב.',
  },
};
