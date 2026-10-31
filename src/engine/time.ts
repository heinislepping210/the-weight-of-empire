import type { Slot, SlotRef } from './types';

// The turn timeline (§3.4a): 2 days per turn, four 6-hour daylight sub-steps, 2-hour battle rounds.
export const SLOTS_PER_TURN = 4;
export const ROUNDS_PER_SLOT = 3;

export function isAfternoon(slot: Slot): boolean {
  return slot === 1 || slot === 3;
}

export function slotIndex(ref: SlotRef): number {
  return (ref.turn - 1) * SLOTS_PER_TURN + ref.slot;
}

/** Day number since the start of the scenario (0-based). */
export function dayIndex(ref: SlotRef): number {
  return (ref.turn - 1) * 2 + (ref.slot < 2 ? 0 : 1);
}

export function nextDaylight(ref: SlotRef): SlotRef {
  return ref.slot === 3 ? { turn: ref.turn + 1, slot: 0 } : { turn: ref.turn, slot: (ref.slot + 1) as Slot };
}

/** Calendar date (ISO) and starting hour of a sub-step, for display only. */
export function calendar(startDate: string, ref: SlotRef): { date: string; hour: number } {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const date = new Date(start + dayIndex(ref) * 86_400_000).toISOString().slice(0, 10);
  return { date, hour: ref.slot % 2 === 0 ? 6 : 12 };
}
