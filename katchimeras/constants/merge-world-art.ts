import { MOSSPROUT_ROOTBOUND_GATES_BY_ID } from '@/constants/merge-world-catalog';
import { VEILED_MEMORY_CARD_ART } from '@/constants/memory-card-art';

export const MERGE_WORLD_ITEM_ART = {
  'food:table:1': require('../assets/images/katchimeras/merge-world/items/food-table-1-ingredient.webp'),
  'food:table:2': require('../assets/images/katchimeras/merge-world/items/food-table-2-snack.webp'),
  'food:table:3': require('../assets/images/katchimeras/merge-world/items/food-table-3-dish.webp'),
  'food:table:4': require('../assets/images/katchimeras/merge-world/items/food-table-4-meal.webp'),
  'food:table:5': require('../assets/images/katchimeras/merge-world/items/food-table-5-feast.webp'),
  'food:table:6': require('../assets/images/katchimeras/merge-world/items/food-table-6-banquet.webp'),
  'food:dessert:1': require('../assets/images/katchimeras/merge-world/items/food-dessert-1-flour-scoop.webp'),
  'food:dessert:2': require('../assets/images/katchimeras/merge-world/items/food-dessert-2-cake-batter.webp'),
  'food:dessert:3': require('../assets/images/katchimeras/merge-world/items/food-dessert-3-cupcake.webp'),
  'food:dessert:4': require('../assets/images/katchimeras/merge-world/items/food-dessert-4-layer-cake.webp'),
  'food:dessert:5': require('../assets/images/katchimeras/merge-world/items/food-dessert-5-celebration-cake.webp'),
  'food:dessert:6': require('../assets/images/katchimeras/merge-world/items/food-dessert-6-dream-cake.webp'),
  'drink:hot:1': require('../assets/images/katchimeras/merge-world/items/drink-hot-1-tea-leaf.webp'),
  'drink:hot:2': require('../assets/images/katchimeras/merge-world/items/drink-hot-2-tea-cup.webp'),
  'drink:hot:3': require('../assets/images/katchimeras/merge-world/items/drink-hot-3-teapot.webp'),
  'drink:hot:4': require('../assets/images/katchimeras/merge-world/items/drink-hot-4-cocoa-tray.webp'),
  'drink:hot:5': require('../assets/images/katchimeras/merge-world/items/drink-hot-5-cafe-service.webp'),
  'drink:hot:6': require('../assets/images/katchimeras/merge-world/items/drink-hot-6-hearth-ceremony.webp'),
  'drink:refresh:1': require('../assets/images/katchimeras/merge-world/items/drink-refresh-1-berry.webp'),
  'drink:refresh:2': require('../assets/images/katchimeras/merge-world/items/drink-refresh-2-fruit-juice.webp'),
  'drink:refresh:3': require('../assets/images/katchimeras/merge-world/items/drink-refresh-3-smoothie.webp'),
  'drink:refresh:4': require('../assets/images/katchimeras/merge-world/items/drink-refresh-4-lemonade-pitcher.webp'),
  'drink:refresh:5': require('../assets/images/katchimeras/merge-world/items/drink-refresh-5-garden-drinks-cart.webp'),
  'drink:refresh:6': require('../assets/images/katchimeras/merge-world/items/drink-refresh-6-festival-fountain.webp'),
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
  'nature:waterside:6': require('../assets/images/katchimeras/merge-world/items/nature-waterside-6-ocean-sanctuary.webp'),
  'nature:keepsake:1': require('../assets/images/katchimeras/merge-world/items/nature-keepsake-1-dew-bead.webp'),
  'nature:keepsake:2': require('../assets/images/katchimeras/merge-world/items/nature-keepsake-2-pressed-leaf.webp'),
  'nature:keepsake:3': require('../assets/images/katchimeras/merge-world/items/nature-keepsake-3-memory-sprig.webp'),
  'nature:keepsake:4': require('../assets/images/katchimeras/merge-world/items/nature-keepsake-4-field-journal.webp'),
  'nature:keepsake:5': require('../assets/images/katchimeras/merge-world/items/nature-keepsake-5-memory-terrarium.webp'),
  'nature:keepsake:6': require('../assets/images/katchimeras/merge-world/items/nature-keepsake-6-living-archive.webp'),
  'mossprout:root-memory:returning-seed': require('../assets/images/katchimeras/merge-world/items/mossprout-root-returning-seed.webp'),
  'mossprout:root-memory:rain-kept-acorn': require('../assets/images/katchimeras/merge-world/items/mossprout-root-rain-kept-acorn.webp'),
  'mossprout:root-memory:nursery-keepsake': require('../assets/images/katchimeras/merge-world/items/mossprout-root-nursery-keepsake.webp'),
  'mossprout:root-memory:heartseed': require('../assets/images/katchimeras/merge-world/items/mossprout-root-heartseed.webp'),
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
  'adventure:travel:6': require('../assets/images/katchimeras/merge-world/items/adventure-travel-6-memory-globe.webp'),
  'comfort:rest:1': require('../assets/images/katchimeras/merge-world/items/comfort-rest-1-pillow-feather.webp'),
  'comfort:rest:2': require('../assets/images/katchimeras/merge-world/items/comfort-rest-2-cushion.webp'),
  'comfort:rest:3': require('../assets/images/katchimeras/merge-world/items/comfort-rest-3-pillow.webp'),
  'comfort:rest:4': require('../assets/images/katchimeras/merge-world/items/comfort-rest-4-blanket-nest.webp'),
  'comfort:rest:5': require('../assets/images/katchimeras/merge-world/items/comfort-rest-5-cosy-bed.webp'),
  'comfort:rest:6': require('../assets/images/katchimeras/merge-world/items/comfort-rest-6-dream-room.webp'),
  'comfort:care:1': require('../assets/images/katchimeras/merge-world/items/comfort-care-1-bandage.webp'),
  'comfort:care:2': require('../assets/images/katchimeras/merge-world/items/comfort-care-2-care-pouch.webp'),
  'comfort:care:3': require('../assets/images/katchimeras/merge-world/items/comfort-care-3-first-aid-kit.webp'),
  'comfort:care:4': require('../assets/images/katchimeras/merge-world/items/comfort-care-4-comfort-basket.webp'),
  'comfort:care:5': require('../assets/images/katchimeras/merge-world/items/comfort-care-5-healing-cabinet.webp'),
  'comfort:care:6': require('../assets/images/katchimeras/merge-world/items/comfort-care-6-sanctuary-kit.webp'),
  'social:gathering:1': require('../assets/images/katchimeras/merge-world/items/social-gathering-1-place-card.webp'),
  'social:gathering:2': require('../assets/images/katchimeras/merge-world/items/social-gathering-2-shared-plate.webp'),
  'social:gathering:3': require('../assets/images/katchimeras/merge-world/items/social-gathering-3-picnic-cloth.webp'),
  'social:gathering:4': require('../assets/images/katchimeras/merge-world/items/social-gathering-4-gathering-table.webp'),
  'social:gathering:5': require('../assets/images/katchimeras/merge-world/items/social-gathering-5-community-supper.webp'),
  'social:gathering:6': require('../assets/images/katchimeras/merge-world/items/social-gathering-6-village-festival.webp'),
  'social:celebration:1': require('../assets/images/katchimeras/merge-world/items/social-celebration-1-ribbon.webp'),
  'social:celebration:2': require('../assets/images/katchimeras/merge-world/items/social-celebration-2-wrapped-gift.webp'),
  'social:celebration:3': require('../assets/images/katchimeras/merge-world/items/social-celebration-3-party-hat.webp'),
  'social:celebration:4': require('../assets/images/katchimeras/merge-world/items/social-celebration-4-celebration-hamper.webp'),
  'social:celebration:5': require('../assets/images/katchimeras/merge-world/items/social-celebration-5-joyful-parade.webp'),
  'social:celebration:6': require('../assets/images/katchimeras/merge-world/items/social-celebration-6-grand-jubilee.webp'),
  'mind:work:1': require('../assets/images/katchimeras/merge-world/items/mind-work-1-sticky-note.webp'),
  'mind:work:2': require('../assets/images/katchimeras/merge-world/items/mind-work-2-checklist.webp'),
  'mind:work:3': require('../assets/images/katchimeras/merge-world/items/mind-work-3-planner.webp'),
  'mind:work:4': require('../assets/images/katchimeras/merge-world/items/mind-work-4-tidy-desk.webp'),
  'mind:work:5': require('../assets/images/katchimeras/merge-world/items/mind-work-5-project-station.webp'),
  'mind:work:6': require('../assets/images/katchimeras/merge-world/items/mind-work-6-calm-command-centre.webp'),
  'mind:books:1': require('../assets/images/katchimeras/merge-world/items/mind-books-1-bookmark.webp'),
  'mind:books:2': require('../assets/images/katchimeras/merge-world/items/mind-books-2-pocket-book.webp'),
  'mind:books:3': require('../assets/images/katchimeras/merge-world/items/mind-books-3-story-stack.webp'),
  'mind:books:4': require('../assets/images/katchimeras/merge-world/items/mind-books-4-reading-nook.webp'),
  'mind:books:5': require('../assets/images/katchimeras/merge-world/items/mind-books-5-library-cart.webp'),
  'mind:books:6': require('../assets/images/katchimeras/merge-world/items/mind-books-6-wonder-library.webp'),
  'creative:art:1': require('../assets/images/katchimeras/merge-world/items/creative-art-1-pencil.webp'),
  'creative:art:2': require('../assets/images/katchimeras/merge-world/items/creative-art-2-sketchbook.webp'),
  'creative:art:3': require('../assets/images/katchimeras/merge-world/items/creative-art-3-paint-set.webp'),
  'creative:art:4': require('../assets/images/katchimeras/merge-world/items/creative-art-4-easel.webp'),
  'creative:art:5': require('../assets/images/katchimeras/merge-world/items/creative-art-5-studio-corner.webp'),
  'creative:art:6': require('../assets/images/katchimeras/merge-world/items/creative-art-6-gallery-of-dreams.webp'),
  'creative:screen:1': require('../assets/images/katchimeras/merge-world/items/creative-screen-1-game-token.webp'),
  'creative:screen:2': require('../assets/images/katchimeras/merge-world/items/creative-screen-2-handheld-game.webp'),
  'creative:screen:3': require('../assets/images/katchimeras/merge-world/items/creative-screen-3-console.webp'),
  'creative:screen:4': require('../assets/images/katchimeras/merge-world/items/creative-screen-4-cosy-game-setup.webp'),
  'creative:screen:5': require('../assets/images/katchimeras/merge-world/items/creative-screen-5-arcade-corner.webp'),
  'creative:screen:6': require('../assets/images/katchimeras/merge-world/items/creative-screen-6-pixel-palace.webp'),
  'hybrid:picnic-pack': require('../assets/images/katchimeras/merge-world/items/hybrid-picnic-pack.webp'),
  'hybrid:memory-bloom': require('../assets/images/katchimeras/merge-world/items/hybrid-memory-bloom.webp'),
  'hybrid:rain-mirror': require('../assets/images/katchimeras/merge-world/items/hybrid-rain-mirror.webp'),
  'hybrid:heartwood-sanctuary': require('../assets/images/katchimeras/merge-world/items/hybrid-heartwood-sanctuary.webp'),
} as const;

