/**
 * Builds the complete seed data set (the test fixtures) into a database. All timestamps are relative to `now`, ids are
 * deterministic, and every denormalized value (counters, stats) is derived from the source rows.
 */
import { emptyTables, type MockDatabase } from '../server/db';
import { seedMainScenario } from './scenario-main';
import { seedHistory } from './scenario-history';
import { seedMarketplace } from './scenario-marketplace';
import { SeedBuilder } from './seed-builder';
import { seedPeople } from './seed-people';

export function seedDatabase(db: MockDatabase, now: Date): void {
  db.load(emptyTables());
  const builder = new SeedBuilder(db, now);
  seedPeople(builder);
  seedHistory(builder);
  seedMainScenario(builder);
  seedMarketplace(builder);
  builder.finalize();
}

export { SEED_IDS } from './scenario-main';
export { MAIN_CUSTOMER_IDS } from './users';
export { MAIN_PRO_IDS, PRO_IDS } from './professionals';
