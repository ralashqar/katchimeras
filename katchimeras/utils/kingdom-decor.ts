import type { HomeDayRecord } from '@/types/home';
import type { WorldObject } from '@/types/world';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { decorObjects, type DecorItem } from '@/utils/world-decor';
import { EARNED_WORLD_PROPS } from '@/utils/world-props-catalog';

// Kingdom decoration (docs/kingdom-world-design.md §3): decorations are earned
// by LIVING and accumulate forever in the one Kingdom — replacing the per-day
// "blooms" that reset with each patch. Life earns props (daily signal rules +
// the starter seed); Essence only ever styles them. Every item carries
// provenance — where in a real life it came from.

export type KingdomProvenance = {
  kind: 'day' | 'starter' | 'legacy' | 'discovery';
  // "A 12k-step day", "First Seed", "Earned from First Museum"
  label: string;
  isoDate: string;
  dayId?: string;
};

export type KingdomGift = {
  id: string; // grant id — one per (day, rule)
  assetKey: string;
  name: string;
  sizeScale?: number;
  provenance: KingdomProvenance;
};

export type KingdomDecorItem = {
  id: string;
  assetKey: string;
  name: string;
  col: number;
  row: number;
  // null = the centre island; expansion plots (K4) get their own ids.
  plotId: string | null;
  sizeScale?: number;
  provenance: KingdomProvenance;
};

export type KingdomDecorState = {
  version: 1;
  // Grants already issued (or baselined away) — a gift is never granted twice.
  grantedIds: string[];
  // First sync marks history as granted without flooding gifts (see sync).
  baselined: boolean;
  migratedLegacy: boolean;
  placed: KingdomDecorItem[];
  unplanted: KingdomGift[];
  // Retired daily planting allowance — kept in stored data from older builds,
  // no longer read (planting is limited only by what the shelf holds).
  plantLedger?: { isoDate: string; count: number };
};

const STORAGE_KEY = 'katchadeck.kingdom-decor-v1';
const LEGACY_DAY_DECOR_KEY = 'katchadeck.world-decor-v1';
// How many legacy per-day placements carry over onto the island (newest first).
// Legacy decor was only ever visible one day at a time — hoisting every planting
// from months of days would bury the Kingdom (and the renderer).
const LEGACY_HOIST_CAP = 48;
// The baseline pass creates real gifts only for the most recent hatched days,
// so a long history doesn't open as a wall of presents.
const BASELINE_GIFT_DAYS = 3;
// A day can earn at most this many props (rule order = priority).
const MAX_DAILY_GIFTS = 2;
// Where a freshly-planted gift first lands before the user drags it.
const DROP_CELL = { col: 1.5, row: 2.4 };

const EMPTY_STATE: KingdomDecorState = {
  version: 1,
  grantedIds: [],
  baselined: false,
  migratedLegacy: false,
  placed: [],
  unplanted: [],
};

export function loadKingdomDecor(): KingdomDecorState {
  const value = getStoredJson<KingdomDecorState>(STORAGE_KEY, EMPTY_STATE);
  return value && typeof value === 'object' && Array.isArray(value.placed) ? value : EMPTY_STATE;
}

export function saveKingdomDecor(state: KingdomDecorState) {
  setStoredJson(STORAGE_KEY, state);
}

// --- Daily earning rules --------------------------------------------------
// Signal → prop, evaluated once per hatched day, deterministic. Assets come
// from the existing decor palette; bespoke prop families arrive in K5 behind
// these same rule ids. Order = priority when a day matches more than two.

type DailyRule = {
  id: string;
  assetKey: string;
  name: string;
  sizeScale?: number;
  // Static almanac copy: how a day earns this.
  hint: string;
  label: (day: HomeDayRecord) => string;
  when: (day: HomeDayRecord) => boolean;
};

function reflectionCount(day: HomeDayRecord): number {
  return (day.promptAnswers ?? []).filter((answer) => !answer.dismissed && answer.choiceIds.length > 0).length;
}

