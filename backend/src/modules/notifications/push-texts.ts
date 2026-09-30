/**
 * Push notification texts (the app's `notifications:types.*` copy in en + he). Placeholders:
 * {{category}} {{price}} {{date}} {{distance}} {{professionalName}} {{customerName}} {{name}}
 * {{preview}} {{stars}}.
 */
import type { AppLanguage } from '../../shared/domain.js';
import type { NotificationType } from '../../shared/notification-types.js';

interface TypeTexts {
  title: string;
  body: string;
  /** Alternative body (no distance, completed-for-professional, empty preview). */
  altBody?: string;
}

export interface PushTexts {
  fallbacks: { customer: string; professional: string; service: string };
  types: Record<NotificationType, TypeTexts>;
}

const en: PushTexts = {
  fallbacks: { customer: 'A customer', professional: 'A professional', service: 'service' },
  types: {
    new_matching_request: { title: 'New {{category}} request nearby', body: '{{distance}} from you', altBody: 'In your service area' },
    offer_received: { title: 'New offer: {{price}}', body: '{{professionalName}} sent an offer for your {{category}} request.' },
    offer_updated: { title: 'Offer updated', body: '{{professionalName}} updated their offer for your {{category}} request to {{price}}.' },
    offer_withdrawn: { title: 'Offer withdrawn', body: '{{professionalName}} withdrew their offer for your {{category}} request.' },
    offer_accepted: {
      title: 'Your offer was accepted',
      body: '{{customerName}} accepted your {{price}} offer for {{category}}. Please confirm the appointment on {{date}}.',
    },
    offer_not_selected: { title: 'Offer not selected', body: 'The customer chose another professional for the {{category}} request.' },
    offer_expired: { title: 'Your offer expired', body: 'Your {{price}} offer for the {{category}} request expired without a response.' },
    request_cancelled: { title: 'Request cancelled', body: '{{customerName}} cancelled the {{category}} request.' },
    job_confirmed: { title: 'Appointment confirmed', body: '{{professionalName}} confirmed your {{category}} appointment for {{date}}.' },
    job_started: { title: 'Work has started', body: '{{professionalName}} started working on your {{category}} job.' },
    appointment_reminder: { title: 'Upcoming appointment', body: 'Reminder: {{category}} with {{name}} on {{date}}.' },
    job_completed: {
      title: 'Job completed',
      body: 'Your {{category}} job with {{name}} is complete. How did it go? Leave a review.',
      altBody: 'The {{category}} job for {{name}} is complete. Great work!',
    },
    job_cancelled: {
      title: 'Job cancelled',
      body: 'Your {{category}} job on {{date}} was cancelled because the professional closed their account.',
    },
    review_received: { title: 'New {{stars}} review', body: '{{customerName}} reviewed your {{category}} work.' },
    new_message: { title: 'New message from {{name}}', body: '{{preview}}', altBody: 'Open the chat to read it.' },
  },
};

const he: PushTexts = {
  fallbacks: { customer: 'לקוח', professional: 'בעל מקצוע', service: 'שירות' },
  types: {
    new_matching_request: { title: 'בקשה חדשה באזור שלכם: {{category}}', body: 'במרחק {{distance}} מכם', altBody: 'באזור השירות שלכם' },
    offer_received: { title: 'הצעה חדשה: {{price}}', body: 'התקבלה הצעה חדשה מאת {{professionalName}} לבקשה שלכם בנושא {{category}}.' },
    offer_updated: { title: 'הצעה עודכנה', body: 'ההצעה של {{professionalName}} לבקשה שלכם בנושא {{category}} עודכנה ל-{{price}}.' },
    offer_withdrawn: { title: 'הצעה נמשכה', body: 'ההצעה של {{professionalName}} לבקשה שלכם בנושא {{category}} נמשכה.' },
    offer_accepted: {
      title: 'ההצעה שלכם אושרה',
      body: 'ההצעה שלכם על סך {{price}} ({{category}}) אושרה על ידי {{customerName}}. נא לאשר את מועד הביקור: {{date}}.',
    },
    offer_not_selected: { title: 'ההצעה לא נבחרה', body: 'נבחר בעל מקצוע אחר לבקשה בנושא {{category}}.' },
    offer_expired: { title: 'תוקף ההצעה פג', body: 'תוקף ההצעה שלכם על סך {{price}} לבקשה בנושא {{category}} פג ללא מענה.' },
    request_cancelled: { title: 'הבקשה בוטלה', body: 'הבקשה בנושא {{category}} בוטלה על ידי {{customerName}}.' },
    job_confirmed: { title: 'מועד הביקור אושר', body: 'מועד הביקור של {{professionalName}} ({{category}}) אושר: {{date}}.' },
    job_started: { title: 'העבודה התחילה', body: 'העבודה בנושא {{category}} עם {{professionalName}} התחילה.' },
    appointment_reminder: { title: 'ביקור מתקרב', body: 'תזכורת: ביקור בנושא {{category}} עם {{name}}, {{date}}.' },
    job_completed: {
      title: 'העבודה הושלמה',
      body: 'העבודה בנושא {{category}} עם {{name}} הושלמה. איך היה? נשמח לביקורת שלכם.',
      altBody: 'העבודה בנושא {{category}} עבור {{name}} הושלמה. עבודה מצוינת!',
    },
    job_cancelled: { title: 'העבודה בוטלה', body: 'העבודה בנושא {{category}} ({{date}}) בוטלה כי החשבון של בעל המקצוע נסגר.' },
    review_received: { title: 'ביקורת חדשה: {{stars}}', body: 'ביקורת חדשה מאת {{customerName}} על העבודה בנושא {{category}}.' },
    new_message: { title: 'הודעה חדשה מאת {{name}}', body: '{{preview}}', altBody: 'פתחו את הצ׳אט כדי לקרוא אותה.' },
  },
};

export const PUSH_TEXTS: Record<AppLanguage, PushTexts> = { en, he };
