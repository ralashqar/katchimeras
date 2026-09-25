import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { BARISTABBIT_DAY_ONE_CHOICES, BARISTABBIT_DAY_ONE_END, BARISTABBIT_DAY_ONE_HANDOFFS, BARISTABBIT_DAY_ONE_OPENING } from '@/constants/baristabbit-day-one-copy';
import { BARISTABBIT_EGG_POLICY } from '@/constants/baristabbit-egg-copy';
import { BARISTABBIT_SCENARIO_POLLS } from '@/constants/baristabbit-scenario-polls';
import { STEPPLING_WISPS } from '@/features/onboarding/corruption-wisps';
import { MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM } from '@/features/onboarding/opening-mist';
import { BARISTABBIT_RESCUE_BATTLE, BARISTABBIT_RESCUE_COPY } from '@/constants/rescue-battles';

/**
 * Baristabbit, the second friend the Mist kept: a lit window beside the
 * trail, a board of tea things under the Mist, an Egg that warms when you
 * pause (two questions, answered in a tap), a first conversation about what
 * kind of pause today needs, the Ritual Bar, and his daily cards: a photo of
 * today's drink, and a small scene to answer. Authored entirely here and in the copy files it imports; the hex art
 * is registered in `tile-art.ts`. The same path as Steppling's, beat for
 * beat, in Baristabbit's own words.
 */
