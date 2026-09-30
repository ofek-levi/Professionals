/**
 * `PUT /me/avatar` (multipart, one image in `avatar`) and `DELETE /me/avatar` (backend/docs/API.md
 * → Users): the avatar is saved at once (the routes answer `CurrentUserResponse`). A professional's
 * profile shows the same photo.
 */
import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';
import { MULTIPART_FIELDS } from '@/types/api';

import type { Actor } from './auth';
import type { ServerContext } from './context';
import { storeImage } from './images';
import { imageFiles, readMultipart } from './multipart';
import { emitProfileUpdated } from './services/notification-service';

function saveAvatar(ctx: ServerContext, actor: Actor, avatarUrl: string | null): void {
  ctx.db.users.update(actor.userId, { avatarUrl });
  if (actor.role === 'professional') {
    ctx.db.professionals.update(actor.professional.id, { avatarUrl });
    emitProfileUpdated(ctx, actor.professional.id);
  }
}

export function setAvatar(ctx: ServerContext, actor: Actor, body: unknown): void {
  const field = MULTIPART_FIELDS.avatar;
  const [file] = imageFiles(readMultipart(body, { field, maxFiles: 1, tooManyFiles: vm('upload.invalid') }).files, field);
  if (!file) throw DomainError.validation({ [field]: [vm('upload.invalid')] }, `Attach the image as the multipart field "${field}"`);
  saveAvatar(ctx, actor, storeImage(ctx, 'avatars', file).url);
}

export function removeAvatar(ctx: ServerContext, actor: Actor): void {
  saveAvatar(ctx, actor, null);
}