const DAILY_RULES: DailyRule[] = [
  {
    id: 'big_moment_blossom',
    hint: 'Mark a Big Moment',
    assetKey: 'festival_bunting',
    name: 'Festival Bunting',
    sizeScale: 1.1,
    label: (day) => day.bigMoments?.[0]?.label ?? 'A big moment',
    when: (day) => (day.bigMoments?.length ?? 0) > 0,
  },
  {
    id: 'journey_stone',
    hint: '8,000+ steps, or a hike',
    assetKey: 'trail_stone',
    name: 'Trail Stone',
    label: (day) => `${(day.stepsCount ?? 0).toLocaleString()} steps in one day`,
    when: (day) => (day.stepsCount ?? 0) >= 8000 || day.stepsInterpretation?.movement === 'hike',
  },
  {
    id: 'wayfinder_post',
    hint: 'Give a place its meaning',
    assetKey: 'decor_13',
    name: 'Wayfinder Post',
    label: (day) => {
      const place = day.confirmedPlaces?.[0];
      return place ? `${place.label} · a place given meaning` : 'A place given meaning';
    },
    when: (day) => (day.confirmedPlaces?.length ?? 0) > 0,
  },
  {
    id: 'market_crate',
    hint: 'Save a food memory',
    assetKey: 'picnic_basket',
    name: 'Picnic Basket',
    label: (day) => {
      const food = day.foodMoments?.[0];
      return food ? `${food.emoji} ${food.label} · savoured` : 'A meal savoured';
    },
    when: (day) => (day.foodMoments?.length ?? 0) > 0,
  },
  {
    id: 'study_planter',
    hint: 'Keep an inspiration',
    assetKey: 'book_stack',
    name: 'Book Stack',
    label: (day) => {
      const studio = day.studioMoments?.[0];
      return studio ? `${studio.emoji} ${studio.label} · an inspiration` : 'An inspiration kept';
    },
    when: (day) => (day.studioMoments?.length ?? 0) > 0,
  },
  {
    id: 'reflection_flowers',
    hint: 'Answer 3 reflections in a day',
    assetKey: 'decor_7',
    name: 'Wildflowers',
    label: () => 'A deeply reflected day',
    when: (day) => reflectionCount(day) >= 3,
  },
  {
    id: 'keeper_lantern',
    hint: 'Keep 2 notes in a day',
    assetKey: 'decor_12',
    name: 'Keeper’s Lantern',
    sizeScale: 1.15,
    label: (day) => `${day.notes?.length ?? 0} notes kept in one day`,
    when: (day) => (day.notes?.length ?? 0) >= 2,
  },
];

function dayGrants(day: HomeDayRecord): { grantId: string; rule: DailyRule }[] {
  return DAILY_RULES.filter((rule) => rule.when(day))
    .slice(0, MAX_DAILY_GIFTS)
    .map((rule) => ({ grantId: `${day.id}:${rule.id}`, rule }));
}

// --- Lane A: everyday blooms (docs §3.2) -----------------------------------
// Ordinary living accrues bloom points; every BLOOM_POINTS_PER_GIFT points is a
// common green gift (tree/shrub/flower), capped per day. The first week of the
// archive earns at a friendlier rate so a new Kingdom greens up fast.

export const BLOOM_POINTS_PER_GIFT = 3;
const FOUNDING_POINTS_PER_GIFT = 2;
const FOUNDING_DAYS = 7;
export const MAX_BLOOM_GIFTS_PER_DAY = 3;

// The signature earns the day has fired so far (for Today's earnings sheet) —
// same rules + cap the hatch grant uses.
export function signatureEarnsForDay(day: HomeDayRecord): { id: string; name: string; assetKey: string; label: string }[] {
  return dayGrants(day).map(({ rule }) => ({ id: rule.id, name: rule.name, assetKey: rule.assetKey, label: rule.label(day) }));
}

export function bloomPointsForDay(day: HomeDayRecord): number {
  let points = 0;
  points += (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0); // photos given meaning
  points += day.notes?.length ?? 0;
  points += (day.confirmedPlaces?.length ?? 0) * 2;
  points += (day.promptAnswers ?? []).filter((answer) => !answer.dismissed && answer.choiceIds.length > 0).length;
  points += day.foodMoments?.length ?? 0;
  points += day.studioMoments?.length ?? 0;
  const steps = day.stepsCount ?? 0;
  if (steps >= 4000) points += 1;
  if (steps >= 8000) points += 1;
  points += (day.seedCompletions?.length ?? 0); // completed quests
  if (day.sleep) points += 1;
  return points;
}

