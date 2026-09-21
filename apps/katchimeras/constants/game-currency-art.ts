export const GAME_CURRENCY_ART = {
  bond: require('@incubator/art-merge-world/ui/bond.webp'),
  // Egg-feed Energy uses Bond art; coins is the persisted currency key for Glow.
  energy: require('@incubator/art-merge-world/ui/bond.webp'),
  coins: require('@incubator/art-merge-world/ui/glow-swirl-v3.png'),
  // Merge energy, from the Dew Spring: cool where Glow is warm, so the two never read alike in the top bar.
  mergeEnergy: require('@incubator/art-merge-world/ui/energy-dew-v1.webp'),
} as const;
