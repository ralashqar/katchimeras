import { MOSSPROUT_LAYOUT } from '@incubator/environments/mossprout-layout';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { GLOW } from '@/constants/glow';
import { GLOW_ORDER_IDS, MOSSPROUT_BASKET_ARRIVAL_ID } from '@/constants/glow-discovery-ids';
import { STEPPLING_DAY_ONE_CHOICES, STEPPLING_DAY_ONE_HANDOFFS, STEPPLING_DAY_ONE_OPENING } from '@/constants/steppling-day-one-copy';
import { STEPPLING_WISP_LINES, STEPPLING_WISPS } from '@/features/onboarding/corruption-wisps';
import { MISSION_CAMERA_ANCHOR_Y, MISSION_CAMERA_ZOOM } from '@/features/onboarding/opening-mist';

/**
 * Steppling, the first friend the Mist kept: the misty clearing at the gate,
 * the trail board, the Egg that wakes with yesterday's steps, the Locker.
 * Every id here is the one his saves already carry.
 */
export const STEPPLING_HATCHABLE: HatchableCompanionDefinition = {
  companion: 'steppling',
  tile: {
    id: 'steppling-home', coord: MOSSPROUT_LAYOUT.gate.coord,
    unlockId: 'mossprout:overgrown-trail', price: GLOW.mistUnlockCost,
    name: 'Misty clearing', revealPreset: 'mist-clear',
    alphaBoundsKey: 'shared_world_steppling_trailhead_hex_tile_v1.webp',
    markerLines: { sleeping: 'The Mist still holds this one.' },
  },
  availability: { kind: 'after_ftue' },
  discovery: { gateId: 'gate-2-steppling', pathId: 'overgrown-trail' },
  mission: {
    id: 'mission:steppling',
    /** v3: no spawner, veiled cells; a v2 board saved mid-mission (the Locker's trail) is left behind. */
    storageKey: 'katchimeras.mist-mission.steppling.v3',
    /** Two merges and six wakings: eight strikes, two per wisp. */
    required: 8,
    camera: { kind: 'focus_target', target: { kind: 'haven_gateway' }, zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y, durationMs: 900 },
    seed: {
      /** The gear the Mist left on the board: three Socks along the bottom, two of them side by side. */
      items: [
        { cell: 36, definitionId: 'adventure:trail:1' },
        { cell: 37, definitionId: 'adventure:trail:1' },
        { cell: 40, definitionId: 'adventure:trail:1' },
      ],
      /** The one sleeper the player can see: a Shoe under a lower band of mist, bottom middle, that wakes as a Boot. */
      echoes: [{ cell: 38, id: 'steppling-trail-1', definitionId: 'adventure:trail:2' }],
      /**
       * The cells the Mist holds completely. Each hides the next sleeper and bursts open the moment a
       * sleeper beside it wakes, in the order the chain climbs: 31 above the first sleeper; 24 and 30
       * above and beside that; 23 above 30; 22 beside 23. The top one (24) wants the Pack the two
       * Hiking Gears make.
       */
      veiled: [
        { cell: 31, id: 'steppling-trail-2', definitionId: 'adventure:trail:3' },
        { cell: 24, id: 'steppling-trail-3', definitionId: 'adventure:trail:5' },
        { cell: 30, id: 'steppling-trail-4', definitionId: 'adventure:trail:1' },
        { cell: 23, id: 'steppling-trail-5', definitionId: 'adventure:trail:2' },
        { cell: 22, id: 'steppling-trail-6', definitionId: 'adventure:trail:3' },
      ],
    },
    guides: {
      firstMerge: { eyebrow: 'Left on the trail', title: 'Two Socks. Together.', body: 'Every merge strikes a wisp.' },
      wake: { eyebrow: 'Asleep under the Mist', title: 'Something under there wants {a} {name}.', body: 'Give it its match. What it was hiding comes with it.' },
      merge: { eyebrow: 'Two of a kind', title: 'Two of the same make {a} {name}.', body: 'Drag one onto the other. Every merge strikes a wisp.' },
      mergeFallbackTitle: 'Two of the same make the next one up.',
      free: { eyebrow: 'Keep striking', title: 'Keep merging.', body: 'Two of the same, together.' },
    },
    wisps: STEPPLING_WISPS,
    lines: STEPPLING_WISP_LINES,
  },
  discoveryFlow: {
    id: 'glow-steppling-discovery', version: 11, runId: 'story:glow-steppling-v1',
    gardenLesson: {
      open: { guide: { eyebrow: 'Someone’s in there', title: 'Light is made on the Garden board.', body: 'Mossprout has a request waiting there. Serve it and the light reaches the trail.' }, actionLabel: 'Open Garden' },
      prepareCapability: 'glow.lesson.prepare',
      /**
       * The Garden board's proper introduction: one lesson, nothing taught twice. Merging was taught by
       * the opening, waking sleepers by Steppling's board; what is new here is a parcel on the tray, a
       * spawner, and a request served. The board starts bare: open the parcel (the Basket's own reward
       * page greets it), two Seeds, then grow the Plant the request asks for the player's own way (the
       * finger only points after a pause), and serve it for the light the trail needs.
       */
      beats: [
        { id: 'lesson.single.parcel', kind: 'parcel', arrivalId: MOSSPROUT_BASKET_ARRIVAL_ID, guide: { eyebrow: 'A parcel from Mossprout', title: 'The Garden Basket. Open it.', body: 'Everything that grows here starts in there.' } },
        { id: 'lesson.single.spawn', kind: 'spawn', generatorId: 'wild-garden', guide: { eyebrow: 'A request', title: 'Mossprout is asking for a Plant.', body: 'That’s a request, on the right. Start with two Seeds.' } },
        { id: 'lesson.single.grow', kind: 'grow', definitionId: 'nature:garden:3', generatorId: 'wild-garden', guide: { eyebrow: 'Making light', title: 'Two Seeds make a Sprout. Two Sprouts make a Plant.', body: 'Tap the Basket whenever you run short.' } },
        { id: 'lesson.single.serve', kind: 'serve', orderId: GLOW_ORDER_IDS[1], guide: { eyebrow: 'A request, served', title: 'Give it here.', body: 'Serving a request is what turns a grown thing into light.' } },
      ],
      lessonPrefix: 'glow',
      ready: { guide: { eyebrow: 'Enough light', title: 'That should reach.', body: 'Come and see who the trail was hiding.' }, actionLabel: 'Back to world' },
    },
    offer: { guide: { eyebrow: 'Held', title: 'Tap the glowing bubble.', body: 'Four Mistwisps have the trail. Spend the light and they’ll show themselves.' }, actionLabel: 'See the light' },
    egg: { guide: { eyebrow: 'An Egg', title: 'So the trail was keeping someone.', body: 'You noticed something out in your world today. This is what that did. Go on. That’s you.' }, actionLabel: 'Meet the Egg' },
    migrations: {
      'gateway.return': 'gateway.offer',
      'gateway.goal': 'garden.open',
      'garden.focus': 'gateway.focus',
      ...Object.fromEntries(['lesson.prepare', 'lesson.spawn', 'lesson.seed', 'lesson.sprout', 'lesson.serve', 'lesson.repeat', 'lesson.repeat.prepare', 'lesson.repeat.spawn', 'lesson.repeat.match-1', 'lesson.repeat.match-2', 'lesson.repeat.match-3', 'lesson.repeat.match-4', 'lesson.repeat.match-5', 'lesson.repeat.serve'].map((id) => [id, 'lesson.single.prepare'])),
      'gateway.purchase': 'gateway.purchase.focus',
      // The purchase sheet became the mission board: a save waiting to buy plays it instead.
      'gateway.buy': 'mission.focus',
      'egg.transfer': 'gateway.egg', 'world.choose': 'gateway.egg',
      'steppling.hatch': 'gateway.egg', 'steppling.claim': 'gateway.egg', 'steppling.welcome': 'complete',
    },
  },
  dayOne: {
    flow: {
      id: 'steppling-day-one', version: 3, runId: 'journey:steppling:day-1', title: 'A little way together',
      // Catalog registration validates removed nodes even when older definitions
      // remain available. Keep every released v1/v2 checkpoint explicitly mapped.
      migrations: {
        welcome: 'reflection',
        closing: 'parcel',
        'habit.picker': 'reflection',
        'habit.added': 'parcel',
        ...Object.fromEntries(['walk', 'adapted', 'rest'].flatMap((choice) => [
          [`response.${choice}`, `handoff.${choice}`],
          [`reflection.reply.${choice}`, `handoff.${choice}`],
          [`cue.${choice}`, `handoff.${choice}`],
          ...['after', 'break', 'choose'].map((cue) => [`cue.${choice}.reply.${cue}`, `handoff.${choice}`]),
        ])),
        ...Object.fromEntries([
          ['ten-minute-walk', 'walk'], ['adapted-break', 'adapted'], ['rest-break', 'rest'],
          ['walk-one-journey', 'walk'], ['two-minute-walk', 'walk'],
        ].flatMap(([habit, choice]) => [
          [`habit.steppling:${habit}`, `handoff.${choice}`],
          [`habit.accept.steppling:${habit}`, `handoff.${choice}`],
        ])),
      },
    },
    opening: STEPPLING_DAY_ONE_OPENING,
    choices: STEPPLING_DAY_ONE_CHOICES,
    handoffs: STEPPLING_DAY_ONE_HANDOFFS,
    choiceVariable: 'movementChoice',
    handoffLabel: 'Tend garden',
    parcel: { generatorId: 'journey-locker', rewardId: 'journey:steppling:day-1:journey-locker' },
  },
  lesson: {
    flow: {
      id: 'steppling-garden-lesson', version: 2, runId: 'ftue:steppling-garden:1',
      // An interim build authored the Kingdom goal as a node of this run. A save
      // that stopped there must land back on the summary it was reached from,
      // otherwise the lesson stays active forever with no surface that can end it.
      // v2: the two guided taps and the guided merge became one free beat (the
      // Garden lesson just taught that shape); a save parked on any of them grows.
      migrations: { 'kingdom.goal': 'summary', 'spawn.first': 'grow', 'spawn.second': 'grow', 'merge': 'grow' },
    },
    taskCapability: 'steppling.garden.task',
    eventPrefix: 'steppling.garden',
    closing: 'A Shoe, some light, and the first stretch of trail the Mist doesn’t own. We can keep going, at your pace.',
    summary: 'Your world grows where you look',
    generatorId: 'journey-locker',
    parcelArrivalId: 'journey:steppling:day-1:journey-locker',
    growDefinitionId: 'adventure:trail:2',
    dropDefinitionId: 'adventure:trail:1',
    order: {
      id: 'steppling:discovery:first-trail', characterId: 'steppling', title: 'Steppling’s first Shoe',
      description: 'Merge two Socks into a Shoe for Steppling.', difficulty: 'small', requirements: [{ definitionId: 'adventure:trail:2', quantity: 1 }],
      reward: { coins: 20, mergeXp: 18, friendshipXp: 12, energy: 2 }, signature: false, purpose: 'normal', storyArcId: 'steppling:discovery',
    },
    copy: {
      parcel: { eyebrow: '', title: 'A parcel from Steppling!', body: 'He kept it through the whole Mist. Tap to open it.' },
      room: { eyebrow: '', title: 'A little room', body: 'Merge or store an item, then we’ll continue.' },
      grow: { eyebrow: '', title: 'Yours now. Make him a Shoe.', body: 'Two Socks from the Locker, together.' },
      serve: { eyebrow: '', title: 'Steppling needs a Shoe.', body: 'Serve it, and the light is yours to spend.' },
      finale: { eyebrow: '', title: 'Back to Steppling.', body: '' },
    },
  },
  economy: { generatorId: 'journey-locker' },
};
