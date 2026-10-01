/**
 * `users`: the account (sign-in identity, profile basics, preferences). Customer-only data
 * (`defaultLocation`) is embedded; a professional's public profile lives in `professionals`.
 */
import { Schema, model, type Types } from 'mongoose';

import { modelTimestamps } from '../../infra/model-clock.js';
import { locationSchema, type LocationDoc } from '../../infra/schema-parts.js';
import { SUPPORTED_LANGUAGES, USER_ROLES, type AppLanguage, type UserRole } from '../../shared/domain.js';
import type { NotificationPreferences } from '../../shared/contract/index.js';

export interface AvatarDoc {
  url: string;
  /** Set when the image is ours (Cloudinary); Google profile pictures have none. */
  publicId: string | null;
}

/** The Terms of Use and Privacy Policy the user accepted at sign-up. */
export interface TermsAcceptanceDoc {
  /** `LEGAL_CONFIG.effectiveDate` of the accepted versions. */
  version: string;
  acceptedAt: Date;
}

export interface UserDoc {
  _id: Types.ObjectId;
  /** Lower-cased sign-in email. */
  email: string;
  /** argon2id hash; absent for Google-only accounts. */
  passwordHash?: string;
  /** Linked Google account id; absent when never linked. */
  googleSub?: string;
  /** Absent until the address is verified (link opened, or Google sign-up/link). */
  emailVerifiedAt?: Date;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  language: AppLanguage;
  avatar: AvatarDoc | null;
  notificationPreferences: NotificationPreferences;
  /** Customers only: the default service address. */
  defaultLocation: LocationDoc | null;
  /** Set at sign-up (password or Google); absent on accounts created before it was recorded. */
  termsAcceptance?: TermsAcceptanceDoc;
  /**
   * Means nothing by itself: bumped (`updatedAt` untouched) at the start of every transaction that
   * creates something for the account (`lockActiveAccount`), a write on the document the deletion
   * writes first, so the two transactions conflict and the later one sees the other's result.
   */
  writeSeq?: number;
  /**
   * The account was deleted (`account-deletion.service.ts`): the document stays as a tombstone
   * (id, role, language, dates) so the other parties' jobs, chats and reviews keep resolving it;
   * everything personal is gone and the email is a placeholder (the real one can sign up again).
   */
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  emailEnabled: false,
  jobUpdates: true,
  messages: true,
  newRequests: true,
  reminders: true,
};

const notificationPreferencesSchema = new Schema<NotificationPreferences>(
  {
    pushEnabled: { type: Boolean, required: true },
    emailEnabled: { type: Boolean, required: true },
    jobUpdates: { type: Boolean, required: true },
    messages: { type: Boolean, required: true },
    newRequests: { type: Boolean, required: true },
    reminders: { type: Boolean, required: true },
  },
  { _id: false },
);

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    googleSub: { type: String },
    emailVerifiedAt: { type: Date },
    role: { type: String, enum: USER_ROLES, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    language: { type: String, enum: SUPPORTED_LANGUAGES, required: true },
    avatar: { type: new Schema<AvatarDoc>({ url: String, publicId: { type: String, default: null } }, { _id: false }), default: null },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      required: true,
      default: () => ({ ...DEFAULT_NOTIFICATION_PREFERENCES }),
    },
    defaultLocation: { type: locationSchema, default: null },
    termsAcceptance: {
      type: new Schema<TermsAcceptanceDoc>({ version: { type: String, required: true }, acceptedAt: { type: Date, required: true } }, { _id: false }),
    },
    writeSeq: { type: Number },
    deletedAt: { type: Date },
  },
  // createdAt = `User.createdAt` / `memberSince`; updatedAt = `CustomerProfile.updatedAt`.
  { timestamps: modelTimestamps(), versionKey: false },
);

// Login, registration duplicate check, password reset request.
userSchema.index({ email: 1 }, { unique: true });
// Google sign-in and sign-up: an account linked to a Google identity is matched by `sub` only.
// Partial on `$exists` (the field is never null): an equality lookup can use such an index, while a
// `$type` filter kept it from being chosen (a collection scan per sign-in).
userSchema.index({ googleSub: 1 }, { unique: true, partialFilterExpression: { googleSub: { $exists: true } }, name: 'googleSub' });

export const UserModel = model<UserDoc>('User', userSchema);

/**
 * Filter of accounts that were not deleted, on `users` and on `professionals` (same ids, both mark
 * `deletedAt`). A deleted account's access tokens outlive it by minutes.
 */
export const NOT_DELETED = { deletedAt: { $exists: false } } as const;
