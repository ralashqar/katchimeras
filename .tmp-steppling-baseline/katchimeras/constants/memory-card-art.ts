export const VEILED_MEMORY_CARD_ART = require('../assets/images/katchimeras/merge-world/items/veiled-memory-card-back.webp');
export const RARE_MEMORY_CARD_REVEAL_ART = require('../assets/images/katchimeras/merge-world/items/rare-memory-card-reveal.webp');

const MEMORY_CARD_ART = {
  'rain-on-glass': require('../assets/images/katchimeras/merge-world/items/memory-card-rain-on-glass.webp'),
  'first-green-shoot': require('../assets/images/katchimeras/merge-world/items/memory-card-first-green-shoot.webp'),
  'path-taken-twice': require('../assets/images/katchimeras/merge-world/items/memory-card-path-taken-twice.webp'),
  'cup-after-rain': require('../assets/images/katchimeras/merge-world/items/memory-card-cup-after-rain.webp'),
  'light-through-leaves': require('../assets/images/katchimeras/merge-world/items/memory-card-light-through-leaves.webp'),
  'something-worth-keeping': require('../assets/images/katchimeras/merge-world/items/memory-card-something-worth-keeping.webp'),
} as const;

export function memoryCardArt(cardId: string) {
  return MEMORY_CARD_ART[cardId as keyof typeof MEMORY_CARD_ART] ?? VEILED_MEMORY_CARD_ART;
}
