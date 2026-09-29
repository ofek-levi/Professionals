/** A job's conversation between a signed-in customer and professional (plus helpers). */
import request from 'supertest';
import type { Express } from 'express';

import type { TestDeps } from '../../../../test/app.js';
import { signInCustomer, signInProfessional, type SignedInCustomer, type SignedInProfessional } from '../../../../test/auth.js';
import { createJob, createOffer, createRequest } from '../../../../test/factories.js';
import type { JobDoc } from '../../jobs/job.model.js';

export interface Chat {
  customer: SignedInCustomer;
  pro: SignedInProfessional;
  job: JobDoc;
  conversationId: string;
  /** `/v1/conversations/:id` */
  path: string;
}

export async function createChat(deps: TestDeps, options: { customer?: SignedInCustomer; pro?: SignedInProfessional } = {}): Promise<Chat> {
  const customer = options.customer ?? (await signInCustomer(deps, { firstName: 'Noa', lastName: 'Levi' }));
  const pro = options.pro ?? (await signInProfessional(deps, { professional: { displayName: 'Avi Fix' } }));
  const serviceRequest = await createRequest(customer.user);
  const offer = await createOffer(serviceRequest, pro.professional, { status: 'accepted' });
  const job = await createJob(serviceRequest, offer);
  const conversationId = job.conversation.toHexString();
  return { customer, pro, job, conversationId, path: `/v1/conversations/${conversationId}` };
}

let sequence = 0;

/** Sends `text` as `sender` (a fresh clientMessageId unless given) and expects 201. */
export async function send(
  app: Express,
  chat: Chat,
  sender: { headers: { Authorization: string } },
  text: string,
  clientMessageId = `client-${++sequence}`,
) {
  const res = await request(app).post(`${chat.path}/messages`).set(sender.headers).send({ text, clientMessageId }).expect(201);
  return res.body as { id: string; clientMessageId: string; createdAt: string; readAt: string | null; senderId: string };
}
