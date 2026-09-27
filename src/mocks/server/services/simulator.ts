/**
 * Demo simulator: makes the marketplace feel alive when exploring the app alone.
 * - After a customer publishes a request, 2–3 matching non-demo professionals send realistic
 *   offers after ~6s, ~15s and ~28s (through the normal lifecycle service).
 * - When a user sends a chat message, the counterpart replies once after ~4s with a
 *   context-appropriate canned reply (in the language the message was written in).
 */
import { APP_CONFIG } from '@/constants/app-config';
import { validateOfferAgainstRequest } from '@/features/offers/offer-rules';
import { findNextWorkingSlot, isWithinWorkingHours } from '@/features/profiles/availability';
import { requestAcceptsOffers } from '@/features/requests/request-status-machine';
import { createSeededRandom, type SeededRandom } from '@/features/shared/seeded-random';
import type { CreateOfferPayload } from '@/types/api';
import type { Message, OwnProfessionalProfile, PreferredTimeWindow, ServiceRequest } from '@/types/domain';
import { addDays, addMinutes, isSameDay, parseDateKey, roundUpToMinutes } from '@/utils/dates';
import { createClientMessageId } from '@/utils/id';

import { cannedReply, offerMessageFor, textLanguage } from '../../data/content';
import { randomDuration, randomQuote } from '../../data/price-ranges';
import { actorForUserId } from '../auth';
import type { ServerContext, ServerHooks, UnitOfWorkRunner } from '../context';
import { activeOfferOf } from '../queries';
import { submitOffer } from './lifecycle-service';
import { findMatchingProfessionals } from './matching-service';
import { counterpartOf, sendMessage } from './messaging-service';

/** Base delays of the simulated offers (a little jitter is added). */
export const SIMULATED_OFFER_DELAYS_MS = [6_000, 15_000, 28_000] as const;
export const AUTO_REPLY_DELAY_MS = 4_000;
/** Client message ids of simulated replies start with this prefix (they never trigger replies). */
export const AUTO_REPLY_ID_PREFIX = 'sim-';

export interface SimulatorDeps {
  /** Runs work in a server unit of work (transaction + event delivery + persistence). */
  run: UnitOfWorkRunner;
  schedule: (callback: () => void, delayMs: number) => void;
  isEnabled: () => boolean;
}

const WINDOW_HOURS: Record<PreferredTimeWindow, readonly [number, number]> = {
  morning: [8, 11],
  afternoon: [12, 16],
  evening: [17, 19],
  any: [9, 16],
};

function atLocalTime(day: Date, hour: number, minute: number): Date {
  const date = new Date(day.getTime());
  date.setHours(hour, minute, 0, 0);
  return date;
}

function randomTimeOnDay(day: Date, window: PreferredTimeWindow, random: SeededRandom): Date {
  const [from, to] = WINDOW_HOURS[window];
  return atLocalTime(day, random.int(from, to), random.pick([0, 15, 30, 45]));
}

/** Urgency-driven first guess for the appointment start. */
function candidateStart(request: ServiceRequest, now: Date, random: SeededRandom): Date {
  const preferredDay = request.preferredSchedule ? parseDateKey(request.preferredSchedule.date) : null;
  if (preferredDay && request.urgency !== 'emergency' && request.preferredSchedule) {
    return randomTimeOnDay(preferredDay, request.preferredSchedule.timeWindow, random);
  }
  switch (request.urgency) {
    case 'emergency':
      return roundUpToMinutes(addMinutes(now, random.int(60, 180)), 15);
    case 'urgent': {
      const laterToday = roundUpToMinutes(addMinutes(now, random.int(120, 300)), 15);
      if (isSameDay(laterToday, now) && laterToday.getHours() >= 8 && laterToday.getHours() < 19) return laterToday;
      return randomTimeOnDay(addDays(now, 1), 'any', random);
    }
    case 'normal':
      return randomTimeOnDay(addDays(now, random.int(1, 3)), 'any', random);
    case 'flexible':
      return randomTimeOnDay(addDays(now, random.int(2, 7)), 'any', random);
  }
}

const isAllowed = (request: ServiceRequest, start: Date, now: Date) =>
  validateOfferAgainstRequest({ proposedStartAt: start, request, now }).isValid;

/**
 * Proposed start respecting urgency (emergency 1–3h, urgent later today/tomorrow, normal 1–3 days,
 * flexible 2–7 days), aligned to 15-minute slots and inside working hours when possible.
 */
