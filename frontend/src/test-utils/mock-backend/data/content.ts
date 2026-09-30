/**
 * User-generated seed content: request descriptions and review comments. This is data typed by
 * users, so it is not localized through i18n.
 */
import type { CategoryId } from '@/constants/professional-categories';
import { getCategoryById } from '@/constants/professional-categories';
import type { SeededRandom } from '../seeded-random';
import type { AppLanguage, Rating } from '@/types/domain';

// ────────────────────────────── Request descriptions (history) ──────────────────────────────

const DESCRIPTIONS: Partial<Record<CategoryId, string[]>> = {
  plumbing: [
    'The toilet keeps running after every flush and the tank takes ages to refill. Probably the fill valve.',
    'Replace the kitchen faucet with a new pull-out one (already purchased) and fix a slow drain under the sink.',
  ],
  waterproofing_leak_detection: [
    'Damp stain spreading on the ceiling under the bathroom. Need leak detection before the neighbors’ ceiling is affected.',
  ],
  water_heater: [
    'The boiler’s heating element burned out – no hot water unless the sun is strong. Please replace the element and thermostat.',
  ],
  gas_technician: ['Connect a new gas stove and check the building’s gas line for leaks.'],
  electrical: [
    'Add two outlets in the home office and replace an old light fixture in the hallway.',
    'The breaker for the kitchen trips randomly. Need someone to find the fault and fix it.',
  ],
  smart_home: ['Install smart switches in the living room and set up scenes for evening lighting.'],
  security_systems: ['Install two outdoor cameras at the entrance and connect them to an app on my phone.'],
  hvac: [
    'Annual service for 3 split AC units: filter cleaning, gas check and drain line cleaning.',
    'The bedroom AC turns off after a few minutes and shows an error light. Needs diagnosis and repair.',
  ],
  appliance_repair: [
    'Front-loading washing machine doesn’t drain and stops mid-cycle.',
    'Oven heats unevenly and the fan is noisy. Probably the fan motor.',
  ],
  handyman: [
    'Hang curtain rods in 3 rooms, fix a squeaky door and mount a mirror in the bathroom.',
    'Several small repairs before moving in: door handles, a loose kitchen cabinet and shelves in the storage room.',
  ],
  furniture_assembly: ['Assemble a double bed, two night stands and a chest of drawers (IKEA).'],
  painting: [
    'Paint a 3-room apartment (walls only, white) before new tenants move in.',
    'Repaint the living room with an accent wall and fix a few cracks near the windows.',
  ],
  tv_mounting: ['Mount a 55" TV on a drywall wall and hide the cables in a channel.'],
  plastering_drywall: ['Build a drywall partition to split a large bedroom into two small rooms.'],
  flooring_tiling: ['Replace about 12 cracked floor tiles in the kitchen (tiles available).'],
  renovation: ['Small bathroom refresh: new vanity, mirror cabinet, re-grouting and painting.'],
  moving: [
    'Moving a 3-room apartment across Tel Aviv, 2nd floor without elevator to a building with an elevator.',
    'Move a studio apartment: bed, sofa, washing machine and about 15 boxes.',
  ],
  truck_moving: ['Need a truck with a lift and two movers for half a day.'],
  furniture_transport: ['Transport a sofa and a dining table bought second hand from Holon to my apartment.'],
  packing_unpacking: ['Professional packing of a 4-room apartment the day before our move, including fragile kitchenware.'],
  heavy_lifting: ['Carry a large refrigerator up to the 3rd floor (no elevator) and take the old one away.'],
  junk_removal: ['Clear out old furniture and appliances from a storage room after a renovation.'],
  delivery: ['Deliver a washing machine from the store to my apartment and connect it.'],
  computer_it_repair: [
    'Desktop PC is very slow and shows random blue screens. Clean-up, diagnosis and SSD upgrade if needed.',
    'Recover photos from an external hard drive that stopped being recognized.',
  ],
  network_wifi_setup: ['Weak Wi‑Fi on the second floor. Set up a mesh system and configure the router.'],
  locksmith: ['Replace the front door cylinder with a high-security one and make 5 keys.'],
  door_shutter_repair: ['Electric shutter in the living room is stuck halfway. Motor or switch problem.'],
  glass_window_repair: ['Replace a cracked double-glazed window pane in the bedroom.'],
  cleaning: [
    'Deep cleaning of a 4-room apartment before moving in, including windows and kitchen cabinets.',
    'Post-renovation cleaning: dust everywhere, paint stains on floors and window frames.',
  ],
  window_cleaning: ['Clean all windows and shutters of a 5-room apartment on the 7th floor, inside and out.'],
  upholstery_cleaning: ['Steam clean a 3-seat fabric sofa and 4 dining chairs.'],
  carpet_cleaning: ['Deep clean two large wool rugs (pickup and delivery if possible).'],
  pest_control: [
    'Cockroaches in the kitchen and balcony. Need a safe treatment – we have a cat.',
    'Ants keep coming into the kitchen from the balcony. Treatment for the whole apartment.',
  ],
  chimney_vent_cleaning: ['Clean the kitchen hood duct and the dryer vent.'],
  landscaping_gardening: [
    'Monthly garden maintenance: lawn, hedges and seasonal planting (about 80 m²).',
    'Install drip irrigation with a timer for the balcony planters.',
  ],
  tree_services: ['Prune a large ficus tree that touches the house and the electricity wires.'],
  pergolas_decking: ['Build a 4x3 m wooden pergola on the roof terrace.'],
  pool_maintenance: ['Weekly pool maintenance for the summer: cleaning, chemicals and filter check.'],
  solar_panels: ['Quote for a 10 kW rooftop solar system on a private house.'],
};

