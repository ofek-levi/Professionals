/**
 * Hand-written scenario of the two main customers (Noa and Daniel) covering every request state,
 * with consistent offers, jobs, conversations, reviews and notifications.
 */
import { customerShortName } from '../server/queries';
import { PRO_IDS } from './professionals';
import { proName } from './seed-people';
import type { SeedBuilder } from './seed-builder';
import { MAIN_CUSTOMER_IDS } from './users';

/** Stable ids of the scenario entities (used by tests and deep links in the docs). */
export const SEED_IDS = {
  requests: {
    noaDraft: 'req_noa_cabinet_draft',
    noaAc: 'req_noa_ac_open',
    noaLeak: 'req_noa_leak',
    noaLighting: 'req_noa_lighting',
    noaWardrobe: 'req_noa_wardrobe',
    noaDishwasher: 'req_noa_dishwasher',
    noaKidsRoom: 'req_noa_kids_room',
    danielMoving: 'req_daniel_moving',
    danielWifi: 'req_daniel_wifi',
    danielPainting: 'req_daniel_painting',
  },
  offers: {
    leakAvi: 'off_noa_leak_avi',
    leakYossi: 'off_noa_leak_yossi',
    leakEli: 'off_noa_leak_eli',
    lightingYael: 'off_noa_lighting_yael',
    lightingOmer: 'off_noa_lighting_omer',
    wardrobeDana: 'off_noa_wardrobe_dana',
    wardrobeEli: 'off_noa_wardrobe_eli',
    dishwasherMoshe: 'off_noa_dishwasher_moshe',
    kidsRoomAnat: 'off_noa_kids_room_anat',
    movingRami: 'off_daniel_moving_rami',
    movingBoaz: 'off_daniel_moving_boaz',
    movingOfer: 'off_daniel_moving_ofer',
    wifiLior: 'off_daniel_wifi_lior',
  },
  jobs: {
    noaLighting: 'job_noa_lighting',
    noaWardrobe: 'job_noa_wardrobe',
    noaDishwasher: 'job_noa_dishwasher',
    danielWifi: 'job_daniel_wifi',
  },
  conversations: {
    noaLighting: 'cnv_noa_lighting',
    noaWardrobe: 'cnv_noa_wardrobe',
    noaDishwasher: 'cnv_noa_dishwasher',
    danielWifi: 'cnv_daniel_wifi',
  },
  reviews: { noaWardrobe: 'rev_noa_wardrobe' },
} as const;

const R = SEED_IDS.requests;
const O = SEED_IDS.offers;
const J = SEED_IDS.jobs;
const C = SEED_IDS.conversations;

export function seedMainScenario(b: SeedBuilder): void {
  seedNoa(b);
  seedDaniel(b);
}

