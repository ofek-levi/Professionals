/**
 * Typed in-memory database of the mock backend.
 *
 * Rows are treated as immutable: `update` always stores a new (shallowly frozen) object. This makes
 * transactions cheap – a snapshot is a shallow copy of every table's row map – and guarantees that
 * views never leak references that could later be mutated.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DomainError } from '@/features/shared/domain-error';
import type {
  AppNotification,
  CustomerProfile,
  EntityId,
  ISODateTimeString,
  Job,
  LocalizedText,
  Message,
  Offer,
  OwnProfessionalProfile,
  Review,
  ServiceRequest,
  User,
  UserRole,
} from '@/types/domain';

export const MOCK_DB_SCHEMA_VERSION = 3;
const MOCK_DB_STORAGE_KEY = '@professionals/mock-db/v1';

// ────────────────────────────── Stored row types ──────────────────────────────

/** A user row plus demo metadata that is never sent to clients as part of `User`. */
export interface StoredUser extends User {
  isDemo: boolean;
  /** Shown on the demo account picker. */
  demoDescription: LocalizedText | null;
}

/** A job row plus internal scheduler bookkeeping. */
export interface StoredJob extends Job {
  reminderSentAt: ISODateTimeString | null;
}

/** Conversation row; `lastMessage`/`unreadCount`/participant display data are computed per viewer. */
export interface StoredConversation {
  id: EntityId;
  jobId: EntityId;
  requestId: EntityId;
  participants: { userId: EntityId; role: UserRole }[];
  isOpen: boolean;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

interface StoredUpload {
  id: EntityId;
  ownerId: EntityId;
  url: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  fileName: string | null;
  createdAt: ISODateTimeString;
}

interface StoredDevice {
  id: EntityId;
  userId: EntityId;
  pushToken: string;
  platform: 'ios' | 'android' | 'web';
  registeredAt: ISODateTimeString;
}

export interface DatabaseTables {
  users: StoredUser[];
  customerProfiles: CustomerProfile[];
  professionals: OwnProfessionalProfile[];
  requests: ServiceRequest[];
  offers: Offer[];
  jobs: StoredJob[];
  reviews: Review[];
  notifications: AppNotification[];
  conversations: StoredConversation[];
  messages: Message[];
  uploads: StoredUpload[];
  devices: StoredDevice[];
}

type TableName = keyof DatabaseTables;

export interface DatabaseSnapshot {
  version: number;
  /** Clock value the demo data was generated for. */
  seededAt: ISODateTimeString;
  savedAt: ISODateTimeString;
  tables: DatabaseTables;
}

export function emptyTables(): DatabaseTables {
  return {
    users: [],
    customerProfiles: [],
    professionals: [],
    requests: [],
    offers: [],
    jobs: [],
    reviews: [],
    notifications: [],
    conversations: [],
    messages: [],
    uploads: [],
    devices: [],
  };
}

/** Deep copy of JSON-compatible data (simulates serialization boundaries). */
export function cloneJson<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

// ────────────────────────────── Table ──────────────────────────────

type Patch<T> = Partial<T> | ((row: T) => T);

class Table<T extends object> {
  private rows = new Map<string, T>();

  constructor(
    readonly name: TableName,
    private readonly keyOf: (row: T) => string,
    private readonly onChange: () => void,
  ) {}

  get size(): number {
    return this.rows.size;
  }

  get(id: string): T | undefined {
    return this.rows.get(id);
  }

  has(id: string): boolean {
    return this.rows.has(id);
  }

  /** Returns the row or throws `NOT_FOUND` (404) naming the entity. */
  require(id: string, entity: string): T {
    const row = this.rows.get(id);
    if (!row) throw DomainError.notFound(entity, id);
    return row;
  }

  insert(row: T): T {
    const key = this.keyOf(row);
    if (this.rows.has(key)) throw new Error(`Duplicate key "${key}" in table ${this.name}`);
    const frozen = Object.freeze({ ...row });
    this.rows.set(key, frozen);
    this.onChange();
    return frozen;
  }

  /** Stores a new version of the row (patch object or updater function). */
  update(id: string, patch: Patch<T>): T {
    const current = this.rows.get(id);
    if (!current) throw new Error(`Row "${id}" not found in table ${this.name}`);
    const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
    const frozen = Object.freeze({ ...next });
    this.rows.set(id, frozen);
    this.onChange();
    return frozen;
  }

  delete(id: string): boolean {
    const deleted = this.rows.delete(id);
    if (deleted) this.onChange();
    return deleted;
  }

  all(): T[] {
    return [...this.rows.values()];
  }

  filter(predicate: (row: T) => boolean): T[] {
    const result: T[] = [];
    for (const row of this.rows.values()) if (predicate(row)) result.push(row);
    return result;
  }

  find(predicate: (row: T) => boolean): T | undefined {
    for (const row of this.rows.values()) if (predicate(row)) return row;
    return undefined;
  }

  count(predicate?: (row: T) => boolean): number {
    if (!predicate) return this.rows.size;
    let count = 0;
    for (const row of this.rows.values()) if (predicate(row)) count += 1;
    return count;
  }

  /** Replaces every row (used by load/restore). Does not notify. */
  replaceAll(rows: readonly T[]): void {
    this.rows = new Map(rows.map((row) => [this.keyOf(row), Object.freeze({ ...row })]));
  }

  /** Shallow copy of the row map (rows are immutable, so this is a full snapshot). */
  captureState(): Map<string, T> {
    return new Map(this.rows);
  }

