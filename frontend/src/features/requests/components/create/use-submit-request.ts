/**
 * Posting the request form. A new request goes in one multipart post, idempotent: the same form
 * posted again after a lost or late answer gets the request the first post created (its photos
 * stored once). A draft is saved with its new photos (`PATCH`, keeping the stored ones by id) and
 * then published; the saved photos replace the local ones in the form (`onPhotosSaved`), so posting
 * again after a failed publish sends no file again. A failure says whether the photos explain it
 * (`isPhotoUploadFailure`, counting only photos still being sent).
 */
import { useRef } from 'react';

import { useCreateRequest, usePublishRequest, useUpdateDraftRequest } from '@/hooks';
import {
  requestPhotosToForm,
  toCreateRequestPayload,
  toUpdateDraftRequestPayload,
  type RequestFormPhoto,
  type RequestFormValues,
} from '@/lib/validation';
import { toApiError } from '@/services/api/errors';
import type { CustomerRequestView } from '@/types/domain';

import { isPhotoUploadFailure, newPhotoFiles } from './request-form-model';
import { createSubmissionKeys } from './submission-key';

export type SubmitOutcome = { ok: true; request: CustomerRequestView } | { ok: false; error: unknown; photoFailure: boolean };

export interface SubmitCallbacks {
  /** Whether new photos are on their way (the form says so). */
  onUploading(uploading: boolean): void;
  /** A draft's photos were saved: the form's photos become these (stored, with their `publicId`). */
  onPhotosSaved(photos: RequestFormPhoto[]): void;
}

export function useSubmitRequest(draft: CustomerRequestView | null) {
  const createRequest = useCreateRequest();
  const updateDraft = useUpdateDraftRequest();
  const publishRequest = usePublishRequest();
  const submissionKeys = useRef(createSubmissionKeys()).current;

  return async (values: RequestFormValues, callbacks: SubmitCallbacks): Promise<SubmitOutcome> => {
    const photos = newPhotoFiles(values.photos);
    let sendingPhotos = photos.length > 0;
    callbacks.onUploading(sendingPhotos);
    try {
      if (draft) {
        const updated = await updateDraft.mutateAsync({ requestId: draft.id, payload: toUpdateDraftRequestPayload(values), photos });
        callbacks.onPhotosSaved(requestPhotosToForm(updated.photos));
        sendingPhotos = false;
        callbacks.onUploading(false);
        return { ok: true, request: await publishRequest.mutateAsync(draft.id) };
      }
      const payload = toCreateRequestPayload(values, true);
      const clientRequestId = submissionKeys.keyFor({ payload, photos: photos.map((photo) => photo.uri) });
      return { ok: true, request: await createRequest.mutateAsync({ payload: { ...payload, clientRequestId }, photos }) };
    } catch (error) {
      return { ok: false, error, photoFailure: isPhotoUploadFailure(toApiError(error), sendingPhotos) };
    } finally {
      callbacks.onUploading(false);
    }
  };
}
