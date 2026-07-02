import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import type { KingdomBuilding, KingdomCreature, KingdomState } from '@/types/kingdom';
import type { KingdomDecorState, KingdomGift } from '@/utils/kingdom-decor';

// The morning ceremony's memory: what the user has already WITNESSED in the
// Kingdom. On focus the scene diffs the witnessed snapshot against the current
// kingdom — new creatures, fresh gifts, building level-ups — and plays the
// arrivals before marking them witnessed. A persisted "pending" flag (set when
// Today hatches) drives the Kingdom tab badge.

type WitnessedState = {
  version: 1;
  initialized: boolean;
  creatureDayIds: string[];
  levels: Record<string, number>;
  giftIds: string[];
};

const WITNESSED_KEY = 'katchadeck.kingdom-witnessed-v1';
const PENDING_KEY = 'katchadeck.kingdom-arrival-pending-v1';
// Ledger caps — these lists only need to cover what could still be diffed.
const MAX_CREATURE_IDS = 500;
const MAX_GIFT_IDS = 300;

const EMPTY: WitnessedState = { version: 1, initialized: false, creatureDayIds: [], levels: {}, giftIds: [] };

function loadWitnessed(): WitnessedState {
  const value = getStoredJson<WitnessedState>(WITNESSED_KEY, EMPTY);
  return value && typeof value === 'object' && Array.isArray(value.creatureDayIds) ? value : EMPTY;
}

export type KingdomArrivals = {
  creatures: KingdomCreature[];
  gifts: KingdomGift[];
  levelUps: { building: KingdomBuilding; from: number }[];
};

// Gifts granted LIVE from a still-forming day go straight to the shelf — they
// shouldn't pop a ceremony on every mid-day visit, and they shouldn't be marked
// witnessed either, so any left unplanted still parade with tomorrow's arrival.
function isHeld(gift: KingdomGift, holdGiftDayIds?: string[]): boolean {
  return !!gift.provenance.dayId && (holdGiftDayIds ?? []).includes(gift.provenance.dayId);
}

// Everything that arrived since the last witnessed snapshot, or null when the
// morning is quiet. The very first run initializes silently (no retro-parade).
export function deriveKingdomArrivals(
  kingdom: KingdomState,
  decor: KingdomDecorState,
  options: { holdGiftDayIds?: string[] } = {}
): KingdomArrivals | null {
  const witnessed = loadWitnessed();
  if (!witnessed.initialized) {
    witnessKingdom(kingdom, decor, options);
    return null;
  }
  const seenCreatures = new Set(witnessed.creatureDayIds);
  const seenGifts = new Set(witnessed.giftIds);
  const creatures = kingdom.creatures.filter((creature) => !seenCreatures.has(creature.dayId));
  const gifts = decor.unplanted.filter((gift) => !seenGifts.has(gift.id) && !isHeld(gift, options.holdGiftDayIds));
  const levelUps = kingdom.buildings
    .filter((building) => {
      const prev = witnessed.levels[building.id];
      return typeof prev === 'number' && building.level > prev;
    })
    .map((building) => ({ building, from: witnessed.levels[building.id] }));
  if (creatures.length === 0 && gifts.length === 0 && levelUps.length === 0) return null;
  return { creatures, gifts, levelUps };
}

// Record the current kingdom as seen (ceremony finished / first run) and clear
// the tab badge. Held (live-granted, still-forming-day) gifts stay unwitnessed.
export function witnessKingdom(
  kingdom: KingdomState,
  decor: KingdomDecorState,
  options: { holdGiftDayIds?: string[] } = {}
) {
  const next: WitnessedState = {
    version: 1,
    initialized: true,
    creatureDayIds: kingdom.creatures.map((creature) => creature.dayId).slice(0, MAX_CREATURE_IDS),
    levels: Object.fromEntries(kingdom.buildings.map((building) => [building.id, building.level])),
    giftIds: decor.unplanted
      .filter((gift) => !isHeld(gift, options.holdGiftDayIds))
      .map((gift) => gift.id)
      .slice(0, MAX_GIFT_IDS),
  };
  setStoredJson(WITNESSED_KEY, next);
  clearArrivalPending();
}

// --- Tab badge: a persisted flag + in-process subscription -----------------

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((listener) => listener());
}

export function isArrivalPending(): boolean {
  return getStoredJson<boolean>(PENDING_KEY, false) === true;
}

// Called by Today the moment a day hatches — the Kingdom has an arrival waiting.
export function markArrivalPending() {
  setStoredJson(PENDING_KEY, true);
  notify();
}

export function clearArrivalPending() {
  if (isArrivalPending()) {
    setStoredJson(PENDING_KEY, false);
    notify();
  }
}

export function subscribeArrivalPending(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
