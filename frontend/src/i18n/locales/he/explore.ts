import type { explore as enexplore } from '../en/explore';
import type { LocaleNamespace } from '../../types';

export const explore: LocaleNamespace<typeof enexplore> = {
  title: 'חיפוש',
  modes: {
    map: 'מפה',
    list: 'רשימה',
  },
  filtersButton: 'סינון',
  filtersButtonActive_one: 'סינון, מסנן אחד פעיל',
  filtersButtonActive_two: 'סינון, {{count}} מסננים פעילים',
  filtersButtonActive_other: 'סינון, {{count}} מסננים פעילים',
  jobsInArea_one: 'עבודה אחת באזור שלך',
  jobsInArea_two: '{{count}} עבודות באזור שלך',
  jobsInArea_other: '{{count}} עבודות באזור שלך',
  loadingJobs: 'מחפשים עבודות…',
  recenter: 'חזרה לאזור השירות שלך',
  map: {
    label: 'מפת העבודות הפתוחות באזור השירות שלך',
    markerA11y: '{{category}}, {{urgency}}, {{distance}}',
  },
  preview: {
    view: 'לצפייה',
    openHint: 'פותח את פרטי הבקשה',
  },
  empty: {
    filteredTitle: 'אין עבודות שמתאימות לסינון',
    areaTitle: 'אין כרגע עבודות פתוחות בסביבה',
    adjustFilters: 'שינוי הסינון',
    clearFilters: 'ניקוי הסינון',
    expandArea: 'הרחבת אזור השירות',
  },
  filters: {
    title: 'סינון',
    categories: 'שירות',
    distance: 'מרחק',
    withinDistance: 'עד {{distance}}',
    wholeArea: 'כל אזור השירות',
    wholeAreaWithRadius: 'כל האזור ({{distance}})',
    urgency: 'דחיפות',
    apply_one: 'הצגת עבודה אחת',
    apply_two: 'הצגת {{count}} עבודות',
    apply_other: 'הצגת {{count}} עבודות',
    applyNone: 'אין עבודות מתאימות',
    applyPlain: 'הצגת עבודות',
  },
};
