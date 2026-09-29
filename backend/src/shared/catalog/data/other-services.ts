/** Catalog entries: other services. */
import type { CategoryInput } from '../types.js';

export const OTHER_SERVICES: CategoryInput[] = [
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
];