export function proposeSimulatedStart(
  request: ServiceRequest,
  professional: Pick<OwnProfessionalProfile, 'availability'>,
  now: Date,
  durationMinutes: number,
  random: SeededRandom,
): Date {
  let start = candidateStart(request, now, random);
  if (request.urgency !== 'emergency' && !isWithinWorkingHours(professional.availability, start, durationMinutes)) {
    const working = findNextWorkingSlot(professional.availability, start, {
      durationMinutes: Math.min(durationMinutes, 8 * 60),
    });
    if (working && isAllowed(request, working, now)) start = working;
  }
  return isAllowed(request, start, now) ? start : roundUpToMinutes(addMinutes(now, 90), 15);
}

/** A realistic offer payload from `professional` for `request`. */
export function generateSimulatedOffer(
  request: ServiceRequest,
  professional: Pick<OwnProfessionalProfile, 'availability'>,
  now: Date,
  random: SeededRandom,
): CreateOfferPayload {
  const durationMinutes = randomDuration(request.categoryId, random);
  return {
    price: randomQuote(request.categoryId, random),
    currency: APP_CONFIG.defaultCurrency,
    proposedStartAt: proposeSimulatedStart(request, professional, now, durationMinutes, random).toISOString(),
    estimatedDurationMinutes: durationMinutes,
    message: offerMessageFor(request.categoryId, textLanguage(request.description), random),
  };
}

export function createSimulator(deps: SimulatorDeps): ServerHooks {
  const conversationsAwaitingReply = new Set<string>();

  const sendSimulatedOffer = (requestId: string, professionalId: string) => {
    if (!deps.isEnabled()) return;
    try {
      deps.run((ctx) => {
        const request = ctx.db.requests.get(requestId);
        const professional = ctx.db.professionals.get(professionalId);
        if (!request || !professional || !requestAcceptsOffers(request.status)) return;
        if (activeOfferOf(ctx.db, requestId, professionalId)) return;
        const actor = actorForUserId(ctx.db, professional.userId);
        if (actor?.role !== 'professional') return;
        const random = createSeededRandom(`offer:${requestId}:${professionalId}`);
        submitOffer(ctx, actor, requestId, generateSimulatedOffer(request, professional, ctx.now(), random));
      });
    } catch {
      // The request may have been cancelled or accepted meanwhile – simply skip this offer.
    }
  };

  const sendAutoReply = (incoming: Message) => {
    conversationsAwaitingReply.delete(incoming.conversationId);
    if (!deps.isEnabled()) return;
    try {
      deps.run((ctx) => {
        const conversation = ctx.db.conversations.get(incoming.conversationId);
        if (!conversation?.isOpen) return;
        const counterpart = counterpartOf(conversation, incoming.senderId);
        const actor = actorForUserId(ctx.db, counterpart.userId);
        if (!actor) return;
        sendMessage(ctx, actor, conversation.id, {
          text: cannedReply(incoming.text, counterpart.role),
          clientMessageId: `${AUTO_REPLY_ID_PREFIX}${createClientMessageId()}`,
        });
      });
    } catch {
      // Conversation closed meanwhile – nothing to do.
    }
  };

  return {
    onRequestPublished(ctx: ServerContext, requestId: string) {
      if (!deps.isEnabled()) return;
      const request = ctx.db.requests.get(requestId);
      if (!request) return;
      const random = createSeededRandom(`simulation:${requestId}`);
      const candidates = findMatchingProfessionals(ctx, request).filter(
        ({ professional }) => ctx.db.users.get(professional.userId)?.isDemo === false,
      );
      const count = Math.min(candidates.length, random.int(2, 3));
      random
        .shuffle(candidates)
        .slice(0, count)
        .forEach(({ professional }, index) => {
          const delay = SIMULATED_OFFER_DELAYS_MS[index] + random.int(-800, 800);
          ctx.afterCommit(() => deps.schedule(() => sendSimulatedOffer(requestId, professional.id), delay));
        });
    },

    onMessageSent(ctx: ServerContext, message: Message) {
      if (!deps.isEnabled()) return;
      if (message.clientMessageId?.startsWith(AUTO_REPLY_ID_PREFIX)) return;
      ctx.afterCommit(() => {
        // One pending reply per conversation: a burst of messages gets a single answer.
        if (conversationsAwaitingReply.has(message.conversationId)) return;
        conversationsAwaitingReply.add(message.conversationId);
        deps.schedule(() => sendAutoReply(message), AUTO_REPLY_DELAY_MS);
      });
    },
  };
}
