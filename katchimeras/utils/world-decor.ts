import type { HomeDayRecord } from '@/types/home';
import type { WorldArchetype, WorldObject } from '@/types/world';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';

// "Decorate your day": the more you LIVE a day (photos, notes, places, a reflection,
// movement, food), the more decorative plants ("blooms") you earn to plant on THAT
// day's patch. Purely expressive — no stat, no nag, no chore. Per-day, persisted.
// Positions live here (col,row, fractional cells); placing/dragging happens in
// world-canvas Decorate mode, clamped to the grass and kept off the real objects.

export type DecorItem = {
  id: string;
  assetKey: string;
  col: number;
  row: number;
  propId?: string;
  sourceLabel?: string;
  earnedFrom?: string;
  sizeScale?: number;
};

const STORAGE_KEY = 'katchadeck.world-decor-v1';
const MAX_BLOOMS = 8;
// Where a freshly-planted decor first lands (front-centre, clear of the back row),
// before the user drags it somewhere. Fractional cell in the patch grid.
const DROP_CELL = { col: 1.5, row: 2.4 };

type DecorStore = Record<string, DecorItem[]>;

function loadStore(): DecorStore {
  const value = getStoredJson<DecorStore>(STORAGE_KEY, {});
  return value && typeof value === 'object' ? value : {};
}

export function loadDayDecor(dayId: string): DecorItem[] {
  const items = loadStore()[dayId];
  return Array.isArray(items) ? items : [];
}

function saveDayDecor(dayId: string, items: DecorItem[]) {
  const store = loadStore();
  store[dayId] = items;
  setStoredJson(STORAGE_KEY, store);
}

// How many plantables the day's REAL living has earned (capped). Each real
// contribution is one "bloom"; an active day adds one more.
export function bloomBudget(day: HomeDayRecord): number {
  const photos = (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0);
  const notes = day.notes?.length ?? 0;
  const places = day.confirmedPlaces?.length ?? 0;
  const reflections = day.promptAnswers?.length ?? 0;
  const food = day.foodMoments?.length ?? 0;
  const studio = day.studioMoments?.length ?? 0;
  const moved = (day.stepsCount ?? 0) >= 4000 ? 1 : 0;
  return Math.min(MAX_BLOOMS, photos + notes + places + reflections + food + studio + moved);
}

export function addDecor(
  dayId: string,
  items: DecorItem[],
  assetKey: string,
  col: number = DROP_CELL.col,
  row: number = DROP_CELL.row,
  meta: Pick<DecorItem, 'propId' | 'sourceLabel' | 'earnedFrom' | 'sizeScale'> = {}
): DecorItem[] {
  const id = `decor-${dayId}-${items.length}-${assetKey}`;
  const next = [...items, { id, assetKey, col, row, ...meta }];
  saveDayDecor(dayId, next);
  return next;
}

export function moveDecor(dayId: string, items: DecorItem[], id: string, col: number, row: number): DecorItem[] {
  const next = items.map((item) => (item.id === id ? { ...item, col, row } : item));
  saveDayDecor(dayId, next);
  return next;
}

export function removeDecor(dayId: string, items: DecorItem[], id: string): DecorItem[] {
  const next = items.filter((item) => item.id !== id);
  saveDayDecor(dayId, next);
  return next;
}

// The plant palette offered, lightly biased by the day's mood (archetype). v1 is a
// shared base set; mood promotes a fitting plant to the front. Keys resolve in
// world-visuals (the decor_plants set).
// The full 16-prop set: trees (incl. cone pine), shrubs, flowers, then props
// (crates, barrel, lantern, signpost, boulder, mushrooms, hay bale).
const BASE: string[] = [
  'decor_1', 'decor_2', 'decor_3', 'decor_4', 'decor_5', 'decor_6', 'decor_7', 'decor_8',
  'decor_9', 'decor_10', 'decor_11', 'decor_12', 'decor_13', 'decor_14', 'decor_15', 'decor_16',
];
const MOOD_LEAD: Partial<Record<WorldArchetype, string>> = {
  calm: 'decor_7', // wildflowers
  meaningful: 'decor_3', // cherry-blossom tree
  social: 'decor_2', // oak — a gathering tree
  active: 'decor_1', // cone pine — the outdoors
};
export function decorPalette(archetype: WorldArchetype): string[] {
  const lead = MOOD_LEAD[archetype];
  if (!lead) return BASE;
  return [lead, ...BASE.filter((key) => key !== lead)];
}

// Relative render size per prop (tight-cropped art fills its square, so without
// this a mushroom cluster would render as big as a tree). Trees read large, ground
// props small. Keyed by assetKey; defaults to 1.
const DECOR_SCALE: Record<string, number> = {
  decor_1: 1.35, // cone pine
  decor_2: 1.35, // oak
  decor_3: 1.3, // blossom tree
  decor_4: 1.3, // birch
  decor_5: 0.85, // shrub
  decor_6: 0.85, // fern
  decor_7: 0.8, // wildflowers
  decor_8: 0.8, // potted plant
  decor_9: 0.85, // crate
  decor_10: 0.95, // crate stack
  decor_11: 0.9, // barrel
  decor_12: 1.15, // lantern post
  decor_13: 1.05, // signpost
  decor_14: 0.9, // boulder
  decor_15: 0.7, // mushrooms
  decor_16: 0.9, // hay bale
};

// Project decor items into render-ready patch objects (category 'decor'). Merged
// into the patch in world.tsx so they render + drag like any other object.
export function decorObjects(items: DecorItem[]): WorldObject[] {
  return items.map((item) => ({
    id: item.id,
    kind: 'prop' as const,
    assetKey: item.assetKey,
    label: item.earnedFrom ?? 'Decor',
    col: item.col,
    row: item.row,
    footprint: 1,
    sourceLabel: item.sourceLabel ?? null,
    category: 'decor',
    sizeScale: item.sizeScale ?? DECOR_SCALE[item.assetKey] ?? 1,
  }));
}
