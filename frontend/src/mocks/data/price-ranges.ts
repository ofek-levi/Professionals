/**
 * Realistic price and duration ranges (ILS, Tel Aviv metro, 2026) per category. Used by the seed
 * data and by the simulator when other professionals send offers.
 */
import type { CategoryId } from '@/constants/professional-categories';
import type { SeededRandom } from '@/features/shared/seeded-random';

interface CategoryPriceRange {
  min: number;
  max: number;
  /** Typical duration range in minutes. */
  durationMinutes: readonly [number, number];
}

const range = (min: number, max: number, durationMin: number, durationMax: number): CategoryPriceRange => ({
  min,
  max,
  durationMinutes: [durationMin, durationMax],
});

export const CATEGORY_PRICE_RANGES: Record<CategoryId, CategoryPriceRange> = {
  plumbing: range(250, 900, 60, 180),
  electrical: range(200, 900, 60, 180),
  hvac: range(250, 1200, 60, 240),
  appliance_repair: range(200, 700, 45, 120),
  handyman: range(180, 700, 60, 240),
  painting: range(800, 6000, 240, 960),
  carpentry: range(300, 2500, 120, 480),
  furniture_assembly: range(150, 900, 60, 240),
  locksmith: range(200, 650, 30, 90),
  glass_window_repair: range(250, 1500, 60, 180),
  door_shutter_repair: range(200, 900, 60, 150),
  roofing: range(1500, 12000, 240, 1440),
  waterproofing_leak_detection: range(450, 2500, 90, 300),
  flooring_tiling: range(1500, 12000, 480, 2400),
  plastering_drywall: range(600, 4500, 240, 960),
  pest_control: range(250, 900, 45, 120),
  cleaning: range(300, 1400, 120, 360),
  home_maintenance: range(250, 1200, 60, 240),
  water_heater: range(250, 1800, 60, 180),
  gas_technician: range(250, 900, 45, 120),
  general_contractor: range(5000, 60000, 1440, 10080),
  masonry: range(1500, 15000, 480, 2880),
  renovation: range(8000, 80000, 2880, 10080),
  kitchen_renovation: range(15000, 90000, 4320, 10080),
  bathroom_renovation: range(12000, 60000, 4320, 10080),
  welding: range(400, 3500, 120, 480),
  ironwork: range(800, 6000, 240, 960),
  aluminum_work: range(800, 8000, 240, 960),
  insulation: range(1000, 9000, 240, 1440),
  landscaping_gardening: range(400, 3500, 120, 480),
  tree_services: range(500, 3500, 120, 480),
  pool_maintenance: range(350, 1500, 60, 240),
  pergolas_decking: range(4000, 25000, 960, 4320),
  moving: range(1500, 6500, 240, 600),
  truck_moving: range(900, 3500, 180, 480),
  furniture_transport: range(350, 1500, 60, 240),
  delivery: range(150, 600, 30, 120),
  junk_removal: range(400, 2500, 90, 300),
  heavy_lifting: range(500, 2500, 60, 240),
  packing_unpacking: range(500, 2500, 180, 480),
  vehicle_towing: range(250, 900, 30, 120),
  computer_it_repair: range(200, 700, 60, 180),
  network_wifi_setup: range(250, 1200, 60, 240),
  security_systems: range(900, 6000, 180, 480),
  solar_panels: range(15000, 60000, 960, 2880),
  water_filtration: range(400, 2500, 60, 180),
  window_cleaning: range(250, 900, 60, 240),
  upholstery_cleaning: range(300, 1200, 60, 180),
  carpet_cleaning: range(250, 900, 60, 180),
  chimney_vent_cleaning: range(300, 1000, 60, 180),
  tv_mounting: range(200, 600, 45, 120),
  smart_home: range(400, 3500, 120, 360),
};

/** Rounds a price the way professionals quote: tens below 1,000, fifties below 5,000, hundreds above. */
function roundQuotePrice(value: number): number {
  const step = value < 1000 ? 10 : value < 5000 ? 50 : 100;
  return Math.max(step, Math.round(value / step) * step);
}

/** A plausible quote within the category range (biased towards the lower-middle of the range). */
export function randomQuote(categoryId: CategoryId, random: SeededRandom): number {
  const { min, max } = CATEGORY_PRICE_RANGES[categoryId];
  const position = (random.next() + random.next()) / 2; // triangular distribution around the middle
  return roundQuotePrice(min + (max - min) * position * 0.8);
}

/** A plausible duration in minutes, aligned to 15 minutes. */
export function randomDuration(categoryId: CategoryId, random: SeededRandom): number {
  const [min, max] = CATEGORY_PRICE_RANGES[categoryId].durationMinutes;
  return Math.round(random.int(min, max) / 15) * 15;
}
