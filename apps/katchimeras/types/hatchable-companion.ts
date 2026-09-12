import type { ImageSourcePropType } from 'react-native';
import type { HexCoord } from '@incubator/environments/hex';
import type { MergeCharacterId, MergeOrder } from './merge-world';
import type { CorruptionWispLines, CorruptionWispSpec } from '@/features/onboarding/corruption-wisps';
import type { FtueCameraDirective, FtueGuide } from '@/features/onboarding/ftue-types';
import type { MergeLessonBeat } from '@/features/content-flow/merge-lesson-recipe';

/**
 * A hatchable companion: a friend the Mist is keeping on a hex tile of the
 * shared world. Everything from the misted tile to the day after the hatch is
 * authored here, as data, and every screen, flow and engine rule reads it from
 * the registry. Adding a friend is a definition file, its content files and
 * its art; no code.
 *
 * Steppling is the first entry, with every id, version, run id and storage
 * key he had before this existed, so no save changes.
 */
export type HatchableTileArt = { full: ImageSourcePropType; medium: ImageSourcePropType; thumb: ImageSourcePropType };

export type HatchableTileDefinition = {
  /** The shared-world tile id, also the story target's structure id. */
  id: string;
  coord: HexCoord;
  /** The world unlock the purchase records (`worldUnlocks[unlockId]`). */
  unlockId: string;
  price: number;
  name: string;
  revealPreset: 'mist-clear';
  /**
   * The cleared tile's bundled art by LOD, resolved on demand: a definition is data that tests and
   * the engine load, and bundled images are only for the scene that draws them.
   */
  art: () => HatchableTileArt;
  alphaBoundsKey: string;
  markerLines: { sleeping: string };
};

/** When the tile wakes from sleeping (marker dim, purchase refused) to saving. */
export type HatchableAvailability =
  | { kind: 'after_ftue' }
  | { kind: 'kingdom_goal_introduced' }
  | { kind: 'after_companion'; companion: MergeCharacterId };

export type HatchableMissionSeed = {
  items: readonly { cell: number; definitionId: string }[];
  echoes: readonly { cell: number; id: string; definitionId: string }[];
  veiled: readonly { cell: number; id: string; definitionId: string }[];
};

/**
 * Guide copy for the mission board's beats. `{name}` and `{a}` in the wake and
 * merge titles are filled with the wanted item's name and its article.
 */
export type HatchableMissionGuides = {
  firstMerge: FtueGuide;
  wake: FtueGuide;
  merge: FtueGuide;
  mergeFallbackTitle: string;
  free: FtueGuide;
};

export type HatchableMissionDefinition = {
  id: string;
  storageKey: string;
  required: number;
  camera: FtueCameraDirective;
  seed: HatchableMissionSeed;
  guides: HatchableMissionGuides;
  wisps: readonly CorruptionWispSpec[];
  lines: CorruptionWispLines;
};

export type HatchableFlowCopy = { guide: FtueGuide; actionLabel: string };

export type HatchableDiscoveryFlowDefinition = {
  id: string;
  version: number;
  runId: string;
  migrations?: Readonly<Record<string, string>>;
  /**
   * A Garden lesson before the mission: Steppling's discovery is where the
   * Garden board is introduced. Later friends have none; the lesson was taught.
   */
  gardenLesson?: {
    open: HatchableFlowCopy;
    prepareCapability: string;
    beats: readonly MergeLessonBeat[];
    lessonPrefix: string;
    ready: HatchableFlowCopy;
  };
  offer: HatchableFlowCopy;
  egg: HatchableFlowCopy;
};

export type HatchableDayOneDefinition = {
  flow: { id: string; version: number; runId: string; title: string; migrations?: Readonly<Record<string, string>> };
  opening: string;
  choices: readonly { id: string; label: string }[];
  handoffs: Readonly<Record<string, string>>;
  /** The run variable the reflection's answer is kept under. */
  choiceVariable: string;
  handoffLabel: string;
  parcel: { generatorId: string; rewardId: string };
};

export type HatchableLessonDefinition = {
  flow: { id: string; version: number; runId: string; migrations?: Readonly<Record<string, string>> };
  taskCapability: string;
  /** Task events are `${eventPrefix}.${beat}`. */
  eventPrefix: string;
  closing: string;
  summary: string;
  generatorId: string;
  parcelArrivalId: string;
  /** The tier the lesson grows and serves, and the only drop the spawner gives until it is on the board. */
  growDefinitionId: string;
  dropDefinitionId: string;
  order: Omit<MergeOrder, 'createdAt'>;
  copy: { parcel: FtueGuide; room: FtueGuide; grow: FtueGuide; serve: FtueGuide; finale: FtueGuide };
};

export type HatchableCompanionDefinition = {
  companion: MergeCharacterId;
  tile: HatchableTileDefinition;
  availability: HatchableAvailability;
  /** What the hatch records in companion discovery. */
  discovery: { gateId: string; pathId: string };
  mission: HatchableMissionDefinition;
  discoveryFlow: HatchableDiscoveryFlowDefinition;
  dayOne: HatchableDayOneDefinition;
  lesson: HatchableLessonDefinition;
  economy: { generatorId: string };
};
