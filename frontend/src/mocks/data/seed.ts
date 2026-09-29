/**
 * Builds the complete demo data set into a database. All timestamps are relative to `now`, ids are
 * deterministic, and every denormalized value (counters, stats) is derived from the source rows.
 */
import { emptyTables, type MockDatabase } from '../server/db';
import { seedDemoScenario } from './scenario-demo';
import { seedHistory } from './scenario-history';
import { seedMarketplace } from './scenario-marketplace';
import { SeedBuilder } from './seed-builder';
import { seedPeople } from './seed-people';

export function seedDatabase(db: MockDatabase, now: Date): void {
  db.load(emptyTables(), now.toISOString());
  const builder = new SeedBuilder(db, now);
  seedPeople(builder);
  seedHistory(builder);
  seedDemoScenario(builder);
  seedMarketplace(builder);
  builder.finalize();
}

export { SEED_IDS } from './scenario-demo';
export { DEMO_CUSTOMER_IDS } from './users';
export { DEMO_PROFESSIONAL_IDS, PRO_IDS } from './professionals';