export const BARISTABBIT_HATCHABLE: HatchableCompanionDefinition = {
  companion: 'baristabbit',
  displayName: 'Baristabbit',
  tile: {
    id: 'baristabbit-home', coord: { q: 1, r: -1 },
    // Cozy 4X v2: no ticket. The rescue battle is the price (`constants/rescue-battles.ts`).
    unlockId: 'mossprout:warm-light', price: 0,
    name: 'A lit window', revealPreset: 'mist-clear',
    alphaBoundsKey: 'shared_world_baristabbit_window_hex_tile_v1.webp',
    markerLines: { sleeping: 'The Mist keeps this window until Steppling is home.' },
  },
  // Cozy 4X: the window wakes once Steppling is home (the end of the first session); Baristabbit is Chapter 1's rescue,
  // and his Café is where the team's Meals come from.
  availability: { kind: 'after_companion', companion: 'steppling' },
  legacyAvailability: { kind: 'island_friend_home', residentSkinId: 'petalimp' },
  discovery: { gateId: 'gate-3-first-choice', pathId: 'warm-light' },
  mission: {
    id: 'mission:baristabbit',
    storageKey: 'katchimeras.mist-mission.baristabbit.v1',
    // Played: a Lanes rescue, the lamp's keepers coming down on the window (Chapter 1, The Lit Window). The board below
    // is the retired glow-strikes one, kept for saves parked on it.
    encounter: BARISTABBIT_RESCUE_BATTLE,
    rescue: BARISTABBIT_RESCUE_COPY,
    /** Two merges and six wakings: eight strikes, two per wisp. */
    required: 8,
    camera: { kind: 'focus_target', target: { kind: 'haven_gateway' }, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 900 },
    seed: {
      /** Café things the Mist left by the window: three Small Juice Cups along the bottom, two side by side. */
      items: [
        { cell: 40, definitionId: 'drink:refresh:1' },
        { cell: 39, definitionId: 'drink:refresh:1' },
        { cell: 36, definitionId: 'drink:refresh:1' },
      ],
      /** The visible sleeper: an Iced Fruit Tea under lower mist, bottom middle, that wakes as a Berry Smoothie. */
      echoes: [{ cell: 38, id: 'baristabbit-hot-1', definitionId: 'drink:refresh:2' }],
      /**
       * The cells the Mist holds completely, climbing the other way from Steppling's board: 31 above
       * the sleeper; 24 and 32 above and beside that; 25 above 32; 26 beside 25. The top one (24)
       * wants the Garden Drinks Cart two Lemonade Pitchers make.
       */
      veiled: [
        { cell: 31, id: 'baristabbit-hot-2', definitionId: 'drink:refresh:3' },
        { cell: 24, id: 'baristabbit-hot-3', definitionId: 'drink:refresh:5' },
        { cell: 32, id: 'baristabbit-hot-4', definitionId: 'drink:refresh:1' },
        { cell: 25, id: 'baristabbit-hot-5', definitionId: 'drink:refresh:2' },
        { cell: 26, id: 'baristabbit-hot-6', definitionId: 'drink:refresh:3' },
      ],
    },
    guides: {
      firstMerge: { eyebrow: 'Left by the window', title: 'Two Small Juice Cups. Together.', body: 'Every merge strikes a wisp.' },
      wake: { eyebrow: 'Asleep under the Mist', title: 'Something under there wants {a} {name}.', body: 'Give it its match. What it was keeping warm comes with it.' },
      merge: { eyebrow: 'Two of a kind', title: 'Two of the same make {a} {name}.', body: 'Drag one onto the other. Every merge strikes a wisp.' },
      mergeFallbackTitle: 'Two of the same make the next one up.',
      free: { eyebrow: 'Keep striking', title: 'Keep merging.', body: 'Two of the same, together.' },
    },
    wisps: STEPPLING_WISPS,
    lines: {
      firstStrike: 'It felt that. The glass fogs.',
      fell: ['One gone. The kettle ticks.', 'Two gone. Steam on the window.', 'One left, and the light is on.'],
      last: 'The last one falls. Look what it was keeping warm.',
      reveal: 'It was holding more.',
    },
  },
  discoveryFlow: {
    // v4: no reveal-to-Egg and no joined bubble: the battle's win clears his tile with him on it.
    id: 'glow-baristabbit-discovery', version: 4, runId: 'story:glow-baristabbit-v1',
    // v1 opened the board from the bubble; the bubble pays first now. v3: no Egg, he is rescued straight home.
    migrations: { 'gateway.offer': 'gateway.pay', 'gateway.return': 'gateway.pay', 'gateway.focus': 'gateway.pay', 'gateway.egg': 'gateway.rescue', 'egg.enter': 'gateway.rescue' },
    arrival: 'rescue',
    joined: { guide: { eyebrow: 'Baristabbit has joined your Sanctuary', title: 'You walked through that? You must be starving.', body: 'He kept that window lit the whole time, for whoever came. Now his Café is open: friends order, you merge and serve, and every order feeds the team.' }, actionLabel: 'Welcome, Baristabbit' },
    egg: { guide: { eyebrow: 'An Egg', title: 'So the window was keeping someone.', body: 'Something in there kept a kettle warm for nobody. Go on. That is you now.' }, actionLabel: 'Meet the Egg' },
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
    closing: 'An Iced Fruit Tea, some light, and a window the Mist does not own. We keep a cup ready, at your pace.',
    summary: 'Your world grows where you look',
    generatorId: 'ritual-bar',
    parcelArrivalId: 'journey:baristabbit:day-1:ritual-bar',
    growDefinitionId: 'drink:refresh:2',
    dropDefinitionId: 'drink:refresh:1',
    order: {
      id: 'baristabbit:discovery:first-cup', characterId: 'baristabbit', title: 'Baristabbit’s first Iced Fruit Tea',
      description: 'Merge two Small Juice Cups into an Iced Fruit Tea for Baristabbit.', difficulty: 'small', requirements: [{ definitionId: 'drink:refresh:2', quantity: 1 }],
      reward: { coins: 20, mergeXp: 18, friendshipXp: 12, energy: 2 }, signature: false, purpose: 'normal', storyArcId: 'baristabbit:discovery',
    },
    copy: {
      parcel: { eyebrow: '', title: 'A parcel from Baristabbit.', body: 'Kept warm through the whole Mist. Tap to open it.' },
      room: { eyebrow: '', title: 'A little room', body: 'Merge or store an item, then we continue.' },
      grow: { eyebrow: '', title: 'Yours now. Make an Iced Fruit Tea.', body: 'Two Small Juice Cups from the Bar, together.' },
      serve: { eyebrow: '', title: 'Baristabbit needs an Iced Fruit Tea.', body: 'Serve it, and the light is yours to spend.' },
      finale: { eyebrow: '', title: 'Back to Baristabbit.', body: '' },
      finaleAction: 'Our first pour',
    },
  },
  egg: BARISTABBIT_EGG_POLICY,
  economy: { generatorId: 'ritual-bar' },
  daily: {
    chapterTitle: 'The Counter',
    restingLine: 'Baristabbit is resting. The kettle is on low. The Garden is open.',
    idleLine: 'The counter is open. Show me today’s cup, or answer me something.',
    questionSubtitle: 'One small scene. The village answers too.',
    presentation: 'rows',
    photo: {
      category: 'drink',
      title: 'Show Baristabbit today’s drink',
      subtitle: 'Whatever is in the cup. Water counts.',
      artKey: 'today:photo',
      camera: {
        icon: 'cup.and.saucer.fill',
        title: 'Show Baristabbit today’s drink',
        subtitle: 'Whatever is in the cup. Water counts.',
        permissionTitle: 'Today’s drink, for Baristabbit',
        permissionBody: 'Show Baristabbit what is in your cup. Any drink counts, even water.',
        analysingLine: 'Looking at the cup…',
      },
      /** A cup is a cup: the capture category, not a graded quality. The photo stays in the camera roll. */
      match: { categoryIds: ['drink'] },
      lines: {
        noMatch: 'I could not find a cup in that one. Any drink counts, even water.',
        thanks: [
          'That is a good cup. I can tell from here.',
          'A drink and a pause. The day has a shape now.',
          'Noted, and kept warm. Thank you for showing me.',
          'Whatever is in it, you stopped for it. That is the part I like.',
        ],
      },
    },
    polls: BARISTABBIT_SCENARIO_POLLS,
  },
};
