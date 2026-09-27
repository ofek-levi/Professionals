/**
 * Open requests of non-demo customers spread over the metro area, so every demo professional has
 * several matching jobs on the map (some already with competing offers).
 */
import type { CategoryId } from '@/constants/professional-categories';
import type { PreferredTimeWindow, UrgencyLevel } from '@/types/domain';

import { customerShortName } from '../server/queries';
import { PRO_IDS } from './professionals';
import type { SeedBuilder } from './seed-builder';
import { CUSTOMERS } from './users';

type StartSpec = { daytimeAfterMinutes: number } | { dayOffset: number; time: string };

interface MarketOfferSpec {
  professionalId: string;
  price: number;
  createdMinutesAgo: number;
  start: StartSpec;
  durationMinutes: number;
  message: string;
  /** Seeds a historical expired offer instead of a pending one. */
  expired?: boolean;
}

interface MarketRequestSpec {
  id: string;
  customerId: string;
  categoryId: CategoryId;
  /** Defaults to the customer's home. */
  place?: { placeId: string; streetIndex: number; houseNumber: number; details: string | null };
  urgency: UrgencyLevel;
  description: string;
  notes?: string;
  preferredSchedule?: { dayOffset: number; timeWindow: PreferredTimeWindow };
  photos?: number;
  publishedMinutesAgo: number;
  offers?: MarketOfferSpec[];
  /** Demo professionals that received a `new_matching_request` notification (and whether they read it). */
  notified?: { professionalId: string; read: boolean }[];
}

