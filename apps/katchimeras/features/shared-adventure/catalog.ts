import type { AdventureOrder, LanternRouteDefinition, SharedAdventureDefinition } from './types';

/** Bundled story: the same opening and destination in development and release. */
export const SHARED_ADVENTURE_ENABLED = true;
export const ADVENTURE_ID = 'shared:first-answer:v1';
export const PREPARATION_ORDER_ID = 'shared:first-answer:preparation';
export const DOORSTEP_ORDER_ID = 'feastle:chapter-1:doorstep-snacks';
export const FIRST_ANSWER: SharedAdventureDefinition = {
  id: ADVENTURE_ID, title: 'The First Answer', destination: 'Reconnect our homes and wake Heartwood',
  beats: [
    { id: 'wish', title: 'Our first signal', speaker: 'mossprout', lines: [
      'Our Garden sent light along the old roots. Steppling found where the lantern used to stand. We can reach farther together.',
      'Heartwood has one living root. Light the old post and we can join our homes together—and give lost friends a way back.',
      'What should our first signal promise?',
    ] },
    { id: 'trail', title: 'The mark on the trail', speaker: 'steppling', lines: [
      'Three notches. My mark! This post linked our homes to Heartwood’s roots. I remembered the snack stop rather better.',
      'A Plant to hold the post, and a Shoe for the short path. Bring them from the Garden. I will keep the mark in sight.',
      'The light we make should reach that warm table in the Mist. Someone there may remember how these lanterns worked.',
    ] },
    { id: 'hearth', title: 'A place kept warm', speaker: 'feastle', lines: [
      'That mark is under my bowl. Two handles, one on either side. I remember another pair of hands, but not their name.',
      'We used to leave a little food for friends travelling the lantern paths. A light should lead somewhere welcoming.',
    ] },
    { id: 'welcome', title: 'Something worth returning to', speaker: 'feastle', lines: [
      'Two Snacks. One for us, one for the doorstep. If you already brought them, they are right where we need them.',
      'Steppling found a place for the post. I will keep the hearth warm while you make the way clear.',
    ] },
    { id: 'post', title: 'The first Lantern Post', speaker: 'steppling', lines: [
      'Roots ready. Hearth warm. Here is the old footing we found beyond my trailhead. One last stretch to clear.',
      'The Mist is holding the last stretch. Match what it keeps, and we can put our light where it belongs.',
    ] },
    { id: 'answer', title: 'The first answer', speaker: 'mossprout', lines: [
      'My roots have the post. Steppling, aim it along the old road. Let’s find out who can see us.',
      'Three flashes, along the old roots. Heartwood is lighting up! Wait… something beyond the bend…',
      'Three flashes back! Someone is there. And look—the Tree’s lower branches are growing leaves!',
      'They answered us. Garden, trail and hearth—our homes are connected. Heartwood is Rooted again. Beyond that bend, another friend needs our light.',
    ] },
  ],
};
export const PREPARATION_ORDER: AdventureOrder = {
  id: PREPARATION_ORDER_ID, characterId: 'steppling', title: 'A post and a path',
  description: 'Mossprout holds the roots; Steppling finds the way. Prepare their first lantern signal.',
  requirements: [{ definitionId: 'nature:garden:3', quantity: 1 }, { definitionId: 'adventure:trail:2', quantity: 1 }],
  reward: { coins: 60, mergeXp: 0, friendshipXp: 0, energy: 0 },
  difficulty: 'small', purpose: 'normal', signature: false, storyArcId: ADVENTURE_ID, storyTargetLevel: 1,
};
export const DOORSTEP_ORDER: AdventureOrder = {
  id: DOORSTEP_ORDER_ID, characterId: 'feastle', title: 'A plate on the step',
  description: 'Two Snacks: one for here, one for whoever finds the light.',
  requirements: [{ definitionId: 'food:table:2', quantity: 2 }],
  reward: { coins: 25, mergeXp: 0, friendshipXp: 0, energy: 0 },
  difficulty: 'small', purpose: 'normal', signature: false, storyArcId: 'feastle-chapter-1', storyTargetLevel: 1,
};
function pathSeed(chain: string) {
  return {
    items: [{ cell: 36, definitionId: `${chain}:1` }, { cell: 37, definitionId: `${chain}:1` }, { cell: 40, definitionId: `${chain}:1` }],
    echoes: [{ cell: 38, id: `${chain}:echo`, definitionId: `${chain}:2` }],
    veiled: [
      { cell: 31, id: `${chain}:a`, definitionId: `${chain}:3` },
      { cell: 24, id: `${chain}:b`, definitionId: `${chain}:5` },
      { cell: 30, id: `${chain}:c`, definitionId: `${chain}:1` },
      { cell: 23, id: `${chain}:d`, definitionId: `${chain}:2` },
      { cell: 22, id: `${chain}:e`, definitionId: `${chain}:3` },
    ],
  };
}
export const SIGNAL_MISSION: LanternRouteDefinition = {
  id: 'signal-site', title: 'Make a way for the light', companion: 'steppling', required: 8,
  seed: pathSeed('adventure:trail'), finalItem: 'adventure:trail:6', reward: 0,
};
export const LANTERN_ROUTES: readonly LanternRouteDefinition[] = [
  { id: 'overgrown-turn', title: 'The Overgrown Turn', companion: 'mossprout', required: 8, seed: pathSeed('nature:garden'), finalItem: 'nature:garden:6', reward: 20 },
  { ...SIGNAL_MISSION, id: 'broken-waymarker', title: 'The Broken Waymarker', reward: 20 },
  { id: 'warm-delivery', title: 'The Warm Delivery', companion: 'feastle', required: 7,
    seed: { items: [22, 23, 24, 25, 29, 30, 31, 32].map(cell => ({ cell, definitionId: 'food:table:1' })), echoes: [], veiled: [] },
    finalItem: 'food:table:4', reward: 20 },
];
export const routeById = (id: string) => id === SIGNAL_MISSION.id ? SIGNAL_MISSION : LANTERN_ROUTES.find(route => route.id === id);
