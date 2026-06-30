import { ARCHETYPE_THEME } from '@/constants/world';
import type { HomeDayRecord } from '@/types/home';
import type { PatchCell, PatchCellType, WorldObject, WorldPatch } from '@/types/world';
import { earnedSeeds } from '@/utils/daily-seeds-engine';
import { deriveArchetypes } from '@/utils/world-archetype';
import { buildPatchInputFromDay } from '@/utils/world-patch-engine';
import { deriveWorldStructureObjects, WORLD_STRUCTURE_CELLS } from '@/utils/world-structures';

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
// All chests line the FAR back-right edge (row 0): photos · notes · steps · (places,
// consolidated into steps so hidden). The egg/creature gets the front-most corner.
// Cozy Collectible layout (docs/world-structures-cozy-direction.md §9). The memory
// cluster sits back-left; the domains ring the central plaza (egg). All draggable, so
// these are sensible defaults the user can rearrange.
const CELL_LAYOUT = WORLD_STRUCTURE_CELLS;

// Cutouts are now tightly cropped (each fills its square), so a level set would
// otherwise render at one size — growth is conveyed by render SIZE per level.

// The egg (forming) and creature (hatched) occupy the CENTRE of the base tile
// (must match EGG_CELL in components/.../world-canvas.tsx). The egg/creature is
// layered on top of its pedestal there.
const CENTRE_CELL = { col: 1.5, row: 1.5 };

// Big Moments grow a rare landmark in the free centre tiles around the egg.
const LANDMARK_CELLS = [
  { col: 2, row: 1 },
  { col: 1, row: 2 },
  { col: 2, row: 2 },
];
// Cozy collectible milestone monuments — one per Big Moment type (world-visuals
// milestone_*). A marked birthday/anniversary/trip/… grows its own celebratory landmark.
const BIG_MOMENT_ASSET: Record<string, string> = {
  birthday: 'milestone_birthday',
  anniversary: 'milestone_anniversary',
  firstTime: 'milestone_firsttime',
  holiday: 'milestone_holiday',
  trip: 'milestone_trip',
  achievement: 'milestone_achievement',
  milestone: 'milestone_monument',
};

function bigMomentObjects(day: HomeDayRecord): WorldObject[] {
  return (day.bigMoments ?? []).slice(0, LANDMARK_CELLS.length).map((moment, index) => ({
    id: `${day.id}-bigmoment-${moment.id}`,
    kind: 'landmark' as const,
    assetKey: BIG_MOMENT_ASSET[moment.type] ?? 'milestone_monument',
    label: moment.label,
    col: LANDMARK_CELLS[index].col,
    row: LANDMARK_CELLS[index].row,
    footprint: 1,
    sourceLabel: `✨ ${moment.label}`,
    sizeScale: 1.35, // a celebratory landmark, a touch larger than a chest
  }));
}

function posOf(type: PatchCellType): { col: number; row: number } {
  const cell = CELL_LAYOUT.find((c) => c.type === type) ?? CELL_LAYOUT[0];
  return { col: cell.col, row: cell.row };
}

