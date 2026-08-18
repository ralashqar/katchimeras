import type { HavenStage } from '@/constants/haven-catalog';
import type { MergeCharacterId } from '@/types/merge-world';

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
  palette: HavenUpgradeEffectPalette;
  reactionLine: string;
  status: HavenUpgradePresentationStatus;
  toStage: HavenStage;
  upgradeName: string;
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
