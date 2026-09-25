export * from '@incubator/environments/upgrade-presentation';
import type { HavenUpgradeEffectPalette, HavenUpgradePresentationStatus } from '@incubator/environments/upgrade-presentation';
import type { HavenStage } from '@/constants/haven-catalog';
import type { StoryWorldUpgradePresentationPayload } from '@/types/content-flow';
import type { MergeCharacterId, MossproutNatureIslandId } from '@/types/merge-world';
export type HavenTileUpgradePresentation = {
  characterId: MergeCharacterId;
  coinCost: number;
  coinOrigin: { x: number; y: number };
  creatureName: string;
  creatureId: string;
  fromStage: HavenStage;
  nonce: number;
  natureIslandId?: MossproutNatureIslandId;
  natureIslandReveal?: boolean;
  palette: HavenUpgradeEffectPalette;
  reactionLine: string;
  /** Story camera operations can complete focus before the reveal begins. */
  cameraAlreadyFocused?: boolean;
  /** Some story upgrades are gifts, so their reveal should not imply payment. */
  showCoins?: boolean;
  /**
   * The opening's mist lift: the same tile crossblend, driven by a local
   * presentation with no world write. Nothing is purchased or staged, so the
   * finish path must not touch story resolvers, Glow or the tutorial nonce.
   */
  veilLift?: boolean;
  /**
   * The Last Clearing's Heart Tree waking: the Heartwood crossblends between these two stages, with the coins and the
   * field of light of any restoration. The world is written alongside; the finish path hands the story on.
   */
  /**
   * A Last Clearing reveal the story plays locally while it writes the world (the Lost Trail clearing, Steppling's tile
   * opening); the finish path hands its beat on instead of a purchase's story.
   */
  /** A hero's level up: the full sequence on their own tile ('home' is Mossprout's), the art unchanged. */
  tileLevelUp?: { layerId: string };
  /** A friend's tile cleared with them on it (a rescue): the tile id. */
  ftueReveal?: string;
  /** A hero building's new look on its friend's tile: the tile crossblends from one look to the next. */
  tileLook?: { tileId: string; from: number; to: number };
  /** A friend's tile opening with them already home: no Egg is revealed with it. */
  noEgg?: boolean;
  heartTree?: { from: import('@/features/shared-adventure/heartwood-progression').HeartwoodStage; to: import('@/features/shared-adventure/heartwood-progression').HeartwoodStage; /** A level grown from its panel, not the first session's waking: the story is not moved on. */ grown?: boolean };
  status: HavenUpgradePresentationStatus;
  storyPresentationKey?: string;
  toStage: HavenStage;
  upgradeName: string;
  /** World object that owns the reveal visuals; it can intentionally differ
   * from the profile field committed by the upgrade. */
  visualTarget?: StoryWorldUpgradePresentationPayload['target'];
};
