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
  palette: HavenUpgradeEffectPalette;
  reactionLine: string;
  /** Story camera operations can complete focus before the reveal begins. */
  cameraAlreadyFocused?: boolean;
  /** Some story upgrades are gifts, so their reveal should not imply payment. */
  showCoins?: boolean;
  status: HavenUpgradePresentationStatus;
  storyPresentationKey?: string;
  toStage: HavenStage;
  upgradeName: string;
  /** World object that owns the reveal visuals; it can intentionally differ
   * from the profile field committed by the upgrade. */
  visualTarget?: StoryWorldUpgradePresentationPayload['target'];
};
