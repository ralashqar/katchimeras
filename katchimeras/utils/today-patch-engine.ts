import { ARCHETYPE_THEME } from '@/constants/world';
import type { HomeDayRecord } from '@/types/home';
import type { PatchCell, PatchCellType, WorldObject, WorldPatch } from '@/types/world';
import { earnedSeeds } from '@/utils/daily-seeds-engine';
import { deriveArchetypes } from '@/utils/world-archetype';
import { buildPatchInputFromDay } from '@/utils/world-patch-engine';

// The live patch for TODAY as a DIORAMA TIME CAPSULE: four semantic cells —
// Memory Vault (photos), Places (where), Journey (movement), Reflection (mood) —
// plus the egg/creature at the front. Each cell holds ONE object whose visual
// LEVELS UP from real contribution; an empty cell (level 0) renders as a ghost
// spot. Nothing comes from aggregate scores — every level traces to the day's
// own data, so the patch reads as "this is what today left behind".

// Fixed cell positions — the four CORNERS of the diamond (the extreme points), so
// they read far apart and tap cleanly, leaving the centre free for the egg →
// creature and any day-themed decorative growth (world-canvas composites the egg
// over the centre tile (1,1)).
const CELL_LAYOUT: { type: PatchCellType; col: number; row: number }[] = [
  { type: 'memory', col: 0, row: 0 }, // top
  { type: 'places', col: 3, row: 0 }, // right
  { type: 'journey', col: 0, row: 3 }, // left
  { type: 'reflection', col: 3, row: 3 }, // front/bottom
];

// The egg (forming) and creature (hatched) occupy the centre tile.
const CENTRE_CELL = { col: 1, row: 1 };

function posOf(type: PatchCellType): { col: number; row: number } {
  const cell = CELL_LAYOUT.find((c) => c.type === type) ?? CELL_LAYOUT[0];
  return { col: cell.col, row: cell.row };
}

// Each cell's visual per level. Memory Vault has a bespoke chest set (new art);
// the others reuse existing world anchors/memory-nodes as their level rungs.
const VAULT_ASSET: Record<number, string> = {
  1: 'vault_chest_small',
  2: 'vault_chest',
  3: 'vault_chest_treasure',
  4: 'vault_chest_treasure',
};
const PLACES_ASSET: Record<number, string> = {
  1: 'exploration_signpost',
  2: 'exploration_signpost',
  3: 'exploration_tower',
  4: 'exploration_lookout',
};
const JOURNEY_ASSET: Record<number, string> = {
  1: 'active_trail_marker',
  2: 'active_trail_marker',
  3: 'active_bridge',
  4: 'memory_monument',
};
type Mood = 'calm' | 'energetic' | 'social' | 'meaningful';
const MOOD_ASSET: Record<Mood, string> = {
  calm: 'calm_pond',
  energetic: 'active_windmill',
  social: 'social_campfire',
  meaningful: 'meaningful_shrine',
};
const MOOD_WORD: Record<Mood, string> = {
  calm: 'calm',
  energetic: 'lively',
  social: 'warm',
  meaningful: 'meaningful',
};