  restoreState(state: Map<string, T>): void {
    this.rows = new Map(state);
  }
}

// ────────────────────────────── Database ──────────────────────────────

type TableRow<N extends TableName> = DatabaseTables[N][number];
type TransactionState = { [N in TableName]: Map<string, TableRow<N>> };

const byId = <T extends { id: string }>(row: T) => row.id;

export class MockDatabase {
  readonly users: Table<StoredUser>;
  readonly customerProfiles: Table<CustomerProfile>;
  readonly professionals: Table<OwnProfessionalProfile>;
  readonly requests: Table<ServiceRequest>;
  readonly offers: Table<Offer>;
  readonly jobs: Table<StoredJob>;
  readonly reviews: Table<Review>;
  readonly notifications: Table<AppNotification>;
  readonly conversations: Table<StoredConversation>;
  readonly messages: Table<Message>;
  readonly uploads: Table<StoredUpload>;
  readonly devices: Table<StoredDevice>;

  /** Clock value the current data set was generated for. */
  seededAt: ISODateTimeString = new Date(0).toISOString();

  private listeners = new Set<() => void>();

  constructor() {
    const changed = () => this.listeners.forEach((listener) => listener());
    this.users = new Table('users', byId, changed);
    this.customerProfiles = new Table('customerProfiles', (row) => row.userId, changed);
    this.professionals = new Table('professionals', byId, changed);
    this.requests = new Table('requests', byId, changed);
    this.offers = new Table('offers', byId, changed);
    this.jobs = new Table('jobs', byId, changed);
    this.reviews = new Table('reviews', byId, changed);
    this.notifications = new Table('notifications', byId, changed);
    this.conversations = new Table('conversations', byId, changed);
    this.messages = new Table('messages', byId, changed);
    this.uploads = new Table('uploads', byId, changed);
    this.devices = new Table('devices', byId, changed);
  }

  /** Subscribe to any row change (used for debounced persistence). */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private tables(): { [N in TableName]: Table<TableRow<N>> } {
    return {
      users: this.users,
      customerProfiles: this.customerProfiles,
      professionals: this.professionals,
      requests: this.requests,
      offers: this.offers,
      jobs: this.jobs,
      reviews: this.reviews,
      notifications: this.notifications,
      conversations: this.conversations,
      messages: this.messages,
      uploads: this.uploads,
      devices: this.devices,
    };
  }

  /** Replaces all data. */
  load(tables: DatabaseTables, seededAt: ISODateTimeString): void {
    const all = this.tables();
    (Object.keys(all) as TableName[]).forEach(<N extends TableName>(name: N) => {
      all[name].replaceAll(cloneJson(tables[name] ?? []) as TableRow<N>[]);
    });
    this.seededAt = seededAt;
    this.listeners.forEach((listener) => listener());
  }

  /** Deep, serializable copy of every table. */
  exportTables(): DatabaseTables {
    const all = this.tables();
    return cloneJson({
      users: all.users.all(),
      customerProfiles: all.customerProfiles.all(),
      professionals: all.professionals.all(),
      requests: all.requests.all(),
      offers: all.offers.all(),
      jobs: all.jobs.all(),
      reviews: all.reviews.all(),
      notifications: all.notifications.all(),
      conversations: all.conversations.all(),
      messages: all.messages.all(),
      uploads: all.uploads.all(),
      devices: all.devices.all(),
    });
  }

  snapshot(now: Date): DatabaseSnapshot {
    return { version: MOCK_DB_SCHEMA_VERSION, seededAt: this.seededAt, savedAt: now.toISOString(), tables: this.exportTables() };
  }

  restore(snapshot: DatabaseSnapshot): void {
    this.load(snapshot.tables, snapshot.seededAt);
  }

  /**
   * Runs `work` atomically: if it throws, every table is restored to its previous state and the
   * error is re-thrown.
   */
  transaction<T>(work: () => T): T {
    const all = this.tables();
    const state = Object.fromEntries(
      (Object.keys(all) as TableName[]).map((name) => [name, all[name].captureState()]),
    ) as TransactionState;
    try {
      return work();
    } catch (error) {
      (Object.keys(all) as TableName[]).forEach(<N extends TableName>(name: N) => {
        (all[name] as Table<TableRow<N>>).restoreState(state[name] as Map<string, TableRow<N>>);
      });
      throw error;
    }
  }
}

// ────────────────────────────── Persistence ──────────────────────────────

export interface DatabaseStorage {
  load(): Promise<DatabaseSnapshot | null>;
  save(snapshot: DatabaseSnapshot): Promise<void>;
  clear(): Promise<void>;
}

function isSnapshot(value: unknown): value is DatabaseSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DatabaseSnapshot>;
  return typeof candidate.version === 'number' && typeof candidate.seededAt === 'string' && !!candidate.tables;
}

/** AsyncStorage-backed storage. Corrupt data is treated as missing (the server then reseeds). */
export function createAsyncStorageDatabaseStorage(key = MOCK_DB_STORAGE_KEY): DatabaseStorage {
  return {
    async load() {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return isSnapshot(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    async save(snapshot) {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(snapshot));
      } catch {
        // Persistence is best effort – the in-memory database stays authoritative.
      }
    },
    async clear() {
      try {
        await AsyncStorage.removeItem(key);
      } catch {
        // Ignore.
      }
    },
  };
}

interface DebouncedSaver {
  schedule(): void;
  flush(): Promise<void>;
  cancel(): void;
}

/** Coalesces bursts of changes into one save after `delayMs` of quiet. */
export function createDebouncedSaver(save: () => Promise<void>, delayMs = 300): DebouncedSaver {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void save();
      }, delayMs);
    },
    async flush() {
      if (timer) clearTimeout(timer);
      timer = null;
      await save();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
