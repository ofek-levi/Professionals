/** `POST /auth/login`: email + password. */
import type { AppDeps } from '../../deps.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthSession } from '../../shared/contract/index.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import { USER_VIEW_PROJECTION, type UserForView } from '../users/user.views.js';
import type { LoginInput } from './auth.schemas.js';
import { hashPassword, passwordNeedsRehash, verifyPassword } from './passwords.js';
import { signIn } from './sign-in.service.js';

type LoginUser = UserForView & Pick<UserDoc, 'passwordHash'>;

/**
 * The same 401 `INVALID_CREDENTIALS` (after the same argon2 work) for an unknown email, a wrong
 * password and a Google-only account, so the answer does not reveal which accounts exist.
 */
export async function login(deps: Pick<AppDeps, 'env' | 'clock'>, input: LoginInput): Promise<AuthSession> {
  const user = await UserModel.findOne({ email: input.email }, { ...USER_VIEW_PROJECTION, passwordHash: 1 }).lean<LoginUser>();
  const matches = await verifyPassword(user?.passwordHash, input.password);
  if (!user?.passwordHash || !matches) throw ApiError.invalidCredentials();
  if (passwordNeedsRehash(user.passwordHash)) {
    // Hashing parameters were raised since this password was set: upgrade while we have it.
    await UserModel.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(input.password) } });
  }
  return signIn(deps, user);
}