export const MARKETPLACE_REQUESTS: readonly MarketRequestSpec[] = [
  {
    id: 'req_tamar_sink',
    customerId: 'user_tamar_shalev',
    categoryId: 'plumbing',
    urgency: 'emergency',
    description:
      'Water is pouring out from under the kitchen sink every time we use it – the drain pipe cracked and the cabinet floor is soaked. The main valve is closed for now.',
    photos: 1,
    publishedMinutesAgo: 50,
    notified: [{ professionalId: PRO_IDS.avi, read: false }],
  },
  {
    id: 'req_tamar_tv',
    customerId: 'user_tamar_shalev',
    categoryId: 'tv_mounting',
    urgency: 'flexible',
    description:
      'Mount a 65" TV on the living-room wall (drywall with metal studs) using a full-motion arm, and hide the cables inside the wall.',
    photos: 1,
    publishedMinutesAgo: 26 * 60,
    notified: [{ professionalId: PRO_IDS.dana, read: true }],
  },
  {
    id: 'req_tamar_mom_fixes',
    customerId: 'user_tamar_shalev',
    categoryId: 'handyman',
    place: { placeId: 'tlv-kerem-hateimanim', streetIndex: 0, houseNumber: 9, details: 'My mother’s apartment, ground floor' },
    urgency: 'normal',
    description:
      'A few small jobs at my mother’s place: hang 3 shelves and a mirror, fix a sticking balcony door and replace a broken towel rail.',
    publishedMinutesAgo: 30 * 60,
    offers: [
      {
        professionalId: PRO_IDS.eli,
        price: 450,
        createdMinutesAgo: 26 * 60,
        start: { dayOffset: 2, time: '11:00' },
        durationMinutes: 150,
        message: 'Hi! All four jobs can be done in one visit. I’ll bring wall plugs for old plaster walls.',
      },
    ],
    notified: [{ professionalId: PRO_IDS.dana, read: true }],
  },
  {
    id: 'req_yonatan_boiler',
    customerId: 'user_yonatan_barak',
    categoryId: 'water_heater',
    urgency: 'normal',
    description:
      'The electric boiler takes hours to heat and the water is only lukewarm. Probably the heating element or the thermostat – the tank is about 8 years old.',
    preferredSchedule: { dayOffset: 2, timeWindow: 'afternoon' },
    publishedMinutesAgo: 6 * 60,
    offers: [
      {
        professionalId: PRO_IDS.yossi,
        price: 420,
        createdMinutesAgo: 5 * 60,
        start: { dayOffset: 2, time: '14:00' },
        durationMinutes: 90,
        message: 'Price includes a new element and thermostat (original parts) and descaling the tank.',
      },
    ],
    notified: [{ professionalId: PRO_IDS.avi, read: false }],
  },
  {
    id: 'req_yonatan_power',
    customerId: 'user_yonatan_barak',
    categoryId: 'electrical',
    place: { placeId: 'givatayim', streetIndex: 1, houseNumber: 14, details: '1st floor' },
    urgency: 'emergency',
    description:
      'Half of the apartment has no power since this morning – the main breaker trips as soon as I switch it back on, and there’s a burning smell near the kitchen outlets.',
    publishedMinutesAgo: 180,
    offers: [
      {
        professionalId: PRO_IDS.omer,
        price: 380,
        createdMinutesAgo: 150,
        start: { daytimeAfterMinutes: 90 },
        durationMinutes: 90,
        message: 'Don’t use the kitchen outlets until I check them. I can be there soon – price covers diagnosis and the repair of one circuit.',
      },
      {
        professionalId: PRO_IDS.eli,
        price: 350,
        createdMinutesAgo: 120,
        start: { daytimeAfterMinutes: 120 },
        durationMinutes: 90,
        message: 'Our electrician is nearby. Diagnosis and a standard repair are included.',
      },
    ],
    notified: [{ professionalId: PRO_IDS.yael, read: false }],
  },
  {
    id: 'req_yonatan_ceiling',
    customerId: 'user_yonatan_barak',
    categoryId: 'waterproofing_leak_detection',
    place: { placeId: 'tlv-yad-eliyahu', streetIndex: 0, houseNumber: 21, details: 'Rental apartment, 4th floor' },
    urgency: 'normal',
    description:
      'Water seeps into the ceiling from the upstairs neighbor’s balcony every time it rains. Need leak detection and a quote for waterproofing.',
    photos: 2,
    publishedMinutesAgo: 20 * 60,
    notified: [{ professionalId: PRO_IDS.avi, read: true }],
  },
  {
    id: 'req_yonatan_network',
    customerId: 'user_yonatan_barak',
    categoryId: 'network_wifi_setup',
    urgency: 'normal',
    description:
      'Home office setup: run a network cable to the study, install a small NAS for backups and configure a guest network on the router.',
    publishedMinutesAgo: 90,
    notified: [{ professionalId: PRO_IDS.lior, read: false }],
  },
  {
    id: 'req_maya_switches',
    customerId: 'user_maya_goldberg',
    categoryId: 'smart_home',
    urgency: 'flexible',
    description:
      'Replace 8 regular light switches with smart switches (Wi‑Fi, working with Google Home) and set up a few routines – lights off at midnight, hallway on at sunset.',
    publishedMinutesAgo: 2 * 24 * 60,
    notified: [
      { professionalId: PRO_IDS.yael, read: true },
      { professionalId: PRO_IDS.lior, read: true },
    ],
  },
  {
    id: 'req_maya_laptop',
    customerId: 'user_maya_goldberg',
    categoryId: 'computer_it_repair',
    urgency: 'urgent',
    description:
      'My ThinkPad won’t boot past the logo after a Windows update. I need my work files recovered and the system fixed, ideally today or tomorrow.',
    publishedMinutesAgo: 4 * 60,
    notified: [{ professionalId: PRO_IDS.lior, read: false }],
  },
  {
    id: 'req_itai_ac_leak',
    customerId: 'user_itai_mor',
    categoryId: 'hvac',
    urgency: 'urgent',
    description:
      'The bedroom AC drips water down the wall and onto the floor. The drain line might be blocked – it’s a 3-year-old Tadiran split unit.',
    photos: 2,
    publishedMinutesAgo: 120,
    offers: [
      {
        professionalId: PRO_IDS.moshe,
        price: 350,
        createdMinutesAgo: 100,
        start: { dayOffset: 1, time: '10:00' },
        durationMinutes: 60,
        message: 'Classic blocked drain line. I’ll clear and flush it and check the unit’s tilt. Includes a gas pressure check.',
      },
      {
        professionalId: PRO_IDS.yossi,
        price: 420,
        createdMinutesAgo: 60,
        start: { daytimeAfterMinutes: 300 },
        durationMinutes: 75,
        message: 'Can come later today. Price includes cleaning the drain line and the indoor unit filters.',
      },
    ],
    notified: [{ professionalId: PRO_IDS.moshe, read: true }],
  },
  {
    id: 'req_itai_washer',
    customerId: 'user_itai_mor',
    categoryId: 'appliance_repair',
    urgency: 'normal',
    description: 'LG front-loading washing machine makes a loud banging noise during the spin cycle and moves across the floor.',
    publishedMinutesAgo: 4 * 24 * 60 + 120,
    offers: [
      {
        professionalId: PRO_IDS.moshe,
        price: 290,
        createdMinutesAgo: 4 * 24 * 60 + 60,
        start: { dayOffset: -1, time: '15:00' },
        durationMinutes: 60,
        message: 'Most likely the shock absorbers or the drum bearings. I’ll bring both parts.',
        expired: true,
      },
    ],
    notified: [{ professionalId: PRO_IDS.moshe, read: true }],
  },
  {
    id: 'req_ronen_ac_install',
    customerId: 'user_ronen_klein',
    categoryId: 'hvac',
    urgency: 'flexible',
    description:
      'Install a new 1.5 HP inverter AC in the kids’ room, including about 4 m of piping and a bracket for the outdoor unit on the balcony.',
    preferredSchedule: { dayOffset: 7, timeWindow: 'any' },
    publishedMinutesAgo: 26 * 60,
    offers: [
      {
        professionalId: PRO_IDS.omer,
        price: 950,
        createdMinutesAgo: 24 * 60,
        start: { dayOffset: 7, time: '10:00' },
        durationMinutes: 240,
        message: 'Installation price only (unit not included): piping up to 4 m, bracket, drain and vacuum test.',
      },
    ],
    notified: [{ professionalId: PRO_IDS.moshe, read: false }],
  },
  {
    id: 'req_shira_cameras',
    customerId: 'user_shira_avraham',
    categoryId: 'security_systems',
    urgency: 'normal',
    description:
      'Install 4 outdoor security cameras with night vision and a recorder, viewable from the phone. Two-floor private house; there are power points near two of the locations.',
    preferredSchedule: { dayOffset: 4, timeWindow: 'morning' },
    publishedMinutesAgo: 24 * 60,
    offers: [
      {
        professionalId: PRO_IDS.guy,
        price: 3200,
        createdMinutesAgo: 20 * 60,
        start: { dayOffset: 4, time: '09:00' },
        durationMinutes: 360,
        message: 'Includes 4 Hikvision 4MP cameras, a 1 TB recorder, cabling and app setup. 2-year warranty.',
      },
    ],
    notified: [{ professionalId: PRO_IDS.yael, read: true }],
  },
  {
    id: 'req_shira_storage',
    customerId: 'user_shira_avraham',
    categoryId: 'junk_removal',
    urgency: 'flexible',
    description: 'Clear out a storage room: old furniture, a broken fridge and about 20 bags of stuff. Ground floor, easy access from the street.',
    photos: 1,
    publishedMinutesAgo: 8 * 60,
    notified: [{ professionalId: PRO_IDS.rami, read: false }],
  },
  {
    id: 'req_adi_piano',
    customerId: 'user_adi_levin',
    categoryId: 'heavy_lifting',
    place: { placeId: 'hod-hasharon', streetIndex: 1, houseNumber: 7, details: 'My parents’ house' },
    urgency: 'normal',
    description:
      'Move an upright piano from the living room to the second floor of the same house – internal staircase, 14 steps with one turn.',
    publishedMinutesAgo: 10 * 60,
    notified: [{ professionalId: PRO_IDS.rami, read: false }],
  },
  {
    id: 'req_adi_move',
    customerId: 'user_adi_levin',
    categoryId: 'moving',
    urgency: 'normal',
    description:
      'Moving a 2-room apartment from Kfar Saba to Tel Aviv (Old North). About 15 boxes, a bed, a wardrobe that needs to be taken apart, a sofa and a small fridge.',
    preferredSchedule: { dayOffset: 10, timeWindow: 'morning' },
    publishedMinutesAgo: 5 * 60,
    offers: [
      {
        professionalId: PRO_IDS.boaz,
        price: 1900,
        createdMinutesAgo: 4 * 60,
        start: { dayOffset: 10, time: '08:00' },
        durationMinutes: 300,
        message: 'Truck with a lift and 3 movers. Wardrobe disassembly and assembly included.',
      },
    ],
    notified: [{ professionalId: PRO_IDS.rami, read: true }],
  },
  {
    id: 'req_adi_assembly',
    customerId: 'user_adi_levin',
    categoryId: 'furniture_assembly',
    place: { placeId: 'tlv-old-north', streetIndex: 2, houseNumber: 30, details: 'New apartment, 3rd floor' },
    urgency: 'flexible',
    description: 'Assemble a bed frame, a chest of drawers and two bookcases (IKEA) in my new apartment, and anchor the bookcases to the wall.',
    publishedMinutesAgo: 3 * 60,
    notified: [{ professionalId: PRO_IDS.dana, read: false }],
  },
];

