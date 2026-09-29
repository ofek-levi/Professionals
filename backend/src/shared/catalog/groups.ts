import type { ProfessionalCategoryGroup } from './types.js';

export const CATEGORY_GROUPS: readonly ProfessionalCategoryGroup[] = [
  {
    id: 'home_repairs',
    name: { en: 'Home Repairs & Maintenance', he: 'תיקונים ותחזוקת הבית' },
    icon: 'home-variant',
    sortOrder: 1,
  },
  {
    id: 'construction_renovation',
    name: { en: 'Construction & Renovation', he: 'בנייה ושיפוצים' },
    icon: 'account-hard-hat',
    sortOrder: 2,
  },
  {
    id: 'moving_transportation',
    name: { en: 'Moving & Transportation', he: 'הובלות ושינוע' },
    icon: 'truck',
    sortOrder: 3,
  },
  {
    id: 'other_services',
    name: { en: 'Other Services', he: 'שירותים נוספים' },
    icon: 'tools',
    sortOrder: 4,
  },
];
