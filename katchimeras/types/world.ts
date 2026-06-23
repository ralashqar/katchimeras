import type { HomeRarityTier, HomeVisualKey } from '@/types/home';

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

export type WorldObjectKind = 'anchor' | 'prop' | 'memory' | 'creature';

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
};

export type WorldState = {
  version: 1;
  patches: WorldPatch[];
  // dayIds already turned into patches, so we only ever build each day once.
  builtDayIds: string[];
};