function level(value: number, thresholds: [number, number, number, number]): 0 | 1 | 2 | 3 | 4 {
  if (value >= thresholds[3]) return 4;
  if (value >= thresholds[2]) return 3;
  if (value >= thresholds[1]) return 2;
  if (value >= thresholds[0]) return 1;
  return 0;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Compute the four cells from the day's data + any earned Daily Seeds. Pure.
export function computeCells(day: HomeDayRecord): PatchCell[] {
  const seeds = earnedSeeds(day);
  const seedCount = (type: PatchCellType) => seeds.filter((s) => s.slot === type).length;

  // Memory Vault — captured media (photos + meanings + capture seeds).
  const mediaCount =
    (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0) + seedCount('memory');
  const memoryLevel = level(mediaCount, [1, 2, 4, 99]); // 4 (big-moment) reserved for later
  const memory: PatchCell = {
    type: 'memory',
    ...posOf('memory'),
    level: memoryLevel,
    assetKey: memoryLevel > 0 ? VAULT_ASSET[memoryLevel] : null,
    summaryLabel:
      mediaCount > 0 ? `${plural(mediaCount, 'memory', 'memories')} captured` : 'A quiet vault, so far',
    sourceLabel: 'Memory Vault',
  };

  // Places — where the day happened.
  const visited = day.visitedPlaceCount ?? 0;
  const newPlaces = day.newPlaceCount ?? 0;
  let placesLevel: 0 | 1 | 2 | 3 | 4 = 0;
  if (newPlaces >= 2) placesLevel = 4;
  else if (newPlaces >= 1) placesLevel = 3;
  else if (visited >= 2) placesLevel = 2;
  else if (visited >= 1 || seedCount('places') > 0) placesLevel = 1;
  const places: PatchCell = {
    type: 'places',
    ...posOf('places'),
    level: placesLevel,
    assetKey: placesLevel > 0 ? PLACES_ASSET[placesLevel] : null,
    summaryLabel:
      newPlaces > 0
        ? 'A new place today'
        : visited > 0
          ? `${plural(visited, 'place', 'places')} shaped today`
          : placesLevel > 0
            ? 'Close to home'
            : 'No places yet',
    sourceLabel: 'Places',
  };

  // Journey — movement. Low movement is cozy, never failure.
  const steps = day.stepsCount ?? 0;
  let journeyLevel = level(steps, [1, 2500, 7000, 12000]);
  if (journeyLevel === 0 && seedCount('journey') > 0) journeyLevel = 1;
  const journey: PatchCell = {
    type: 'journey',
    ...posOf('journey'),
    level: journeyLevel,
    assetKey: journeyLevel > 0 ? JOURNEY_ASSET[journeyLevel] : null,
    summaryLabel:
      journeyLevel >= 4
        ? 'You moved more than usual'
        : journeyLevel >= 2
          ? `${steps.toLocaleString()} steps`
          : journeyLevel === 1
            ? 'A gentle day'
            : 'A restful day',
    sourceLabel: 'Journey',
  };

  // Reflection — mood + meaning.
  const mood = dominantMood(day, seeds);
  const moodCount =
    (day.capturedMeanings?.length ?? 0) + (day.promptAnswers?.length ?? 0) + seedCount('reflection');
  const reflectionLevel = level(moodCount, [1, 2, 3, 99]);
  const reflection: PatchCell = {
    type: 'reflection',
    ...posOf('reflection'),
    level: reflectionLevel,
    assetKey: reflectionLevel > 0 ? MOOD_ASSET[mood] : null,
    summaryLabel:
      reflectionLevel > 0 ? `Today carried a ${MOOD_WORD[mood]} energy` : 'Yet to reflect',
    sourceLabel: 'Reflection',
  };

  return [memory, places, journey, reflection];
}

function dominantMood(day: HomeDayRecord, seeds: ReturnType<typeof earnedSeeds>): Mood {
  const tally: Record<Mood, number> = { calm: 0, energetic: 0, social: 0, meaningful: 0 };
  for (const meaning of day.capturedMeanings ?? []) {
    if (meaning.archetype === 'calm') tally.calm += 1;
    else if (meaning.archetype === 'energy') tally.energetic += 1;
    else if (meaning.archetype === 'together') tally.social += 1;
    else if (meaning.archetype === 'meaningful') tally.meaningful += 1;
  }
  for (const seed of seeds.filter((s) => s.slot === 'reflection')) {
    if (seed.archetype === 'social') tally.social += 1;
    else tally.calm += 1; // calm / generic reflection seeds read as calm
  }
  const order: Mood[] = ['calm', 'energetic', 'social', 'meaningful'];
  let best: Mood = 'calm';
  let bestN = -1;
  for (const key of order) {
    if (tally[key] > bestN) {
      best = key;
      bestN = tally[key];
    }
  }
  return best;
}

// Project a non-empty cell into a renderable object. Keyed by level so an upgrade
// (chest → treasure chest) mounts a fresh sprite and bounces in.
function cellObject(dayId: string, cell: PatchCell): WorldObject | null {
  if (!cell.assetKey || cell.level === 0) return null;
  return {
    id: `${dayId}-cell-${cell.type}-l${cell.level}`,
    kind: 'prop',
    assetKey: cell.assetKey,
    label: cell.sourceLabel,
    col: cell.col,
    row: cell.row,
    footprint: 1,
    sourceLabel: cell.summaryLabel,
    category: cell.type,
  };
}

// Derive today's live patch. Cells are recomputed from the day each time (they
// only ever level UP as inputs accumulate); `prev` is unused now that growth is
// driven by deterministic per-cell levels rather than carried placements.
function groundTiles() {
  const tiles = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      tiles.push({ col, row, kind: 'ground' as const, decal: null });
    }
  }
  return tiles;
}

