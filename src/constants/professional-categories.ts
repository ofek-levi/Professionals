/**
 * Centralized, strict catalog of supported professional categories.
 *
 * - Both professional registration and customer request creation use this exact catalog.
 * - All internal logic references the stable `id`, never the display name.
 * - The same shape is returned by `GET /catalog/categories`, so the catalog can later be served
 *   by a backend without UI changes (the UI reads it through `useCategoryCatalog()`).
 */
import type {
  CategoryCatalog,
  ProfessionalCategory,
  ProfessionalCategoryGroup,
} from '@/types/domain/category';

export const CATEGORY_GROUP_IDS = [
  'home_repairs',
  'construction_renovation',
  'moving_transportation',
  'other_services',
] as const;
export type CategoryGroupId = (typeof CATEGORY_GROUP_IDS)[number];

export const CATEGORY_IDS = [
  // Home repairs & maintenance
  'plumbing',
  'electrical',
  'hvac',
  'appliance_repair',
  'handyman',
  'painting',
  'carpentry',
  'furniture_assembly',
  'locksmith',
  'glass_window_repair',
  'door_shutter_repair',
  'roofing',
  'waterproofing_leak_detection',
  'flooring_tiling',
  'plastering_drywall',
  'pest_control',
  'cleaning',
  'home_maintenance',
  'water_heater',
  'gas_technician',
  // Construction & renovation
  'general_contractor',
  'masonry',
  'renovation',
  'kitchen_renovation',
  'bathroom_renovation',
  'welding',
  'ironwork',
  'aluminum_work',
  'insulation',
  'landscaping_gardening',
  'tree_services',
  'pool_maintenance',
  'pergolas_decking',
  // Moving & transportation
  'moving',
  'truck_moving',
  'furniture_transport',
  'delivery',
  'junk_removal',
  'heavy_lifting',
  'packing_unpacking',
  'vehicle_towing',
  // Other services
  'computer_it_repair',
  'network_wifi_setup',
  'security_systems',
  'solar_panels',
  'water_filtration',
  'window_cleaning',
  'upholstery_cleaning',
  'carpet_cleaning',
  'chimney_vent_cleaning',
  'tv_mounting',
  'smart_home',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

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

type CategoryInput = Omit<ProfessionalCategory, 'sortOrder' | 'isPopular'> & { isPopular?: boolean };

const define = (items: CategoryInput[]): ProfessionalCategory[] =>
  items.map((item, index) => ({ ...item, isPopular: item.isPopular ?? false, sortOrder: index + 1 }));

export const PROFESSIONAL_CATEGORIES: readonly ProfessionalCategory[] = define([
  // ───────────────────────────── Home repairs & maintenance ─────────────────────────────
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
  // ───────────────────────────── Construction & renovation ─────────────────────────────
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
  // ───────────────────────────── Moving & transportation ─────────────────────────────
  {
    id: 'moving',
    groupId: 'moving_transportation',
    name: { en: 'Moving Services', he: 'הובלות' },
    description: {
      en: 'Apartment and office moves with a professional crew.',
      he: 'הובלת דירות ומשרדים עם צוות מקצועי.',
    },
    icon: 'dolly',
    keywords: {
      en: ['moving', 'movers', 'relocation', 'apartment move'],
      he: ['הובלה', 'מוביל', 'מעבר דירה', 'הובלות'],
    },
    isPopular: true,
  },
  {
    id: 'truck_moving',
    groupId: 'moving_transportation',
    name: { en: 'Truck Moving', he: 'הובלה במשאית' },
    description: {
      en: 'Truck with driver for large loads and long distance moves.',
      he: 'משאית עם נהג למטענים גדולים והובלות למרחקים.',
    },
    icon: 'truck',
    keywords: {
      en: ['truck', 'van', 'lorry', 'long distance'],
      he: ['משאית', 'טנדר', 'הובלה ארצית'],
    },
  },
  {
    id: 'furniture_transport',
    groupId: 'moving_transportation',
    name: { en: 'Furniture Transportation', he: 'הובלת רהיטים' },
    description: {
      en: 'Transport of single furniture items and appliances.',
      he: 'הובלת פריטי ריהוט בודדים ומכשירי חשמל.',
    },
    icon: 'sofa-outline',
    keywords: {
      en: ['furniture', 'sofa', 'fridge', 'transport', 'small move'],
      he: ['רהיטים', 'ספה', 'מקרר', 'הובלה קטנה'],
    },
  },
  {
    id: 'delivery',
    groupId: 'moving_transportation',
    name: { en: 'Delivery Services', he: 'שירותי משלוחים' },
    description: {
      en: 'Same-day pickup and delivery of packages and goods.',
      he: 'איסוף ומשלוח חבילות וסחורה באותו היום.',
    },
    icon: 'truck-delivery',
    keywords: {
      en: ['delivery', 'courier', 'pickup', 'package'],
      he: ['משלוח', 'שליח', 'איסוף', 'חבילה'],
    },
  },
  {
    id: 'junk_removal',
    groupId: 'moving_transportation',
    name: { en: 'Junk Removal', he: 'פינוי פסולת וגרוטאות' },
    description: {
      en: 'Removal of old furniture, construction waste and clutter.',
      he: 'פינוי רהיטים ישנים, פסולת בניין וגרוטאות.',
    },
    icon: 'dump-truck',
    keywords: {
      en: ['junk', 'waste', 'removal', 'debris', 'clearance'],
      he: ['פינוי', 'פסולת', 'פסולת בניין', 'גרוטאות', 'פינוי דירה'],
    },
  },
  {
    id: 'heavy_lifting',
    groupId: 'moving_transportation',
    name: { en: 'Heavy Lifting', he: 'הרמת משאות כבדים' },
    description: {
      en: 'Crane lifts, pianos, safes and other heavy items.',
      he: 'הרמה במנוף, פסנתרים, כספות ופריטים כבדים.',
    },
    icon: 'crane',
    keywords: {
      en: ['crane', 'piano', 'safe', 'heavy', 'lift'],
      he: ['מנוף', 'פסנתר', 'כספת', 'הרמה', 'משא כבד'],
    },
  },
  {
    id: 'packing_unpacking',
    groupId: 'moving_transportation',
    name: { en: 'Packing & Unpacking', he: 'אריזה ופריקה' },
    description: {
      en: 'Professional packing, boxes and unpacking at the new home.',
      he: 'אריזה מקצועית, קרטונים ופריקה בבית החדש.',
    },
    icon: 'package-variant',
    keywords: {
      en: ['packing', 'boxes', 'unpacking', 'wrapping'],
      he: ['אריזה', 'קרטונים', 'פריקה', 'עטיפה'],
    },
  },
  {
    id: 'vehicle_towing',
    groupId: 'moving_transportation',
    name: { en: 'Vehicle Towing', he: 'גרירת רכבים' },
    description: {
      en: 'Towing and roadside transport of cars and motorcycles.',
      he: 'גרירה והובלה של רכבים ואופנועים.',
    },
    icon: 'tow-truck',
    keywords: {
      en: ['towing', 'tow truck', 'car', 'breakdown', 'roadside'],
      he: ['גרר', 'גרירה', 'רכב', 'תקלה בדרך'],
    },
  },
  // ───────────────────────────── Other services ─────────────────────────────
  {
    id: 'computer_it_repair',
    groupId: 'other_services',
    name: { en: 'Computer & IT Repair', he: 'תיקון מחשבים ו-IT' },
    description: {
      en: 'Laptop and PC repairs, upgrades, viruses and data recovery.',
      he: 'תיקון מחשבים ניידים ונייחים, שדרוגים, וירוסים ושחזור מידע.',
    },
    icon: 'laptop',
    keywords: {
      en: ['computer', 'laptop', 'pc', 'it', 'virus', 'data recovery'],
      he: ['מחשב', 'לפטופ', 'טכנאי מחשבים', 'וירוס', 'שחזור מידע'],
    },
  },
  {
    id: 'network_wifi_setup',
    groupId: 'other_services',
    name: { en: 'Network & Wi-Fi Setup', he: 'התקנת רשת ו-Wi-Fi' },
    description: {
      en: 'Routers, mesh Wi-Fi, cabling and weak signal fixes.',
      he: 'ראוטרים, רשת Mesh, תשתית כבילה ושיפור קליטה.',
    },
    icon: 'wifi',
    keywords: {
      en: ['wifi', 'router', 'network', 'internet', 'mesh', 'cabling'],
      he: ['וויפיי', 'ראוטר', 'רשת', 'אינטרנט', 'קליטה'],
    },
  },
  {
    id: 'security_systems',
    groupId: 'other_services',
    name: { en: 'Security Systems & Cameras', he: 'מערכות אבטחה ומצלמות' },
    description: {
      en: 'CCTV cameras, alarms, intercoms and smart locks.',
      he: 'מצלמות אבטחה, אזעקות, אינטרקום ומנעולים חכמים.',
    },
    icon: 'cctv',
    keywords: {
      en: ['cctv', 'camera', 'alarm', 'intercom', 'security'],
      he: ['מצלמות', 'אזעקה', 'אינטרקום', 'אבטחה'],
    },
  },
  {
    id: 'solar_panels',
    groupId: 'other_services',
    name: { en: 'Solar Panel Installation & Maintenance', he: 'התקנה ותחזוקת מערכות סולאריות' },
    description: {
      en: 'Photovoltaic systems, panel cleaning and inverter service.',
      he: 'מערכות פוטו-וולטאיות, ניקוי פאנלים ושירות לממירים.',
    },
    icon: 'solar-panel',
    keywords: {
      en: ['solar', 'photovoltaic', 'pv', 'inverter', 'panels'],
      he: ['סולארי', 'פאנלים', 'מערכת סולארית', 'ממיר'],
    },
  },
  {
    id: 'water_filtration',
    groupId: 'other_services',
    name: { en: 'Water Filtration Systems', he: 'מערכות סינון מים' },
    description: {
      en: 'Water filters, bars, softeners and filter replacement.',
      he: 'מסנני מים, בר מים, מרככי מים והחלפת מסננים.',
    },
    icon: 'air-filter',
    keywords: {
      en: ['water filter', 'filtration', 'softener', 'water bar'],
      he: ['סינון מים', 'מסנן', 'בר מים', 'מרכך מים'],
    },
  },
  {
    id: 'window_cleaning',
    groupId: 'other_services',
    name: { en: 'Window Cleaning', he: 'ניקוי חלונות' },
    description: {
      en: 'Interior and exterior window and glass facade cleaning.',
      he: 'ניקוי חלונות מבפנים ומבחוץ וחזיתות זכוכית.',
    },
    icon: 'spray-bottle',
    keywords: {
      en: ['windows', 'glass', 'window cleaning', 'facade'],
      he: ['חלונות', 'ניקוי חלונות', 'זכוכית', 'חזית'],
    },
  },
  {
    id: 'upholstery_cleaning',
    groupId: 'other_services',
    name: { en: 'Upholstery & Sofa Cleaning', he: 'ניקוי ריפודים וספות' },
    description: {
      en: 'Deep cleaning of sofas, armchairs, mattresses and car seats.',
      he: 'ניקוי עמוק של ספות, כורסאות, מזרנים ומושבי רכב.',
    },
    icon: 'sofa',
    keywords: {
      en: ['upholstery', 'sofa', 'couch', 'mattress', 'stain'],
      he: ['ריפוד', 'ספה', 'מזרן', 'כתם', 'ניקוי ספות'],
    },
  },
  {
    id: 'carpet_cleaning',
    groupId: 'other_services',
    name: { en: 'Carpet Cleaning', he: 'ניקוי שטיחים' },
    description: {
      en: 'Carpet and rug washing with pickup or on-site.',
      he: 'ניקוי שטיחים באיסוף או במקום.',
    },
    icon: 'rug',
    keywords: {
      en: ['carpet', 'rug', 'wash', 'stain'],
      he: ['שטיח', 'שטיחים', 'ניקוי שטיחים', 'כתם'],
    },
  },
  {
    id: 'chimney_vent_cleaning',
    groupId: 'other_services',
    name: { en: 'Chimney & Vent Cleaning', he: 'ניקוי ארובות ופתחי אוורור' },
    description: {
      en: 'Fireplaces, chimneys, kitchen hoods and air ducts.',
      he: 'קמינים, ארובות, קולטי אדים ותעלות אוורור.',
    },
    icon: 'fireplace',
    keywords: {
      en: ['chimney', 'fireplace', 'vent', 'duct', 'hood'],
      he: ['ארובה', 'קמין', 'אוורור', 'תעלות', 'קולט אדים'],
    },
  },
  {
    id: 'tv_mounting',
    groupId: 'other_services',
    name: { en: 'TV Mounting & Home Theater', he: 'תליית טלוויזיות וקולנוע ביתי' },
    description: {
      en: 'TV wall mounting, cable concealment and sound systems.',
      he: 'תליית טלוויזיה על הקיר, הסתרת כבלים ומערכות שמע.',
    },
    icon: 'television',
    keywords: {
      en: ['tv', 'television', 'mount', 'home theater', 'soundbar'],
      he: ['טלוויזיה', 'תליית טלוויזיה', 'קולנוע ביתי', 'מקרן'],
    },
  },
  {
    id: 'smart_home',
    groupId: 'other_services',
    name: { en: 'Smart Home Installation', he: 'התקנת בית חכם' },
    description: {
      en: 'Smart switches, thermostats, sensors and home automation.',
      he: 'מתגים חכמים, תרמוסטטים, חיישנים ואוטומציה לבית.',
    },
    icon: 'home-automation',
    keywords: {
      en: ['smart home', 'automation', 'smart switch', 'sensors'],
      he: ['בית חכם', 'אוטומציה', 'מתג חכם', 'חיישנים'],
    },
  },
]);

const CATEGORY_CATALOG_VERSION = '2026.09.1';

export const DEFAULT_CATEGORY_CATALOG: CategoryCatalog = {
  groups: [...CATEGORY_GROUPS],
  categories: [...PROFESSIONAL_CATEGORIES],
  version: CATEGORY_CATALOG_VERSION,
};

const CATEGORY_ID_SET: ReadonlySet<string> = new Set(CATEGORY_IDS);
const CATEGORY_BY_ID = new Map<CategoryId, ProfessionalCategory>(
  PROFESSIONAL_CATEGORIES.map((category) => [category.id, category]),
);

/** Type guard: only ids that exist in the catalog are supported. */
export function isSupportedCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && CATEGORY_ID_SET.has(value);
}

export function getCategoryById(id: CategoryId): ProfessionalCategory;
export function getCategoryById(id: string): ProfessionalCategory | undefined;
export function getCategoryById(id: string): ProfessionalCategory | undefined {
  return isSupportedCategoryId(id) ? CATEGORY_BY_ID.get(id) : undefined;
}