export function seedMarketplace(b: SeedBuilder): void {
  const { t } = b;
  for (const spec of MARKETPLACE_REQUESTS) {
    const customer = CUSTOMERS.find((candidate) => candidate.id === spec.customerId);
    if (!customer) throw new Error(`Unknown customer ${spec.customerId}`);
    const place = spec.place ?? customer.home;
    const createdAt = t.minutesAgo(spec.publishedMinutesAgo + 4);
    const publishedAt = t.minutesAgo(spec.publishedMinutesAgo);
    const scheduleDay = spec.preferredSchedule ? t.workdayOffset(spec.preferredSchedule.dayOffset) : null;
    const request = b.request({
      id: spec.id,
      customerId: spec.customerId,
      categoryId: spec.categoryId,
      description: spec.description,
      location: b.location(place.placeId, place.streetIndex, place.houseNumber, place.details),
      urgency: spec.urgency,
      preferredSchedule:
        spec.preferredSchedule && scheduleDay !== null
          ? { date: t.dateKey(scheduleDay), timeWindow: spec.preferredSchedule.timeWindow }
          : null,
      photos: Array.from({ length: spec.photos ?? 0 }, (_, index) => b.photo(spec.id, index + 1, spec.customerId, createdAt)),
      notes: spec.notes ?? null,
      status: spec.offers?.some((offer) => !offer.expired) ? 'offers_received' : 'open',
      createdAt,
      publishedAt,
    });

    spec.offers?.forEach((offerSpec, index) => {
      const createdOfferAt = t.minutesAgo(offerSpec.createdMinutesAgo);
      const start =
        'daytimeAfterMinutes' in offerSpec.start
          ? t.daytimeSlot(offerSpec.start.daytimeAfterMinutes)
          : offerSpec.start.dayOffset < 0
            ? t.daysAgo(-offerSpec.start.dayOffset, offerSpec.start.time)
            : b.offerStart(
                offerSpec.professionalId,
                t.atDay(scheduleDay ?? t.workdayOffset(offerSpec.start.dayOffset), offerSpec.start.time),
                offerSpec.durationMinutes,
                request,
                createdOfferAt,
              );
      const offer = b.offer({
        id: `off_${spec.id.replace(/^req_/, '')}_${index + 1}`,
        requestId: spec.id,
        professionalId: offerSpec.professionalId,
        price: offerSpec.price,
        urgency: spec.urgency,
        proposedStartAt: start,
        estimatedDurationMinutes: offerSpec.durationMinutes,
        message: offerSpec.message,
        createdAt: createdOfferAt,
      });
      if (offerSpec.expired) {
        const expired = b.db.offers.update(offer.id, { status: 'expired', statusReason: 'expired', updatedAt: offer.expiresAt });
        b.notification(
          offerSpec.professionalId,
          expired.expiresAt,
          { type: 'offer_expired', offer: expired, categoryId: spec.categoryId },
          true,
        );
      }
    });
    const customerName = customerShortName(b.db.users.require(spec.customerId, 'User'));
    for (const { professionalId, read } of spec.notified ?? []) {
      b.notification(
        professionalId,
        publishedAt,
        { type: 'new_matching_request', request, customerName, distanceKm: b.distance(professionalId, request) },
        read,
      );
    }
  }

}
