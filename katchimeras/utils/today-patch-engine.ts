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
// All chests line the FAR back-right edge (row 0): photos · notes · steps · (places,
// consolidated into steps so hidden). The egg/creature gets the front-most corner.
// Cozy Collectible layout (docs/world-structures-cozy-direction.md §9). The memory
// cluster sits back-left; the domains ring the central plaza (egg). All draggable, so
// these are sensible defaults the user can rearrange.
const CELL_LAYOUT: { type: PatchCellType; col: number; row: number }[] = [
  { type: 'memory', col: 0, row: 0 }, // 📸 Memory Vault — owns all captured media
  { type: 'journey', col: 3, row: 0 }, // 🛤 Journey Hall — steps only now (un-merged)
  { type: 'places', col: 2, row: 0 }, // 🗺 Crossroads — where I went (its own building again)
  { type: 'reflection', col: 3, row: 2 }, // 🌿 Sanctuary — how today felt (its own cell, off the quest board)
];

// Cutouts are now tightly cropped (each fills its square), so a level set would
// otherwise render at one size — growth is conveyed by render SIZE per level.
const LEVEL_SCALE: Record<number, number> = { 1: 0.78, 2: 0.92, 3: 1.05, 4: 1.2 };

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

// Memory cluster satellites — small VIEWS that flank the Memory Vault (which owns the
// data). The Notes stack sits to one side, the Photos stack to the other; tapping
// either opens the relevant memory reader. Not separate data domains (§9.3).
const NOTES_CELL = { col: 1, row: 0 }; // beside the vault (0,0)
function notesObject(day: HomeDayRecord): WorldObject | null {
  const notes = day.notes ?? [];
  if (notes.length === 0) return null;
  return {
    id: `${day.id}-notes-${notes.length}`,
    kind: 'prop',
    assetKey: 'notes_stack', // cozy stack of note cards (text + voice)
    label: 'Notes',
    col: NOTES_CELL.col,
    row: NOTES_CELL.row,
    footprint: 1,
    sourceLabel: `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`,
    category: 'notes', // taps open the notes + voice reader
    badge: notes.length,
    badgeIcon: 'square.and.pencil',
    sizeScale: 0.95,
  };
}

// Photos stack — the other Memory Vault satellite (front-left of the vault).
const PHOTOS_STACK_CELL = { col: 0, row: 1 };
function photosStackObject(day: HomeDayRecord): WorldObject | null {
  const photoCount = (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0);
  if (photoCount === 0) return null;
  return {
    id: `${day.id}-photos-${photoCount}`,
    kind: 'prop',
    assetKey: 'photos_stack',
    label: 'Photos',
    col: PHOTOS_STACK_CELL.col,
    row: PHOTOS_STACK_CELL.row,
    footprint: 1,
    sourceLabel: `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`,
    category: 'photos', // its OWN category so it drags independently of the Vault
    badge: photoCount,
    sizeScale: 0.95,
  };
}

// Featured Memory Board — the day's "cover" billboard by the vault. Always present on
// a day that has anything to feature (a photo) or already has one pinned.
const FEATURED_CELL = { col: 1, row: 1 };
function featuredBoardObject(day: HomeDayRecord): WorldObject | null {
  const photoCount = (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0);
  if (photoCount === 0 && !day.featuredMemory) return null;
  return {
    id: `${day.id}-featured`,
    kind: 'prop',
    assetKey: 'featured_board',
    label: 'Featured',
    col: FEATURED_CELL.col,
    row: FEATURED_CELL.row,
    footprint: 1,
    sourceLabel: 'Featured memory',
    category: 'featured', // taps open the cover-photo picker
    sizeScale: 1.25,
  };
}

// The Memory cluster's satellites (Notes stack + Photos stack + Featured Board) that
// surround the Memory Vault. The Vault itself is a normal cell object.
function memoryClusterObjects(day: HomeDayRecord): WorldObject[] {
  return [notesObject(day), photosStackObject(day), featuredBoardObject(day)].filter(
    (o): o is WorldObject => !!o
  );
}

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

// Sleep is a small block on its own tile — the graphic varies by how the day
// began (sunny garden / stone lantern / misty moon lantern). Only present once
// the day's sleep is known (Health or manual).
const SLEEP_CELL = { col: 3, row: 1 }; // a small satellite beside the Sanctuary (3,2)
const SLEEP_ASSET: Record<string, string> = {
  good: 'sleep_nook_good',
  normal: 'sleep_nook_normal',
  low: 'sleep_nook_low',
};
function sleepObject(day: HomeDayRecord): WorldObject | null {
  const sleep = day.sleep;
  if (!sleep) return null;
  return {
    id: `${day.id}-sleep-${sleep.quality}`,
    kind: 'prop',
    assetKey: SLEEP_ASSET[sleep.quality] ?? 'prop_lantern',
    label: 'Sleep',
    col: SLEEP_CELL.col,
    row: SLEEP_CELL.row,
    footprint: 1,
    sourceLabel: 'Sleep',
    category: 'sleep',
    sizeScale: 1.0, // cozy bed satellite
  };
}

