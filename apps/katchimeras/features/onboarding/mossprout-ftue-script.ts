import { MOSSPROUT_GARDEN_RETURN, MOSSPROUT_FIRST_NOTICE } from './mossprout-first-grow';
import { TODAY_GROWTH_REWARDS } from '@/utils/today-growth';
import { MOSSPROUT_FIRST_MEMORY_SLOT_ID } from '@/utils/mossprout-garden-layout';

import type { FtueScriptDefinition } from './ftue-types';
import { STEPPLING_DISCOVERY_ID } from '@/constants/companion-discovery-catalog';
import { MOSSPROUT_BOND_SHARE_PROMPTS } from './mossprout-bond-share';
import { MOSSPROUT_FTUE_COPY as COPY, MOSSPROUT_DAY_OPTIONS, MOSSPROUT_HELP_OPTIONS } from './mossprout-ftue-copy';
import { OPENING_CAMERA_ANCHOR_Y, OPENING_CAMERA_ENTRY_MS, OPENING_CAMERA_ZOOM, OPENING_MERGE_REQUIRED } from './opening-mist';

// 2.05 is the established, correctly framed world-map composition. Feeding
// begins closer and retreats toward it; it must never retreat to the generic
// 1x world camera because that makes the growing Egg lose its framing.
import { SHARED_EGG_REST_ZOOM, SHARED_EGG_CLOSE_ZOOM, SHARED_EGG_ENTRY_ZOOM } from '@/components/katchadeck/world/shared-resident-presentation';
export const MOSSPROUT_WORLD_EGG_REST_ZOOM = SHARED_EGG_REST_ZOOM;
export const MOSSPROUT_WORLD_EGG_CLOSE_ZOOM = SHARED_EGG_CLOSE_ZOOM;
export const MOSSPROUT_WORLD_EGG_ENTRY_ZOOM = SHARED_EGG_ENTRY_ZOOM;
export function mossproutWorldEggZoom(stepId: string): number {
  const close = MOSSPROUT_WORLD_EGG_CLOSE_ZOOM;
  const rest = MOSSPROUT_WORLD_EGG_REST_ZOOM;
  const equalRetreat = (feedsRemaining: number) => (
    rest * Math.pow(close / rest, feedsRemaining / 3)
  );
  switch (stepId) {
    case 'world.egg_intro':
    case 'egg.opening':
      return close;
    case 'egg.context':
      return equalRetreat(2);
    case 'egg.mind':
      return equalRetreat(1);
    case 'egg.ready':
    default:
      return rest;
  }
}

const mossproutCompanionResume = {
  lock: true,
  // This query parameter is part of the route identity, not decoration. It
  // tells the companion route to present the authored FTUE surface rather
  // than the ordinary Mossprout dashboard after a cold launch.
  resume: { kind: 'companion', creatureId: 'companion:mossprout', ftue: '1' },
} as const;
const mossproutHavenHostedCompanionResume = {
  lock: true,
  resume: { kind: 'haven' },
} as const;
const mossproutWorldDialogueCamera = {
  kind: 'focus_target',
  target: { kind: 'haven_resident', characterId: 'mossprout' },
  zoom: MOSSPROUT_WORLD_EGG_REST_ZOOM,
  anchorY: 0.5,
  durationMs: 520,
} as const;
// Keep the intimate dialogue scale while looking slightly farther down the
// world. Mossprout settles higher in the viewport, leaving a clear lane for
// the meditation timer and action cards beneath him.
const mossproutMeditationCamera = {
  ...mossproutWorldDialogueCamera,
  anchorY: 0.46,
  durationMs: 420,
} as const;
const mossproutMergeResume = {
  // Merge remains the durable cold-start destination, but Back is a supported
  // escape to Mossprout's single Continue story card.
  lock: false,
  resume: { kind: 'merge', creatureId: 'companion:mossprout' },
} as const;
// Two concise answers are enough to hatch Mossprout. They are remembered and
// echoed back immediately so the Egg feels like a listener, not a questionnaire.
export const FTUE_EGG_ANSWER_GROWTH_REWARD = TODAY_GROWTH_REWARDS.reflection;
export const MOSSPROUT_FTUE_RETURN_NOTE_ID = 'mossprout:chapter-0:return-note';

const openingQuestionSteps: FtueScriptDefinition['steps'] = [
  {
    id: 'egg.opening', surface: 'haven',
    guide: { eyebrow: 'Mossprout’s Egg', title: 'It’s listening.', body: '' },
    camera: { kind: 'focus_target', target: { kind: 'haven_tile', characterId: 'mossprout' }, zoom: mossproutWorldEggZoom('egg.opening'), anchorY: 0.5, durationMs: 520 },
    actions: [{
      id: 'egg.day_texture', title: COPY.dayQuestion, description: '', icon: 'leaf.fill',
      presentation: 'inline_choice', handlerId: 'player_profile', promptKind: 'day_focus', growthSource: 'reflection', growthReward: FTUE_EGG_ANSWER_GROWTH_REWARD,
      nextStepId: 'egg.context', backendEvent: true,
      options: MOSSPROUT_DAY_OPTIONS,
    }],
  },
  {
    id: 'egg.context', surface: 'haven',
    guide: { eyebrow: 'Mossprout’s Egg', title: 'That reached it.', body: '' },
    camera: { kind: 'focus_target', target: { kind: 'haven_tile', characterId: 'mossprout' }, zoom: mossproutWorldEggZoom('egg.context'), anchorY: 0.49, durationMs: 520 },
    actions: [{
      id: 'egg.desired_help', title: COPY.helpQuestion, description: '', icon: 'heart.fill',
      presentation: 'inline_choice', handlerId: 'player_profile', promptKind: 'day_focus', growthSource: 'reflection', growthReward: FTUE_EGG_ANSWER_GROWTH_REWARD,
      nextStepId: 'egg.ready', backendEvent: true,
      options: MOSSPROUT_HELP_OPTIONS,
    }],
  },
  {
    id: 'egg.mind', surface: 'haven',
    guide: { eyebrow: 'Question 3 of 3', title: 'Each answer helps it wake.', body: '' },
    camera: { kind: 'focus_target', target: { kind: 'haven_tile', characterId: 'mossprout' }, zoom: mossproutWorldEggZoom('egg.mind'), anchorY: 0.51, durationMs: 520 },
    actions: [{
      id: 'egg.support_style', title: 'The Egg keeps one thing full for you. Which?', description: '', icon: 'sparkles',
      presentation: 'inline_choice', handlerId: 'player_profile', promptKind: 'day_focus', growthSource: 'reflection', growthReward: FTUE_EGG_ANSWER_GROWTH_REWARD,
      nextStepId: 'egg.ready', backendEvent: true,
      options: [
        { id: 'more_energy', label: 'Energy', icon: 'bolt.fill' },
        { id: 'more_calm', label: 'Calm', icon: 'leaf.fill' },
        { id: 'something_new', label: 'Something new', icon: 'sparkles' },
      ],
    }],
  },
  {
    id: 'egg.nature_theme', surface: 'today',
    guide: { eyebrow: 'Question 4 of 5', title: 'Your answer is taking root.', body: '' },
    actions: [{
      id: 'egg.life_priority', title: 'A whole free day. What gets it first?', description: '', icon: 'leaf.fill',
      presentation: 'inline_choice', handlerId: 'player_profile', promptKind: 'activity', growthSource: 'reflection', growthReward: FTUE_EGG_ANSWER_GROWTH_REWARD,
      nextStepId: 'egg.companion_identity', backendEvent: true,
      options: [
        { id: 'looking_after_myself', label: 'Looking after myself', icon: 'heart.fill' },
        { id: 'getting_things_done', label: 'Getting things done', icon: 'checkmark.circle.fill' },
        { id: 'friends_and_family', label: 'The people I like', icon: 'person.2.fill' },
        { id: 'creativity_and_play', label: 'Making or playing', icon: 'paintbrush.fill' },
      ],
    }],
  },
  {
    id: 'egg.companion_identity', surface: 'today',
    guide: { eyebrow: 'Question 5 of 5', title: 'One spark before we meet.', body: '' },
    actions: [{
      id: 'egg.companion_place', title: 'Four paths lead into the Mist. Which do you take?', description: '', icon: 'map.fill',
      presentation: 'inline_choice', handlerId: 'player_profile', promptKind: 'activity', growthSource: 'reflection', growthReward: FTUE_EGG_ANSWER_GROWTH_REWARD,
      nextStepId: 'egg.ready', backendEvent: true,
      options: [
        { id: 'mossy_forest', label: 'Into the mossy forest', icon: 'leaf.fill' },
        { id: 'flower_meadow', label: 'Across the flower meadow', icon: 'paintbrush.fill' },
        { id: 'rainy_pond', label: 'Down to the rainy pond', icon: 'cloud.rain.fill' },
        { id: 'windy_hill', label: 'Up the windy hill', icon: 'cloud.sun.fill' },
      ],
    }],
  },
];

