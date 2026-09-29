/** Customer accounts of the demo data set (2 demo customers + non-demo customers). */
import type { LocalizedText } from '@/types/domain';

interface CustomerSeed {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string;
  /** Home address from the gazetteer. */
  home: { placeId: string; streetIndex: number; houseNumber: number; details: string | null };
  memberSinceDaysAgo: number;
  isDemo: boolean;
  demoDescription: LocalizedText | null;
}

export const DEMO_CUSTOMER_IDS = { noa: 'user_noa_levi', daniel: 'user_daniel_cohen' } as const;

export const CUSTOMERS: readonly CustomerSeed[] = [
  {
    id: DEMO_CUSTOMER_IDS.noa,
    firstName: 'Noa',
    lastName: 'Levi',
    avatarUrl: 'https://randomuser.me/api/portraits/women/65.jpg',
    phone: '052-555-1234',
    home: { placeId: 'tlv-florentin', streetIndex: 0, houseNumber: 24, details: 'Apartment 7, 3rd floor, entrance from the courtyard' },
    memberSinceDaysAgo: 540,
    isDemo: true,
    demoDescription: {
      en: 'Customer in Florentin, Tel Aviv. Compare three offers on a bathroom leak, chat with your electrician, review a finished dishwasher repair and continue a saved draft.',
      he: 'לקוחה בפלורנטין, תל אביב. השוו שלוש הצעות לתיקון נזילה באמבטיה, התכתבו עם החשמלאי, כתבו ביקורת על תיקון מדיח שהסתיים והמשיכו טיוטה שמורה.',
    },
  },
  {
    id: DEMO_CUSTOMER_IDS.daniel,
    firstName: 'Daniel',
    lastName: 'Cohen',
    avatarUrl: 'https://randomuser.me/api/portraits/men/46.jpg',
    phone: '054-321-7788',
    home: { placeId: 'rg-center', streetIndex: 0, houseNumber: 45, details: 'Building B, 4th floor, apartment 12' },
    memberSinceDaysAgo: 410,
    isDemo: true,
    demoDescription: {
      en: 'Customer in Ramat Gan. Pick a mover for next week, follow a Wi‑Fi job that is in progress and publish a new request to watch offers arrive live.',
      he: 'לקוח ברמת גן. בחרו מוביל לשבוע הבא, עקבו אחר עבודת Wi‑Fi שנמצאת בביצוע ופרסמו בקשה חדשה כדי לראות הצעות מגיעות בזמן אמת.',
    },
  },
  {
    id: 'user_tamar_shalev',
    firstName: 'Tamar',
    lastName: 'Shalev',
    avatarUrl: 'https://randomuser.me/api/portraits/women/33.jpg',
    phone: '050-841-2290',
    home: { placeId: 'tlv-ramat-aviv', streetIndex: 0, houseNumber: 40, details: '2nd floor' },
    memberSinceDaysAgo: 620,
    isDemo: false,
    demoDescription: null,
  },
  {
    id: 'user_yonatan_barak',
    firstName: 'Yonatan',
    lastName: 'Barak',
    avatarUrl: null,
    phone: '053-777-0142',
    home: { placeId: 'givatayim', streetIndex: 0, houseNumber: 60, details: null },
    memberSinceDaysAgo: 480,
    isDemo: false,
    demoDescription: null,
  },
  {
    id: 'user_maya_goldberg',
    firstName: 'Maya',
    lastName: 'Goldberg',
    avatarUrl: 'https://randomuser.me/api/portraits/women/90.jpg',
    phone: '052-610-4433',
    home: { placeId: 'herzliya-center', streetIndex: 0, houseNumber: 30, details: 'Private house, gate code 2580' },
    memberSinceDaysAgo: 700,
    isDemo: false,
    demoDescription: null,
  },
  {
    id: 'user_itai_mor',
    firstName: 'Itai',
    lastName: 'Mor',
    avatarUrl: 'https://randomuser.me/api/portraits/men/18.jpg',
    phone: '058-902-3311',
    home: { placeId: 'bat-yam', streetIndex: 0, houseNumber: 55, details: '9th floor, apartment 35' },
    memberSinceDaysAgo: 390,
    isDemo: false,
    demoDescription: null,
  },
  {
    id: 'user_shira_avraham',
    firstName: 'Shira',
    lastName: 'Avraham',
    avatarUrl: null,
    phone: '050-266-9001',
    home: { placeId: 'pt-center', streetIndex: 1, houseNumber: 20, details: 'Private house' },
    memberSinceDaysAgo: 450,
    isDemo: false,
    demoDescription: null,
  },
  {
    id: 'user_ronen_klein',
    firstName: 'Ronen',
    lastName: 'Klein',
    avatarUrl: 'https://randomuser.me/api/portraits/men/64.jpg',
    phone: '054-118-5620',
    home: { placeId: 'rishon-center', streetIndex: 0, houseNumber: 80, details: '3rd floor' },
    memberSinceDaysAgo: 560,
    isDemo: false,
    demoDescription: null,
  },
  {
    id: 'user_adi_levin',
    firstName: 'Adi',
    lastName: 'Levin',
    avatarUrl: 'https://randomuser.me/api/portraits/women/21.jpg',
    phone: '052-903-7745',
    home: { placeId: 'kfar-saba', streetIndex: 0, houseNumber: 100, details: '1st floor, apartment 2' },
    memberSinceDaysAgo: 360,
    isDemo: false,
    demoDescription: null,
  },
];
