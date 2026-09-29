/** Catalog entries: home repairs & maintenance. */
import type { CategoryInput } from '../types.js';

export const HOME_REPAIRS: CategoryInput[] = [
  {
    id: 'plumbing',
    groupId: 'home_repairs',
    name: { en: 'Plumbing', he: 'אינסטלציה' },
    description: {
      en: 'Leaks, clogged drains, faucets, toilets and pipe repairs.',
      he: 'נזילות, סתימות, ברזים, אסלות ותיקוני צנרת.',
    },
    icon: 'pipe-wrench',
    keywords: {
      en: ['plumber', 'leak', 'pipe', 'drain', 'clog', 'toilet', 'faucet', 'sink'],
      he: ['אינסטלטור', 'נזילה', 'צנרת', 'סתימה', 'ברז', 'אסלה', 'כיור'],
    },
    isPopular: true,
  },
  {
    id: 'electrical',
    groupId: 'home_repairs',
    name: { en: 'Electrical Work', he: 'עבודות חשמל' },
    description: {
      en: 'Outlets, lighting, breakers, wiring and electrical faults.',
      he: 'שקעים, תאורה, לוחות חשמל, חיווט ותקלות חשמל.',
    },
    icon: 'flash',
    keywords: {
      en: ['electrician', 'outlet', 'socket', 'lighting', 'breaker', 'wiring', 'short circuit'],
      he: ['חשמלאי', 'שקע', 'תאורה', 'לוח חשמל', 'קצר', 'חיווט'],
    },
    isPopular: true,
  },
  {
    id: 'hvac',
    groupId: 'home_repairs',
    name: { en: 'Air Conditioning', he: 'מיזוג אוויר' },
    description: {
      en: 'AC installation, cleaning, gas refills and repairs.',
      he: 'התקנת מזגנים, ניקוי, מילוי גז ותיקונים.',
    },
    icon: 'air-conditioner',
    keywords: {
      en: ['air conditioner', 'ac', 'hvac', 'cooling', 'heating', 'mini split'],
      he: ['מזגן', 'מיזוג', 'טכנאי מזגנים', 'קירור', 'חימום', 'מילוי גז'],
    },
    isPopular: true,
  },
  {
    id: 'appliance_repair',
    groupId: 'home_repairs',
    name: { en: 'Appliance Repair', he: 'תיקון מכשירי חשמל' },
    description: {
      en: 'Washing machines, dryers, fridges, ovens and dishwashers.',
      he: 'מכונות כביסה, מייבשים, מקררים, תנורים ומדיחי כלים.',
    },
    icon: 'washing-machine',
    keywords: {
      en: ['washing machine', 'dryer', 'fridge', 'refrigerator', 'oven', 'dishwasher', 'appliance'],
      he: ['מכונת כביסה', 'מייבש', 'מקרר', 'תנור', 'מדיח', 'טכנאי'],
    },
    isPopular: true,
  },
  {
    id: 'handyman',
    groupId: 'home_repairs',
    name: { en: 'General Handyman', he: 'הנדימן' },
    description: {
      en: 'Small fixes, hanging, mounting and odd jobs around the house.',
      he: 'תיקונים קטנים, תלייה, התקנות ועבודות שונות בבית.',
    },
    icon: 'hammer-screwdriver',
    keywords: {
      en: ['handyman', 'fix', 'mount', 'hang', 'shelves', 'curtains', 'repair'],
      he: ['הנדימן', 'איש אחזקה', 'תלייה', 'מדפים', 'וילונות', 'תיקונים'],
    },
    isPopular: true,
  },
  {
    id: 'painting',
    groupId: 'home_repairs',
    name: { en: 'Painting', he: 'צביעה' },
    description: {
      en: 'Interior and exterior painting, touch-ups and wall prep.',
      he: 'צביעת פנים וחוץ, תיקוני צבע והכנת קירות.',
    },
    icon: 'format-paint',
    keywords: {
      en: ['painter', 'paint', 'walls', 'ceiling', 'color'],
      he: ['צבעי', 'צבע', 'קירות', 'תקרה', 'שפכטל'],
    },
    isPopular: true,
  },
  {
    id: 'carpentry',
    groupId: 'home_repairs',
    name: { en: 'Carpentry', he: 'נגרות' },
    description: {
      en: 'Custom woodwork, cabinets, closets and wood repairs.',
      he: 'עבודות עץ בהתאמה אישית, ארונות ותיקוני עץ.',
    },
    icon: 'saw-blade',
    keywords: {
      en: ['carpenter', 'wood', 'cabinet', 'closet', 'shelves'],
      he: ['נגר', 'עץ', 'ארון', 'ארונות', 'מדפים'],
    },
  },
  {
    id: 'furniture_assembly',
    groupId: 'home_repairs',
    name: { en: 'Furniture Assembly', he: 'הרכבת רהיטים' },
    description: {
      en: 'Assembly and disassembly of flat-pack and custom furniture.',
      he: 'הרכבה ופירוק של רהיטים ורהיטי IKEA.',
    },
    icon: 'table-furniture',
    keywords: {
      en: ['assembly', 'ikea', 'furniture', 'bed', 'wardrobe', 'desk'],
      he: ['הרכבה', 'איקאה', 'רהיטים', 'מיטה', 'ארון', 'שולחן'],
    },
  },
  {
    id: 'locksmith',
    groupId: 'home_repairs',
    name: { en: 'Locksmith', he: 'מנעולן' },
    description: {
      en: 'Lockouts, lock replacement, cylinders and security doors.',
      he: 'פריצת דלתות, החלפת מנעולים, צילינדרים ודלתות ביטחון.',
    },
    icon: 'key-variant',
    keywords: {
      en: ['locksmith', 'lock', 'key', 'locked out', 'cylinder'],
      he: ['מנעולן', 'מנעול', 'מפתח', 'צילינדר', 'פריצה'],
    },
    isPopular: true,
  },
  {
    id: 'glass_window_repair',
    groupId: 'home_repairs',
    name: { en: 'Glass & Window Repair', he: 'זגגות ותיקון חלונות' },
    description: {
      en: 'Broken glass, window tracks, mirrors and glazing.',
      he: 'החלפת זכוכית שבורה, מסילות, מראות וזיגוג.',
    },
    icon: 'window-closed-variant',
    keywords: {
      en: ['glass', 'window', 'glazier', 'mirror', 'broken window'],
      he: ['זגג', 'זכוכית', 'חלון', 'מראה', 'חלון שבור'],
    },
  },
  {
    id: 'door_shutter_repair',
    groupId: 'home_repairs',
    name: { en: 'Door & Shutter Repair', he: 'תיקון דלתות ותריסים' },
    description: {
      en: 'Doors, roller shutters, electric shutters and hinges.',
      he: 'דלתות, תריסי גלילה, תריסים חשמליים וצירים.',
    },
    icon: 'window-shutter',
    keywords: {
      en: ['door', 'shutter', 'roller shutter', 'blinds', 'hinge'],
      he: ['דלת', 'תריס', 'תריס חשמלי', 'תריסים', 'ציר'],
    },
  },
  {
    id: 'roofing',
    groupId: 'home_repairs',
    name: { en: 'Roofing', he: 'עבודות גגות' },
    description: {
      en: 'Roof repairs, tiles, gutters and roof inspections.',
      he: 'תיקוני גגות, רעפים, מרזבים ובדיקות גג.',
    },
    icon: 'home-roof',
    keywords: {
      en: ['roof', 'tiles', 'gutter', 'roofer'],
      he: ['גג', 'רעפים', 'מרזב', 'גגן'],
    },
  },
  {
    id: 'waterproofing_leak_detection',
    groupId: 'home_repairs',
    name: { en: 'Waterproofing & Leak Detection', he: 'איטום ואיתור נזילות' },
    description: {
      en: 'Finding hidden leaks, damp walls, roof and balcony sealing.',
      he: 'איתור נזילות סמויות, רטיבות בקירות, איטום גגות ומרפסות.',
    },
    icon: 'water-alert',
    keywords: {
      en: ['waterproofing', 'leak detection', 'damp', 'moisture', 'sealing', 'mold'],
      he: ['איטום', 'איתור נזילות', 'רטיבות', 'עובש', 'לחות'],
    },
  },
  {
    id: 'flooring_tiling',
    groupId: 'home_repairs',
    name: { en: 'Flooring & Tiling', he: 'ריצוף וחיפוי' },
    description: {
      en: 'Tiles, parquet, laminate and floor repairs.',
      he: 'ריצוף, פרקט, למינציה ותיקוני רצפה.',
    },
    icon: 'checkerboard',
    keywords: {
      en: ['tiles', 'tiling', 'floor', 'parquet', 'laminate', 'grout'],
      he: ['רצף', 'ריצוף', 'אריחים', 'פרקט', 'למינציה', 'רובה'],
    },
  },
  {
    id: 'plastering_drywall',
    groupId: 'home_repairs',
    name: { en: 'Plastering & Drywall', he: 'טיח וגבס' },
    description: {
      en: 'Drywall partitions, ceilings, plaster repairs and finishing.',
      he: 'קירות וקירוי גבס, תיקוני טיח וגמרים.',
    },
    icon: 'wall',
    keywords: {
      en: ['drywall', 'plaster', 'gypsum', 'partition', 'ceiling'],
      he: ['גבס', 'טיח', 'טייח', 'מחיצה', 'תקרה'],
    },
  },
  {
    id: 'pest_control',
    groupId: 'home_repairs',
    name: { en: 'Pest Control', he: 'הדברה' },
    description: {
      en: 'Cockroaches, ants, termites, rodents and preventive treatment.',
      he: 'ג׳וקים, נמלים, טרמיטים, מכרסמים וטיפול מונע.',
    },
    icon: 'bug',
    keywords: {
      en: ['pest', 'exterminator', 'cockroach', 'ants', 'termites', 'mice', 'rats'],
      he: ['מדביר', 'הדברה', 'ג׳וקים', 'נמלים', 'טרמיטים', 'עכברים'],
    },
    isPopular: true,
  },
  {
    id: 'cleaning',
    groupId: 'home_repairs',
    name: { en: 'Cleaning', he: 'ניקיון' },
    description: {
      en: 'Home cleaning, deep cleaning and post-renovation cleaning.',
      he: 'ניקיון בית, ניקיון יסודי וניקיון לאחר שיפוץ.',
    },
    icon: 'broom',
    keywords: {
      en: ['cleaning', 'cleaner', 'deep clean', 'house cleaning', 'post renovation'],
      he: ['ניקיון', 'מנקה', 'ניקיון יסודי', 'ניקיון אחרי שיפוץ'],
    },
    isPopular: true,
  },
  {
    id: 'home_maintenance',
    groupId: 'home_repairs',
    name: { en: 'Home Maintenance', he: 'תחזוקת בית' },
    description: {
      en: 'Periodic maintenance, inspections and preventive care.',
      he: 'תחזוקה שוטפת, בדיקות תקופתיות וטיפול מונע.',
    },
    icon: 'home-edit',
    keywords: {
      en: ['maintenance', 'inspection', 'preventive', 'upkeep'],
      he: ['תחזוקה', 'בדיקה', 'אחזקה', 'טיפול מונע'],
    },
  },
  {
    id: 'water_heater',
    groupId: 'home_repairs',
    name: { en: 'Water Heaters & Solar Boilers', he: 'דודים ודודי שמש' },
    description: {
      en: 'Electric boilers, solar water heaters, elements and thermostats.',
      he: 'דודי חשמל, דודי שמש, גופי חימום ותרמוסטטים.',
    },
    icon: 'water-boiler',
    keywords: {
      en: ['boiler', 'water heater', 'solar heater', 'hot water', 'thermostat'],
      he: ['דוד', 'דוד שמש', 'מים חמים', 'גוף חימום', 'תרמוסטט'],
    },
  },
  {
    id: 'gas_technician',
    groupId: 'home_repairs',
    name: { en: 'Gas Technician', he: 'טכנאי גז' },
    description: {
      en: 'Licensed gas stove installation, gas leaks and pipe inspections.',
      he: 'התקנת כיריים גז, דליפות גז ובדיקות צנרת גז על ידי טכנאי מוסמך.',
    },
    icon: 'gas-burner',
    keywords: {
      en: ['gas', 'stove', 'gas leak', 'gas pipe', 'cooktop'],
      he: ['גז', 'כיריים', 'דליפת גז', 'צנרת גז', 'טכנאי גז'],
    },
  },
];
