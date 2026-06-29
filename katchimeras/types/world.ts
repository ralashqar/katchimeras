import type { EggVisualState, HomeRarityTier, HomeVisualKey } from '@/types/home';

// The six day-identities a patch can express. Derived purely from existing day
// signals (utils/world-archetype.ts) — the World system adds no new capture
// surface. The five score-aligned ones mirror HomeScoreKey; `meaningful` is a
// synthesised axis from living-rarity + meaning signals.
export type WorldArchetype =
  | 'calm'
  | 'active'
  | 'social'
  | 'exploration'
  | 'focus'
  | 'meaningful';

// A logical tile in the 4×4 patch grid. The ground itself is drawn geometrically
// (Skia), so a tile only carries its slot role + an optional flat decal key — it
// is NOT a terrain sprite. See docs/katchimera-world-design.md.
export type WorldTile = {
  col: number;
  row: number;
  kind: 'ground' | 'accent';
  decal?: string | null;
};

export type WorldObjectKind = 'anchor' | 'prop' | 'memory' | 'creature' | 'landmark';

// Diorama Time Capsule — the four semantic cells a day's patch is built from.
// Each cell stores one facet of the day and levels its visual up from real
// contribution: 'memory' (photos/media), 'places' (where), 'journey' (movement),
// 'reflection' (mood/meaning). The creature/egg sits separately at the centre.
// Cell categories drive the four leveling cells. 'notes' is NOT a cell — it's a
// standalone chest object (see notesObject) that taps into its own notes reader,
// so it lives in the object-category union but not in PatchCellType. 'sleep' is
// the same kind of standalone object (sleepObject) — a tappable tile, no cell.
export type WorldObjectCategory =
  | 'memory'
  | 'places'
  | 'journey'
  | 'reflection'
  | 'notes'
  | 'sleep'
  | 'food'
  // The Studio: the inspiration archive — tapping it opens the reader of books/
  // films/shows/games the day took in (utils/today-patch-engine.ts studioObject).
  | 'studio'
  // The Town Hall: a standalone structure that keeps the day's story — tapping it
  // opens the Chronicle reader (utils/chronicle-engine.ts). Not a leveling cell.
  | 'chronicle'
  // The Quest Board: today-only notice board — tapping it opens the day's Memory
  // Quests (utils/memory-quests-engine.ts). Not a leveling cell.
  | 'quests'
  // A user-planted decorative object (tree/plant/flower) — earned from the day's
  // living, placed freely in Decorate mode. Expressive only; no reader.
  | 'decor'
  // The Featured Memory Board — a billboard by the Memory Vault showing the day's
  // cover photo; tapping opens the cover-photo picker.
  | 'featured'
  // The Photos stack — a Memory Vault satellite (its own category so it drags
  // independently); tapping opens the Vault on the Photos tab.
  | 'photos';
export type PatchCellType = 'memory' | 'places' | 'journey' | 'reflection';

// A single cell: its fixed grid position, current level (0 = empty ghost), the
// asset its level resolves to, and the labels that explain "built from …".
export type PatchCell = {
  type: PatchCellType;
  col: number;
  row: number;
  level: 0 | 1 | 2 | 3 | 4;
  assetKey: string | null; // null while empty (rendered as a ghost spot)
  summaryLabel: string; // "5 memories captured"
  sourceLabel: string; // "Memory Vault"
  count: number; // the raw metric shown as a badge (photos / steps / moments / places)
};

// A placed thing sitting on a tile slot. `assetKey` resolves to a bundled cutout
// at render time (utils/world-visuals.ts) — the engine stays pure data, never
// touching `require()`. `sourceLabel` is the day-signal this object was built
// from, surfaced verbatim in the patch construction breakdown.
export type WorldObject = {
  id: string;
  kind: WorldObjectKind;
  assetKey: string;
  label: string;
  col: number;
  row: number;
  footprint: number;
  sourceLabel?: string | null;
  category?: WorldObjectCategory;
  badge?: number; // small count/metric tag shown at the object's corner
  badgeIcon?: string; // override the badge's icon (SF symbol name)
  sizeScale?: number; // per-object render-size multiplier (e.g. big structures)
};

// A memory node is an interactive structure that stores one real moment for
// retrieval. Tapping it surfaces the payload fields below.
export type MemoryNodeKind =
  | 'photo_bloom'
  | 'landmark_stone'
  | 'monument'
  | 'memory_crystal'
  | 'lantern_shrine';

export type MemoryNode = {
  id: string;
  kind: MemoryNodeKind;
  assetKey: string;
  label: string;
  col: number;
  row: number;
  photoThumbnailUri?: string | null;
  meaningLabel?: string | null;
  locationLabel?: string | null;
  timeLabel?: string | null;
};

export type WorldDirection = 'N' | 'E' | 'S' | 'W';

// Lifecycle of a patch. Archived/legacy patches have no status field and are
// implicitly 'hatched' (already finalized into the world). Today's live patch
// carries 'forming' → 'readyToHatch' and grows monotonically through the day
// (utils/today-patch-engine.ts) before the hatch finalizes it into the world.
export type WorldPatchStatus = 'forming' | 'readyToHatch' | 'hatched';

// The unit generated per day — one self-contained isometric diorama plot.
export type WorldPatch = {
  id: string;
  dayId: string;
  isoDate: string;
  name: string;
  primaryArchetype: WorldArchetype;
  secondaryArchetype: WorldArchetype | null;
  size: 4;
  tiles: WorldTile[];
  objects: WorldObject[];
  memoryNodes: MemoryNode[];
  creatureId: string | null;
  creatureVisualKey: HomeVisualKey | null;
  creatureName: string | null;
  rarity: HomeRarityTier | null;
  // Patch-grid coordinates assigned at placement (utils/world-placement.ts).
  gridCol: number;
  gridRow: number;
  // Deferred (post-MVP): which sides have neighbours for edge-blending/biomes.
  connectorSides: WorldDirection[];
  // Live-patch fields. Absent on archived/legacy patches (treated as 'hatched').
  // While forming, the creature slot is empty and the egg is composited over the
  // patch's centre cell instead (components/.../today-patch-view.tsx).
  status?: WorldPatchStatus;
  eggVisual?: EggVisualState | null;
  // Diorama Time Capsule — the four leveling cells; level-0 cells render as ghosts.
  cells?: PatchCell[];
};

export type WorldState = {
  version: 2;
  patches: WorldPatch[];
  // dayIds already turned into patches, so we only ever build each day once.
  builtDayIds: string[];
};
