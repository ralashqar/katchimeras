import { islandLevel, type IslandLevelSpec } from '@/constants/island-campaigns/island-levels';
import type { EncounterDefinition } from '@/types/encounter';
import type { RescueBattleCopy } from '@/types/hatchable-companion';

/**
 * A friend's rescue (`docs/cozy-4x-ftue-v2-wayfinders-road.md`, Chapter 1 on): a Lanes battle docked under their misted
 * tile, played the way the Lost Trail's last stone taught. The friend is trapped under the thick Mist at the top of the
 * middle lane, ringed by light Mist; it is won with every wisp down and that cell cleared (`rescue`). No ticket: the
 * battle is the price. Seeds land only in the bottom two rows, under the plants.
 */
const BOTTOM_ROWS = [36, 37, 38, 39, 40, 43, 44, 45, 46, 47] as const;

/**
 * Chapter 1, The Lit Window: Baristabbit, who kept a lamp lit in the Mist, and the wisps drawn to it. One more wave than
 * the Lost Trail's rescue, a spitter on the right, and the lamp's keeper (a warden) down the middle. Not forgiving: the
 * first session is over, and a loss is retried.
 */
const BARISTABBIT_RESCUE_SPEC: IslandLevelSpec = {
  title: 'The Lit Window', objective: 'Bring down every wisp, and burn the thick Mist off whoever kept the lamp lit.', difficulty: 'calm',
  pieces: [[43, 1], [44, 2], [45, 1], [46, 2], [47, 1], [36, 1], [38, 2], [40, 1], [30, 2], [32, 2]],
  mist: [16, 18, 24, 23, 25].map((cell) => ({ cell, type: 'light' as const })),
  rescue: { cell: 17 },
  wisps: [], seeds: { every: 3, area: BOTTOM_ROWS }, rows: 5,
  lanes: [
    { id: 'moth-1', column: 3, at: 2, hp: 4, step: 6 },
    { id: 'moth-2', column: 1, at: 7, hp: 4, step: 5.5 },
    { id: 'moth-3', column: 5, at: 7.6, hp: 4, step: 5.5, spit: 6 },
    { id: 'moth-4', column: 2, at: 14, hp: 5, step: 5 },
    { id: 'moth-5', column: 4, at: 14.6, hp: 5, step: 5 },
    { id: 'lamp-keeper', column: 3, at: 21, hp: 9, step: 5, look: 'warden' },
    { id: 'last-1', column: 1, at: 27, hp: 5, step: 4.5 },
    { id: 'last-2', column: 5, at: 27.6, hp: 5, step: 4.5 },
    { id: 'last-3', column: 2, at: 28.2, hp: 5, step: 4.5 },
  ],
  rewards: { glow: 25, xp: 12 },
};

export const BARISTABBIT_RESCUE_BATTLE: EncounterDefinition = islandLevel('rescue', 'baristabbit', BARISTABBIT_RESCUE_SPEC).encounter;

export const BARISTABBIT_RESCUE_COPY: RescueBattleCopy = {
  intro: { title: 'The Lit Window', line: 'The wisps are drawn to the lamp. Get there first: clear them, then burn the Mist off whoever kept it lit.' },
  voice: 'Someone at the window',
  hello: 'Kettle’s on. If anyone’s out there.',
  guard: 'They’re guarding the light. Of course they are.',
  light: 'Is that… light? Keep it coming.',
  almost: 'Nearly through. Right by the window.',
  steer: 'Merge beside the thick Mist by the window. Burn it off him.',
  arrival: {
    title: 'The Lit Window', answer: 'Open the Caf\u00e9',
    lines: [
      { speaker: 'baristabbit', text: 'You walked through that? For me?' },
      { speaker: 'baristabbit', text: 'I kept the lamp lit every night. I hoped someone would see it.' },
      { speaker: 'mossprout', text: 'We saw it. You\u2019re safe now.' },
      { speaker: 'baristabbit', text: 'Then let me be useful. Your crew looks half-starved.' },
      { speaker: 'steppling', text: 'We might have skipped a few breakfasts.' },
      { speaker: 'baristabbit', text: 'Heroes fight on full bellies. Bring me what they order, and I\u2019ll turn it into Meals.' },
      { speaker: 'baristabbit', text: 'Meals make heroes stronger. Come on. The Caf\u00e9 is open.' },
    ],
  },
};