// The commons pool — existing decor art, one entry per green thing.
const COMMONS: { assetKey: string; name: string }[] = [
  { assetKey: 'decor_1', name: 'Pine Tree' },
  { assetKey: 'decor_2', name: 'Oak Tree' },
  { assetKey: 'decor_4', name: 'Birch Tree' },
  { assetKey: 'decor_3', name: 'Blossom Tree' },
  { assetKey: 'decor_5', name: 'Garden Shrub' },
  { assetKey: 'decor_6', name: 'Fern' },
  { assetKey: 'decor_7', name: 'Wildflowers' },
  { assetKey: 'decor_15', name: 'Mushroom Cluster' },
  { assetKey: 'decor_8', name: 'Garden Planter' },
];

// The day's mood promotes a fitting plant to its FIRST bloom (same leads as
// world-decor's decorPalette).
function commonsBias(day: HomeDayRecord): string | null {
  if ((day.bigMoments?.length ?? 0) > 0) return 'decor_3'; // blossom — meaningful
  if ((day.capturedMeanings ?? []).some((meaning) => meaning.archetype === 'together')) return 'decor_2'; // oak — social
  if ((day.stepsCount ?? 0) >= 8000) return 'decor_1'; // pine — the outdoors
  if ((day.promptAnswers ?? []).some((answer) => !answer.dismissed && answer.choiceIds.includes('calm'))) {
    return 'decor_7'; // wildflowers — calm
  }
  return null;
}

// Deterministic pick — no randomness, so re-syncing always grants the same gift.
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function bloomGrants(day: HomeDayRecord, foundingBoost: boolean): { grantId: string; assetKey: string; name: string; points: number }[] {
  const points = bloomPointsForDay(day);
  const perGift = foundingBoost ? FOUNDING_POINTS_PER_GIFT : BLOOM_POINTS_PER_GIFT;
  const count = Math.min(MAX_BLOOM_GIFTS_PER_DAY, Math.floor(points / perGift));
  const bias = commonsBias(day);
  return Array.from({ length: count }, (_, index) => {
    const pick =
      index === 0 && bias
        ? COMMONS.find((entry) => entry.assetKey === bias) ?? COMMONS[hashString(`${day.id}:${index}`) % COMMONS.length]
        : COMMONS[hashString(`${day.id}:${index}`) % COMMONS.length];
    return { grantId: `${day.id}:bloom:${index}`, assetKey: pick.assetKey, name: pick.name, points };
  });
}

// --- Lane C: achievement earns (discoveries + noticed patterns) -------------
// A Discovery unlock grants its mapped prop (world-props-catalog); unmapped
// discoveries fall back by rarity tier. Pattern props (observation/mood
// unlocks) grant once when they first fire. Unlike lanes A/B, history is
// GRANTED as real gifts on the baseline pass — achievements feel owed.

export type UnlockedDiscoveryInput = { id: string; name: string; rarity?: string | null; unlockedAt?: number | null };
export type PatternPropInput = { id: string; assetKey: string; name: string; sourceLabel: string; sizeScale?: number };

const DISCOVERY_PROP_BY_SOURCE = new Map(
  EARNED_WORLD_PROPS.filter((def) => def.unlockKind === 'discovery' && def.unlockSourceId).map((def) => [
    def.unlockSourceId as string,
    def,
  ])
);

const TIER_FALLBACK: Record<string, { assetKey: string; name: string; sizeScale?: number }> = {
  common: { assetKey: 'decor_4', name: 'Discovery Sapling' },
  rare: { assetKey: 'decor_12', name: 'Honour Lantern', sizeScale: 1.15 },
  epic: { assetKey: 'monument_stone', name: 'Milestone Stone', sizeScale: 1.15 },
  legendary: { assetKey: 'monument_shard', name: 'Monument Shard', sizeScale: 1.3 },
};

