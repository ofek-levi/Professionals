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
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
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
  },
  // createdAt = `User.createdAt` / `memberSince`; updatedAt = `CustomerProfile.updatedAt`.
  { timestamps: modelTimestamps() },
);

// Login, registration duplicate check, password reset request.
userSchema.index({ email: 1 }, { unique: true });
// Google sign-in: an account linked to a Google identity is matched by `sub` only.
userSchema.index({ googleSub: 1 }, { unique: true, partialFilterExpression: { googleSub: { $type: 'string' } } });

export const UserModel = model<UserDoc>('User', userSchema);