export type MergeWorldAuthoredItemId = keyof typeof MERGE_WORLD_ITEM_ART;

export const MERGE_WORLD_GENERATOR_ART = {
  'hearth-pantry': require('../assets/images/katchimeras/merge-world/generators/hearth-pantry.webp'),
  'ritual-bar': require('../assets/images/katchimeras/merge-world/generators/ritual-bar.webp'),
  'journey-locker': require('../assets/images/katchimeras/merge-world/generators/journey-locker.webp'),
  'wild-garden': require('../assets/images/katchimeras/merge-world/generators/wild-garden.webp'),
  'memory-nursery': require('../assets/images/katchimeras/merge-world/items/memory-nursery-stage-1.webp'),
  'comfort-chest': require('../assets/images/katchimeras/merge-world/generators/comfort-chest.webp'),
  'community-cart': require('../assets/images/katchimeras/merge-world/generators/community-cart.webp'),
  'study-desk': require('../assets/images/katchimeras/merge-world/generators/study-desk.webp'),
  'creative-playroom': require('../assets/images/katchimeras/merge-world/generators/creative-playroom.webp'),
} as const;
export const MOSSPROUT_SPROUTING_POT_ART = require('../assets/images/katchimeras/merge-world/generators/mossprout-sprouting-pot.webp');

