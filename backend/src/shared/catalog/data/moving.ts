/** Catalog entries: moving & transportation. */
import type { CategoryInput } from '../types.js';

export const MOVING: CategoryInput[] = [
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
];