function seedNoa(b: SeedBuilder): void {
  const { t } = b;
  const noa = MAIN_CUSTOMER_IDS.noa;
  const noaUser = b.db.users.require(noa, 'User');
  const noaName = customerShortName(noaUser);
  const home = b.location('tlv-florentin', 0, 24, 'Apartment 7, 3rd floor, entrance from the courtyard');

  // ── Draft (carpentry) ──
  b.request({
    id: R.noaDraft,
    customerId: noa,
    categoryId: 'carpentry',
    description:
      'Two kitchen cabinet doors are hanging loose – the hinges have torn out of the particle board. Need the hinges fixed or replaced and all the doors aligned.',
    location: home,
    urgency: 'normal',
    notes: 'I’m usually home after 16:00 on weekdays.',
    status: 'draft',
    createdAt: t.daysAgo(2),
  });

  // ── Open, no offers yet (AC) ──
  const acCreated = t.minutesAgo(45);
  b.request({
    id: R.noaAc,
    customerId: noa,
    categoryId: 'hvac',
    description:
      'The living room AC (Electra, about 6 years old) blows warm air and the outdoor unit makes a loud rattling noise. Please check it and refill the gas if needed.',
    location: home,
    urgency: 'urgent',
    preferredSchedule: { date: t.dateKey(1), timeWindow: 'morning' },
    photos: [b.photo(R.noaAc, 1, noa, acCreated)],
    status: 'open',
    createdAt: acCreated,
    publishedAt: t.minutesAgo(40),
  });

  // ── Offers received (bathroom leak) ──
  const leakCreated = t.minutesAgo(310);
  const leakRequest = b.request({
    id: R.noaLeak,
    customerId: noa,
    categoryId: 'plumbing',
    description:
      'Water is leaking inside the wall behind the bathroom sink – there’s a growing damp stain and the paint is bubbling. Probably a pipe in the wall. Need the leak found and repaired.',
    location: home,
    urgency: 'urgent',
    photos: [b.photo(R.noaLeak, 1, noa, leakCreated), b.photo(R.noaLeak, 2, noa, leakCreated)],
    notes: 'The main water valve for the apartment is in the stairwell cabinet.',
    status: 'offers_received',
    createdAt: leakCreated,
    publishedAt: t.minutesAgo(300),
  });
  const aviOfferAt = t.minutesAgo(240);
  b.offer({
    id: O.leakAvi,
    requestId: R.noaLeak,
    professionalId: PRO_IDS.avi,
    price: 650,
    urgency: 'urgent',
    proposedStartAt: b.offerStart(PRO_IDS.avi, t.atDay(1, '09:00'), 120, leakRequest, aviOfferAt),
    estimatedDurationMinutes: 120,
    message:
      'Hi Noa, I work with a thermal camera and an acoustic leak detector, so I can find the leak without breaking unnecessary tiles. The price includes detection and the pipe repair; re-tiling is extra only if needed.',
    createdAt: aviOfferAt,
  });
  const yossiOfferAt = t.minutesAgo(180);
  b.offer({
    id: O.leakYossi,
    requestId: R.noaLeak,
    professionalId: PRO_IDS.yossi,
    price: 480,
    urgency: 'urgent',
    proposedStartAt: t.daytimeSlot(180),
    estimatedDurationMinutes: 90,
    message: 'I can come later today. Price covers finding and fixing the leak; tiles and plaster are not included.',
    createdAt: yossiOfferAt,
  });
  const eliOfferAt = t.minutesAgo(70);
  b.offer({
    id: O.leakEli,
    requestId: R.noaLeak,
    professionalId: PRO_IDS.eli,
    price: 550,
    urgency: 'urgent',
    proposedStartAt: b.offerStart(PRO_IDS.eli, t.atDay(1, '14:00'), 150, leakRequest, eliOfferAt),
    estimatedDurationMinutes: 150,
    message: 'Hello! We’ll open only where needed, fix the pipe and close it up neatly. Includes a 6-month warranty on the repair.',
    createdAt: eliOfferAt,
  });

  // ── Professional selected (lighting with Yael) ──
  const lightingPublished = t.minutesAgo(50 * 60);
  b.request({
    id: R.noaLighting,
    customerId: noa,
    categoryId: 'electrical',
    description:
      'Install 4 new LED spotlights in the kitchen ceiling (gypsum board) and replace the old dimmer switch in the living room.',
    location: home,
    urgency: 'normal',
    status: 'professional_selected',
    acceptedOfferId: O.lightingYael,
    jobId: J.noaLighting,
    createdAt: t.minutesAgo(50 * 60 + 5),
    publishedAt: lightingPublished,
  });
  const acceptedAt = t.minutesAgo(26 * 60);
  const lightingOffer = b.offer({
    id: O.lightingYael,
    requestId: R.noaLighting,
    professionalId: PRO_IDS.yael,
    price: 780,
    proposedStartAt: b.workingSlot(PRO_IDS.yael, t.atDay(2, '10:00'), 180),
    estimatedDurationMinutes: 180,
    message:
      'Hi Noa! Price includes 4 slim LED spotlights, the new dimmer and a safety certificate. I’ll protect the floor and clean up the gypsum dust.',
    status: 'accepted',
    statusReason: 'accepted_by_customer',
    respondedAt: acceptedAt,
    createdAt: t.minutesAgo(47 * 60),
    updatedAt: acceptedAt,
  });
  b.offer({
    id: O.lightingOmer,
    requestId: R.noaLighting,
    professionalId: PRO_IDS.omer,
    price: 850,
    proposedStartAt: t.atDay(3, '12:00'),
    estimatedDurationMinutes: 150,
    message: 'Hi, I can do it on the proposed day. Spotlights not included – I can recommend a model.',
    status: 'rejected',
    statusReason: 'another_offer_accepted',
    respondedAt: acceptedAt,
    createdAt: t.minutesAgo(44 * 60),
    updatedAt: acceptedAt,
  });
  b.conversation({
    id: C.noaLighting,
    jobId: J.noaLighting,
    requestId: R.noaLighting,
    customerId: noa,
    professionalUserId: PRO_IDS.yael,
    createdAt: acceptedAt,
  });
  b.job({
    id: J.noaLighting,
    conversationId: C.noaLighting,
    request: b.db.requests.require(R.noaLighting, 'Request'),
    offer: lightingOffer,
    status: 'awaiting_confirmation',
    createdAt: acceptedAt,
  });
  const lightingMessages: [string, number, string, number | null][] = [
    [PRO_IDS.yael, 25 * 60 + 50, 'Hi Noa, thanks for choosing BrightSpark! I’ll bring 4000K neutral-white spotlights unless you prefer warmer. Is there parking near the building?', 25 * 60],
    [noa, 25 * 60, 'Hi Yael! Warm white (3000K) would be nicer for the kitchen. There’s usually parking on Vital St, and the building code is 1948#.', 24 * 60 + 30],
    [PRO_IDS.yael, 24 * 60 + 30, 'Perfect, 3000K it is. I’ll confirm the exact time shortly.', 20 * 60],
    [noa, 3 * 60, 'Thanks! Could you also take a quick look at the bathroom outlet? It sometimes trips the breaker.', null],
  ];
  lightingMessages.forEach(([senderId, minutesAgo, text, readMinutesAgo], index) =>
    b.message({
      id: `msg_noa_lighting_${index + 1}`,
      conversationId: C.noaLighting,
      senderId,
      text,
      createdAt: t.minutesAgo(minutesAgo),
      readAt: readMinutesAgo === null ? null : t.minutesAgo(readMinutesAgo),
    }),
  );

  // ── Completed with review (wardrobe & TV with Dana) ──
  const wardrobePublished = t.daysAgo(16, '19:10');
  b.request({
    id: R.noaWardrobe,
    customerId: noa,
    categoryId: 'handyman',
    description:
      'Assemble an IKEA PAX wardrobe (2 m wide, sliding doors) and mount a 55" TV on a concrete wall with a tilting bracket.',
    location: home,
    urgency: 'normal',
    status: 'completed',
    acceptedOfferId: O.wardrobeDana,
    jobId: J.noaWardrobe,
    createdAt: t.daysAgo(16, '19:02'),
    publishedAt: wardrobePublished,
  });
  const wardrobeAccepted = t.daysAgo(15, '08:40');
  const wardrobeStart = t.daysAgo(12, '10:00');
  const wardrobeOffer = b.offer({
    id: O.wardrobeDana,
    requestId: R.noaWardrobe,
    professionalId: PRO_IDS.dana,
    price: 640,
    proposedStartAt: wardrobeStart,
    estimatedDurationMinutes: 210,
    message: 'Hi Noa, I’ve assembled dozens of PAX wardrobes. I’ll bring concrete anchors for the TV bracket and hide the cables.',
    status: 'accepted',
    statusReason: 'accepted_by_customer',
    respondedAt: wardrobeAccepted,
    createdAt: t.daysAgo(16, '20:05'),
    updatedAt: wardrobeAccepted,
  });
  b.offer({
    id: O.wardrobeEli,
    requestId: R.noaWardrobe,
    professionalId: PRO_IDS.eli,
    price: 720,
    proposedStartAt: t.daysAgo(13, '15:00'),
    estimatedDurationMinutes: 240,
    status: 'rejected',
    statusReason: 'another_offer_accepted',
    respondedAt: wardrobeAccepted,
    createdAt: t.daysAgo(16, '21:30'),
    updatedAt: wardrobeAccepted,
  });
  b.conversation({
    id: C.noaWardrobe,
    jobId: J.noaWardrobe,
    requestId: R.noaWardrobe,
    customerId: noa,
    professionalUserId: PRO_IDS.dana,
    createdAt: wardrobeAccepted,
  });
  const wardrobeCompleted = t.daysAgo(12, '13:20');
  b.job({
    id: J.noaWardrobe,
    conversationId: C.noaWardrobe,
    request: b.db.requests.require(R.noaWardrobe, 'Request'),
    offer: wardrobeOffer,
    status: 'completed',
    confirmedAt: t.daysAgo(15, '09:30'),
    startedAt: t.daysAgo(12, '10:05'),
    completedAt: wardrobeCompleted,
    completedBy: 'professional',
    reviewId: SEED_IDS.reviews.noaWardrobe,
    createdAt: wardrobeAccepted,
    updatedAt: t.daysAgo(11, '09:15'),
  });
  [
    [PRO_IDS.dana, t.daysAgo(15, '09:31'), 'Hi Noa, confirmed for 10:00. Please make sure the wardrobe boxes are in the bedroom.'],
    [noa, t.daysAgo(15, '10:02'), 'Great, they’re already there. See you!'],
    [PRO_IDS.dana, t.daysAgo(12, '13:25'), 'All done! Thanks for the coffee :) Enjoy the new wardrobe.'],
  ].forEach(([senderId, createdAt, text], index) =>
    b.message({
      id: `msg_noa_wardrobe_${index + 1}`,
      conversationId: C.noaWardrobe,
      senderId,
      text,
      createdAt,
      readAt: b.t.plus(createdAt, 15),
    }),
  );
  const wardrobeReview = b.review({
    id: SEED_IDS.reviews.noaWardrobe,
    jobId: J.noaWardrobe,
    professionalId: PRO_IDS.dana,
    customerId: noa,
    categoryId: 'handyman',
    rating: 5,
    comment:
      'Dana was right on time, super tidy and assembled the wardrobe perfectly. The TV is mounted level and all the cables are hidden. Highly recommend!',
    customerDisplayName: noaName,
    customerAvatarUrl: noaUser.avatarUrl,
    createdAt: t.daysAgo(11, '09:15'),
  });

  // ── Completed without review (dishwasher with Moshe) ──
  b.request({
    id: R.noaDishwasher,
    customerId: noa,
    categoryId: 'appliance_repair',
    description: 'Bosch dishwasher stopped draining and shows error E24. Water stays at the bottom after every cycle.',
    location: home,
    urgency: 'normal',
    status: 'completed',
    acceptedOfferId: O.dishwasherMoshe,
    jobId: J.noaDishwasher,
    createdAt: t.daysAgo(5, '08:10'),
    publishedAt: t.daysAgo(5, '08:12'),
  });
  const dishwasherAccepted = t.daysAgo(4, '09:00');
  const dishwasherOffer = b.offer({
    id: O.dishwasherMoshe,
    requestId: R.noaDishwasher,
    professionalId: PRO_IDS.moshe,
    price: 380,
    proposedStartAt: t.daysAgo(2, '16:00'),
    estimatedDurationMinutes: 60,
    message: 'E24 is almost always a blocked drain pump or hose. Price includes cleaning or replacing the pump filter.',
    status: 'accepted',
    statusReason: 'accepted_by_customer',
    respondedAt: dishwasherAccepted,
    createdAt: t.daysAgo(5, '08:47'),
    updatedAt: dishwasherAccepted,
  });
  b.conversation({
    id: C.noaDishwasher,
    jobId: J.noaDishwasher,
    requestId: R.noaDishwasher,
    customerId: noa,
    professionalUserId: PRO_IDS.moshe,
    createdAt: dishwasherAccepted,
  });
  const dishwasherCompleted = t.daysAgo(2, '17:10');
  const dishwasherJob = b.job({
    id: J.noaDishwasher,
    conversationId: C.noaDishwasher,
    request: b.db.requests.require(R.noaDishwasher, 'Request'),
    offer: dishwasherOffer,
    status: 'completed',
    confirmedAt: t.daysAgo(4, '09:40'),
    startedAt: t.daysAgo(2, '16:05'),
    completedAt: dishwasherCompleted,
    completedBy: 'professional',
    createdAt: dishwasherAccepted,
    updatedAt: dishwasherCompleted,
  });
  [
    [PRO_IDS.moshe, t.daysAgo(4, '09:41'), 'Confirmed – see you at 16:00 on the day. Please empty the lower basket before I arrive.'],
    [PRO_IDS.moshe, t.daysAgo(2, '17:12'), 'The pump was blocked by a piece of glass – cleaned and tested, it drains perfectly now.'],
  ].forEach(([senderId, createdAt, text], index) =>
    b.message({
      id: `msg_noa_dishwasher_${index + 1}`,
      conversationId: C.noaDishwasher,
      senderId,
      text,
      createdAt,
      readAt: b.t.plus(createdAt, 30),
    }),
  );

  // ── Cancelled (kids' room painting) ──
  const kidsRoomCancelled = t.daysAgo(6, '12:30');
  b.request({
    id: R.noaKidsRoom,
    customerId: noa,
    categoryId: 'painting',
    description: 'Paint the kids’ room (about 12 m², walls only) in a light color. A few pieces of furniture need to be moved.',
    location: home,
    urgency: 'flexible',
    status: 'cancelled',
    cancelledAt: kidsRoomCancelled,
    cancellationReason: 'found_elsewhere',
    createdAt: t.daysAgo(9, '21:00'),
    publishedAt: t.daysAgo(9, '21:04'),
    updatedAt: kidsRoomCancelled,
  });
  b.offer({
    id: O.kidsRoomAnat,
    requestId: R.noaKidsRoom,
    professionalId: PRO_IDS.anat,
    price: 1250,
    proposedStartAt: t.daysAgo(3, '08:00'),
    estimatedDurationMinutes: 420,
    status: 'rejected',
    statusReason: 'request_cancelled',
    respondedAt: kidsRoomCancelled,
    createdAt: t.daysAgo(8, '10:15'),
    updatedAt: kidsRoomCancelled,
  });

  // ── Noa's notifications ──
  const leak = b.db.requests.require(R.noaLeak, 'Request');
  b.notification(noa, yossiOfferAt, { type: 'offer_received', offer: b.db.offers.require(O.leakYossi, 'Offer'), categoryId: leak.categoryId, professionalName: proName(PRO_IDS.yossi) }, true);
  b.notification(noa, aviOfferAt, { type: 'offer_received', offer: b.db.offers.require(O.leakAvi, 'Offer'), categoryId: leak.categoryId, professionalName: proName(PRO_IDS.avi) }, true);
  b.notification(noa, eliOfferAt, { type: 'offer_received', offer: b.db.offers.require(O.leakEli, 'Offer'), categoryId: leak.categoryId, professionalName: proName(PRO_IDS.eli) });
  b.notification(noa, t.minutesAgo(24 * 60 + 30), {
    type: 'new_message',
    conversationId: C.noaLighting,
    categoryId: 'electrical',
    senderRole: 'professional',
    senderName: proName(PRO_IDS.yael),
    messageText: lightingMessages[2][2],
  }, true);
  b.notification(noa, dishwasherCompleted, {
    type: 'job_completed',
    job: dishwasherJob,
    recipientRole: 'customer',
    counterpartName: proName(PRO_IDS.moshe),
  });
  b.notification(noa, wardrobeCompleted, {
    type: 'job_completed',
    job: b.db.jobs.require(J.noaWardrobe, 'Job'),
    recipientRole: 'customer',
    counterpartName: proName(PRO_IDS.dana),
  }, true);

  // ── Related professional notifications ──
  b.notification(PRO_IDS.avi, leak.publishedAt ?? leakCreated, { type: 'new_matching_request', request: leak, customerName: noaName, distanceKm: b.distance(PRO_IDS.avi, leak) }, true);
  b.notification(PRO_IDS.yael, acceptedAt, {
    type: 'offer_accepted',
    offer: lightingOffer,
    job: b.db.jobs.require(J.noaLighting, 'Job'),
    customerName: noaName,
  }, true);
  b.notification(PRO_IDS.yael, t.minutesAgo(3 * 60), {
    type: 'new_message',
    conversationId: C.noaLighting,
    categoryId: 'electrical',
    senderRole: 'customer',
    senderName: noaUser.displayName,
    messageText: lightingMessages[3][2],
  });
  b.notification(PRO_IDS.dana, wardrobeReview.createdAt, { type: 'review_received', review: wardrobeReview });
  b.notification(PRO_IDS.moshe, b.db.requests.require(R.noaAc, 'Request').publishedAt ?? acCreated, {
    type: 'new_matching_request',
    request: b.db.requests.require(R.noaAc, 'Request'),
    customerName: noaName,
    distanceKm: b.distance(PRO_IDS.moshe, b.db.requests.require(R.noaAc, 'Request')),
  });
}