export const MOSSPROUT_FTUE_SCRIPT: FtueScriptDefinition = {
  id: 'mossprout-first-session',
  version: 49,
  entryStepId: 'world.mist_open',
  terminalStepId: 'complete',
  steps: [
    // The opening: every tile under the Mist, a small board docked under
    // Mossprout's tile, and merges lifting the veil before the Egg is met.
    {
      id: 'world.mist_open', surface: 'haven', navigation: { lock: true, resume: { kind: 'haven' } },
      guide: { eyebrow: 'The Mist', title: COPY.openingNoticed, body: COPY.openingArrived },
      actions: [{ id: 'world.look_closer', title: COPY.lookCloser, description: 'See what the Mist is hiding.', icon: 'sparkles', presentation: 'acknowledgement', handlerId: 'acknowledgement', nextStepId: 'world.mist_clear' }],
      // Mounted a little further out; this glide runs while the two captions play.
      camera: { kind: 'focus_target', target: { kind: 'haven_tile', characterId: 'mossprout' }, zoom: OPENING_CAMERA_ZOOM, anchorY: OPENING_CAMERA_ANCHOR_Y, durationMs: OPENING_CAMERA_ENTRY_MS },
    },
    {
      id: 'world.mist_clear', surface: 'haven', navigation: { lock: true, resume: { kind: 'haven' } },
      guide: { eyebrow: 'Something is holding it', title: COPY.mistClearTitle, body: COPY.mistClearBody },
      actions: [{ id: 'world.clear_mist', title: 'Drive off the Mist', description: 'Every merge strikes a wisp. Fell all three.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_item_created', nextStepId: 'world.mist_lift' }],
      // A tutorial objective, not a receipt the backend needs: no Glow, no sync.
      // The docked board is free; the spotlight and finger show the first pairs
      // through the ordinary Merge overlay, then step aside.
      interaction: { mode: 'none' },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'merge_completed' }, commitActionId: 'world.clear_mist', nextStepId: 'world.mist_lift', requiredCount: OPENING_MERGE_REQUIRED }],
      camera: { kind: 'focus_target', target: { kind: 'haven_tile', characterId: 'mossprout' }, zoom: OPENING_CAMERA_ZOOM, anchorY: OPENING_CAMERA_ANCHOR_Y, durationMs: 520 },
    },
    {
      id: 'world.mist_lift', surface: 'haven', navigation: { lock: true, resume: { kind: 'haven' } },
      guide: { eyebrow: 'The Mist', title: COPY.mistThins, body: '' },
      // Committed by the Kingdom when the veil crossblend completes.
      actions: [{ id: 'world.mist_lifted', title: 'Continue', description: 'The Mist lifts from the clearing.', icon: 'sparkles', presentation: 'acknowledgement', handlerId: 'acknowledgement', nextStepId: 'world.egg_intro' }],
      camera: { kind: 'focus_target', target: { kind: 'haven_tile', characterId: 'mossprout' }, zoom: MOSSPROUT_WORLD_EGG_ENTRY_ZOOM, anchorY: 0.42, durationMs: 700 },
    },
    {
      id: 'world.egg_intro', surface: 'haven', navigation: { lock: true, resume: { kind: 'haven' } },
      guide: { eyebrow: 'A new friend', title: COPY.eggHeardYou, body: '' },
      actions: [{ id: 'world.inspect_mossprout_egg', title: 'Come closer', description: 'See how the Egg responds to you.', icon: 'sparkles', presentation: 'acknowledgement', handlerId: 'acknowledgement', nextStepId: 'egg.opening' }],
      camera: { kind: 'focus_target', target: { kind: 'haven_tile', characterId: 'mossprout' }, zoom: MOSSPROUT_WORLD_EGG_CLOSE_ZOOM, anchorY: 0.5, durationMs: 3_900 },
    },
    ...openingQuestionSteps,
    {
      id: 'egg.ready', surface: 'haven',
      guide: { eyebrow: 'Mossprout’s Egg', title: 'Something in there heard you.', body: '' },
      actions: [{ id: 'egg.hatch', title: 'Hatch', description: 'See who heard you.', icon: 'sparkles', presentation: 'cta_action', handlerId: 'discovery_hatch', nextStepId: 'companion.first_meeting', backendEvent: true }],
      blockingBeat: 'mossprout_intro',
      camera: { kind: 'focus_target', target: { kind: 'haven_tile', characterId: 'mossprout' }, zoom: mossproutWorldEggZoom('egg.ready'), anchorY: 0.5, durationMs: 520 },
    },
    {
      id: 'companion.first_meeting', surface: 'haven', navigation: mossproutHavenHostedCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Out of the Mist', title: 'Meet Mossprout.', body: '' },
      actions: [{ id: 'companion.complete_first_meeting', title: 'Continue', description: COPY.seedOrigin, icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'companion_conversation', nextStepId: 'companion.garden_intro', backendEvent: true }],
      blockingBeat: 'mossprout_intro',
    },
    {
      id: 'companion.nickname', surface: 'companion', navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'A name to keep', title: 'What should Mossprout call you?', body: 'The Mist takes names first. A nickname is optional and stays on this device.' },
      actions: [{ id: 'companion.save_nickname', title: 'Save nickname', description: 'Tell Mossprout what to call you.', icon: 'person.2.fill', presentation: 'nickname_input', handlerId: 'player_profile', nextStepId: 'companion.bond_intro', backendEvent: true }],
    },
    {
      id: 'companion.bond_intro', surface: 'companion', navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Remembered', title: 'Your Bond grew.', body: 'Bond is the part the Mist can’t take. It grows when you spend time together.' },
      actions: [{ id: 'companion.acknowledge_friendship', title: 'Continue', description: 'Listen to Mossprout.', icon: 'heart.fill', presentation: 'acknowledgement', handlerId: 'acknowledgement', nextStepId: 'companion.bond_spotlight', backendEvent: true }],
    },
    {
      id: 'companion.garden_intro', surface: 'companion', navigation: mossproutHavenHostedCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Your Memory', title: COPY.seedOrigin, body: COPY.bond },
      actions: [
        { id: 'companion.continue_to_planting', title: 'Plant it', description: 'Find it a place in the garden.', icon: 'arrow.right', presentation: 'acknowledgement', handlerId: 'acknowledgement', nextStepId: 'world.garden_arrival', backendEvent: true },
        // Receipt lookup for older saves; never shown as a second control.
        { id: 'companion.acknowledge_garden_intro', title: 'Continue', description: '', icon: 'arrow.right', presentation: 'observed_game_action', handlerId: 'acknowledgement', nextStepId: 'world.garden_arrival', backendEvent: true },
      ],
    },
    {
      id: 'companion.order_preview', surface: 'companion', navigation: mossproutHavenHostedCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Your Memory', title: 'Let’s plant it before we do anything else.', body: 'The Mist still has most of the garden. There’s one patch of soil it let go of.' },
      actions: [{ id: 'companion.open_garden', title: 'Plant the Seed', description: 'Give it the one patch the Mist let go of.', icon: 'leaf.fill', presentation: 'cta_action', handlerId: 'companion_order_preview', nextStepId: 'world.garden_arrival', backendEvent: true }],
      blockingBeat: 'mossprout_intro',
    },
    {
      id: 'world.garden_arrival', surface: 'haven', navigation: { lock: true, resume: { kind: 'haven' } },
      guide: { eyebrow: 'Your Memory', title: 'Here. The soil’s still soft.', body: '' },
      actions: [{ id: 'world.plant_first_seed', title: 'Plant it', description: 'Give your Memory a place in the garden.', icon: 'leaf.fill', presentation: 'cta_action', handlerId: 'acknowledgement', nextStepId: 'world.seed_planted', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'target_tap', target: { kind: 'haven_garden_plant_button', characterId: 'mossprout' } } },
      cue: { kind: 'tap', target: { kind: 'haven_garden_plant_button', characterId: 'mossprout' } },
      spotlight: {
        targets: [
          { kind: 'haven_guide' },
          { kind: 'haven_garden_plot', characterId: 'mossprout', slotId: MOSSPROUT_FIRST_MEMORY_SLOT_ID },
          { kind: 'haven_garden_plant_button', characterId: 'mossprout' },
        ],
        grouping: 'bounding_rect',
        padding: 8,
        radius: 22,
        dimOpacity: 0.62,
      },
      // Cold-start projection only. The live pan is owned by the atomic
      // world.camera node in mossprout-ftue-flow.
      camera: { kind: 'focus_target', target: { kind: 'haven_garden_tile', characterId: 'mossprout' }, zoom: 1.28, anchorY: 0.55, durationMs: 900, projectionOnly: true },
      blockingBeat: 'mossprout_intro',
    },
    {
      id: 'world.seed_planted', surface: 'haven', navigation: { lock: true, resume: { kind: 'haven' } },
      guide: { eyebrow: 'Your Memory', title: COPY.planted, body: COPY.mergePurpose },
      cue: { kind: 'tap', target: { kind: 'haven_garden_button', characterId: 'mossprout' } },
      spotlight: { targets: [{ kind: 'haven_guide' }, { kind: 'haven_garden_cluster', characterId: 'mossprout' }, { kind: 'haven_garden_plot', characterId: 'mossprout', slotId: MOSSPROUT_FIRST_MEMORY_SLOT_ID }], grouping: 'individual', targetGroups: [[0, 2], [1]], padding: 7 },
      actions: [{ id: 'world.acknowledge_seed_dormant', title: 'Open Merge', description: COPY.mergePurpose, icon: 'leaf.fill', presentation: 'cta_action', handlerId: 'acknowledgement', nextStepId: 'merge.serve_sprout', backendEvent: true }],
      camera: { kind: 'focus_target', target: { kind: 'haven_garden_tile', characterId: 'mossprout' }, zoom: 1.28, anchorY: 0.55, durationMs: 900, projectionOnly: true },
      blockingBeat: 'mossprout_intro',
    },
    {
      id: 'world.garden_handoff', surface: 'haven', navigation: { lock: true, resume: { kind: 'haven' } },
      guide: { eyebrow: 'Mossprout’s Garden', title: 'Let’s make some light.', body: 'Every request you serve here is light. Light is what pushes the Mist back.' },
      actions: [{ id: 'world.open_garden', title: 'Open Garden', description: 'Serve requests. Make light.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'acknowledgement', nextStepId: 'merge.serve_sprout', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'target_tap', target: { kind: 'haven_garden_button', characterId: 'mossprout' } } },
      cue: { kind: 'tap', target: { kind: 'haven_garden_button', characterId: 'mossprout' } },
      spotlight: {
        targets: [
          { kind: 'haven_garden_button', characterId: 'mossprout' },
        ],
        grouping: 'bounding_rect',
        padding: 7,
        radius: 22,
        dimOpacity: 0.58,
      },
      camera: { kind: 'focus_target', target: { kind: 'haven_garden_tile', characterId: 'mossprout' }, zoom: 1.28, anchorY: 0.55, durationMs: 900, projectionOnly: true },
      blockingBeat: 'mossprout_intro',
    },
    {
      id: 'merge.seed_drag', surface: 'merge',
      guide: { eyebrow: 'Making light', title: 'Two of the same, together. You know this one.', body: 'Drag one Seed onto the other.' },
      actions: [{ id: 'merge.create_sprout', title: 'Make a Sprout', description: 'Drag one Seed onto the other.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: {
        mode: 'exclusive',
        allowed: {
          kind: 'board_drag',
          from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 },
          to: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 },
        },
      },
      cue: {
        kind: 'drag',
        from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 },
        to: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 },
      },
      spotlight: {
        targets: [
          { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 },
          { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 },
        ],
        grouping: 'bounding_rect',
        padding: 3,
        radius: 11,
        dimOpacity: 0.64,
      },
      edges: [{
        event: {
          type: 'merge_completed',
          resultDefinitionId: 'nature:garden:2',
        },
        commitActionId: 'merge.create_sprout',
        nextStepId: 'merge.second_seed_drag',
      }],
    },
    {
      id: 'merge.second_seed_drag', surface: 'merge',
      guide: { coaching: 'practice', eyebrow: 'Making light', title: 'Again. I’ll pretend not to watch.', body: 'Merge the other two Seeds.' },
      actions: [{ id: 'merge.create_second_sprout', title: 'Make a second Sprout', description: 'Merge the other two Seeds.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'merge_completed', resultDefinitionId: 'nature:garden:2' }, commitActionId: 'merge.create_second_sprout', nextStepId: 'merge.first_bloom' }],
    },
    {
      id: 'merge.first_bloom', surface: 'merge',
      guide: { coaching: 'practice', eyebrow: 'Making light', title: 'Now those two. Something bigger is trying to come back.', body: 'Merge the two Sprouts.' },
      actions: [{ id: 'merge.create_first_bloom', title: 'Grow the first bloom', description: 'Merge the two Sprouts.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 1 } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 1 } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 1 }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'merge_completed', resultDefinitionId: 'nature:garden:3' }, commitActionId: 'merge.create_first_bloom', nextStepId: 'merge.serve_sprout' }],
    },
    {
      id: 'merge.serve_sprout', surface: 'merge',
      guide: { eyebrow: 'First Bloom', title: 'That’s what I asked for. Give it here and watch.', body: 'Serve the request. Watch what it turns into.' },
      actions: [{ id: 'merge.serve_sprout', title: 'Give Mossprout the Plant', description: 'Serve the request.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_order_served', backendEvent: true }],
      // Merging was taught by the opening. The request only points at Serve;
      // the board stays free so the player grows the Plant their own way.
      interaction: { mode: 'none' },
      cue: { kind: 'tap', target: { kind: 'order_serve', orderId: 'mossprout:chapter-0:first-sprout' } },
      spotlight: {
        targets: [
          { kind: 'order_card', orderId: 'mossprout:chapter-0:first-sprout' },
          { kind: 'order_requirement_item', orderId: 'mossprout:chapter-0:first-sprout', requirementIndex: 0 },
        ],
        grouping: 'individual',
        padding: 9,
        radius: 14,
        dimOpacity: 0.64,
      },
      edges: [{
        event: { type: 'order_served', orderId: 'mossprout:chapter-0:first-sprout' },
        commitActionId: 'merge.serve_sprout',
        nextStepId: 'world.first_bloom_offer',
      }],
    },
    {
      id: 'world.first_bloom_offer', surface: 'haven', navigation: { lock: true, resume: { kind: 'haven' } },
      guide: { eyebrow: 'First light', title: 'See that? Light.', body: 'That came from your day. It’s the only kind of light that works here. Tap the glowing bubble.' },
      actions: [{ id: 'world.open_first_bloom_upgrade', title: 'See what the light does', description: '', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'acknowledgement', nextStepId: 'world.first_bloom_restore' }],
      cue: { kind: 'tap', target: { kind: 'haven_upgrade_button', characterId: 'mossprout' } },
      spotlight: { targets: [{ kind: 'haven_upgrade_button', characterId: 'mossprout' }], padding: 7, radius: 18, dimOpacity: 0.58 },
      camera: { kind: 'focus_target', target: { kind: 'haven_garden_tile', characterId: 'mossprout' }, zoom: 1.28, anchorY: 0.55, durationMs: 900, projectionOnly: true },
    },
    {
      id: 'world.first_bloom_restore', surface: 'haven', navigation: { lock: true, resume: { kind: 'haven' } },
      guide: { eyebrow: 'First light', title: 'Enough to wake this patch.', body: 'Tap to wake the garden.' },
      actions: [
        { id: 'world.restore_with_first_bloom', title: 'Wake the garden', description: 'Spend the light here. The Mist gives ground where it’s spent.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'acknowledgement', nextStepId: 'world.first_bloom_restore', backendEvent: true },
        { id: 'world.complete_first_bloom_restore', title: 'Garden awake', description: 'Continue after the garden wakes.', icon: 'checkmark.circle.fill', presentation: 'observed_game_action', handlerId: 'haven_upgrade', nextStepId: 'world.first_seed_grew', backendEvent: true },
      ],
      interaction: { mode: 'exclusive', allowed: { kind: 'target_tap', target: { kind: 'haven_upgrade_button', characterId: 'mossprout' } } },
      cue: { kind: 'tap', target: { kind: 'haven_upgrade_button', characterId: 'mossprout' } },
      spotlight: {
        targets: [{ kind: 'haven_upgrade_button', characterId: 'mossprout' }],
        grouping: 'bounding_rect',
        padding: 7,
        radius: 22,
        dimOpacity: 0.58,
      },
      edges: [{ event: { type: 'haven_upgrade_completed', characterId: 'mossprout', stage: 1 }, commitActionId: 'world.complete_first_bloom_restore', nextStepId: 'world.first_seed_grew' }],
      camera: { kind: 'focus_target', target: { kind: 'haven_garden_tile', characterId: 'mossprout' }, zoom: 1.28, anchorY: 0.55, durationMs: 900, projectionOnly: true },
      blockingBeat: 'chapter_complete',
    },
    {
      id: 'world.first_seed_grew', surface: 'haven', navigation: { lock: true, resume: { kind: 'haven' } },
      guide: { eyebrow: 'Your Memory', title: 'Look. Your day is growing here.', body: 'The Mist can’t hold a place someone is watching.' },
      actions: [{ id: 'world.acknowledge_first_seed_growth', title: 'Continue', description: 'A moment with Mossprout.', icon: 'arrow.right', presentation: 'cta_action', handlerId: 'acknowledgement', nextStepId: 'companion.water_together', backendEvent: true }],
      camera: { kind: 'focus_target', target: { kind: 'haven_garden_tile', characterId: 'mossprout' }, zoom: 1.28, anchorY: 0.55, durationMs: 900, projectionOnly: true },
      blockingBeat: 'chapter_complete',
    },
    {
      id: 'merge.plant.spawn', surface: 'merge',
      guide: { eyebrow: 'Something in the Mist', title: 'Grow one more Seed.', body: 'The Mist is keeping a shape near here. Mossprout can almost see it.' },
      actions: [{ id: 'merge.spawn_echo_seed', title: 'Grow a Seed', description: 'Tap the Wild Garden once.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_generator_spawned', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } } },
      cue: { kind: 'tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } },
      spotlight: { targets: [{ kind: 'board_generator', generatorId: 'wild-garden' }], padding: 5, radius: 12, dimOpacity: 0.64 },
      edges: [{ event: { type: 'item_spawned', generatorId: 'wild-garden', definitionId: 'nature:garden:1' }, commitActionId: 'merge.spawn_echo_seed', nextStepId: 'merge.plant.seed_pairs' }],
    },
    {
      id: 'merge.plant.seed_pairs', surface: 'merge',
      guide: { eyebrow: 'A Dream Echo', title: 'The Mist has a Seed. Give it its twin.', body: 'Two of the same, and the Mist has to let go. The cell wakes, and the Seed keeps growing.' },
      actions: [{ id: 'merge.clear_seed_echo', title: 'Wake the Seed Echo', description: 'Drag the Seed into its Dream Echo.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_dream_echo', echoId: 'mossprout-seed-echo' } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_dream_echo', echoId: 'mossprout-seed-echo' } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, { kind: 'board_dream_echo', echoId: 'mossprout-seed-echo' }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'dream_echo_cleared', echoId: 'mossprout-seed-echo', resultDefinitionId: 'nature:garden:2' }, commitActionId: 'merge.clear_seed_echo', nextStepId: 'merge.serve_sprout' }],
    },
    {
      id: 'merge.plant.sprout_pair', surface: 'merge',
      guide: { eyebrow: 'Half remembered', title: 'Wake the Sprout Echo.', body: 'A Dream Echo is a shape the Mist hasn’t finished forgetting. Match it with your Sprout and it comes back whole.' },
      actions: [{ id: 'merge.clear_sprout_echo', title: 'Wake the Sprout Echo', description: 'Drag the Sprout into its Dream Echo.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, to: { kind: 'board_dream_echo', echoId: 'mossprout-sprout-echo' } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, to: { kind: 'board_dream_echo', echoId: 'mossprout-sprout-echo' } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, { kind: 'board_dream_echo', echoId: 'mossprout-sprout-echo' }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'dream_echo_cleared', echoId: 'mossprout-sprout-echo', resultDefinitionId: 'nature:garden:3' }, commitActionId: 'merge.clear_sprout_echo', nextStepId: 'merge.serve_plant' }],
    },
    {
      id: 'merge.serve_plant', surface: 'merge',
      guide: { eyebrow: 'Brought back', title: 'Bring it home.', body: 'Give Mossprout the Plant you pulled out of the Mist.' },
      actions: [{ id: 'merge.serve_home_plant', title: 'Serve the Plant', description: 'Give Mossprout the Plant you woke.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_order_served', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'order_serve', target: { kind: 'order_serve', orderId: 'mossprout:chapter-0:first-sprout' } } },
      cue: { kind: 'tap', target: { kind: 'order_serve', orderId: 'mossprout:chapter-0:first-sprout' } },
      spotlight: { targets: [{ kind: 'order_card', orderId: 'mossprout:chapter-0:first-sprout' }, { kind: 'order_requirement_item', orderId: 'mossprout:chapter-0:first-sprout', requirementIndex: 0 }], grouping: 'individual', padding: 9, radius: 14, dimOpacity: 0.64 },
      edges: [{ event: { type: 'order_served', orderId: 'mossprout:chapter-0:first-sprout' }, commitActionId: 'merge.serve_home_plant', nextStepId: 'companion.chapter_zero_return' }],
    },
    {
      id: 'merge.energy.spawn_pair', surface: 'merge',
      guide: { eyebrow: 'One more held cell', title: 'Start with two Seeds.', body: 'The last Echo near here is a Plant. The Mist won’t give it up for less.' },
      actions: [{ id: 'merge.energy.spawn_pair', title: 'Grow two Seeds', description: 'Tap the Wild Garden twice.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_generator_spawned', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } } },
      cue: { kind: 'tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } },
      spotlight: { targets: [{ kind: 'board_generator', generatorId: 'wild-garden' }], padding: 5, radius: 12, dimOpacity: 0.64 },
      edges: [{ event: { type: 'item_spawned', generatorId: 'wild-garden', definitionId: 'nature:garden:1' }, requiredCount: 2, commitActionId: 'merge.energy.spawn_pair', nextStepId: 'merge.energy.first_sprout' }],
    },
    {
      id: 'merge.energy.first_sprout', surface: 'merge',
      guide: { eyebrow: 'For the last Echo', title: 'Make a Sprout.', body: 'Merge the two Seeds.' },
      actions: [{ id: 'merge.energy.first_sprout', title: 'Make a Sprout', description: 'Merge the Seeds.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'merge_completed', resultDefinitionId: 'nature:garden:2' }, commitActionId: 'merge.energy.first_sprout', nextStepId: 'merge.energy.last_seed' }],
    },
    {
      id: 'merge.energy.last_seed', surface: 'merge',
      guide: { eyebrow: 'Nearly there', title: 'Grow one more Seed.', body: 'The Plant is almost ready.' },
      actions: [{ id: 'merge.energy.last_seed', title: 'Grow one Seed', description: 'Tap the Wild Garden.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_generator_spawned', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } } },
      cue: { kind: 'tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } },
      spotlight: { targets: [{ kind: 'board_generator', generatorId: 'wild-garden' }], padding: 5, radius: 12, dimOpacity: 0.64 },
      edges: [{ event: { type: 'item_spawned', generatorId: 'wild-garden', definitionId: 'nature:garden:1' }, commitActionId: 'merge.energy.last_seed', nextStepId: 'merge.energy_exhausted' }],
    },
    {
      id: 'merge.energy_exhausted', surface: 'merge',
      guide: { eyebrow: 'Mossprout noticed', title: 'We’re running low.', body: 'The Energy we’ve been spending came from your day. Tell me a little more of it.' },
      actions: [{ id: 'merge.tell_me_more', title: 'Tell me something else', description: 'Bring a new memory back.', icon: 'sparkles', presentation: 'cta_action', handlerId: 'acknowledgement', nextStepId: 'energy.capture', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target: { kind: 'board_generator', generatorId: '__locked__' } } },
      blockingBeat: 'energy_connection',
    },
    {
      id: 'energy.capture', surface: 'today',
      guide: { eyebrow: 'A little more of today', title: 'Share one quick reflection.', body: 'One honest answer is enough. That’s how light gets made.' },
      actions: [{
        id: 'energy.reflect', title: 'If today had been a walk, what kind was it?', description: 'One quick answer is enough.', icon: 'sparkles',
        presentation: 'inline_choice', handlerId: 'day_prompt', promptKind: 'day_word', growthSource: 'reflection', growthReward: FTUE_EGG_ANSWER_GROWTH_REWARD,
        nextStepId: 'energy.journal_reward', backendEvent: true,
        options: [
          { id: 'good', label: 'A good one', icon: 'heart.fill', domainChoiceId: 'lovely' },
          { id: 'quiet', label: 'Quiet', icon: 'cloud.fill', domainChoiceId: 'quiet' },
          { id: 'busy', label: 'Busy', icon: 'sun.max.fill', domainChoiceId: 'full' },
          { id: 'rough', label: 'A bit rough', icon: 'cloud.rain.fill', domainChoiceId: 'hard' },
        ],
      }],
      blockingBeat: 'energy_connection',
    },
    {
      id: 'energy.journal_reward', surface: 'today',
      guide: { eyebrow: 'Noticed', title: '+20 Energy', body: 'You looked at your day, and it became something we can spend.' },
      actions: [{ id: 'energy.check_steps', title: 'Check yesterday\'s steps', description: 'See whether yesterday made more Energy.', icon: 'figure.walk', presentation: 'acknowledgement', handlerId: 'pedometer_steps', nextStepId: 'energy.steps_offer', backendEvent: true }],
      blockingBeat: 'energy_awarded',
    },
    {
      id: 'energy.steps_offer', surface: 'today',
      guide: { eyebrow: 'Yesterday can help too', title: 'Turn your steps into Energy?', body: 'Yesterday’s steps were light too, even if nobody counted them.' },
      actions: [{ id: 'energy.convert_steps', title: 'Turn steps into Energy', description: 'Convert yesterday\'s steps.', icon: 'figure.walk', presentation: 'acknowledgement', handlerId: 'pedometer_steps', nextStepId: 'energy.steps_reward', backendEvent: true }],
      blockingBeat: 'energy_awarded',
    },
    {
      id: 'energy.steps_reward', surface: 'today',
      guide: { eyebrow: 'Energy is ready', title: 'Let\'s get back to Mossprout.', body: 'The garden is waiting, and so is the last held cell.' },
      actions: [{ id: 'energy.return', title: 'Back to Mossprout', description: 'Bring the Energy to the garden.', icon: 'leaf.fill', presentation: 'cta_action', handlerId: 'acknowledgement', nextStepId: 'merge.energy.finish_seed', backendEvent: true }],
      blockingBeat: 'energy_awarded',
    },
    {
      id: 'merge.energy.finish_seed', surface: 'merge',
      guide: { eyebrow: 'Back to the garden', title: 'Grow the missing Seed.', body: 'Use the Energy your day gave you.' },
      actions: [{ id: 'merge.energy.finish_seed', title: 'Grow the missing Seed', description: 'Tap the Wild Garden.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_generator_spawned', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } } },
      cue: { kind: 'tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } },
      spotlight: { targets: [{ kind: 'board_generator', generatorId: 'wild-garden' }], padding: 5, radius: 12, dimOpacity: 0.64 },
      edges: [{ event: { type: 'item_spawned', generatorId: 'wild-garden', definitionId: 'nature:garden:1' }, commitActionId: 'merge.energy.finish_seed', nextStepId: 'merge.energy.finish_sprout' }],
    },
    {
      id: 'merge.energy.finish_sprout', surface: 'merge',
      guide: { eyebrow: 'Finish the Plant', title: 'Make the second Sprout.', body: 'Merge the two Seeds.' },
      actions: [{ id: 'merge.energy.finish_sprout', title: 'Make a Sprout', description: 'Merge the Seeds.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'merge_completed', resultDefinitionId: 'nature:garden:2' }, commitActionId: 'merge.energy.finish_sprout', nextStepId: 'merge.energy.finish_plant' }],
    },
    {
      id: 'merge.energy.finish_plant', surface: 'merge',
      guide: { eyebrow: 'Finish the Plant', title: 'Bring the Sprouts together.', body: 'One last merge.' },
      actions: [{ id: 'merge.energy.finish_plant', title: 'Make the Plant', description: 'Merge the Sprouts.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 1 } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 1 } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 1 }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'merge_completed', resultDefinitionId: 'nature:garden:3' }, commitActionId: 'merge.energy.finish_plant', nextStepId: 'merge.energy.clear_plant_echo' }],
    },
    {
      id: 'merge.energy.clear_plant_echo', surface: 'merge',
      guide: { eyebrow: 'Your day reached the Mist', title: 'Wake the Plant Echo.', body: 'Give the Mist its twin and it lets go. The Plant blooms as the cell opens.' },
      actions: [{ id: 'merge.energy.clear_plant_echo', title: 'Wake the Plant Echo', description: 'Drag the Plant into its Dream Echo.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'nature:garden:3', occurrence: 0 }, to: { kind: 'board_dream_echo', echoId: 'mossprout-plant-echo' } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:3', occurrence: 0 }, to: { kind: 'board_dream_echo', echoId: 'mossprout-plant-echo' } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:3', occurrence: 0 }, { kind: 'board_dream_echo', echoId: 'mossprout-plant-echo' }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'dream_echo_cleared', echoId: 'mossprout-plant-echo', resultDefinitionId: 'nature:garden:4' }, commitActionId: 'merge.energy.clear_plant_echo', nextStepId: 'merge.energy.serve_plant' }],
    },
    {
      id: 'merge.energy.serve_plant', surface: 'merge',
      guide: { eyebrow: 'Remembered', title: 'Give Mossprout the Flower.', body: 'Your day did this. The Mist has no hold on this part of the garden now.' },
      actions: [{ id: 'merge.energy.serve_plant', title: 'Serve the Plant', description: 'Finish Mossprout’s home.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_order_served', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'order_serve', target: { kind: 'order_serve', orderId: 'mossprout:chapter-0:energy-plant' } } },
      cue: { kind: 'tap', target: { kind: 'order_serve', orderId: 'mossprout:chapter-0:energy-plant' } },
      spotlight: { targets: [{ kind: 'order_card', orderId: 'mossprout:chapter-0:energy-plant' }, { kind: 'order_requirement_item', orderId: 'mossprout:chapter-0:energy-plant', requirementIndex: 0 }], grouping: 'individual', padding: 9, radius: 14, dimOpacity: 0.64 },
      edges: [{ event: { type: 'order_served', orderId: 'mossprout:chapter-0:energy-plant' }, commitActionId: 'merge.energy.serve_plant', nextStepId: 'merge.return_note' }],
    },
    {
      id: 'merge.return_note', surface: 'merge',
      guide: { eyebrow: 'A note from Mossprout', title: 'The garden is awake.', body: 'Read what Mossprout left for you.' },
      actions: [{ id: 'merge.open_mossprout_note', title: 'Read Mossprout’s note', description: 'Return to Mossprout.', icon: 'envelope.fill', presentation: 'observed_game_action', handlerId: 'merge_chat_note_opened', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'chat_note_tap', target: { kind: 'tray_chat_note', noteId: MOSSPROUT_FTUE_RETURN_NOTE_ID } } },
      cue: { kind: 'tap', target: { kind: 'tray_chat_note', noteId: MOSSPROUT_FTUE_RETURN_NOTE_ID } },
      spotlight: { targets: [{ kind: 'tray_chat_note', noteId: MOSSPROUT_FTUE_RETURN_NOTE_ID }], padding: 7, radius: 14, dimOpacity: 0.64 },
      edges: [{ event: { type: 'chat_note_opened', noteId: MOSSPROUT_FTUE_RETURN_NOTE_ID }, commitActionId: 'merge.open_mossprout_note', nextStepId: 'companion.chapter_zero_return' }],
    },
    {
      id: 'companion.chapter_zero_return', surface: 'companion',
      navigation: { ...mossproutCompanionResume, resume: { ...mossproutCompanionResume.resume, ftue: 'chapter-zero-return' } },
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'First Bloom', title: 'The Grove remembers.', body: 'See what you and Mossprout brought back.' },
      actions: [{ id: 'companion.complete_chapter_zero_return', title: 'See what changed', description: 'Notice what your First Bloom brought back to the Grove.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'companion_conversation', nextStepId: 'companion.water_together', backendEvent: true }],
    },
    {
      id: 'companion.bond_spotlight', surface: 'companion',
      navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Your time together', title: 'This is your Bond.', body: 'It grows through real moments with Mossprout, across real days. The Mist can’t take it, and Merge play can’t grind it.' },
      actions: [{ id: 'companion.acknowledge_bond', title: 'Grow the Garden', description: 'Turn what Mossprout learned into something you can grow together.', icon: 'heart.fill', presentation: 'acknowledgement', handlerId: 'acknowledgement', nextStepId: 'companion.garden_intro', backendEvent: true }],
    },
    {
      id: 'companion.day_one_action', surface: 'companion',
      navigation: mossproutHavenHostedCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Mossprout understands', title: 'What are we growing?', body: 'Choose the shape that feels closest. It does not need to be a precise goal.' },
      actions: [
        {
          id: 'companion.choose_growth_intent', title: 'One magical garden plot. What does it grow for you?', description: '', icon: 'heart.fill',
          presentation: 'inline_choice', handlerId: 'player_profile', nextStepId: 'companion.day_one_action',
          options: MOSSPROUT_BOND_SHARE_PROMPTS[0].options.map((option) => ({ id: `${MOSSPROUT_BOND_SHARE_PROMPTS[0].id}:${option.id}`, label: option.label, icon: option.icon })),
        },
        {
          id: 'companion.choose_support_style', title: 'Halfway up a hill and stuck. What do you want from me?', description: '', icon: 'heart.fill',
          presentation: 'inline_choice', handlerId: 'player_profile', nextStepId: 'companion.day_one_action',
          options: [
            { id: 'tiny_step', label: 'Point at the next step', icon: 'leaf.fill' },
            { id: 'reflect', label: 'Talk it through with me', icon: 'bubble.left.fill' },
            { id: 'push', label: 'A push', icon: 'bolt.fill' },
            { id: 'company', label: 'Just walk with me', icon: 'heart.fill' },
          ],
        },
        { id: 'companion.complete_day_one_action', title: 'Grow it bit by bit', description: 'Mossprout understands you a little better.', icon: 'heart.fill', presentation: 'observed_game_action', handlerId: 'companion_conversation', nextStepId: 'companion.bond_spotlight', backendEvent: true },
      ],
      blockingBeat: 'chapter_complete',
    },
    {
      id: 'companion.water_together', surface: 'companion', navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Our first garden', title: MOSSPROUT_GARDEN_RETURN.prompt, body: '' },
      actions: [{ id: 'companion.choose_garden_return', title: 'A moment with Mossprout', description: '', icon: 'leaf.fill',
        presentation: 'observed_game_action', handlerId: 'player_profile', nextStepId: 'companion.first_grow',
        options: MOSSPROUT_GARDEN_RETURN.choices.map(({ id, label }) => ({ id, label, icon: 'leaf.fill' })) }],
    },
    {
      id: 'companion.first_grow', surface: 'companion', navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Your turn', title: MOSSPROUT_GARDEN_RETURN.invitation, body: '' },
      actions: [{ id: 'companion.open_first_grow', title: 'Notice one small thing', description: 'Look up from this for a moment.', icon: 'leaf.fill',
        presentation: 'observed_game_action', handlerId: 'acknowledgement', nextStepId: 'companion.first_notice' }],
    },
    {
      id: 'companion.first_notice', surface: 'companion', navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Your turn', title: MOSSPROUT_FIRST_NOTICE.prompt, body: '' },
      actions: [
        { id: 'companion.complete_first_notice', title: 'Notice one small thing', description: '', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'player_profile', nextStepId: 'companion.notice_bond_spotlight' },
        { id: 'companion.skip_first_notice', title: 'Not now', description: '', icon: 'arrow.right', presentation: 'observed_game_action', handlerId: 'acknowledgement', nextStepId: 'companion.first_rest' },
      ],
    },
    {
      id: 'companion.notice_bond_spotlight', surface: 'companion', navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Closer', title: 'You noticed something. That’s the whole trick.', body: 'It’s how the Mist loses.' },
      actions: [{ id: 'companion.acknowledge_notice_bond', title: 'Continue', description: '', icon: 'arrow.right',
        presentation: 'acknowledgement', handlerId: 'acknowledgement', nextStepId: 'companion.first_rest' }],
    },
    {
      id: 'companion.water_response', surface: 'companion', navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Mossprout heard you', title: 'A small answer is enough', body: 'Mossprout keeps what you noticed. That’s one more thing the Mist doesn’t get.' },
      actions: [{ id: 'companion.ack_water_response', title: 'Keep going', description: 'See what Mossprout noticed.', icon: 'leaf.fill', presentation: 'acknowledgement', handlerId: 'acknowledgement', nextStepId: 'companion.first_insight', backendEvent: true }],
    },
    {
      id: 'companion.first_insight', surface: 'companion', navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Today I learned', title: 'Did Mossprout get that right?', body: 'A reflection can be corrected. Mossprout will keep learning instead of pretending to know everything.' },
      actions: [{
        id: 'companion.confirm_first_reflection', title: 'Did I get that right?', description: 'Help Mossprout understand what he noticed.', icon: 'bubble.left.and.bubble.right.fill', presentation: 'inline_choice', handlerId: 'player_profile', nextStepId: 'companion.first_rest', backendEvent: true,
        options: [
          { id: 'pretty_much', label: 'Pretty much', icon: 'checkmark.circle.fill' },
          { id: 'sometimes', label: 'Sometimes', icon: 'arrow.left.arrow.right' },
          { id: 'not_really', label: 'Not really', icon: 'xmark.circle.fill' },
        ],
      }],
    },
    {
      id: 'companion.first_rest', surface: 'companion', navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Rest', title: COPY.farewell, body: '' },
      actions: [{ id: 'companion.begin_rest', title: COPY.restAction, description: 'Let him rest.', icon: 'moon.stars.fill', presentation: 'acknowledgement', handlerId: 'acknowledgement', nextStepId: 'companion.meditating', backendEvent: true }],
      blockingBeat: 'chapter_complete',
    },
    {
      id: 'companion.meditating', surface: 'companion', navigation: { ...mossproutCompanionResume, lock: false },
      camera: mossproutMeditationCamera,
      guide: { eyebrow: 'Resting', title: COPY.meditation, body: COPY.meditationHelp },
      actions: [{ id: 'companion.tend_garden', title: 'Look at the Mist', description: 'Someone’s still in there.', icon: 'sparkles', presentation: 'acknowledgement', handlerId: 'acknowledgement', nextStepId: 'complete', backendEvent: true }],
      blockingBeat: 'chapter_complete',
    },
    {
      id: 'companion.resident_affinity', surface: 'companion', navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Someone else heard us', title: 'Who feels closest to your nature?', body: 'Your answers reach whoever the Mist is keeping nearest. A veiled parcel comes back, without giving away who sent it.' },
      actions: [{ id: 'companion.complete_resident_affinity', title: 'Find the closest resident', description: 'Answer a few quick nature questions.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'companion_conversation', nextStepId: 'companion.resident_parcel_ready', backendEvent: true }],
    },
    {
      id: 'companion.resident_parcel_ready', surface: 'companion', navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Someone heard the Grove', title: 'A parcel is waiting.', body: 'Something small answered the light. It came through the Mist to get here.' },
      actions: [{ id: 'companion.open_resident_parcel', title: 'Go to the Garden', description: 'Open the resident parcel on the Merge board.', icon: 'shippingbox.fill', presentation: 'cta_action', handlerId: 'acknowledgement', nextStepId: 'merge.resident_parcel', backendEvent: true }],
    },
    {
      id: 'merge.resident_parcel', surface: 'merge', navigation: mossproutMergeResume,
      guide: { eyebrow: 'A veiled parcel', title: 'Open what the resident sent.', body: 'There’s a sealed card inside. The Mist couldn’t read it.' },
      actions: [{ id: 'merge.claim_resident_parcel', title: 'Open the parcel', description: 'Place the sealed card on the board.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'merge_parcel_claimed', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'parcel_tap', target: { kind: 'active_resident_parcel' } } },
      cue: { kind: 'tap', target: { kind: 'active_resident_parcel' } },
      spotlight: { targets: [{ kind: 'active_resident_parcel' }], padding: 7, radius: 14, dimOpacity: 0.62 },
      edges: [{ event: { type: 'arrival_claimed', residentDiscovery: true }, commitActionId: 'merge.claim_resident_parcel', nextStepId: 'merge.resident_card' }],
    },
    {
      id: 'merge.resident_card', surface: 'merge', navigation: mossproutMergeResume,
      guide: { eyebrow: 'Two of the same', title: 'Bring the two cards together.', body: 'Drag the sealed card onto the glowing mystery card.' },
      actions: [{ id: 'merge.reveal_resident', title: 'Reveal the resident', description: 'Match the sealed card to the mystery card.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'active_resident_card_item' }, to: { kind: 'active_resident_card_node' } } },
      cue: { kind: 'drag', from: { kind: 'active_resident_card_item' }, to: { kind: 'active_resident_card_node' } },
      spotlight: { targets: [{ kind: 'active_resident_card_item' }, { kind: 'active_resident_card_node' }], grouping: 'bounding_rect', padding: 4, radius: 12, dimOpacity: 0.64 },
      edges: [{ event: { type: 'resident_card_revealed' }, commitActionId: 'merge.reveal_resident', nextStepId: 'merge.resident_dialogue' }],
    },
    {
      id: 'merge.resident_dialogue', surface: 'merge', navigation: mossproutMergeResume,
      guide: { eyebrow: 'A new voice', title: 'Meet the resident.', body: 'They’ve been in the Mist a while. They have a request of their own.' },
      actions: [{ id: 'merge.meet_resident', title: 'Meet the resident', description: 'Hear what they need.', icon: 'bubble.left.fill', presentation: 'observed_game_action', handlerId: 'acknowledgement', backendEvent: true }],
      edges: [{ event: { type: 'resident_dialogue_acknowledged' }, commitActionId: 'merge.meet_resident', nextStepId: 'merge.resident_seed_spawn' }],
    },
    {
      id: 'merge.resident_seed_spawn', surface: 'merge', navigation: mossproutMergeResume,
      guide: { eyebrow: 'Petalimp’s request', title: 'Grow one Seed.', body: 'Tap the Garden Basket once. It will give you the Seed we need.' },
      actions: [{ id: 'merge.spawn_resident_seed', title: 'Grow a Seed', description: 'Tap the Garden Basket once.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_generator_spawned', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } } },
      cue: { kind: 'tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } },
      spotlight: { targets: [{ kind: 'board_generator', generatorId: 'wild-garden' }], padding: 5, radius: 12, dimOpacity: 0.64 },
      edges: [{ event: { type: 'item_spawned', generatorId: 'wild-garden', definitionId: 'nature:garden:1' }, commitActionId: 'merge.spawn_resident_seed', nextStepId: 'merge.resident_seed_echo' }],
    },
    {
      id: 'merge.resident_seed_echo', surface: 'merge', navigation: mossproutMergeResume,
      guide: { eyebrow: 'A Seed in the Mist', title: 'The Mist has a Seed. Give it its twin.', body: 'Drag your Seed onto the identical Seed under the Mist.' },
      actions: [{ id: 'merge.clear_resident_seed_echo', title: 'Make a Sprout', description: 'Drag the Seed into its locked match.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_dream_echo', echoId: 'mossprout-seed-echo' } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_dream_echo', echoId: 'mossprout-seed-echo' } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, { kind: 'board_dream_echo', echoId: 'mossprout-seed-echo' }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'dream_echo_cleared', echoId: 'mossprout-seed-echo', resultDefinitionId: 'nature:garden:2' }, commitActionId: 'merge.clear_resident_seed_echo', nextStepId: 'merge.resident_sprout_echo' }],
    },
    {
      id: 'merge.resident_sprout_echo', surface: 'merge', navigation: mossproutMergeResume,
      guide: { eyebrow: 'A Sprout in the Mist', title: 'And a Sprout. Same again.', body: 'Drag your new Sprout onto the identical Sprout under the Mist.' },
      actions: [{ id: 'merge.clear_resident_sprout_echo', title: 'Make a Plant', description: 'Drag the Sprout into its locked match.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, to: { kind: 'board_dream_echo', echoId: 'mossprout-sprout-echo' } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, to: { kind: 'board_dream_echo', echoId: 'mossprout-sprout-echo' } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, { kind: 'board_dream_echo', echoId: 'mossprout-sprout-echo' }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'dream_echo_cleared', echoId: 'mossprout-sprout-echo', resultDefinitionId: 'nature:garden:3' }, commitActionId: 'merge.clear_resident_sprout_echo', nextStepId: 'merge.resident_orders' }],
    },
    {
      id: 'merge.resident_orders', surface: 'merge', navigation: mossproutMergeResume,
      guide: { eyebrow: 'Petalimp’s request', title: 'Serve the Plant.', body: 'Tap Serve to give Petalimp the Plant you grew.' },
      actions: [{ id: 'merge.serve_resident_orders', title: 'Serve the request', description: 'Help Petalimp earn their place in the deck.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_order_served', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'order_serve', target: { kind: 'active_resident_order_serve' } } },
      cue: { kind: 'tap', target: { kind: 'active_resident_order_serve' } },
      spotlight: { targets: [{ kind: 'active_resident_order_card' }, { kind: 'active_resident_order_serve' }], grouping: 'individual', padding: 7, radius: 14, dimOpacity: 0.38, dismissOnGuideClose: true },
      edges: [{ event: { type: 'order_served', residentDiscovery: true }, commitActionId: 'merge.serve_resident_orders', nextStepId: 'merge.resident_card_reward' }],
    },
    {
      id: 'merge.resident_card_reward', surface: 'merge', navigation: mossproutMergeResume,
      guide: { eyebrow: 'Card earned', title: 'Reveal the card in your deck.', body: 'Remembered, and kept. This resident is part of Mossprout’s garden set now.' },
      actions: [{ id: 'merge.ack_resident_card', title: 'Reveal the card', description: 'Watch it turn over in the deck.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'acknowledgement', backendEvent: true }],
      edges: [{ event: { type: 'resident_card_reveal_acknowledged' }, commitActionId: 'merge.ack_resident_card', nextStepId: 'companion.resident_match_result' }],
      blockingBeat: 'chapter_complete',
    },
    {
      id: 'companion.resident_match_result', surface: 'companion', navigation: mossproutCompanionResume,
      camera: mossproutWorldDialogueCamera,
      guide: { eyebrow: 'Petalimp, remembered', title: 'Your first resident card is here.', body: 'Return to Mossprout’s world and see the Garden together.' },
      actions: [{ id: 'companion.ack_resident_match_result', title: 'Return to Mossprout’s world', description: 'Finish the first-session story with Mossprout.', icon: 'checkmark.circle.fill', presentation: 'acknowledgement', handlerId: 'acknowledgement', nextStepId: 'companion.meditating', backendEvent: true }],
      blockingBeat: 'chapter_complete',
    },
    {
      id: 'haven.mossprout.focus', surface: 'haven',
      guide: { eyebrow: 'A little place to begin', title: 'Mossprout has a home here.', body: 'Tap the garden marker to see what your light can bring back.' },
      actions: [{ id: 'haven.open_mossprout_upgrade', title: 'Open Mossprout’s Haven', description: 'See the first permanent garden upgrade.', icon: 'leaf.fill', presentation: 'cta_action', handlerId: 'acknowledgement', nextStepId: 'haven.mossprout.restore' }],
      camera: { kind: 'focus_target', target: { kind: 'haven_tile', characterId: 'mossprout' }, zoom: 1.25, anchorY: 0.46, durationMs: 420 },
      interaction: { mode: 'exclusive', allowed: { kind: 'target_tap', target: { kind: 'haven_tile_hud', characterId: 'mossprout' } } },
      cue: { kind: 'tap', target: { kind: 'haven_tile_hud', characterId: 'mossprout' } },
      spotlight: { targets: [{ kind: 'haven_tile_hud', characterId: 'mossprout' }], padding: 7, radius: 18, dimOpacity: 0.62 },
      blockingBeat: 'chapter_complete',
    },
    {
      id: 'haven.mossprout.restore', surface: 'haven',
      guide: { eyebrow: 'A little place to begin', title: 'Restore the Little Garden', body: 'Light you made in Merge, spent here. The Mist doesn’t come back where it’s been spent.' },
      actions: [{ id: 'haven.restore_mossprout', title: 'Restore · 20 Glow', description: 'Bring the clearing back as Mossprout’s first garden.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'haven_upgrade', nextStepId: 'companion.meditating', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'target_tap', target: { kind: 'haven_upgrade_button', characterId: 'mossprout' } } },
      cue: { kind: 'tap', target: { kind: 'haven_upgrade_button', characterId: 'mossprout' } },
      spotlight: { targets: [{ kind: 'haven_upgrade_button', characterId: 'mossprout' }], padding: 6, radius: 16, dimOpacity: 0.62 },
      edges: [{ event: { type: 'haven_upgrade_completed', characterId: 'mossprout', stage: 1 }, commitActionId: 'haven.restore_mossprout', nextStepId: 'companion.meditating' }],
      blockingBeat: 'chapter_complete',
    },
    {
      id: 'discovery.steppling.parcel', surface: 'merge',
      guide: { eyebrow: 'A delivery from the Mist', title: 'Open the Trail-Worn Parcel.', body: 'Something inside matches the object the Mist is holding.' },
      actions: [{ id: 'discovery.steppling.parcel', title: 'Open the parcel', description: 'Place its item on the board.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'merge_parcel_claimed', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'parcel_tap', target: { kind: 'tray_parcel', arrivalId: `arrival:discovery:${STEPPLING_DISCOVERY_ID}` } } },
      cue: { kind: 'tap', target: { kind: 'tray_parcel', arrivalId: `arrival:discovery:${STEPPLING_DISCOVERY_ID}` } },
      spotlight: { targets: [{ kind: 'tray_parcel', arrivalId: `arrival:discovery:${STEPPLING_DISCOVERY_ID}` }], padding: 7, radius: 14, dimOpacity: 0.64 },
      edges: [{ event: { type: 'arrival_claimed', arrivalId: `arrival:discovery:${STEPPLING_DISCOVERY_ID}` }, commitActionId: 'discovery.steppling.parcel', nextStepId: 'discovery.steppling.sock' }],
    },
    {
      id: 'discovery.steppling.sock', surface: 'merge',
      guide: { eyebrow: 'A half-finished trail', title: 'The Sock has a match in the Mist.', body: 'Complete the merge that was already waiting here.' },
      actions: [{ id: 'discovery.steppling.sock', title: 'Make a Shoe', description: 'Drag the Sock onto the Dreambound Sock.', icon: 'figure.walk', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'adventure:trail:1', occurrence: 0 }, to: { kind: 'board_companion_discovery', discoveryId: STEPPLING_DISCOVERY_ID } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'adventure:trail:1', occurrence: 0 }, to: { kind: 'board_companion_discovery', discoveryId: STEPPLING_DISCOVERY_ID } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'adventure:trail:1', occurrence: 0 }, { kind: 'board_companion_discovery', discoveryId: STEPPLING_DISCOVERY_ID }], grouping: 'bounding_rect', padding: 4, radius: 12, dimOpacity: 0.62 },
      edges: [{ event: { type: 'companion_discovery_advanced', discoveryId: STEPPLING_DISCOVERY_ID, stage: 1 }, commitActionId: 'discovery.steppling.sock', nextStepId: 'discovery.steppling.shoe' }],
    },
    {
      id: 'discovery.steppling.shoe', surface: 'merge',
      guide: { eyebrow: 'The tracks continue', title: 'The Shoe matches the next shadow.', body: 'Carry the result forward.' },
      actions: [{ id: 'discovery.steppling.shoe', title: 'Make a Boot', description: 'Drag the Shoe onto the Dreambound Shoe.', icon: 'figure.walk', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'adventure:trail:2', occurrence: 0 }, to: { kind: 'board_companion_discovery', discoveryId: STEPPLING_DISCOVERY_ID } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'adventure:trail:2', occurrence: 0 }, to: { kind: 'board_companion_discovery', discoveryId: STEPPLING_DISCOVERY_ID } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'adventure:trail:2', occurrence: 0 }, { kind: 'board_companion_discovery', discoveryId: STEPPLING_DISCOVERY_ID }], grouping: 'bounding_rect', padding: 4, radius: 12, dimOpacity: 0.62 },
      edges: [{ event: { type: 'companion_discovery_advanced', discoveryId: STEPPLING_DISCOVERY_ID, stage: 2 }, commitActionId: 'discovery.steppling.shoe', nextStepId: 'discovery.steppling.boot' }],
    },
    {
      id: 'discovery.steppling.boot', surface: 'merge',
      guide: { eyebrow: 'Someone is close', title: 'One last match is hidden ahead.', body: 'Bring the Boot to the final Dreambound object.' },
      actions: [{ id: 'discovery.steppling.boot', title: 'Open the trail', description: 'Drag the Boot onto the Dreambound Boot.', icon: 'sparkles', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'adventure:trail:3', occurrence: 0 }, to: { kind: 'board_companion_discovery', discoveryId: STEPPLING_DISCOVERY_ID } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'adventure:trail:3', occurrence: 0 }, to: { kind: 'board_companion_discovery', discoveryId: STEPPLING_DISCOVERY_ID } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'adventure:trail:3', occurrence: 0 }, { kind: 'board_companion_discovery', discoveryId: STEPPLING_DISCOVERY_ID }], grouping: 'bounding_rect', padding: 4, radius: 12, dimOpacity: 0.62 },
      edges: [{ event: { type: 'companion_discovery_advanced', discoveryId: STEPPLING_DISCOVERY_ID, stage: 3, completedCharacterId: 'steppling' }, commitActionId: 'discovery.steppling.boot', nextStepId: 'discovery.steppling.spawn' }],
    },
    {
      id: 'discovery.steppling.spawn', surface: 'merge',
      guide: { eyebrow: 'Steppling found', title: 'Try the Journey Locker.', body: 'Tap it twice to make trail supplies.' },
      actions: [{ id: 'discovery.steppling.spawn', title: 'Make two Socks', description: 'Tap the Journey Locker twice.', icon: 'figure.walk', presentation: 'observed_game_action', handlerId: 'merge_generator_spawned', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target: { kind: 'board_generator', generatorId: 'journey-locker' } } },
      cue: { kind: 'tap', target: { kind: 'board_generator', generatorId: 'journey-locker' } },
      spotlight: { targets: [{ kind: 'board_generator', generatorId: 'journey-locker' }], padding: 5, radius: 12, dimOpacity: 0.62 },
      edges: [{ event: { type: 'item_spawned', generatorId: 'journey-locker', definitionId: 'adventure:trail:1' }, requiredCount: 2, commitActionId: 'discovery.steppling.spawn', nextStepId: 'discovery.steppling.merge' }],
    },
    {
      id: 'discovery.steppling.merge', surface: 'merge',
      guide: { eyebrow: 'First trail gear', title: 'Merge the two Socks.', body: 'Steppling needs something sturdier.' },
      actions: [{ id: 'discovery.steppling.merge', title: 'Make a Shoe', description: 'Drag the Socks together.', icon: 'figure.walk', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'adventure:trail:1', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'adventure:trail:1', occurrence: 1 } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'adventure:trail:1', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'adventure:trail:1', occurrence: 1 } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'adventure:trail:1', occurrence: 0 }, { kind: 'board_items', definitionId: 'adventure:trail:1', occurrence: 1 }], grouping: 'bounding_rect', padding: 4, radius: 12, dimOpacity: 0.62 },
      edges: [{ event: { type: 'merge_completed', resultDefinitionId: 'adventure:trail:2' }, commitActionId: 'discovery.steppling.merge', nextStepId: 'discovery.steppling.serve' }],
    },
    {
      id: 'discovery.steppling.serve', surface: 'merge',
      guide: { eyebrow: 'A new companion', title: 'Help Steppling set out.', body: 'Serve the Shoe to finish your first discovery.' },
      actions: [{ id: 'discovery.steppling.serve', title: 'Serve the Shoe', description: 'Complete Steppling’s first request.', icon: 'figure.walk', presentation: 'observed_game_action', handlerId: 'merge_order_served', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'order_serve', target: { kind: 'order_serve', orderId: 'steppling:discovery:first-trail' } } },
      cue: { kind: 'tap', target: { kind: 'order_serve', orderId: 'steppling:discovery:first-trail' } },
      spotlight: { targets: [{ kind: 'order_card', orderId: 'steppling:discovery:first-trail' }, { kind: 'order_requirement_item', orderId: 'steppling:discovery:first-trail', requirementIndex: 0 }], grouping: 'individual', padding: 9, radius: 14, dimOpacity: 0.62 },
      edges: [{ event: { type: 'order_served', orderId: 'steppling:discovery:first-trail' }, commitActionId: 'discovery.steppling.serve', nextStepId: 'complete' }],
    },
    { id: 'complete', surface: 'haven', guide: { eyebrow: '', title: '', body: '' }, actions: [] },
  ],
};

const stepsById = new Map(MOSSPROUT_FTUE_SCRIPT.steps.map((step) => [step.id, step]));
// These authored beats remain available to old local/debug fixtures. The live
// first-session route grows the First Bloom, then returns after one order.
const retiredFirstSessionStepIds = new Set(MOSSPROUT_FTUE_SCRIPT.steps
  .filter((step) => ['companion.day_one_action', 'companion.order_preview', 'world.garden_handoff', 'companion.chapter_zero_return', 'companion.water_response', 'companion.first_insight', 'egg.context', 'egg.mind', 'egg.nature_theme', 'egg.companion_identity', 'companion.nickname', 'companion.bond_intro', 'companion.bond_spotlight', 'companion.resident_affinity', 'companion.resident_parcel_ready', 'companion.resident_match_result'].includes(step.id)
    || step.id.startsWith('merge.plant.')
    || step.id.startsWith('merge.energy')
    || step.id.startsWith('energy.')
    || step.id.startsWith('merge.resident_')
    || step.id === 'merge.serve_sprout'
    || step.id === 'merge.seed_drag'
    || step.id === 'merge.second_seed_drag'
    || step.id === 'merge.first_bloom'
    || step.id === 'merge.serve_plant'
    || step.id === 'merge.return_note'
    || step.id === 'haven.mossprout.focus'
    || step.id === 'haven.mossprout.restore'
    || step.id.startsWith('discovery.'))
  .map((step) => step.id));
export function mossproutFtueStep(stepId: string) { return stepsById.get(stepId) ?? null; }
export function mossproutFtueAction(stepId: string, actionId: string) { return mossproutFtueStep(stepId)?.actions.find((action) => action.id === actionId) ?? null; }
/** Hide Garden during dialogue and the post-restoration Continue handoff. */
export function mossproutFtueShowsWorldGarden(stepId: string | null | undefined) {
  return !stepId || stepId === 'complete' || [
    'world.garden_arrival', 'world.seed_planted', 'world.garden_handoff',
    'world.first_bloom_offer', 'world.first_bloom_restore',
  ].includes(stepId);
}
export function mossproutFtueUsesHostedCompanionStage(stepId: string | null | undefined) {
  // Meditation belongs to the world's real interaction host, with its own
  // camera entry, Back exit, and compact timer—not the opening Egg overlay.
  if (!stepId || stepId === 'companion.meditating') return false;
  const step = mossproutFtueStep(stepId);
  return Boolean(step && (
    step.surface === 'companion'
    || step.actions.some((action) => action.handlerId === 'companion_conversation')
  ));
}

export function validateMossproutFtueScript(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const step of MOSSPROUT_FTUE_SCRIPT.steps) {
    if (ids.has(step.id)) errors.push(`Duplicate step: ${step.id}`);
    ids.add(step.id);
    const actionIds = new Set<string>();
    for (const action of step.actions) {
      if (actionIds.has(action.id)) errors.push(`Duplicate action in ${step.id}: ${action.id}`);
      actionIds.add(action.id);
      if (action.nextStepId && !MOSSPROUT_FTUE_SCRIPT.steps.some((candidate) => candidate.id === action.nextStepId)) errors.push(`Missing next step ${action.nextStepId}`);
      if (action.presentation === 'inline_choice' && !action.options?.length) errors.push(`Choice action has no options: ${action.id}`);
      if (action.presentation === 'inline_choice' && (action.options?.length ?? 0) > 5) errors.push(`Choice action has more than five options: ${action.id}`);
      const optionIds = new Set<string>();
      for (const option of action.options ?? []) {
        if (optionIds.has(option.id)) errors.push(`Duplicate option in ${action.id}: ${option.id}`);
        optionIds.add(option.id);
        if (option.nextStepId && !MOSSPROUT_FTUE_SCRIPT.steps.some((candidate) => candidate.id === option.nextStepId)) errors.push(`Missing option next step ${option.nextStepId}`);
      }
    }
    for (const edge of step.edges ?? []) {
      if (!actionIds.has(edge.commitActionId)) errors.push(`Missing edge action in ${step.id}: ${edge.commitActionId}`);
      if (!MOSSPROUT_FTUE_SCRIPT.steps.some((candidate) => candidate.id === edge.nextStepId)) errors.push(`Missing edge step ${edge.nextStepId}`);
    }
    if (step.spotlight && step.spotlight.targets.length === 0) errors.push(`Spotlight has no targets: ${step.id}`);
    if (step.id === 'merge.resident_parcel') {
      const allowed = step.interaction?.mode === 'exclusive' ? step.interaction.allowed : null;
      if (allowed?.kind !== 'parcel_tap' || allowed.target.kind !== 'active_resident_parcel') errors.push('Resident parcel step is not bound to the active parcel');
      if (step.edges?.[0]?.event.type !== 'arrival_claimed' || !step.edges[0].event.residentDiscovery) errors.push('Resident parcel step accepts an unrelated arrival');
    }
    if (step.id === 'merge.resident_card') {
      const allowed = step.interaction?.mode === 'exclusive' ? step.interaction.allowed : null;
      if (allowed?.kind !== 'board_drag' || allowed.from.kind !== 'active_resident_card_item' || allowed.to.kind !== 'active_resident_card_node') {
        errors.push('Resident reveal step is not bound to its sealed card and mystery node');
      }
    }
    if (step.id === 'merge.resident_seed_spawn') {
      const allowed = step.interaction?.mode === 'exclusive' ? step.interaction.allowed : null;
      if (allowed?.kind !== 'generator_tap' || allowed.target.kind !== 'board_generator' || allowed.target.generatorId !== 'wild-garden') {
        errors.push('Resident Seed lesson is not bound to one Wild Garden tap');
      }
    }
    if (step.id === 'merge.resident_seed_echo' || step.id === 'merge.resident_sprout_echo') {
      const allowed = step.interaction?.mode === 'exclusive' ? step.interaction.allowed : null;
      if (allowed?.kind !== 'board_drag' || allowed.to.kind !== 'board_dream_echo') {
        errors.push(`Resident locked-slot lesson is not an exclusive drag: ${step.id}`);
      }
    }
    if (step.id === 'merge.resident_orders' && (step.edges?.[0]?.event.type !== 'order_served' || !step.edges[0].event.residentDiscovery)) {
      errors.push('Resident request step accepts an unrelated order');
    }
    if (step.id === 'merge.resident_orders') {
      const allowed = step.interaction?.mode === 'exclusive' ? step.interaction.allowed : null;
      if (allowed?.kind !== 'order_serve' || allowed.target.kind !== 'active_resident_order_serve' || step.edges?.[0]?.requiredCount != null) {
        errors.push('First resident request must gate one active Serve action');
      }
    }
  }
  if (!ids.has(MOSSPROUT_FTUE_SCRIPT.entryStepId)) errors.push('Missing entry step');
  if (!ids.has(MOSSPROUT_FTUE_SCRIPT.terminalStepId)) errors.push('Missing terminal step');
  const reachable = new Set<string>();
  const pending = [MOSSPROUT_FTUE_SCRIPT.entryStepId];
  while (pending.length) {
    const stepId = pending.pop()!;
    if (reachable.has(stepId)) continue;
    reachable.add(stepId);
    const step = mossproutFtueStep(stepId);
    step?.actions.forEach((action) => {
      if (action.nextStepId) pending.push(action.nextStepId);
      action.options?.forEach((option) => { if (option.nextStepId) pending.push(option.nextStepId); });
    });
    step?.edges?.forEach((edge) => pending.push(edge.nextStepId));
  }
  for (const step of MOSSPROUT_FTUE_SCRIPT.steps) {
    if (!reachable.has(step.id) && !retiredFirstSessionStepIds.has(step.id)) errors.push(`Unreachable step: ${step.id}`);
  }
  return errors;
}
