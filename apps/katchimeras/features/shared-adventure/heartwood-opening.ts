import { heartwoodStage } from './heartwood-progression';
import type { MergeWorldState } from '@/types/merge-world';
import { adventureNext, feastleReady } from './runtime';

export const HEARTWOOD_STORY = {
  introduction: {
    title: 'Wake Heartwood',
    text: 'Every path once met beneath Heartwood. When the lights went out, our friends were stranded along them.',
    detail: 'Five empty patches surround its roots, and the old spring sleeps under one. Dig it out, and let’s bring this circle back to life.',
    action: 'Build the Dew Spring',
  },
  signal: {
    title: 'The roots remember',
    text: 'Look at Heartwood! The spring is running and its first root is awake. And that broken marker carries the same light. Three notches… Steppling’s trail.',
    detail: 'The Tree is Stirring! The Dew Spring gives the Garden its energy. Four more patches around its roots are waiting to be built on. Two Seeds await in your Garden parcels. Beyond the grove, Steppling needs us too.',
    action: 'Talk to Mossprout',
  },
  recap: {
    title: 'Our living Heartwood',
    text: 'These homes once met at Heartwood. The Mist broke the paths between them. Every place we restore gives the next friend a way home.',
    detail: 'Your progress is already part of that journey. Follow the next task to see where our light can reach.',
    action: 'See our next step',
  },
} as const;

/** Display-only projection: receipts remain the sole owners of gameplay completion. */
export function heartwoodRoad(world: MergeWorldState) {
  const garden = heartwoodStage(world) !== 'dormant';
  const stepplingHome = Boolean(world.hatchableEggs?.steppling?.hatchedAt || world.stepplingEgg?.hatchedAt);
  const trail = Boolean(world.gardenLessons?.steppling?.servedAt || world.stepplingGardenLesson?.servedAt || world.kingdomGoal?.introducedAt);
  const hearth = feastleReady(world);
  const signal = world.sharedAdventure?.completedAt != null;
  const next = adventureNext(world);
  return {
    title: 'Wake Heartwood',
    objective: !garden ? 'Wake the Garden' : !trail ? stepplingHome ? 'Equip Steppling for the lantern path' : 'Find Steppling at the broken trail'
      : next?.title ?? 'Restore the first lantern path',
    chapters: [
      { id: 'garden', title: 'Garden', complete: garden },
      { id: 'trail', title: 'Trail', complete: trail },
      { id: 'hearth', title: 'Hearth', complete: hearth },
      { id: 'signal', title: 'First Signal', complete: signal },
    ],
    signal,
  };
}

export function needsHeartwoodRecap(world: MergeWorldState) {
  return world.sharedAdventure?.presentations?.introduction == null
    && world.sharedAdventure?.presentations?.recap == null;
}