export function deriveTodayPatch(day: HomeDayRecord, _prev?: WorldPatch | null): WorldPatch {
  const cells = computeCells(day);
  const objects = cells.map((cell) => cellObject(day.id, cell)).filter((o): o is WorldObject => !!o);
  const tiles = groundTiles();
  const status = day.state === 'ready_to_hatch' ? 'readyToHatch' : 'forming';

  return {
    id: `today-${day.id}`,
    dayId: day.id,
    isoDate: day.isoDate,
    name: 'Today',
    primaryArchetype: 'calm',
    secondaryArchetype: null,
    size: 4,
    tiles,
    objects,
    memoryNodes: [],
    creatureId: null,
    creatureVisualKey: null,
    creatureName: null,
    rarity: null,
    gridCol: 0,
    gridRow: 0,
    connectorSides: [],
    status,
    eggVisual: day.egg,
    cells,
  };
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

// Finalize a HATCHED day into its permanent World tile — the SAME four cells the
// live patch showed, frozen, plus the day's creature on the centre tile and a
// day-themed ground/name. This is what `buildWorld` folds into the world, so the
// whole world reads as one consistent set of time-capsule dioramas.
export function finalizeDayPatch(day: HomeDayRecord): WorldPatch {
  const cells = computeCells(day);
  const objects = cells.map((cell) => cellObject(day.id, cell)).filter((o): o is WorldObject => !!o);
  const input = buildPatchInputFromDay(day);
  const { primary, secondary } = deriveArchetypes(input.signals);
  const rng = mulberry32(hashSeed(`${input.nonce}:${day.id}`));

  // The creature takes the centre tile the egg held while forming.
  if (day.creature?.visualKey) {
    objects.push({
      id: `${day.id}-creature`,
      kind: 'creature',
      assetKey: `creature:${day.creature.visualKey}`,
      label: day.creature.name ?? 'Creature',
      col: CENTRE_CELL.col,
      row: CENTRE_CELL.row,
      footprint: 1,
    });
  }

  const theme = ARCHETYPE_THEME[primary];
  return {
    id: `patch-${day.id}`,
    dayId: day.id,
    isoDate: day.isoDate,
    name: `${pickOne(theme.adjectives, rng)} ${pickOne(theme.nouns, rng)}`,
    primaryArchetype: primary,
    secondaryArchetype: secondary,
    size: 4,
    tiles: groundTiles(),
    objects,
    memoryNodes: [],
    creatureId: day.creature?.id ?? null,
    creatureVisualKey: (day.creature?.visualKey as WorldPatch['creatureVisualKey']) ?? null,
    creatureName: day.creature?.name ?? null,
    rarity: day.creature?.rarity ?? null,
    gridCol: 0,
    gridRow: 0,
    connectorSides: [],
    status: 'hatched',
    cells,
  };
}
