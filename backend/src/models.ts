/**
 * Registers every mongoose model. Imported by `server.ts` and the test setup before
 * `syncIndexes()`, so every collection and index exists (autoIndex is off).
 */
export { EmailTokenModel } from './modules/auth/email-token.model.js';
export { SessionModel } from './modules/auth/session.model.js';
export { ConversationModel } from './modules/conversations/conversation.model.js';
export { MessageModel } from './modules/conversations/message.model.js';
export { JobModel } from './modules/jobs/job.model.js';
export { NotificationModel } from './modules/notifications/notification.model.js';
export { OfferModel } from './modules/offers/offer.model.js';
export { ProfessionalModel } from './modules/professionals/professional.model.js';
export { RequestModel } from './modules/requests/request.model.js';
export { ReviewModel } from './modules/reviews/review.model.js';
export { UploadModel } from './modules/uploads/upload.model.js';
export { DeviceModel } from './modules/users/device.model.js';
export { UserModel } from './modules/users/user.model.js';