export function describeHistoricalRequest(categoryId: CategoryId, random: SeededRandom): string {
  const options = DESCRIPTIONS[categoryId];
  if (options && options.length > 0) return random.pick(options);
  return `Looking for help with ${getCategoryById(categoryId).name.en.toLowerCase()} at home. Details and photos on request.`;
}

// ────────────────────────────── Review comments ──────────────────────────────

const REVIEW_COMMENTS: Record<AppLanguage, Record<Rating, string[]>> = {
  en: {
    5: [
      'Arrived on time, explained exactly what needed to be done and left everything spotless. Highly recommended!',
      'Excellent, professional work at a fair price. Even gave us tips to avoid the problem in the future.',
      'Super responsive – sent an offer within minutes and came the same day. Great job.',
      'Very neat and careful work. We will definitely hire again.',
      'Friendly, honest and really knows the job. The final price matched the quote exactly.',
    ],
    4: [
      'Good work and a fair price. Arrived about 20 minutes late but called ahead.',
      'Solid job overall. Needed a short second visit to finish, at no extra cost.',
      'Professional and polite. A bit more expensive than I hoped, but the quality is there.',
    ],
    3: [
      'The job got done, but communication could have been better and it took longer than planned.',
      'Okay result. Had to ask twice for the mess to be cleaned up afterwards.',
    ],
    2: ['Arrived very late and the price went up on site. The work itself is acceptable.'],
    1: ['Did not solve the problem and was hard to reach afterwards.'],
  },
  he: {
    5: [
      'הגיע בזמן, הסביר בדיוק מה צריך לעשות והשאיר הכול נקי. ממליצים בחום!',
      'עבודה מקצועית ומסודרת במחיר הוגן. בהחלט נזמין שוב.',
      'זמינות מעולה – קיבלנו הצעה תוך דקות והעבודה בוצעה באותו יום.',
    ],
    4: ['עבודה טובה ומחיר הוגן. הגיע קצת באיחור אבל עדכן מראש.', 'מקצועי ואדיב. קצת יקר ממה שציפיתי, אבל האיכות מצדיקה.'],
    3: ['העבודה בוצעה, אבל התקשורת הייתה יכולה להיות טובה יותר.'],
    2: ['איחר מאוד והמחיר עלה במקום. העבודה עצמה סבירה.'],
    1: ['הבעיה לא נפתרה וקשה היה להשיג אותו אחר כך.'],
  },
};

/** Weighted rating: mostly 5★ and 4★, occasionally lower. */
export function randomRating(random: SeededRandom): Rating {
  const roll = random.next();
  if (roll < 0.58) return 5;
  if (roll < 0.88) return 4;
  if (roll < 0.97) return 3;
  return 2;
}

/** A review comment (sometimes none, sometimes in Hebrew). */
export function randomReviewComment(rating: Rating, random: SeededRandom): string | null {
  if (random.chance(0.12)) return null;
  const language: AppLanguage = random.chance(0.3) ? 'he' : 'en';
  return random.pick(REVIEW_COMMENTS[language][rating]);
}