export type MergeWorldAuthoredGeneratorId = keyof typeof MERGE_WORLD_GENERATOR_ART;

export function mergeWorldItemArt(definitionId: string) {
  return MERGE_WORLD_ITEM_ART[definitionId as MergeWorldAuthoredItemId] ?? null;
}

export function mergeWorldGeneratorArt(generatorId: string, options?: { mossproutOnboarding?: boolean; level?: number }) {
  if (generatorId === 'wild-garden' && options?.mossproutOnboarding) return MOSSPROUT_SPROUTING_POT_ART;
  if (generatorId === 'wild-garden' && (options?.level ?? 1) >= 3) return MOSSPROUT_PROGRESSION_ART.wildGardenUpgrades[1];
  if (generatorId === 'wild-garden' && (options?.level ?? 1) >= 2) return MOSSPROUT_PROGRESSION_ART.wildGardenUpgrades[0];
  if (generatorId === 'memory-nursery') return MOSSPROUT_PROGRESSION_ART.memoryNursery[Math.max(0, Math.min(2, (options?.level ?? 1) - 1))];
  return MERGE_WORLD_GENERATOR_ART[generatorId as MergeWorldAuthoredGeneratorId] ?? null;
}

export const MOSSPROUT_PROGRESSION_ART = {
  memoryNursery: [
    require('../assets/images/katchimeras/merge-world/items/memory-nursery-stage-1.webp'),
    require('../assets/images/katchimeras/merge-world/items/memory-nursery-stage-2.webp'),
    require('../assets/images/katchimeras/merge-world/items/memory-nursery-stage-3.webp'),
  ],
  wildGardenUpgrades: [
    require('../assets/images/katchimeras/merge-world/items/wild-garden-stage-2.webp'),
    require('../assets/images/katchimeras/merge-world/items/wild-garden-stage-3.webp'),
  ],
  rootParcelClosed: require('../assets/images/katchimeras/merge-world/items/root-match-parcel-closed.webp'),
  rootParcelOpen: require('../assets/images/katchimeras/merge-world/items/root-match-parcel-open.webp'),
  fernWispNest: require('../assets/images/katchimeras/merge-world/items/mossprout-fern-wisp-nest.webp'),
  grovelightWispNest: require('../assets/images/katchimeras/merge-world/items/mossprout-grovelight-wisp-nest.webp'),
  heartwoodLandmark: require('../assets/images/katchimeras/merge-world/items/mossprout-heartwood-landmark.webp'),
} as const;

