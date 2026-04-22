/**
 * Compatibility shim — the original meeting-hall page imports these
 * names. The real implementation now lives in `lib/offline-queue.ts`
 * so dtc-logbook can share it without duplication.
 */

import {
  enqueue,
  drainQueue,
  countQueued as countInStore,
  generateClientId as genId,
} from "./offline-queue";

export type BookingPayload = {
  clientId: string;
  fullName: string;
  designation?: string;
  agency: string;
  email: string;
  phone?: string;
  date: string;
  timeSlot: string;
  attendees: string;
  eventType: string;
  purpose?: string;
  clientSubmittedAt: number;
  submittedOffline?: boolean;
};

export const ENDPOINT = "/api/meeting-hall/bookings";
export const STORE = "meetingHallQueue" as const;

export async function enqueueBooking(payload: BookingPayload): Promise<void> {
  await enqueue(STORE, payload);
}

export async function countQueued(): Promise<number> {
  return countInStore(STORE);
}

export async function drainLocalQueue(): Promise<{ sent: number; remaining: number }> {
  return drainQueue(STORE, ENDPOINT);
}

export function generateClientId(): string {
  return genId();
}