// Each cell's visual per level. Memory Vault has a bespoke chest set (new art);
// the others reuse existing world anchors/memory-nodes as their level rungs.
// Photos object — a cozy "memory tree" that grows fuller (hung with glowing framed
// photos) as more photos are captured.
// Cozy Collectible re-skin (docs/world-structures-cozy-direction.md): each domain
// is now ONE iconic building; "more" reads via the badge count + a size bump per
// level (CELL_BUILDING_SCALE). Bespoke 4-level art for the Memory Vault is a later
// step — until then all levels share the single building.
const VAULT_ASSET: Record<number, string> = {
  1: 'memory_vault_1',
  2: 'memory_vault_2',
  3: 'memory_vault_3',
  4: 'memory_vault_4',
};
// Places = the OBSERVATORY tower (a real structure for "where I went"); one building,
// badge shows the place count.
const PLACES_ASSET: Record<number, string> = {
  1: 'observatory',
  2: 'observatory',
  3: 'observatory',
  4: 'observatory',
};
// Journey = the STEPS PATH — a small engraved trail that grows its stone count by
// level (3 → 5 → 7 → winding), like the original. NOT a building.
const JOURNEY_ASSET: Record<number, string> = {
  1: 'steps_path_1',
  2: 'steps_path_2',
  3: 'steps_path_3',
  4: 'steps_path_4',
};
type Mood = 'calm' | 'energetic' | 'social' | 'meaningful';
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

  // Memory Vault — the PHOTOS chest (photos only; notes get their own chest via
  // notesObject). The 'memory' seed is satisfied BY a photo, so it isn't re-added.
  const noteCount = day.notes?.length ?? 0;
  const photoCount = (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0);
  // The Memory Vault OWNS all captured media (photos + voice + notes), so it grows
  // with the total — not just photos. Photos/Notes get their own satellite stacks.
  const memoryTotal = photoCount + noteCount;
  const memoryLevel = level(memoryTotal, [1, 3, 6, 10]); // 1 safe → 10+ grand vault
  const memory: PatchCell = {
    type: 'memory',
    ...posOf('memory'),
    level: memoryLevel,
    assetKey: memoryLevel > 0 ? VAULT_ASSET[memoryLevel] : null,
    summaryLabel:
      memoryTotal > 0 ? `${plural(memoryTotal, 'memory', 'memories')} kept` : 'A quiet vault, so far',
    sourceLabel: 'Memory Vault',
    count: memoryTotal,
  };

  // Places — where the day happened. Confirming a place (its meaning) grows the
  // cell faster than a passive visit, since the user has said it mattered.
  const visited = day.visitedPlaceCount ?? 0;
  const newPlaces = day.newPlaceCount ?? 0;
  const confirmedPlaces = day.confirmedPlaces?.length ?? 0;
  let placesLevel: 0 | 1 | 2 | 3 | 4 = 0;
  if (newPlaces >= 2 || confirmedPlaces >= 3) placesLevel = 4;
  else if (newPlaces >= 1 || confirmedPlaces >= 2) placesLevel = 3;
  else if (visited >= 2 || confirmedPlaces >= 1) placesLevel = 2;
  else if (visited >= 1 || seedCount('places') > 0) placesLevel = 1;
  const places: PatchCell = {
    type: 'places',
    ...posOf('places'),
    level: placesLevel,
    assetKey: placesLevel > 0 ? PLACES_ASSET[placesLevel] : null,
    summaryLabel:
      confirmedPlaces > 0
        ? `${plural(confirmedPlaces, 'place', 'places')} remembered`
        : newPlaces > 0
          ? 'A new place today'
          : visited > 0
            ? `${plural(visited, 'place', 'places')} shaped today`
            : placesLevel > 0
              ? 'Close to home'
              : 'No places yet',
    sourceLabel: 'Places',
    count: confirmedPlaces > 0 ? confirmedPlaces : visited > 0 ? visited : placesLevel > 0 ? 1 : 0,
  };

  // Journey — movement. Low movement is cozy, never failure.
  const steps = day.stepsCount ?? 0;
  let journeyLevel = level(steps, [1, 2500, 7000, 12000]);
  // Journey Hall is MOVEMENT only now — places live in their own Crossroads building
  // (un-merged). A gentle step/seed day still raises it off zero.
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
    count: steps,
  };

  // Reflection — mood + meaning (notes carry a mood too).
  const mood = dominantMood(day, seeds);
  const moodCount =
    (day.capturedMeanings?.length ?? 0) + (day.promptAnswers?.length ?? 0) + seedCount('reflection') + noteCount;
  const reflectionLevel = level(moodCount, [1, 2, 3, 99]);
  const reflection: PatchCell = {
    type: 'reflection',
    ...posOf('reflection'),
    level: reflectionLevel,
    // 🌿 Sanctuary — one cozy building for "how today felt" (mood word still drives copy).
    assetKey: reflectionLevel > 0 ? 'sanctuary' : null,
    summaryLabel:
      reflectionLevel > 0 ? `Today carried a ${MOOD_WORD[mood]} energy` : 'Yet to reflect',
    sourceLabel: 'Sanctuary',
    count: moodCount,
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
  for (const note of day.notes ?? []) {
    if (note.archetype === 'calm') tally.calm += 1;
    else if (note.archetype === 'energy') tally.energetic += 1;
    else if (note.archetype === 'together') tally.social += 1;
    else if (note.archetype === 'meaningful') tally.meaningful += 1;
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
  const objects = deriveWorldStructureObjects(day, cells, { includeQuestBoard: true });
  objects.push(...bigMomentObjects(day));
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
  const objects = deriveWorldStructureObjects(day, cells, { includeQuestBoard: false });
  objects.push(...bigMomentObjects(day));
  const input = buildPatchInputFromDay(day);
  const { primary, secondary } = deriveArchetypes(input.signals);
  const rng = mulberry32(hashSeed(`${input.nonce}:${day.id}`));

  // The creature takes the centre tile the egg held while forming — rendered large
  // (matches the bigger egg) so the day's katchimera is the hero of the plaza.
  if (day.creature?.visualKey) {
    objects.push({
      id: `${day.id}-creature`,
      kind: 'creature',
      assetKey: `creature:${day.creature.visualKey}`,
      label: day.creature.name ?? 'Creature',
      col: CENTRE_CELL.col,
      row: CENTRE_CELL.row,
      footprint: 1,
      sizeScale: 2.3,
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
