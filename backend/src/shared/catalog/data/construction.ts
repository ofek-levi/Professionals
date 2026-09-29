/** Catalog entries: construction & renovation. */
import type { CategoryInput } from '../types.js';

export const CONSTRUCTION: CategoryInput[] = [
  {
    id: 'general_contractor',
    groupId: 'construction_renovation',
    name: { en: 'General Contractor', he: 'קבלן כללי' },
    description: {
      en: 'Project management for construction and large renovation work.',
      he: 'ניהול פרויקטים של בנייה ושיפוצים גדולים.',
    },
    icon: 'account-hard-hat',
    keywords: {
      en: ['contractor', 'construction', 'project', 'builder'],
      he: ['קבלן', 'בנייה', 'פרויקט', 'קבלן שיפוצים'],
    },
  },
  {
    id: 'masonry',
    groupId: 'construction_renovation',
    name: { en: 'Masonry & Brickwork', he: 'בנייה ועבודות בלוקים' },
    description: {
      en: 'Block and brick walls, concrete work and stone cladding.',
      he: 'קירות בלוקים ולבנים, עבודות בטון וחיפוי אבן.',
    },
    icon: 'wall',
    keywords: {
      en: ['masonry', 'bricks', 'blocks', 'concrete', 'stone'],
      he: ['בנאי', 'בלוקים', 'לבנים', 'בטון', 'אבן'],
    },
  },
  {
    id: 'renovation',
    groupId: 'construction_renovation',
    name: { en: 'Renovation', he: 'שיפוצים' },
    description: {
      en: 'Full apartment and house renovations.',
      he: 'שיפוץ דירות ובתים מקצה לקצה.',
    },
    icon: 'home-edit',
    keywords: {
      en: ['renovation', 'remodel', 'apartment renovation'],
      he: ['שיפוץ', 'שיפוצים', 'שיפוץ דירה', 'שיפוצניק'],
    },
    isPopular: true,
  },
  {
    id: 'kitchen_renovation',
    groupId: 'construction_renovation',
    name: { en: 'Kitchen Renovation', he: 'שיפוץ מטבח' },
    description: {
      en: 'Kitchen cabinets, countertops, backsplash and layout changes.',
      he: 'ארונות מטבח, משטחים, חיפוי ושינוי תכנון.',
    },
    icon: 'countertop',
    keywords: {
      en: ['kitchen', 'countertop', 'cabinets', 'backsplash'],
      he: ['מטבח', 'משטח', 'ארונות מטבח', 'חיפוי'],
    },
  },
  {
    id: 'bathroom_renovation',
    groupId: 'construction_renovation',
    name: { en: 'Bathroom Renovation', he: 'שיפוץ חדר רחצה' },
    description: {
      en: 'Showers, bathtubs, vanities and bathroom tiling.',
      he: 'מקלחונים, אמבטיות, ארונות אמבטיה וריצוף.',
    },
    icon: 'shower',
    keywords: {
      en: ['bathroom', 'shower', 'bathtub', 'vanity'],
      he: ['חדר רחצה', 'אמבטיה', 'מקלחת', 'מקלחון'],
    },
  },
  {
    id: 'welding',
    groupId: 'construction_renovation',
    name: { en: 'Welding', he: 'ריתוך' },
    description: {
      en: 'On-site welding and metal repairs.',
      he: 'ריתוך בשטח ותיקוני מתכת.',
    },
    icon: 'torch',
    keywords: {
      en: ['welding', 'welder', 'metal', 'steel'],
      he: ['ריתוך', 'רתך', 'מתכת', 'פלדה'],
    },
  },
  {
    id: 'ironwork',
    groupId: 'construction_renovation',
    name: { en: 'Ironwork', he: 'מסגרות' },
    description: {
      en: 'Gates, railings, window bars and metal structures.',
      he: 'שערים, מעקות, סורגים ומבני מתכת.',
    },
    icon: 'gate',
    keywords: {
      en: ['ironwork', 'gate', 'railing', 'bars', 'metal'],
      he: ['מסגר', 'מסגרות', 'שער', 'מעקה', 'סורגים'],
    },
  },
  {
    id: 'aluminum_work',
    groupId: 'construction_renovation',
    name: { en: 'Aluminum Work', he: 'עבודות אלומיניום' },
    description: {
      en: 'Aluminum windows, sliding doors, enclosures and nets.',
      he: 'חלונות אלומיניום, דלתות הזזה, סגירות מרפסת ורשתות.',
    },
    icon: 'window-open-variant',
    keywords: {
      en: ['aluminum', 'sliding door', 'window frame', 'enclosure', 'screens'],
      he: ['אלומיניום', 'אלומיניומן', 'חלון הזזה', 'סגירת מרפסת', 'רשת'],
    },
  },
  {
    id: 'insulation',
    groupId: 'construction_renovation',
    name: { en: 'Insulation', he: 'בידוד' },
    description: {
      en: 'Thermal and acoustic insulation for walls, roofs and pipes.',
      he: 'בידוד תרמי ואקוסטי לקירות, גגות וצנרת.',
    },
    icon: 'home-thermometer',
    keywords: {
      en: ['insulation', 'thermal', 'acoustic', 'soundproofing'],
      he: ['בידוד', 'בידוד תרמי', 'בידוד אקוסטי', 'אקוסטיקה'],
    },
  },
  {
    id: 'landscaping_gardening',
    groupId: 'construction_renovation',
    name: { en: 'Landscaping & Gardening', he: 'גינון ופיתוח נוף' },
    description: {
      en: 'Garden design, planting, lawns and irrigation systems.',
      he: 'עיצוב גינות, שתילה, דשא ומערכות השקיה.',
    },
    icon: 'flower',
    keywords: {
      en: ['gardener', 'garden', 'lawn', 'irrigation', 'landscaping', 'plants'],
      he: ['גנן', 'גינה', 'דשא', 'השקיה', 'גינון', 'צמחים'],
    },
  },
  {
    id: 'tree_services',
    groupId: 'construction_renovation',
    name: { en: 'Tree Services', he: 'גיזום וטיפול בעצים' },
    description: {
      en: 'Tree trimming, removal and stump grinding.',
      he: 'גיזום עצים, כריתה ועקירת גדמים.',
    },
    icon: 'tree',
    keywords: {
      en: ['tree', 'trimming', 'pruning', 'stump', 'arborist'],
      he: ['עץ', 'גיזום', 'כריתה', 'גדם'],
    },
  },
  {
    id: 'pool_maintenance',
    groupId: 'construction_renovation',
    name: { en: 'Pool Maintenance', he: 'תחזוקת בריכות' },
    description: {
      en: 'Pool cleaning, pumps, filters and water balance.',
      he: 'ניקוי בריכות, משאבות, מסננים ואיזון מים.',
    },
    icon: 'pool',
    keywords: {
      en: ['pool', 'swimming pool', 'pump', 'chlorine'],
      he: ['בריכה', 'בריכת שחייה', 'משאבה', 'כלור'],
    },
  },
  {
    id: 'pergolas_decking',
    groupId: 'construction_renovation',
    name: { en: 'Pergolas & Decking', he: 'פרגולות ודקים' },
    description: {
      en: 'Wood and aluminum pergolas, decks and outdoor structures.',
      he: 'פרגולות מעץ ואלומיניום, דקים ומבנים חיצוניים.',
    },
    icon: 'grill',
    keywords: {
      en: ['pergola', 'deck', 'patio', 'outdoor'],
      he: ['פרגולה', 'דק', 'מרפסת', 'חצר'],
    },
  },
];