// Food Vault — a little food stall on its own tile, present once the day has any
// food memory (auto-detected from a snapped photo / note, or saved manually). The
// badge counts the day's memories; tapping opens the Food Vault reader.
const FOOD_CELL = { col: 2, row: 3 };
function foodObject(day: HomeDayRecord): WorldObject | null {
  const foods = day.foodMoments ?? [];
  if (foods.length === 0) return null;
  return {
    id: `${day.id}-food-${foods.length}`,
    kind: 'prop',
    assetKey: 'food_pavilion', // 🍽 cozy café kiosk — what you savoured
    label: 'Food Pavilion',
    col: FOOD_CELL.col,
    row: FOOD_CELL.row,
    footprint: 1,
    sourceLabel: `${foods.length} food ${foods.length === 1 ? 'memory' : 'memories'}`,
    category: 'food',
    badge: foods.length,
    sizeScale: 1.6, // a building, not a stall
  };
}

// Studio — the inspiration archive (books, films, shows, games you took in),
// present once the day has any studio memory (auto-detected from a note/photo, or
// saved manually). The badge counts the day's items; tapping opens the reader.
const STUDIO_CELL = { col: 0, row: 2 };
function studioObject(day: HomeDayRecord): WorldObject | null {
  const items = day.studioMoments ?? [];
  if (items.length === 0) return null;
  return {
    id: `${day.id}-studio-${items.length}`,
    kind: 'prop',
    assetKey: 'study', // 📚 cozy library kiosk — what inspired you
    label: 'Study',
    col: STUDIO_CELL.col,
    row: STUDIO_CELL.row,
    footprint: 1,
    sourceLabel: `${items.length} ${items.length === 1 ? 'inspiration' : 'inspirations'}`,
    category: 'studio',
    badge: items.length,
    sizeScale: 1.6, // a small library-nook structure (bigger than a chest, smaller than the Town Hall)
  };
}

// Town Hall — a permanent structure on every patch that keeps the day's STORY.
// Always present (every day has a chronicle); tapping it opens the Chronicle reader.
const TOWN_HALL_CELL = { col: 3, row: 3 };
function townHallObject(day: HomeDayRecord): WorldObject {
  return {
    id: `${day.id}-townhall`,
    kind: 'prop',
    assetKey: 'home', // 🏠 cozy cottage — the day's story (Chronicle reader)
    label: 'Home',
    col: TOWN_HALL_CELL.col,
    row: TOWN_HALL_CELL.row,
    footprint: 1,
    sourceLabel: 'The day’s story',
    category: 'chronicle',
    sizeScale: 2.1, // the Town Hall is a big landmark structure
  };
}

// Quest Board — TODAY ONLY: tapping it opens the day's Memory Quests. Not added to
// finalized patches (quests are forward-looking, only meaningful for the live day).
const QUEST_BOARD_CELL = { col: 0, row: 3 };
function questBoardObject(day: HomeDayRecord): WorldObject {
  return {
    id: `${day.id}-questboard`,
    kind: 'prop',
    assetKey: 'quest_board',
    label: 'Quest Board',
    col: QUEST_BOARD_CELL.col,
    row: QUEST_BOARD_CELL.row,
    footprint: 1,
    sourceLabel: 'Ways to grow today',
    category: 'quests',
  };
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
// Notes object — one journaling family that grows from a single open diary into a
// little writing-desk shrine.
const NOTES_ASSET: Record<number, string> = {
  1: 'notes_1',
  2: 'notes_2',
  3: 'notes_3',
  4: 'notes_4',
};
const PLACES_ASSET: Record<number, string> = {
  1: 'crossroads',
  2: 'crossroads',
  3: 'crossroads',
  4: 'crossroads',
};
const JOURNEY_ASSET: Record<number, string> = {
  1: 'journey_hall',
  2: 'journey_hall',
  3: 'journey_hall',
  4: 'journey_hall',
};
// Cell-based domains are now BUILDINGS, not chests — scale them up to read as such
// (multiplied by the per-level LEVEL_SCALE so they still grow a touch as they fill).
const CELL_BUILDING_SCALE: Record<string, number> = { memory: 1.6, journey: 1.6, places: 1.5, reflection: 1.95 };
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
    badge: cell.count,
    sizeScale: (LEVEL_SCALE[cell.level] ?? 1) * (CELL_BUILDING_SCALE[cell.type] ?? 1),
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
  objects.push(...bigMomentObjects(day));
  objects.push(...memoryClusterObjects(day));
  const sleep = sleepObject(day);
  if (sleep) objects.push(sleep);
  const food = foodObject(day);
  if (food) objects.push(food);
  const studio = studioObject(day);
  if (studio) objects.push(studio);
  objects.push(townHallObject(day));
  objects.push(questBoardObject(day));
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
  objects.push(...bigMomentObjects(day));
  objects.push(...memoryClusterObjects(day));
  const sleep = sleepObject(day);
  if (sleep) objects.push(sleep);
  const food = foodObject(day);
  if (food) objects.push(food);
  const studio = studioObject(day);
  if (studio) objects.push(studio);
  objects.push(townHallObject(day));
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
