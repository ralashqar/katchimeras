import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { BARISTABBIT_DAY_ONE_CHOICES, BARISTABBIT_DAY_ONE_END, BARISTABBIT_DAY_ONE_HANDOFFS, BARISTABBIT_DAY_ONE_OPENING } from '@/constants/baristabbit-day-one-copy';
import { BARISTABBIT_EGG_POLICY } from '@/constants/baristabbit-egg-copy';
import { STEPPLING_WISPS } from '@/features/onboarding/corruption-wisps';
import { MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM } from '@/features/onboarding/opening-mist';

/**
 * Baristabbit, the second friend the Mist kept: a lit window beside the
 * trail, a board of tea things, an Egg that warms when you pause, the
 * Ritual Bar. Authored entirely here and in the copy files it imports; the
 * hex art is registered in `tile-art.ts`.
 */
export const BARISTABBIT_HATCHABLE: HatchableCompanionDefinition = {
  companion: 'baristabbit',
  displayName: 'Baristabbit',
  tile: {
    id: 'baristabbit-home', coord: { q: 1, r: -1 },
    unlockId: 'mossprout:warm-light', price: 60,
    name: 'A lit window', revealPreset: 'mist-clear',
    alphaBoundsKey: 'shared_world_baristabbit_window_hex_tile_v1.webp',
    markerLines: { sleeping: 'The Mist still holds this one.' },
  },
  // The window wakes once Mossprout's wish has been told: the Kingdom has a purpose before a second friend.
  availability: { kind: 'kingdom_goal_introduced' },
  discovery: { gateId: 'gate-3-first-choice', pathId: 'warm-light' },
  mission: {
    id: 'mission:baristabbit',
    storageKey: 'katchimeras.mist-mission.baristabbit.v1',
    /** Two merges and six wakings: eight strikes, two per wisp. */
    required: 8,
    camera: { kind: 'focus_target', target: { kind: 'haven_gateway' }, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 900 },
    seed: {
      /** Tea things the Mist left by the window: three Tea Leaves along the bottom, two of them side by side. */
      items: [
        { cell: 40, definitionId: 'drink:hot:1' },
        { cell: 39, definitionId: 'drink:hot:1' },
        { cell: 36, definitionId: 'drink:hot:1' },
      ],
      /** The one sleeper the player can see: a Tea Cup under a lower band of mist, bottom middle, that wakes as a Teapot. */
      echoes: [{ cell: 38, id: 'baristabbit-hot-1', definitionId: 'drink:hot:2' }],
      /**
       * The cells the Mist holds completely, climbing the other way from Steppling's board: 31 above
       * the sleeper; 24 and 32 above and beside that; 25 above 32; 26 beside 25. The top one (24)
       * wants the Café Service two Cocoa Trays make.
       */
      veiled: [
        { cell: 31, id: 'baristabbit-hot-2', definitionId: 'drink:hot:3' },
        { cell: 24, id: 'baristabbit-hot-3', definitionId: 'drink:hot:5' },
        { cell: 32, id: 'baristabbit-hot-4', definitionId: 'drink:hot:1' },
        { cell: 25, id: 'baristabbit-hot-5', definitionId: 'drink:hot:2' },
        { cell: 26, id: 'baristabbit-hot-6', definitionId: 'drink:hot:3' },
      ],
    },
    guides: {
      firstMerge: { eyebrow: 'Left by the window', title: 'Two Tea Leaves. Together.', body: 'Every merge strikes a wisp.' },
      wake: { eyebrow: 'Asleep under the Mist', title: 'Something under there wants {a} {name}.', body: 'Give it its match. What it was hiding comes with it.' },
      merge: { eyebrow: 'Two of a kind', title: 'Two of the same make {a} {name}.', body: 'Drag one onto the other. Every merge strikes a wisp.' },
      mergeFallbackTitle: 'Two of the same make the next one up.',
      free: { eyebrow: 'Keep striking', title: 'Keep merging.', body: 'Two of the same, together.' },
    },
    wisps: STEPPLING_WISPS,
    lines: {
      firstStrike: 'It felt that.',
      fell: ['One gone. The kettle ticks.', 'Two gone. Steam on the glass.', 'One left, and the light is on.'],
      last: 'The last one falls. Look what it was keeping warm.',
      reveal: 'It was holding more.',
    },
  },
  discoveryFlow: {
    id: 'glow-baristabbit-discovery', version: 1, runId: 'story:glow-baristabbit-v1',
    offer: { guide: { eyebrow: 'Held', title: 'Tap the glowing bubble.', body: 'Four Mistwisps have the window. Spend the light and they’ll show themselves.' }, actionLabel: 'See the light' },
    egg: { guide: { eyebrow: 'An Egg', title: 'So the window was keeping someone.', body: 'Something in there kept a kettle on for nobody. Go on. That’s you.' }, actionLabel: 'Meet the Egg' },
  },
  dayOne: {
    flow: { id: 'baristabbit-day-one', version: 1, runId: 'journey:baristabbit:day-1', title: 'The counter is open' },
    conversationId: 'baristabbit:journey:day-one',
    opening: BARISTABBIT_DAY_ONE_OPENING,
    choices: BARISTABBIT_DAY_ONE_CHOICES,
    handoffs: BARISTABBIT_DAY_ONE_HANDOFFS,
    endMessage: BARISTABBIT_DAY_ONE_END,
    choiceVariable: 'pauseChoice',
    handoffLabel: 'Tend garden',
    parcel: { generatorId: 'ritual-bar', rewardId: 'journey:baristabbit:day-1:ritual-bar' },
  },
  lesson: {
    flow: { id: 'baristabbit-garden-lesson', version: 1, runId: 'ftue:baristabbit-garden:1' },
    taskCapability: 'baristabbit.garden.task',
    eventPrefix: 'baristabbit.garden',
    closing: 'A Tea Cup, some light, and a window the Mist doesn’t own. We can keep the kettle on, at your pace.',
    summary: 'Your world grows where you look',
    generatorId: 'ritual-bar',
    parcelArrivalId: 'journey:baristabbit:day-1:ritual-bar',
    growDefinitionId: 'drink:hot:2',
    dropDefinitionId: 'drink:hot:1',
    order: {
      id: 'baristabbit:discovery:first-cup', characterId: 'baristabbit', title: 'Baristabbit’s first Tea Cup',
      description: 'Merge two Tea Leaves into a Tea Cup for Baristabbit.', difficulty: 'small', requirements: [{ definitionId: 'drink:hot:2', quantity: 1 }],
      reward: { coins: 20, mergeXp: 18, friendshipXp: 12, energy: 2 }, signature: false, purpose: 'normal', storyArcId: 'baristabbit:discovery',
    },
    copy: {
      parcel: { eyebrow: '', title: 'A parcel from Baristabbit!', body: 'Kept warm through the whole Mist. Tap to open it.' },
      room: { eyebrow: '', title: 'A little room', body: 'Merge or store an item, then we’ll continue.' },
      grow: { eyebrow: '', title: 'Yours now. Make a Tea Cup.', body: 'Two Tea Leaves from the Bar, together.' },
      serve: { eyebrow: '', title: 'Baristabbit needs a Tea Cup.', body: 'Serve it, and the light is yours to spend.' },
      finale: { eyebrow: '', title: 'Back to Baristabbit.', body: '' },
      finaleAction: 'Our first pour',
    },
  },
  egg: BARISTABBIT_EGG_POLICY,
  economy: { generatorId: 'ritual-bar' },
};