function discoveryGrants(unlocked: UnlockedDiscoveryInput[]): { grantId: string; gift: KingdomGift }[] {
  return unlocked.map((discovery) => {
    const isoDate = discovery.unlockedAt ? new Date(discovery.unlockedAt).toISOString().slice(0, 10) : '';
    const mapped = DISCOVERY_PROP_BY_SOURCE.get(discovery.id);
    if (mapped) {
      return {
        grantId: `prop:${mapped.id}`,
        gift: {
          id: `prop:${mapped.id}`,
          assetKey: mapped.assetKey,
          name: mapped.name,
          sizeScale: mapped.sizeScale,
          provenance: { kind: 'discovery' as const, label: mapped.sourceLabel, isoDate },
        },
      };
    }
    const fallback = TIER_FALLBACK[discovery.rarity ?? 'common'] ?? TIER_FALLBACK.common;
    return {
      grantId: `disc:${discovery.id}`,
      gift: {
        id: `disc:${discovery.id}`,
        assetKey: fallback.assetKey,
        name: fallback.name,
        sizeScale: fallback.sizeScale,
        provenance: { kind: 'discovery' as const, label: `Earned from ${discovery.name}`, isoDate },
      },
    };
  });
}

// --- Legacy migration -----------------------------------------------------

type LegacyStore = Record<string, DecorItem[]>;

function hoistLegacyDecor(state: KingdomDecorState, days: HomeDayRecord[]): KingdomDecorState {
  const legacy = getStoredJson<LegacyStore>(LEGACY_DAY_DECOR_KEY, {});
  if (!legacy || typeof legacy !== 'object') return { ...state, migratedLegacy: true };
  const isoByDayId = new Map(days.map((day) => [day.id, day.isoDate]));
  const entries = Object.entries(legacy)
    .flatMap(([dayId, items]) => (Array.isArray(items) ? items.map((item) => ({ dayId, item })) : []))
    // Newest days keep their plantings; older overflow was only ever day-scoped.
    .sort((a, b) => (isoByDayId.get(b.dayId) ?? '').localeCompare(isoByDayId.get(a.dayId) ?? ''))
    .slice(0, LEGACY_HOIST_CAP);
  const placed: KingdomDecorItem[] = entries.map(({ dayId, item }) => ({
    id: `legacy-${dayId}-${item.id}`,
    assetKey: item.assetKey,
    name: item.earnedFrom ?? 'Keepsake',
    col: item.col,
    row: item.row,
    plotId: null,
    sizeScale: item.sizeScale,
    provenance: {
      kind: 'legacy',
      label: item.sourceLabel ?? item.earnedFrom ?? 'Planted in an earlier world',
      isoDate: isoByDayId.get(dayId) ?? '',
      dayId,
    },
  }));
  return { ...state, migratedLegacy: true, placed: [...state.placed, ...placed] };
}

// --- Sync (migration + granting) — call with the full day archive ----------
// Lanes A (blooms) + B (signature rules) grant per hatched day; lane C
// (achievements) grants per unlock. Baseline: A/B history is marked granted
// silently (gifts only for the last few days); C history becomes real gifts.

