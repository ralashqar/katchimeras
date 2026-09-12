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
  /** The key its cleared art's alpha bounds are generated under; the art itself is in `tile-art.ts`, by tile id. */
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
  /** The conversation the hatch opens, whose completed session is replayed into the day-one flow. */
  conversationId: string;
  opening: string;
  choices: readonly { id: string; label: string }[];
  handoffs: Readonly<Record<string, string>>;
  /** The run variable the reflection's answer is kept under. */
  choiceVariable: string;
  handoffLabel: string;
  /** The conversation's closing line, once the parcel is on its way. */
  endMessage: string;
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
  copy: { parcel: FtueGuide; room: FtueGuide; grow: FtueGuide; serve: FtueGuide; finale: FtueGuide; /** The button that leaves the closing scene. */ finaleAction: string };
};

/** One answer the Egg can be given, drawn as a question card. */
export type HatchableEggOption = { id: string; label: string; icon?: string; domainChoiceId?: string };
/**
 * What the Egg is fed with. Steps are counted whole from yesterday (a Motion
 * ask first); a photo of today fills the Egg with one matching capture; an
 * answer-only Egg hatches on its alternative question alone.
 */
export type HatchableEggFeed =
  | { kind: 'steps'; target: number; perBond: number; actionTitle: string; readingTitle: string }
  | { kind: 'photo'; category: string; bond: number; actionTitle: string }
  | { kind: 'answer' };
export type HatchableEggPolicy = {
  /** The Egg's glow while it hatches. */
  accentColor: string;
  guides: { intent: FtueGuide; reading: FtueGuide; feed: FtueGuide; permission: FtueGuide; alternative: FtueGuide; ready: FtueGuide };
  intent: { actionId: string; title: string; bond: number; options: readonly HatchableEggOption[] };
  alternative: { actionId: string; title: string; bond: number; options: readonly HatchableEggOption[] };
  /** The spoken ask before a system permission prompt, when the feed needs one. */
  access?: { allow: { id: string; title: string; description: string; icon?: string }; decline: { id: string; title: string; description: string; icon?: string } };
  feed: HatchableEggFeed;
  hatch: { actionId: string; title: string; description: string };
};

export type HatchableCompanionDefinition = {
  companion: MergeCharacterId;
  displayName: string;
  tile: HatchableTileDefinition;
  availability: HatchableAvailability;
  /** What the hatch records in companion discovery. */
  discovery: { gateId: string; pathId: string };
  mission: HatchableMissionDefinition;
  discoveryFlow: HatchableDiscoveryFlowDefinition;
  dayOne: HatchableDayOneDefinition;
  lesson: HatchableLessonDefinition;
  egg: HatchableEggPolicy;
  economy: { generatorId: string };
};