/** Keeps every Rootbound preview on the board and in its inspector identical. */
export function mossproutRootRewardArt(gateId: string) {
  const gate = MOSSPROUT_ROOTBOUND_GATES_BY_ID.get(gateId);
  if (!gate) return null;
  const generatorReward = gate.rewards.find((reward) => reward.kind === 'generator_level');
  return gate.rewardPreview === 'wisp_nest' ? MOSSPROUT_PROGRESSION_ART.fernWispNest
    : gate.rewardPreview === 'heartwood' ? MOSSPROUT_PROGRESSION_ART.heartwoodLandmark
      : gate.rewardPreview === 'memory_card' ? VEILED_MEMORY_CARD_ART
        : gate.rewardPreview === 'nursery' ? MOSSPROUT_PROGRESSION_ART.memoryNursery[0]
          : gate.rewardPreview === 'keepsake' ? mergeWorldItemArt('nature:keepsake:2')
            : generatorReward?.kind === 'generator_level' && generatorReward.generatorId === 'wild-garden'
              ? MOSSPROUT_PROGRESSION_ART.wildGardenUpgrades[generatorReward.level - 2]
              : generatorReward?.kind === 'generator_level' && generatorReward.generatorId === 'memory-nursery'
                ? MOSSPROUT_PROGRESSION_ART.memoryNursery[generatorReward.level - 1]
                : mergeWorldItemArt(gate.rootMemoryDefinitionId);
}