function seedDaniel(b: SeedBuilder): void {
  const { t } = b;
  const daniel = MAIN_CUSTOMER_IDS.daniel;
  const danielUser = b.db.users.require(daniel, 'User');
  const danielName = customerShortName(danielUser);
  const home = b.location('rg-center', 0, 45, 'Building B, 4th floor, apartment 12');

  // ── Offers received (moving) ──
  const moveDay = t.workdayOffset(6);
  const movingCreated = t.minutesAgo(22 * 60);
  b.request({
    id: R.danielMoving,
    customerId: daniel,
    categoryId: 'moving',
    description:
      'Moving from a 3-room apartment in Ramat Gan (4th floor, with elevator) to Givatayim (2nd floor, no elevator). About 25 boxes, a double bed, sofa, fridge, washing machine and a dining table for 6.',
    location: home,
    urgency: 'normal',
    preferredSchedule: { date: t.dateKey(moveDay), timeWindow: 'morning' },
    photos: [b.photo(R.danielMoving, 1, daniel, movingCreated)],
    notes: 'The new address is Katznelson St 60, Givatayim. The fridge and washing machine still need to be disconnected.',
    status: 'offers_received',
    createdAt: movingCreated,
    publishedAt: t.minutesAgo(22 * 60 - 3),
  });
  const ramiOfferAt = t.minutesAgo(20 * 60);
  b.offer({
    id: O.movingRami,
    requestId: R.danielMoving,
    professionalId: PRO_IDS.rami,
    price: 2400,
    proposedStartAt: t.atDay(moveDay, '08:00'),
    estimatedDurationMinutes: 360,
    message:
      'Hi Daniel, our crew of 3 with a lift truck. Price includes disassembling and re-assembling the bed and dining table, wrapping the sofa and disconnecting the appliances.',
    createdAt: ramiOfferAt,
  });
  const boazOfferAt = t.minutesAgo(18 * 60);
  b.offer({
    id: O.movingBoaz,
    requestId: R.danielMoving,
    professionalId: PRO_IDS.boaz,
    price: 2150,
    proposedStartAt: t.atDay(moveDay, '09:00'),
    estimatedDurationMinutes: 420,
    message: 'Two movers and a 12-ton truck. Boxes and wrapping materials can be delivered two days before for an extra 150 ₪.',
    createdAt: boazOfferAt,
  });
  const oferOfferAt = t.minutesAgo(6 * 60);
  b.offer({
    id: O.movingOfer,
    requestId: R.danielMoving,
    professionalId: PRO_IDS.ofer,
    price: 2700,
    proposedStartAt: t.atDay(moveDay, '08:30'),
    estimatedDurationMinutes: 300,
    message: 'We specialize in buildings without elevators – 4 movers so you’re settled by lunchtime. Packing materials included.',
    createdAt: oferOfferAt,
  });

  // ── In progress (Wi‑Fi with Lior) ──
  const wifiAccepted = t.daysAgo(2, '11:20');
  b.request({
    id: R.danielWifi,
    customerId: daniel,
    categoryId: 'network_wifi_setup',
    description:
      'Wi‑Fi is weak in the bedrooms and the home office. Need a mesh network (3 units) set up and the printer connected to the new network.',
    location: home,
    urgency: 'normal',
    status: 'in_progress',
    acceptedOfferId: O.wifiLior,
    jobId: J.danielWifi,
    createdAt: t.daysAgo(3, '18:40'),
    publishedAt: t.daysAgo(3, '18:42'),
  });
  const wifiOffer = b.offer({
    id: O.wifiLior,
    requestId: R.danielWifi,
    professionalId: PRO_IDS.lior,
    price: 450,
    proposedStartAt: t.minutesAgo(60),
    estimatedDurationMinutes: 120,
    message: 'Hi Daniel, I’ll bring three TP-Link Deco units (not included in the price) or install yours. Includes printer setup.',
    status: 'accepted',
    statusReason: 'accepted_by_customer',
    respondedAt: wifiAccepted,
    createdAt: t.daysAgo(3, '20:55'),
    updatedAt: wifiAccepted,
  });
  b.conversation({
    id: C.danielWifi,
    jobId: J.danielWifi,
    requestId: R.danielWifi,
    customerId: daniel,
    professionalUserId: PRO_IDS.lior,
    createdAt: wifiAccepted,
  });
  const wifiJob = b.job({
    id: J.danielWifi,
    conversationId: C.danielWifi,
    request: b.db.requests.require(R.danielWifi, 'Request'),
    offer: wifiOffer,
    status: 'in_progress',
    confirmedAt: t.daysAgo(2, '11:45'),
    startedAt: t.minutesAgo(45),
    createdAt: wifiAccepted,
    updatedAt: t.minutesAgo(45),
  });
  const wifiMessages: [string, string, string, string | null][] = [
    [PRO_IDS.lior, t.daysAgo(2, '11:46'), 'Hi Daniel, thanks! Which room has the fiber router?', t.daysAgo(2, '12:10')],
    [daniel, t.daysAgo(2, '12:10'), 'Hi Lior, it’s in the living room. The office is at the far end of the apartment.', t.daysAgo(2, '12:30')],
    [PRO_IDS.lior, t.minutesAgo(50), 'I’m downstairs, coming up now.', t.minutesAgo(48)],
    [PRO_IDS.lior, t.minutesAgo(12), 'The main unit and the hallway unit are up. Placing the third one in the office now – what’s the printer model?', null],
  ];
  wifiMessages.forEach(([senderId, createdAt, text, readAt], index) =>
    b.message({ id: `msg_daniel_wifi_${index + 1}`, conversationId: C.danielWifi, senderId, text, createdAt, readAt }),
  );

  // ── Open, no offers yet (painting) ──
  b.request({
    id: R.danielPainting,
    customerId: daniel,
    categoryId: 'painting',
    description:
      'Repaint the living room and hallway (about 45 m² of walls), including filling a few small cracks. Ceilings are fine. Light gray, paint can be supplied.',
    location: home,
    urgency: 'flexible',
    status: 'open',
    createdAt: t.minutesAgo(125),
    publishedAt: t.minutesAgo(120),
  });

  // ── Notifications ──
  const moving = b.db.requests.require(R.danielMoving, 'Request');
  b.notification(daniel, ramiOfferAt, { type: 'offer_received', offer: b.db.offers.require(O.movingRami, 'Offer'), categoryId: 'moving', professionalName: proName(PRO_IDS.rami) });
  b.notification(daniel, boazOfferAt, { type: 'offer_received', offer: b.db.offers.require(O.movingBoaz, 'Offer'), categoryId: 'moving', professionalName: proName(PRO_IDS.boaz) }, true);
  b.notification(daniel, oferOfferAt, { type: 'offer_received', offer: b.db.offers.require(O.movingOfer, 'Offer'), categoryId: 'moving', professionalName: proName(PRO_IDS.ofer) });
  b.notification(daniel, t.minutesAgo(45), { type: 'job_started', job: wifiJob, professionalName: proName(PRO_IDS.lior) }, true);
  b.notification(daniel, t.minutesAgo(12), {
    type: 'new_message',
    conversationId: C.danielWifi,
    categoryId: 'network_wifi_setup',
    senderRole: 'professional',
    senderName: proName(PRO_IDS.lior),
    messageText: wifiMessages[3][2],
  });
  b.notification(PRO_IDS.rami, moving.publishedAt ?? movingCreated, { type: 'new_matching_request', request: moving, customerName: danielName, distanceKm: b.distance(PRO_IDS.rami, moving) }, true);
  b.notification(PRO_IDS.lior, t.daysAgo(2, '12:10'), {
    type: 'new_message',
    conversationId: C.danielWifi,
    categoryId: 'network_wifi_setup',
    senderRole: 'customer',
    senderName: danielUser.displayName,
    messageText: wifiMessages[1][2],
  }, true);
  b.notification(PRO_IDS.lior, wifiAccepted, {
    type: 'offer_accepted',
    offer: wifiOffer,
    job: wifiJob,
    customerName: danielName,
  }, true);
  const painting = b.db.requests.require(R.danielPainting, 'Request');
  b.notification(PRO_IDS.dana, painting.publishedAt ?? painting.createdAt, { type: 'new_matching_request', request: painting, customerName: danielName, distanceKm: b.distance(PRO_IDS.dana, painting) });
}
