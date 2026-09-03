import type { HavenStage } from '@/constants/haven-catalog';
import type { StoryWorldUpgradePresentationPayload } from '@/types/content-flow';
import type { MergeCharacterId, MossproutNatureIslandId } from '@/types/merge-world';

export type HavenUpgradePresentationStatus = 'armed' | 'playing';
export type HavenUpgradePresentationPhase =
  | 'armed'
  | 'focus'
  | 'payment'
  | 'cover'
  | 'reveal'
  | 'react'
  | 'complete';

export type HavenUpgradeEffectPalette = {
  accent: string;
  glow: string;
  mist: string;
  primary: string;
};

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

export const HAVEN_UPGRADE_TIMING = {
  cameraMs: 420,
  coverAtMs: 330,
  revealAtMs: 650,
  reactAtMs: 1_180,
  completeAtMs: 2_300,
} as const;

export const HAVEN_UPGRADE_REDUCED_TIMING = {
  cameraMs: 80,
  revealAtMs: 20,
  reactAtMs: 210,
  completeAtMs: 430,
} as const;

/** Pure timeline helper used by tests and presentation previews. */
export function havenUpgradePhaseAt(elapsedAfterFocusMs: number, reducedMotion: boolean): HavenUpgradePresentationPhase {
  const elapsed = Math.max(0, elapsedAfterFocusMs);
  if (reducedMotion) {
    if (elapsed >= HAVEN_UPGRADE_REDUCED_TIMING.completeAtMs) return 'complete';
    if (elapsed >= HAVEN_UPGRADE_REDUCED_TIMING.reactAtMs) return 'react';
    if (elapsed >= HAVEN_UPGRADE_REDUCED_TIMING.revealAtMs) return 'reveal';
    return 'focus';
  }
  if (elapsed >= HAVEN_UPGRADE_TIMING.completeAtMs) return 'complete';
  if (elapsed >= HAVEN_UPGRADE_TIMING.reactAtMs) return 'react';
  if (elapsed >= HAVEN_UPGRADE_TIMING.revealAtMs) return 'reveal';
  if (elapsed >= HAVEN_UPGRADE_TIMING.coverAtMs) return 'cover';
  return 'payment';
}
