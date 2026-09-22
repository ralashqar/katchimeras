/** Presentation only: persisted `coins` fields remain compatible with existing saves. */
export const GLOW = {
  name: 'Glow',
  firstRestorationCost: 20,
  mistUnlockCost: 40,
  /** Steppling's mist after the first session: handed to the player as it opens, then spent on it. */
  stepplingMistCost: 20,
  tutorialRequestReward: 20,
} as const;

export const glowPrice = (amount: number) => `${amount} Glow`;
