import type { HomeDayRecord } from '@/types/home';
import type { WorldObject } from '@/types/world';
import {
  BLOOM_COMMONS,
  CUISINE_FAMILIES,
  DISCOVERY_TIER_KEEPSAKES,
  GROVE_MERGE_COUNT,
  MILESTONE_KEEPSAKES,
  SIGNATURE_KEEPSAKES,
  bloomSpeciesForAssetKey,
  evaluateDayUnlock,
  evaluateLifetimeUnlock,
  formatUnlockLabel,
  groveForSpecies,
  hashSeed,
  subjectsForSpec,
  pickFromVariants,
  pickVariant,
  type DayEvalContext,
  type WorldObjectDefinition,
} from '@/constants/world-objects';
import { distanceMeters, loadHomeAnchor } from '@/utils/home-location';
import WORLD_ECONOMY from '@/data/world-economy.json';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { decorObjects, type DecorItem } from '@/utils/world-decor';
import { expansionProgress, type ExpansionStats, type KingdomExpansion } from '@/utils/world-expansion';
import { EARNED_WORLD_PROPS, propArtVariants } from '@/utils/world-props-catalog';

// Kingdom decoration (docs/kingdom-world-design.md §3): decorations are earned
// by LIVING and accumulate forever in the one Kingdom — replacing the per-day
// "blooms" that reset with each patch. Life earns props (daily signal rules +
// the starter seed); Essence only ever styles them. Every item carries
// provenance — where in a real life it came from.

