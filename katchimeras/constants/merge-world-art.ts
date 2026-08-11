export const MERGE_WORLD_ITEM_ART = {
  'nature:garden:1': require('../assets/images/katchimeras/merge-world/items/nature-garden-1-seed.webp'),
  'nature:garden:2': require('../assets/images/katchimeras/merge-world/items/nature-garden-2-sprout.webp'),
  'nature:garden:3': require('../assets/images/katchimeras/merge-world/items/nature-garden-3-plant.webp'),
  'nature:garden:4': require('../assets/images/katchimeras/merge-world/items/nature-garden-4-flower.webp'),
  'nature:garden:5': require('../assets/images/katchimeras/merge-world/items/nature-garden-5-rare-flower.webp'),
  'nature:garden:6': require('../assets/images/katchimeras/merge-world/items/nature-garden-6-magical-plant.webp'),
  'nature:garden:7': require('../assets/images/katchimeras/merge-world/items/nature-garden-7-ancient-tree.webp'),
  'nature:waterside:1': require('../assets/images/katchimeras/merge-world/items/nature-waterside-1-pebble.webp'),
  'nature:waterside:2': require('../assets/images/katchimeras/merge-world/items/nature-waterside-2-shell.webp'),
  'nature:waterside:3': require('../assets/images/katchimeras/merge-world/items/nature-waterside-3-tidepool.webp'),
  'nature:waterside:4': require('../assets/images/katchimeras/merge-world/items/nature-waterside-4-water-lily.webp'),
  'nature:waterside:5': require('../assets/images/katchimeras/merge-world/items/nature-waterside-5-moonlit-cove.webp'),
  'adventure:trail:1': require('../assets/images/katchimeras/merge-world/items/adventure-trail-1-sock.webp'),
  'adventure:trail:2': require('../assets/images/katchimeras/merge-world/items/adventure-trail-2-shoe.webp'),
  'adventure:trail:3': require('../assets/images/katchimeras/merge-world/items/adventure-trail-3-boot.webp'),
  'adventure:trail:4': require('../assets/images/katchimeras/merge-world/items/adventure-trail-4-hiking-gear.webp'),
  'adventure:trail:5': require('../assets/images/katchimeras/merge-world/items/adventure-trail-5-adventure-pack.webp'),
  'adventure:trail:6': require('../assets/images/katchimeras/merge-world/items/adventure-trail-6-expedition-kit.webp'),
  'adventure:travel:1': require('../assets/images/katchimeras/merge-world/items/adventure-travel-1-ticket.webp'),
  'adventure:travel:2': require('../assets/images/katchimeras/merge-world/items/adventure-travel-2-map.webp'),
  'adventure:travel:3': require('../assets/images/katchimeras/merge-world/items/adventure-travel-3-travel-journal.webp'),
  'adventure:travel:4': require('../assets/images/katchimeras/merge-world/items/adventure-travel-4-suitcase.webp'),
  'adventure:travel:5': require('../assets/images/katchimeras/merge-world/items/adventure-travel-5-grand-journey.webp'),
  'hybrid:picnic-pack': require('../assets/images/katchimeras/merge-world/items/hybrid-picnic-pack.webp'),
} as const;

export type MergeWorldAuthoredItemId = keyof typeof MERGE_WORLD_ITEM_ART;

export function mergeWorldItemArt(definitionId: string) {
  return MERGE_WORLD_ITEM_ART[definitionId as MergeWorldAuthoredItemId] ?? null;
}
