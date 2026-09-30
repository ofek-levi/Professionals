/**
 * Avatars (backend/docs/API.md → Avatars): `avatarUrl` must be the URL of one of the caller's own
 * uploads that is not attached to a request, the current avatar (no-op) or `null` (remove);
 * anything else is refused, so a profile never makes other apps load an arbitrary URL.
 */
import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';

import type { ServerContext } from './context';

export function assertAvatarUrl(ctx: ServerContext, userId: string, avatarUrl: string | null | undefined): void {
  if (avatarUrl === undefined || avatarUrl === null) return;
  if (ctx.db.users.get(userId)?.avatarUrl === avatarUrl) return;
  const upload = ctx.db.uploads.find((candidate) => candidate.ownerId === userId && candidate.url === avatarUrl);
  const attached = upload && ctx.db.requests.find((request) => request.photos.some((photo) => photo.id === upload.id));
  if (!upload || attached) throw DomainError.validation({ avatarUrl: [vm('invalid')] }, 'The avatar must be one of your uploads');
}
