import type { HomeDayRecord } from '@/types/home';
import type { WorldObject } from '@/types/world';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { decorObjects, type DecorItem } from '@/utils/world-decor';

// Kingdom decoration (docs/kingdom-world-design.md §3): decorations are earned
// by LIVING and accumulate forever in the one Kingdom — replacing the per-day
// "blooms" that reset with each patch. Life earns props (daily signal rules +
// the starter seed); Essence only ever styles them. Every item carries
// provenance — where in a real life it came from.

export type KingdomProvenance = {
  kind: 'day' | 'starter' | 'legacy';
  // "A 12k-step day", "First Seed", "Planted in an earlier world"
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
  label: (day: HomeDayRecord) => string;
  when: (day: HomeDayRecord) => boolean;
};

function reflectionCount(day: HomeDayRecord): number {
  return (day.promptAnswers ?? []).filter((answer) => !answer.dismissed && answer.choiceIds.length > 0).length;
}

const DAILY_RULES: DailyRule[] = [
  {
    id: 'big_moment_blossom',
    assetKey: 'decor_3',
    name: 'Blossom Tree',
    sizeScale: 1.3,
    label: (day) => day.bigMoments?.[0]?.label ?? 'A big moment',
    when: (day) => (day.bigMoments?.length ?? 0) > 0,
  },
  {
    id: 'journey_stone',
    assetKey: 'decor_14',
    name: 'Trail Stone',
    label: (day) => `${(day.stepsCount ?? 0).toLocaleString()} steps in one day`,
    when: (day) => (day.stepsCount ?? 0) >= 8000 || day.stepsInterpretation?.movement === 'hike',
  },
  {
    id: 'wayfinder_post',
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
    assetKey: 'decor_9',
    name: 'Market Crate',
    label: (day) => {
      const food = day.foodMoments?.[0];
      return food ? `${food.emoji} ${food.label} · savoured` : 'A meal savoured';
    },
    when: (day) => (day.foodMoments?.length ?? 0) > 0,
  },
  {
    id: 'study_planter',
    assetKey: 'decor_8',
    name: 'Study Planter',
    label: (day) => {
      const studio = day.studioMoments?.[0];
      return studio ? `${studio.emoji} ${studio.label} · an inspiration` : 'An inspiration kept';
    },
    when: (day) => (day.studioMoments?.length ?? 0) > 0,
  },
  {
    id: 'reflection_flowers',
    assetKey: 'decor_7',
    name: 'Wildflowers',
    label: () => 'A deeply reflected day',
    when: (day) => reflectionCount(day) >= 3,
  },
  {
    id: 'keeper_lantern',
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

export function syncKingdomDecorFromDays(days: HomeDayRecord[]): KingdomDecorState {
  let state = loadKingdomDecor();
  let changed = false;

  if (!state.migratedLegacy) {
    state = hoistLegacyDecor(state, days);
    changed = true;
  }

  const hatched = days.filter((day) => day.state === 'hatched');
  const granted = new Set(state.grantedIds);

  if (!state.baselined) {
    // History is honoured, not flooded: everything before the last few days is
    // marked granted silently; only recent days open as actual gifts.
    const recent = new Set(hatched.slice(-BASELINE_GIFT_DAYS).map((day) => day.id));
    const gifts = [...state.unplanted];
    for (const day of hatched) {
      for (const { grantId, rule } of dayGrants(day)) {
        if (granted.has(grantId)) continue;
        granted.add(grantId);
        if (recent.has(day.id)) {
          gifts.push(giftFor(grantId, rule, day));
        }
      }
    }
    state = { ...state, baselined: true, grantedIds: [...granted], unplanted: gifts };
    changed = true;
  } else {
    const gifts: KingdomGift[] = [];
    for (const day of hatched) {
      for (const { grantId, rule } of dayGrants(day)) {
        if (granted.has(grantId)) continue;
        granted.add(grantId);
        gifts.push(giftFor(grantId, rule, day));
      }
    }
    if (gifts.length > 0) {
      state = { ...state, grantedIds: [...granted], unplanted: [...gifts, ...state.unplanted] };
      changed = true;
    }
  }

  if (changed) saveKingdomDecor(state);
  return state;
}

function giftFor(grantId: string, rule: DailyRule, day: HomeDayRecord): KingdomGift {
  return {
    id: grantId,
    assetKey: rule.assetKey,
    name: rule.name,
    sizeScale: rule.sizeScale,
    provenance: { kind: 'day', label: rule.label(day), isoDate: day.isoDate, dayId: day.id },
  };
}

// --- Placement mutations (each persists) -----------------------------------

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