export function syncKingdomDecorFromDays(
  days: HomeDayRecord[],
  options: { unlockedDiscoveries?: UnlockedDiscoveryInput[]; patternProps?: PatternPropInput[] } = {}
): KingdomDecorState {
  let state = loadKingdomDecor();
  let changed = false;

  if (!state.migratedLegacy) {
    state = hoistLegacyDecor(state, days);
    changed = true;
  }

  const hatched = days.filter((day) => day.state === 'hatched');
  const granted = new Set(state.grantedIds);
  const firstIso = days[0]?.isoDate ?? '';
  const foundingCutoff = firstIso ? addDaysIso(firstIso, FOUNDING_DAYS) : '';
  const isFounding = (day: HomeDayRecord) => !!foundingCutoff && day.isoDate < foundingCutoff;

  // Cap-aware rule grants: with live granting a day is visited many times
  // before it hatches, so the "2 signature gifts a day" cap must count what
  // this day has ALREADY been granted, not just what matches right now.
  const ruleGiftsFor = (day: HomeDayRecord): { grantId: string; rule: DailyRule }[] => {
    const alreadyGranted = DAILY_RULES.filter((rule) => granted.has(`${day.id}:${rule.id}`)).length;
    const allowance = Math.max(0, MAX_DAILY_GIFTS - alreadyGranted);
    return DAILY_RULES.filter((rule) => rule.when(day) && !granted.has(`${day.id}:${rule.id}`))
      .slice(0, allowance)
      .map((rule) => ({ grantId: `${day.id}:${rule.id}`, rule }));
  };

  const dayGiftsFor = (day: HomeDayRecord): { grantId: string; gift: KingdomGift }[] => [
    ...ruleGiftsFor(day).map(({ grantId, rule }) => ({
      grantId,
      gift: {
        id: grantId,
        assetKey: rule.assetKey,
        name: rule.name,
        sizeScale: rule.sizeScale,
        provenance: { kind: 'day' as const, label: rule.label(day), isoDate: day.isoDate, dayId: day.id },
      },
    })),
    ...bloomGrants(day, isFounding(day)).map(({ grantId, assetKey, name, points }) => ({
      grantId,
      gift: {
        id: grantId,
        assetKey,
        name,
        provenance: {
          kind: 'day' as const,
          label: `A day of ${points} ${points === 1 ? 'moment' : 'moments'}`,
          isoDate: day.isoDate,
          dayId: day.id,
        },
      },
    })),
  ];

  const wasBaselined = state.baselined;
  const gifts: KingdomGift[] = [];
  const recent = new Set(hatched.slice(-BASELINE_GIFT_DAYS).map((day) => day.id));
  for (const day of hatched) {
    for (const { grantId, gift } of dayGiftsFor(day)) {
      if (granted.has(grantId)) continue;
      granted.add(grantId);
      // Baseline pass: only the last few days open as real gifts.
      if (wasBaselined || recent.has(day.id)) gifts.push(gift);
      changed = true;
    }
  }

  // Live earning: the still-forming day grants AS IT GOES — anything earned
  // today is on the shelf and plantable today, no waiting for the hatch.
  // Grant ids are deterministic, so the hatch pass later simply finds them
  // already granted (rules that fired mid-day stay granted; blooms only ever
  // add indices as points accumulate).
  for (const day of days.filter((entry) => entry.state !== 'hatched')) {
    for (const { grantId, gift } of dayGiftsFor(day)) {
      if (granted.has(grantId)) continue;
      granted.add(grantId);
      gifts.push(gift);
      changed = true;
    }
  }

  // Lane C — achievements always become real gifts, including on baseline.
  for (const { grantId, gift } of discoveryGrants(options.unlockedDiscoveries ?? [])) {
    if (granted.has(grantId)) continue;
    granted.add(grantId);
    gifts.push(gift);
    changed = true;
  }
  for (const prop of options.patternProps ?? []) {
    const grantId = `prop:${prop.id}`;
    if (granted.has(grantId)) continue;
    granted.add(grantId);
    gifts.push({
      id: grantId,
      assetKey: prop.assetKey,
      name: prop.name,
      sizeScale: prop.sizeScale,
      provenance: { kind: 'discovery', label: prop.sourceLabel, isoDate: '' },
    });
    changed = true;
  }

  if (!wasBaselined) changed = true;
  if (changed) {
    state = {
      ...state,
      baselined: true,
      grantedIds: [...granted],
      unplanted: [...gifts, ...state.unplanted],
    };
    saveKingdomDecor(state);
  }
  return state;
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

// --- Placement mutations (each persists) -----------------------------------
// No daily planting allowance: planting is limited only by what the shelf
// holds — earning (the caps above) is the pacing, placing is always free.

export function plantKingdomGift(
  state: KingdomDecorState,
  giftId: string,
  col: number = DROP_CELL.col,
  row: number = DROP_CELL.row,
  plotId: string | null = null
): KingdomDecorState {
  const gift = state.unplanted.find((item) => item.id === giftId);
  if (!gift) return state;
  const item: KingdomDecorItem = {
    id: `placed-${gift.id}`,
    assetKey: gift.assetKey,
    name: gift.name,
    col,
    row,
    plotId,
    sizeScale: gift.sizeScale,
    provenance: gift.provenance,
  };
  const next: KingdomDecorState = {
    ...state,
    placed: [...state.placed, item],
    unplanted: state.unplanted.filter((entry) => entry.id !== giftId),
  };
  saveKingdomDecor(next);
  return next;
}

export function moveKingdomDecor(state: KingdomDecorState, id: string, col: number, row: number): KingdomDecorState {
  const next: KingdomDecorState = {
    ...state,
    placed: state.placed.map((item) => (item.id === id ? { ...item, col, row } : item)),
  };
  saveKingdomDecor(next);
  return next;
}

// Unplanting never destroys an earned thing — it returns to the gift shelf.
export function unplantKingdomDecor(state: KingdomDecorState, id: string): KingdomDecorState {
  const item = state.placed.find((entry) => entry.id === id);
  if (!item) return state;
  const gift: KingdomGift = {
    id: item.id.replace(/^placed-/, ''),
    assetKey: item.assetKey,
    name: item.name,
    sizeScale: item.sizeScale,
    provenance: item.provenance,
  };
  const next: KingdomDecorState = {
    ...state,
    placed: state.placed.filter((entry) => entry.id !== id),
    unplanted: [gift, ...state.unplanted],
  };
  saveKingdomDecor(next);
  return next;
}

// Render-ready patch objects (category 'decor') for the centre island.
export function kingdomDecorObjects(state: KingdomDecorState, plotId: string | null = null): WorldObject[] {
  const items: DecorItem[] = state.placed
    .filter((item) => item.plotId === plotId)
    .map((item) => ({
      id: item.id,
      assetKey: item.assetKey,
      col: item.col,
      row: item.row,
      sourceLabel: item.provenance.label,
      earnedFrom: item.name,
      sizeScale: item.sizeScale,
    }));
  return decorObjects(items);
}

export function findKingdomDecor(state: KingdomDecorState, id: string): KingdomDecorItem | null {
  return state.placed.find((item) => item.id === id) ?? null;
}

// --- Almanac ("how keepsakes are earned") ------------------------------------

export type AlmanacEntry = {
  id: string;
  name: string;
  assetKey: string;
  hint: string;
  earned: boolean;
};
export type AlmanacSection = { title: string; blurb: string; entries: AlmanacEntry[] };

export function keepsakeAlmanac(state: KingdomDecorState): AlmanacSection[] {
  const granted = new Set(state.grantedIds);
  const bloomCount = state.grantedIds.filter((id) => id.includes(':bloom:')).length;
  const commons: AlmanacSection = {
    title: 'Everyday blooms',
    blurb: `Photos, notes, places, reflections, meals and walks add up — every few moments grows one of these (up to ${MAX_BLOOM_GIFTS_PER_DAY} a day). ${bloomCount > 0 ? `${bloomCount} grown so far.` : ''}`,
    entries: COMMONS.map((entry) => ({
      id: `common-${entry.assetKey}`,
      name: entry.name,
      assetKey: entry.assetKey,
      hint: 'Grown by everyday living',
      earned: bloomCount > 0,
    })),
  };
  const signature: AlmanacSection = {
    title: 'Signature days',
    blurb: 'Distinctive days leave distinctive keepsakes (up to 2 a day).',
    entries: DAILY_RULES.map((rule) => ({
      id: rule.id,
      name: rule.name,
      assetKey: rule.assetKey,
      hint: rule.hint,
      earned: state.grantedIds.some((id) => id.endsWith(`:${rule.id}`)),
    })),
  };
  const achievements: AlmanacSection = {
    title: 'Achievements',
    blurb: 'Discoveries and noticed patterns each grant their keepsake once.',
    entries: EARNED_WORLD_PROPS.map((def) => ({
      id: def.id,
      name: def.name,
      assetKey: def.assetKey,
      hint: granted.has(`prop:${def.id}`) ? def.sourceLabel : def.lockedLabel,
      earned: granted.has(`prop:${def.id}`),
    })),
  };
  return [commons, signature, achievements];
}
