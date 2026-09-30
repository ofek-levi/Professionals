/**
 * Typed in-memory database of the mock backend.
 *
 * Rows are treated as immutable: `update` always stores a new (shallowly frozen) object. This makes
 * transactions cheap – a snapshot is a shallow copy of every table's row map – and guarantees that
 * views never leak references that could later be mutated.
 */
import { DomainError } from '@/features/shared/domain-error';
import type {
  AppNotification,
  CustomerProfile,
  EntityId,
  ISODateTimeString,
  Job,
  Message,
  Offer,
  OwnProfessionalProfile,
  Review,
  ServiceRequest,
  User,
  UserRole,
} from '@/types/domain';

// ────────────────────────────── Stored row types ──────────────────────────────

/** A user row (exactly the `User` clients receive). */
export type StoredUser = User;

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

/**
 * Sign-in credentials of an account, keyed by the lower-cased email. Plaintext passwords are never
 * stored – only a salted hash (see `server/passwords.ts`).
 */
export interface StoredCredential {
  /** Lower-cased email (primary key). */
  email: string;
  userId: EntityId;
  /** `sha256$<salt>$<hex digest>`; `null` for accounts that only sign in with Google. */
  passwordHash: string | null;
  /** Google account id (`sub`) linked to the account, if any. */
  googleSubject: string | null;
  /**
   * Whether the owner of the email proved it: `true` for Google sign-ups (Google verified it) and
   * seeded accounts; `false` for password sign-ups (the mock never sends a verification email).
   * An unverified password never survives a Google sign-in with the same email (see
   * `signInWithGoogle`).
   */
  emailVerified: boolean;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/** A registered push token; it belongs to the session that registered it (logout removes it). */
export interface StoredDevice {
  id: EntityId;
  userId: EntityId;
  sessionId: EntityId;
  pushToken: string;
  platform: 'ios' | 'android' | 'web';
  registeredAt: ISODateTimeString;
}

/**
 * A signed-in session (one per sign-in), like the backend's `sessions` collection: the current
 * refresh token, the one the last refresh replaced (answered again within the replay window) and
 * the sliding expiry. Access tokens name the session (see `server/tokens.ts`).
 */
export interface StoredSession {
  id: EntityId;
  userId: EntityId;
  refreshToken: string;
  previousRefreshToken: string | null;
  /** When the refresh token last rotated (`null` before the first refresh). */
  rotatedAt: ISODateTimeString | null;
  expiresAt: ISODateTimeString;
  createdAt: ISODateTimeString;
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
  sessions: StoredSession[];
  credentials: StoredCredential[];
}

type TableName = keyof DatabaseTables;

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
    sessions: [],
    credentials: [],
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
    return frozen;
  }

  /** Stores a new version of the row (patch object or updater function). */
  update(id: string, patch: Patch<T>): T {
    const current = this.rows.get(id);
    if (!current) throw new Error(`Row "${id}" not found in table ${this.name}`);
    const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
    const frozen = Object.freeze({ ...next });
    this.rows.set(id, frozen);
    return frozen;
  }

  delete(id: string): boolean {
    return this.rows.delete(id);
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

  /** Replaces every row (used by `load`). */
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
  readonly sessions: Table<StoredSession>;
  readonly credentials: Table<StoredCredential>;

  constructor() {
    this.users = new Table('users', byId);
    this.customerProfiles = new Table('customerProfiles', (row) => row.userId);
    this.professionals = new Table('professionals', byId);
    this.requests = new Table('requests', byId);
    this.offers = new Table('offers', byId);
    this.jobs = new Table('jobs', byId);
    this.reviews = new Table('reviews', byId);
    this.notifications = new Table('notifications', byId);
    this.conversations = new Table('conversations', byId);
    this.messages = new Table('messages', byId);
    this.uploads = new Table('uploads', byId);
    this.devices = new Table('devices', byId);
    this.sessions = new Table('sessions', byId);
    this.credentials = new Table('credentials', (row) => row.email);
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
      sessions: this.sessions,
      credentials: this.credentials,
    };
  }

  /** Replaces all data. */
  load(tables: DatabaseTables): void {
    const all = this.tables();
    (Object.keys(all) as TableName[]).forEach(<N extends TableName>(name: N) => {
      all[name].replaceAll(cloneJson(tables[name] ?? []) as TableRow<N>[]);
    });
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
      sessions: all.sessions.all(),
      credentials: all.credentials.all(),
    });
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
