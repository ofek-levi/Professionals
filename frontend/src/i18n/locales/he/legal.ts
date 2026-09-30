import type { legal as enlegal } from '../en/legal';
import type { LocaleNamespace } from '../../types';

export const legal: LocaleNamespace<typeof enlegal> = {
  documents: {
    terms: 'תנאי השימוש',
    privacy: 'מדיניות הפרטיות',
  },
  openHint: 'פותח את המסמך',
  effectiveDate: 'בתוקף מיום {{date}}',
};
