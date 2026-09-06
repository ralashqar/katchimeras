export type HavenUpgradePresentationStatus = 'armed' | 'playing';
export type HavenUpgradePresentationPhase =
  | 'armed'
  | 'focus'
  | 'payment'
  | 'cover'
  | 'reveal'
  | 'react'
  | 'complete';

export type HavenUpgradePhaseState = { nonce: number | null; phase: HavenUpgradePresentationPhase };

/** Phase belongs to one receipt, never to the next restoration's first render. */
export function havenUpgradePhaseForPresentation(state: HavenUpgradePhaseState, nonce: number | null | undefined): HavenUpgradePresentationPhase {
  return nonce != null && state.nonce === nonce ? state.phase : 'armed';
}

export type HavenUpgradeEffectPalette = {
  accent: string;
  glow: string;
  mist: string;
  primary: string;
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