export type KingdomProvenance = {
  kind: 'day' | 'starter' | 'legacy' | 'discovery' | 'merge';
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
  // Territory growth (docs §10): unlocked expansion tiles, in unlock order.
  // Absent on older stored states — treated as [].
  expansions?: KingdomExpansion[];
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
// Signal → prop, evaluated once per hatched day, deterministic. The rules
// themselves are DATA — constants/world-objects.ts SIGNATURE_KEEPSAKES
// (declarative unlock specs + label templates); this file only grants.
// Registry array order = priority when a day matches more than two.

// Eval context for geo specs: max km the day roamed from the home anchor,
// resolved lazily and memoized per day (anchor loaded fresh each context —
// the user can re-anchor home at any time).
const distanceCache = new Map<string, number>();
export function dayEvalContext(): DayEvalContext {
  const anchor = loadHomeAnchor();
  return {
    distanceFromHomeKm: (day) => {
      if (!anchor) return 0;
      const key = `${day.id}:${anchor.lat},${anchor.lng}:${day.locations?.length ?? 0}`;
      const cached = distanceCache.get(key);
      if (cached !== undefined) return cached;
      let maxKm = 0;
      for (const point of day.locations ?? []) {
        maxKm = Math.max(maxKm, distanceMeters(point.lat, point.lng, anchor.lat, anchor.lng) / 1000);
      }
      distanceCache.set(key, maxKm);
      return maxKm;
    },
  };
}

function ruleFires(definition: WorldObjectDefinition, day: HomeDayRecord, ctx: DayEvalContext): boolean {
  return definition.unlock ? evaluateDayUnlock(definition.unlock, day, ctx) : false;
}

function ruleGift(definition: WorldObjectDefinition, grantId: string, day: HomeDayRecord): KingdomGift {
  return {
    id: grantId,
    // Deterministic per grant — when a definition gains variant siblings,
    // each grant keeps the art it was born with.
    assetKey: pickVariant(definition, grantId),
    name: definition.name,
    sizeScale: definition.art.sizeScale,
    provenance: {
      kind: 'day',
      label: formatUnlockLabel(definition.labelTemplate ?? definition.name, day),
      isoDate: day.isoDate,
      dayId: day.id,
    },
  };
}

function dayGrants(day: HomeDayRecord, ctx: DayEvalContext = dayEvalContext()): { grantId: string; definition: WorldObjectDefinition }[] {
  return SIGNATURE_KEEPSAKES.filter((definition) => ruleFires(definition, day, ctx))
    .slice(0, MAX_DAILY_GIFTS)
    .map((definition) => ({ grantId: `${day.id}:${definition.id}`, definition }));
}

// --- Lane A: everyday blooms (docs/world-objects-expansion-design.md §9.1) --
// RULE ZERO: a hatched day never yields nothing. Every day grants a guaranteed
// day-bloom common; living adds one more at each points threshold. All dials
// live in data/world-economy.json; the first archive week uses friendlier
// thresholds so a new Kingdom greens up fast.

const FOUNDING_DAYS = WORLD_ECONOMY.founding.days;
export const MAX_BLOOM_GIFTS_PER_DAY = WORLD_ECONOMY.maxBloomGiftsPerDay;

export type BloomYield = {
  points: number;
  count: number;
  // The threshold band the day sits in (for progress meters):
  prevThreshold: number;
  nextThreshold: number | null; // null = ladder maxed
};

export function bloomYieldForDay(day: HomeDayRecord, founding = false): BloomYield {
  const points = bloomPointsForDay(day);
  const t = founding ? WORLD_ECONOMY.founding : WORLD_ECONOMY;
  let count = WORLD_ECONOMY.dayBloom;
  let prevThreshold = 0;
  let nextThreshold: number | null = t.lightThreshold;
  if (points >= t.lightThreshold) {
    count += 1;
    prevThreshold = t.lightThreshold;
    nextThreshold = t.engagedThreshold;
  }
  if (points >= t.engagedThreshold) {
    count += 1;
    prevThreshold = t.engagedThreshold;
    nextThreshold = null;
  }
  return { points, count: Math.min(WORLD_ECONOMY.maxBloomGiftsPerDay, count), prevThreshold, nextThreshold };
}

// The signature earns the day has fired so far (for Today's earnings sheet) —
// same rules + cap the hatch grant uses.
export function signatureEarnsForDay(day: HomeDayRecord): { id: string; name: string; assetKey: string; label: string }[] {
  return dayGrants(day).map(({ grantId, definition }) => ({
    id: definition.id,
    name: definition.name,
    assetKey: pickVariant(definition, grantId),
    label: formatUnlockLabel(definition.labelTemplate ?? definition.name, day),
  }));
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

// The day's mood promotes a fitting SPECIES to its FIRST bloom (same leads as
// world-decor's decorPalette).
function commonsBias(day: HomeDayRecord): string | null {
  if ((day.bigMoments?.length ?? 0) > 0) return 'bloom_blossom'; // meaningful
  if ((day.capturedMeanings ?? []).some((meaning) => meaning.archetype === 'together')) return 'bloom_oak'; // social
  if ((day.stepsCount ?? 0) >= 8000) return 'bloom_pine'; // the outdoors
  if ((day.promptAnswers ?? []).some((answer) => !answer.dismissed && answer.choiceIds.includes('calm'))) {
    return 'bloom_wildflowers'; // calm
  }
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function bloomCycleOffset(day: HomeDayRecord): number {
  const timestamp = Date.parse(`${day.isoDate}T00:00:00Z`);
  if (Number.isFinite(timestamp)) {
    return Math.floor(timestamp / DAY_MS) % BLOOM_COMMONS.length;
  }
  return hashSeed(day.id) % BLOOM_COMMONS.length;
}

function bloomSpeciesForGrant(day: HomeDayRecord, index: number, bias: string | null): WorldObjectDefinition {
  const biased = index === 0 && bias ? BLOOM_COMMONS.find((definition) => definition.id === bias) : undefined;
  if (biased) return biased;

  const skippedBias = bias ? BLOOM_COMMONS.find((definition) => definition.id === bias) : undefined;
  const offset = bloomCycleOffset(day);
  let step = index + (skippedBias ? 1 : 0);
  for (let attempt = 0; attempt < BLOOM_COMMONS.length; attempt += 1) {
    const candidate = BLOOM_COMMONS[(offset + step) % BLOOM_COMMONS.length];
    if (!skippedBias || candidate.id !== skippedBias.id) return candidate;
    step += 1;
  }
  return BLOOM_COMMONS[offset];
}

function bloomVariantForGrant(species: WorldObjectDefinition, day: HomeDayRecord, index: number): string {
  const variants = species.art.variants;
  if (variants.length <= 1) return variants[0];
  return variants[(bloomCycleOffset(day) + index) % variants.length];
}

function bloomGrants(day: HomeDayRecord, foundingBoost: boolean): { grantId: string; assetKey: string; name: string; points: number }[] {
  const { points, count } = bloomYieldForDay(day, foundingBoost);
  const bias = commonsBias(day);
  // Deterministic cycle: species rotates through the bloom pool, then the
  // picked species rotates through its own image variants.
  return Array.from({ length: count }, (_, index) => {
    const grantId = `${day.id}:bloom:${index}`;
    const species = bloomSpeciesForGrant(day, index, bias);
    return { grantId, assetKey: bloomVariantForGrant(species, day, index), name: species.name, points };
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

// Rarity-tier fallbacks come from the registry; the pickVariant seed is the
// grant id, so when the sapling gains its 4 random variants each discovery
// keeps the tree it was born with.
function tierFallback(rarity: string | null | undefined): WorldObjectDefinition {
  const tier = (rarity ?? 'common') as keyof typeof DISCOVERY_TIER_KEEPSAKES;
  return DISCOVERY_TIER_KEEPSAKES[tier] ?? DISCOVERY_TIER_KEEPSAKES.common;
}

function discoveryGrants(unlocked: UnlockedDiscoveryInput[]): { grantId: string; gift: KingdomGift }[] {
  return unlocked.map((discovery) => {
    const isoDate = discovery.unlockedAt ? new Date(discovery.unlockedAt).toISOString().slice(0, 10) : '';
    const mapped = DISCOVERY_PROP_BY_SOURCE.get(discovery.id);
    if (mapped) {
      const grantId = `prop:${mapped.id}`;
      return {
        grantId,
        gift: {
          id: grantId,
          // Deterministic across the prop's variant pool (promoted siblings).
          assetKey: pickFromVariants(propArtVariants(mapped), grantId),
          name: mapped.name,
          sizeScale: mapped.sizeScale,
          provenance: { kind: 'discovery' as const, label: mapped.sourceLabel, isoDate },
        },
      };
    }
    const fallback = tierFallback(discovery.rarity);
    const grantId = `disc:${discovery.id}`;
    return {
      grantId,
      gift: {
        id: grantId,
        assetKey: pickVariant(fallback, grantId),
        name: fallback.name,
        sizeScale: fallback.art.sizeScale,
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
  // One eval context per sync (home anchor loaded once; distances memoized).
  const evalCtx = dayEvalContext();

  // Cap-aware rule grants: with live granting a day is visited many times
  // before it hatches, so the "2 signature gifts a day" cap must count what
  // this day has ALREADY been granted, not just what matches right now.
  const ruleGiftsFor = (day: HomeDayRecord): { grantId: string; definition: WorldObjectDefinition }[] => {
    const alreadyGranted = SIGNATURE_KEEPSAKES.filter((definition) => granted.has(`${day.id}:${definition.id}`)).length;
    const allowance = Math.max(0, MAX_DAILY_GIFTS - alreadyGranted);
    return SIGNATURE_KEEPSAKES.filter(
      (definition) => ruleFires(definition, day, evalCtx) && !granted.has(`${day.id}:${definition.id}`)
    )
      .slice(0, allowance)
      .map((definition) => ({ grantId: `${day.id}:${definition.id}`, definition }));
  };

  const dayGiftsFor = (day: HomeDayRecord): { grantId: string; gift: KingdomGift }[] => [
    ...ruleGiftsFor(day).map(({ grantId, definition }) => ({
      grantId,
      gift: ruleGift(definition, grantId, day),
    })),
    ...bloomGrants(day, isFounding(day)).map(({ grantId, assetKey, name, points }) => ({
      grantId,
      gift: {
        id: grantId,
        assetKey,
        name,
        provenance: {
          kind: 'day' as const,
          // The guaranteed day-bloom on a quiet day reads as the day itself.
          label: points === 0 ? 'A new day in the Kingdom' : `A day of ${points} ${points === 1 ? 'moment' : 'moments'}`,
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

  // --- Lane D: milestone keepsakes (docs §5 lifetime lane) -------------------
  // Streaks, tenure, lifetime counts, calendar windows and first-time places.
  // Grant ids: `ms:<id>` once-ever, `ms:<id>@<year>` for perYear calendar
  // earns — re-syncs never duplicate. Like achievements, always real gifts.
  const milestoneGift = (
    definition: WorldObjectDefinition,
    grantId: string,
    isoDate: string,
    day?: HomeDayRecord
  ): KingdomGift => ({
    id: grantId,
    assetKey: pickVariant(definition, grantId),
    name: definition.name,
    sizeScale: definition.art.sizeScale,
    provenance: {
      kind: 'discovery',
      label: day ? formatUnlockLabel(definition.labelTemplate ?? definition.name, day) : (definition.labelTemplate ?? definition.name),
      isoDate,
      dayId: day?.id,
    },
  });
  for (const definition of MILESTONE_KEEPSAKES) {
    const spec = definition.unlock;
    if (!spec) continue;
    // perSubject earns: one grant per distinct subject (cuisine family…),
    // dedup id `ms:<id>@<subject>`. Art variant picked BY SUBJECT (canonical
    // CUISINE_FAMILIES order), not by hash — the lantern must match the food.
    if (definition.repeat === 'perSubject') {
      for (const day of hatched) {
        for (const subject of subjectsForSpec(spec, day)) {
          const grantId = `ms:${definition.id}@${subject}`;
          if (granted.has(grantId)) continue;
          granted.add(grantId);
          const variantIndex = (CUISINE_FAMILIES as readonly string[]).indexOf(subject);
          const gift = milestoneGift(definition, grantId, day.isoDate, day);
          if (variantIndex >= 0) {
            gift.assetKey = definition.art.variants[variantIndex % definition.art.variants.length];
          }
          gifts.push(gift);
          changed = true;
        }
      }
      continue;
    }
    // perYear day-lane earns (calendar windows, birthdays…) return each year.
    if (definition.repeat === 'perYear' || spec.kind === 'calendar') {
      for (const day of hatched) {
        if (!evaluateDayUnlock(spec, day, evalCtx)) continue;
        const grantId =
          definition.repeat === 'perYear' ? `ms:${definition.id}@${day.isoDate.slice(0, 4)}` : `ms:${definition.id}`;
        if (granted.has(grantId)) continue;
        granted.add(grantId);
        gifts.push(milestoneGift(definition, grantId, day.isoDate, day));
        changed = true;
      }
    } else if (spec.kind === 'tenure' || spec.kind === 'streak' || spec.kind === 'lifetimeCount') {
      const grantId = `ms:${definition.id}`;
      if (!granted.has(grantId) && evaluateLifetimeUnlock(spec, hatched, evalCtx)) {
        const last = hatched[hatched.length - 1];
        granted.add(grantId);
        gifts.push(milestoneGift(definition, grantId, last?.isoDate ?? ''));
        changed = true;
      }
    } else {
      // Day-lane spec earned once-ever (first-time places, one-off feats).
      const grantId = `ms:${definition.id}`;
      if (!granted.has(grantId)) {
        const day = hatched.find((candidate) => evaluateDayUnlock(spec, candidate, evalCtx));
        if (day) {
          granted.add(grantId);
          gifts.push(milestoneGift(definition, grantId, day.isoDate, day));
          changed = true;
        }
      }
    }
  }

  // --- Territory growth (docs §10) -----------------------------------------
  // One expansion may unlock per sync: authored requirements AND the planting
  // pressure gate, evaluated over lifetime stats. Deterministic and monotonic.
  const stats = expansionStatsFor(hatched, state, options.unlockedDiscoveries ?? []);
  const expansions = [...(state.expansions ?? [])];
  const progress = expansionProgress(stats, expansions.length);
  if (progress.met) {
    expansions.push({
      index: progress.target.index,
      side: progress.target.side,
      ring: progress.target.ring,
      unlockedDayId: hatched[hatched.length - 1]?.id ?? days[days.length - 1]?.id ?? '',
      ceremonyShown: false,
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
      expansions,
    };
    saveKingdomDecor(state);
  }
  return state;
}

// Lifetime counters the territory system reads (docs §10.1).
export function expansionStatsFor(
  hatchedDays: HomeDayRecord[],
  state: KingdomDecorState,
  discoveries: UnlockedDiscoveryInput[]
): ExpansionStats {
  return {
    daysLived: hatchedDays.length,
    propsPlanted: state.placed.length,
    discoveries: discoveries.length,
    epicDiscoveries: discoveries.filter((d) => d.rarity === 'epic' || d.rarity === 'legendary').length,
  };
}

// The pending "your Kingdom grows" ceremony, if any (shown once, then marked).
export function pendingExpansionCeremony(state: KingdomDecorState): KingdomExpansion | null {
  return (state.expansions ?? []).find((expansion) => !expansion.ceremonyShown) ?? null;
}

export function markExpansionCeremonyShown(state: KingdomDecorState, index: number): KingdomDecorState {
  const next: KingdomDecorState = {
    ...state,
    expansions: (state.expansions ?? []).map((expansion) =>
      expansion.index === index ? { ...expansion, ceremonyShown: true } : expansion
    ),
  };
  saveKingdomDecor(next);
  return next;
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

// --- Grove merge (docs §9.2) ------------------------------------------------
// The tray's relief valve: three identical unplanted commons fuse into one
// denser, uncommon grove of the same species. Purely a user action — the
// fused gifts' grant ids stay in grantedIds, so a re-sync never refunds them.

export type GroveMergeCandidate = {
  speciesId: string;
  speciesName: string;
  name: string; // "Oak Tree Grove"
  assetKey: string;
  giftIds: string[]; // the gifts that would fuse (oldest first)
  available: number; // total unplanted of the species
};

export function groveMergeCandidates(state: KingdomDecorState): GroveMergeCandidate[] {
  const bySpecies = new Map<string, KingdomGift[]>();
  for (const gift of state.unplanted) {
    const speciesId = bloomSpeciesForAssetKey(gift.assetKey);
    if (!speciesId) continue;
    const gifts = bySpecies.get(speciesId) ?? [];
    gifts.push(gift);
    bySpecies.set(speciesId, gifts);
  }
  const candidates: GroveMergeCandidate[] = [];
  for (const [speciesId, gifts] of bySpecies) {
    if (gifts.length < GROVE_MERGE_COUNT) continue;
    const grove = groveForSpecies(speciesId);
    if (!grove) continue;
    const species = BLOOM_COMMONS.find((definition) => definition.id === speciesId);
    // The tray lists newest first — fuse from the END so the freshest keep
    // their place on the shelf.
    const oldest = gifts.slice(-GROVE_MERGE_COUNT);
    candidates.push({
      speciesId,
      speciesName: species?.name ?? grove.name,
      name: grove.name,
      assetKey: grove.assetKey,
      giftIds: oldest.map((gift) => gift.id),
      available: gifts.length,
    });
  }
  return candidates;
}

export function mergeKingdomGrove(state: KingdomDecorState, speciesId: string): KingdomDecorState {
  const candidate = groveMergeCandidates(state).find((entry) => entry.speciesId === speciesId);
  if (!candidate) return state;
  const fused = new Set(candidate.giftIds);
  const parts = state.unplanted.filter((gift) => fused.has(gift.id));
  // The grove remembers the earliest day among what it grew from.
  const isoDate = parts.map((gift) => gift.provenance.isoDate).sort()[0] ?? '';
  const serial = state.grantedIds.filter((id) => id.startsWith(`grove:${speciesId}:`)).length;
  const grantId = `grove:${speciesId}:${serial}`;
  const gift: KingdomGift = {
    id: grantId,
    assetKey: candidate.assetKey,
    name: candidate.name,
    sizeScale: 1.15,
    provenance: { kind: 'merge', label: `Grown from three matching keepsakes`, isoDate },
  };
  const next: KingdomDecorState = {
    ...state,
    grantedIds: [...state.grantedIds, grantId],
    unplanted: [gift, ...state.unplanted.filter((entry) => !fused.has(entry.id))],
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
    blurb: `Every day grows one of these on its own — photos, notes, places, meals and walks grow more (up to ${MAX_BLOOM_GIFTS_PER_DAY} a day). ${bloomCount > 0 ? `${bloomCount} grown so far.` : ''}`,
    entries: BLOOM_COMMONS.map((definition) => ({
      id: `common-${definition.id}`,
      name: definition.name,
      assetKey: definition.art.variants[0],
      hint: 'Grown by everyday living',
      earned: bloomCount > 0,
    })),
  };
  const signature: AlmanacSection = {
    title: 'Signature days',
    blurb: 'Distinctive days leave distinctive keepsakes (up to 2 a day).',
    entries: SIGNATURE_KEEPSAKES.map((definition) => ({
      id: definition.id,
      name: definition.name,
      assetKey: definition.art.variants[0],
      hint: definition.hint ?? '',
      earned: state.grantedIds.some((id) => id.endsWith(`:${definition.id}`)),
    })),
  };
  const milestones: AlmanacSection = {
    title: 'Milestones',
    blurb: 'Streaks, seasons, tenure and first-times — each earned once (seasonal ones return every year).',
    entries: MILESTONE_KEEPSAKES.map((definition) => ({
      id: definition.id,
      name: definition.name,
      assetKey: definition.art.variants[0],
      hint: definition.hint ?? '',
      earned: state.grantedIds.some((id) => id === `ms:${definition.id}` || id.startsWith(`ms:${definition.id}@`)),
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
  return [commons, signature, milestones, achievements];
}
