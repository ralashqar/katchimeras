/** Presentation only: persisted `coins` fields remain compatible with existing saves. */
export const GLOW = {
  name: 'Glow',
  firstRestorationCost: 20,
  mistUnlockCost: 40,
  tutorialRequestReward: 20,
} as const;

export const glowPrice = (amount: number) => `${amount} Glow`;
