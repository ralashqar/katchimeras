import { TODAY_GROWTH_REWARDS } from '@/utils/today-growth';

import type { FtueActionDefinition, FtueScriptDefinition } from './ftue-types';

const privateChoice = { id: 'private', label: 'Prefer not to say', icon: 'lock.fill', private: true } as const;
// The Discovery Egg is an authored three-beat sequence. Each answer must move
// its physical growth by the same amount, regardless of the normal daily
// reward assigned to that answer's semantic source.
export const FTUE_EGG_ANSWER_GROWTH_REWARD = TODAY_GROWTH_REWARDS.reflection;
export const MOSSPROUT_FTUE_RETURN_NOTE_ID = 'mossprout:chapter-0:return-note';

const openingActions: readonly FtueActionDefinition[] = [
  {
    id: 'egg.feeling', title: 'How do you feel?', description: 'Pick one.', icon: 'face.smiling',
    presentation: 'inline_choice', handlerId: 'day_prompt', promptKind: 'feeling', growthSource: 'mood', growthReward: FTUE_EGG_ANSWER_GROWTH_REWARD,
    nextStepId: 'egg.context', backendEvent: true,
    options: [
      { id: 'great', label: 'Great', icon: 'face.very_happy', domainChoiceId: 'energized' },
      { id: 'good', label: 'Good', icon: 'face.happy', domainChoiceId: 'good' },
      { id: 'okay', label: 'Okay', icon: 'face.neutral', domainChoiceId: 'meh' },
      { id: 'tired', label: 'Tired', icon: 'face.sad', domainChoiceId: 'drained' },
      { id: 'rough', label: 'Rough', icon: 'cloud.rain.fill', domainChoiceId: 'stressed' },
      privateChoice,
    ],
  },
];

export const MOSSPROUT_FTUE_SCRIPT: FtueScriptDefinition = {
  id: 'mossprout-first-session',
  version: 9,
  entryStepId: 'egg.opening',
  terminalStepId: 'complete',
  steps: [
    {
      id: 'egg.opening', surface: 'today',
      guide: { eyebrow: 'A tiny spark', title: 'Something is waiting.', body: 'Share one piece of today.' },
      actions: openingActions,
    },
    {
      id: 'egg.context', surface: 'today',
      guide: { eyebrow: 'It felt that', title: 'The Egg is stirring.', body: 'Give it one more piece.' },
      actions: [{
        id: 'egg.context.activity', title: 'What was part of today?', description: 'Pick one.', icon: 'leaf.fill',
        presentation: 'inline_choice', handlerId: 'day_prompt', promptKind: 'activity', growthSource: 'reflection', growthReward: FTUE_EGG_ANSWER_GROWTH_REWARD,
        nextStepId: 'egg.mind', backendEvent: true,
        options: [
          { id: 'work', label: 'Work', icon: 'briefcase.fill', domainChoiceId: 'work' },
          { id: 'family', label: 'Family', icon: 'person.2.fill', domainChoiceId: 'family' },
          { id: 'outside', label: 'Outside', icon: 'leaf.fill', domainChoiceId: 'outdoors' },
          { id: 'friends', label: 'Friends', icon: 'bubble.left.and.bubble.right.fill', domainChoiceId: 'friends' },
          { id: 'relaxing', label: 'Relaxing', icon: 'moon.stars.fill', domainChoiceId: 'resting' },
          { id: 'something_else', label: 'Something else', icon: 'sparkles', domainChoiceId: 'new' },
          privateChoice,
        ],
      }],
    },
    {
      id: 'egg.mind', surface: 'today',
      guide: { eyebrow: 'Almost awake', title: 'One last thing.', body: 'What has your attention?' },
      actions: [{
        id: 'egg.mind.focus', title: "What's on your mind?", description: 'Pick one.', icon: 'sparkles',
        presentation: 'inline_choice', handlerId: 'day_prompt', promptKind: 'day_focus', growthSource: 'reflection', growthReward: FTUE_EGG_ANSWER_GROWTH_REWARD,
        nextStepId: 'egg.ready', backendEvent: true,
        options: [
          { id: 'people', label: 'People', icon: 'person.2.fill', domainChoiceId: 'people' },
          { id: 'progress', label: 'Something to do', icon: 'briefcase.fill', domainChoiceId: 'progress' },
          { id: 'places', label: 'Somewhere', icon: 'mappin.and.ellipse', domainChoiceId: 'places' },
          { id: 'rest', label: 'Getting some rest', icon: 'moon.stars.fill', domainChoiceId: 'rest' },
          { id: 'fun', label: 'Something fun', icon: 'party.popper.fill', domainChoiceId: 'fun' },
          { id: 'getting_through', label: 'Getting through today', icon: 'cloud.rain.fill', domainChoiceId: 'getting_through' },
          privateChoice,
        ],
      }],
    },
    {
      id: 'egg.ready', surface: 'today',
      guide: { eyebrow: 'A new beginning', title: "It's ready to meet you.", body: 'Your day woke the Egg.' },
      actions: [{ id: 'egg.hatch', title: 'Hatch the Egg', description: 'Meet your new friend.', icon: 'sparkles', presentation: 'cta_action', handlerId: 'discovery_hatch', nextStepId: 'hatch.reveal', backendEvent: true }],
    },
    {
      id: 'hatch.reveal', surface: 'hatch',
      guide: { eyebrow: 'A new friend', title: 'Mossprout', body: 'A tiny spirit ready to grow.' },
      actions: [{ id: 'hatch.talk_to_mossprout', title: 'Say hello', description: 'Meet Mossprout.', icon: 'bubble.left.fill', presentation: 'cta_action', handlerId: 'companion_conversation', nextStepId: 'companion.first_meeting' }],
      blockingBeat: 'mossprout_intro',
    },
    {
      id: 'companion.first_meeting', surface: 'companion',
      guide: { eyebrow: 'Say hello', title: 'Meet Mossprout.', body: 'It remembers what you shared.' },
      actions: [{ id: 'companion.complete_first_meeting', title: 'See the requests', description: 'Plan Mossprout’s first garden.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'companion_conversation', nextStepId: 'companion.order_preview', backendEvent: true }],
      blockingBeat: 'mossprout_intro',
    },
    {
      id: 'companion.order_preview', surface: 'companion',
      guide: { eyebrow: 'A little place to begin', title: 'Two things to grow.', body: 'Start small, then grow something taller.' },
      actions: [{ id: 'companion.open_garden', title: 'Open the garden', description: 'Begin Mossprout’s requests.', icon: 'leaf.fill', presentation: 'cta_action', handlerId: 'companion_order_preview', nextStepId: 'merge.seed_drag', backendEvent: true }],
      blockingBeat: 'mossprout_intro',
    },
    {
      id: 'merge.seed_drag', surface: 'merge',
      guide: { eyebrow: 'First request', title: 'Make a Sprout.', body: 'Merge the two Seeds.' },
      actions: [{ id: 'merge.create_sprout', title: 'Make a Sprout', description: 'Swipe one Seed into the other.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
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
        nextStepId: 'merge.serve_sprout',
      }],
    },
    {
      id: 'merge.serve_sprout', surface: 'merge',
      guide: { eyebrow: 'First request', title: 'Help Mossprout.', body: 'Serve the Sprout.' },
      actions: [{ id: 'merge.serve_sprout', title: 'Serve the Sprout', description: 'Give Mossprout what it needs.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_order_served', backendEvent: true }],
      interaction: {
        mode: 'exclusive',
        allowed: { kind: 'order_serve', target: { kind: 'order_serve', orderId: 'mossprout:chapter-0:first-sprout' } },
      },
      cue: { kind: 'tap', target: { kind: 'order_serve', orderId: 'mossprout:chapter-0:first-sprout' } },
      spotlight: {
        targets: [
          { kind: 'order_requirement_item', orderId: 'mossprout:chapter-0:first-sprout', requirementIndex: 0 },
          { kind: 'order_serve', orderId: 'mossprout:chapter-0:first-sprout' },
        ],
        grouping: 'individual',
        padding: 7,
        radius: 14,
        dimOpacity: 0.64,
      },
      edges: [{
        event: { type: 'order_served', orderId: 'mossprout:chapter-0:first-sprout' },
        commitActionId: 'merge.serve_sprout',
        nextStepId: 'merge.plant.spawn',
      }],
    },
    {
      id: 'merge.plant.spawn', surface: 'merge',
      guide: { eyebrow: 'Second request', title: 'Grow four Seeds.', body: 'Tap the Wild Garden.' },
      actions: [{ id: 'merge.spawn_plant_seeds', title: 'Grow four Seeds', description: 'Tap the Wild Garden four times.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_generator_spawned', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } } },
      cue: { kind: 'tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } },
      spotlight: { targets: [{ kind: 'board_generator', generatorId: 'wild-garden' }], padding: 5, radius: 12, dimOpacity: 0.64 },
      edges: [{ event: { type: 'item_spawned', generatorId: 'wild-garden', definitionId: 'nature:garden:1' }, requiredCount: 4, commitActionId: 'merge.spawn_plant_seeds', nextStepId: 'merge.plant.seed_pairs' }],
    },
    {
      id: 'merge.plant.seed_pairs', surface: 'merge',
      guide: { eyebrow: 'Second request', title: 'Make two Sprouts.', body: 'Merge the Seeds in pairs.' },
      actions: [{ id: 'merge.create_two_sprouts', title: 'Make two Sprouts', description: 'Merge both pairs of Seeds.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 0 }, { kind: 'board_items', definitionId: 'nature:garden:1', occurrence: 1 }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'merge_completed', resultDefinitionId: 'nature:garden:2' }, requiredCount: 2, commitActionId: 'merge.create_two_sprouts', nextStepId: 'merge.plant.sprout_pair' }],
    },
    {
      id: 'merge.plant.sprout_pair', surface: 'merge',
      guide: { eyebrow: 'Second request', title: 'Make a Plant.', body: 'Merge the two Sprouts.' },
      actions: [{ id: 'merge.create_home_plant', title: 'Make a Plant', description: 'Merge the two Sprouts.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_item_created', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'board_drag', from: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 1 } } },
      cue: { kind: 'drag', from: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, to: { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 1 } },
      spotlight: { targets: [{ kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 0 }, { kind: 'board_items', definitionId: 'nature:garden:2', occurrence: 1 }], grouping: 'bounding_rect', padding: 3, radius: 11, dimOpacity: 0.64 },
      edges: [{ event: { type: 'merge_completed', resultDefinitionId: 'nature:garden:3' }, commitActionId: 'merge.create_home_plant', nextStepId: 'merge.serve_plant' }],
    },
    {
      id: 'merge.serve_plant', surface: 'merge',
      guide: { eyebrow: 'Second request', title: 'Bring it home.', body: 'Serve the Plant.' },
      actions: [{ id: 'merge.serve_home_plant', title: 'Serve the Plant', description: 'Give Mossprout its new Plant.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_order_served', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'order_serve', target: { kind: 'order_serve', orderId: 'mossprout:chapter-0:home-plant' } } },
      cue: { kind: 'tap', target: { kind: 'order_serve', orderId: 'mossprout:chapter-0:home-plant' } },
      spotlight: { targets: [{ kind: 'order_requirement_item', orderId: 'mossprout:chapter-0:home-plant', requirementIndex: 0 }, { kind: 'order_serve', orderId: 'mossprout:chapter-0:home-plant' }], grouping: 'individual', padding: 7, radius: 14, dimOpacity: 0.64 },
      edges: [{ event: { type: 'order_served', orderId: 'mossprout:chapter-0:home-plant' }, commitActionId: 'merge.serve_home_plant', nextStepId: 'merge.energy.spawn_pair' }],
    },
    {
      id: 'merge.energy.spawn_pair', surface: 'merge',
      guide: { eyebrow: 'One more plant', title: 'Start with two Seeds.', body: 'Tap the Wild Garden twice.' },
      actions: [{ id: 'merge.energy.spawn_pair', title: 'Grow two Seeds', description: 'Tap the Wild Garden twice.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_generator_spawned', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } } },
      cue: { kind: 'tap', target: { kind: 'board_generator', generatorId: 'wild-garden' } },
      spotlight: { targets: [{ kind: 'board_generator', generatorId: 'wild-garden' }], padding: 5, radius: 12, dimOpacity: 0.64 },
      edges: [{ event: { type: 'item_spawned', generatorId: 'wild-garden', definitionId: 'nature:garden:1' }, requiredCount: 2, commitActionId: 'merge.energy.spawn_pair', nextStepId: 'merge.energy.first_sprout' }],
    },
    {
      id: 'merge.energy.first_sprout', surface: 'merge',
      guide: { eyebrow: 'One more plant', title: 'Make a Sprout.', body: 'Merge the two Seeds.' },
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
      guide: { eyebrow: 'Mossprout noticed', title: 'Weâ€™re running low.', body: 'Your day made this Energy before.' },
      actions: [{ id: 'merge.tell_me_more', title: 'Tell me something else', description: 'Bring a new memory back.', icon: 'sparkles', presentation: 'cta_action', handlerId: 'acknowledgement', nextStepId: 'energy.capture', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'generator_tap', target: { kind: 'board_generator', generatorId: '__locked__' } } },
      blockingBeat: 'energy_connection',
    },
    {
      id: 'energy.capture', surface: 'today',
      guide: { eyebrow: 'A little more of today', title: 'What would you like to keep?', body: 'Choose one.' },
      actions: [
        { id: 'energy.photo', title: 'Add a photo', description: 'Keep something you saw.', icon: 'camera.fill', presentation: 'route_action', handlerId: 'journal_photo', nextStepId: 'energy.journal_reward', backendEvent: true },
        { id: 'energy.people', title: 'Remember someone', description: 'Who was part of today?', icon: 'person.2.fill', presentation: 'route_action', handlerId: 'journal_people', nextStepId: 'energy.journal_reward', backendEvent: true },
        { id: 'energy.write', title: 'Write a little moment', description: 'A few words is enough.', icon: 'square.and.pencil', presentation: 'route_action', handlerId: 'journal_text', nextStepId: 'energy.journal_reward', backendEvent: true },
      ],
      blockingBeat: 'energy_connection',
    },
    {
      id: 'energy.journal_reward', surface: 'today',
      guide: { eyebrow: 'Your memory became Energy', title: '+20 Energy', body: 'Your memories give us energy.' },
      actions: [{ id: 'energy.see_steps', title: 'See another way', description: 'Your movement can help too.', icon: 'figure.walk', presentation: 'cta_action', handlerId: 'acknowledgement', nextStepId: 'energy.steps_permission', backendEvent: true }],
      blockingBeat: 'energy_awarded',
    },
    {
      id: 'energy.steps_permission', surface: 'today',
      guide: { eyebrow: 'Movement can help too', title: 'Turn steps into Energy.', body: 'Use your device step count when you choose.' },
      actions: [{ id: 'energy.connect_steps', title: 'Use step count', description: 'Read step totals from your device.', icon: 'figure.walk', presentation: 'cta_action', handlerId: 'pedometer_steps', nextStepId: 'energy.steps_context', backendEvent: true }],
      blockingBeat: 'energy_awarded',
    },
    {
      id: 'energy.steps_context', surface: 'today',
      guide: { eyebrow: 'Yesterday moved with you', title: 'Your steps can help.', body: 'Tell Mossprout what they were part of.' },
      actions: [{
        id: 'energy.steps_context', title: 'What were your steps part of?', description: 'Choose the closest fit.', icon: 'figure.walk', presentation: 'inline_choice', handlerId: 'movement_context', nextStepId: 'energy.steps_reward', backendEvent: true,
        options: [
          { id: 'walk', label: 'A walk', icon: 'figure.walk' },
          { id: 'hike', label: 'A hike', icon: 'leaf.fill' },
          { id: 'run', label: 'A run', icon: 'sparkles' },
          { id: 'workout', label: 'A workout', icon: 'heart.fill' },
          { id: 'transit', label: 'Getting around', icon: 'mappin.and.ellipse' },
          { id: 'errands', label: 'Errands', icon: 'briefcase.fill' },
          { id: 'mixed', label: 'Something else', icon: 'party.popper.fill' },
        ],
      }],
      blockingBeat: 'energy_awarded',
    },
    {
      id: 'energy.steps_reward', surface: 'today',
      guide: { eyebrow: 'Steps became Energy', title: 'Movement powers the garden.', body: 'Only new steps can be claimed again.' },
      actions: [{ id: 'energy.return', title: 'Help Mossprout', description: 'Finish the Plant.', icon: 'leaf.fill', presentation: 'cta_action', handlerId: 'acknowledgement', nextStepId: 'merge.energy.finish_seed', backendEvent: true }],
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
      edges: [{ event: { type: 'merge_completed', resultDefinitionId: 'nature:garden:3' }, commitActionId: 'merge.energy.finish_plant', nextStepId: 'merge.energy.serve_plant' }],
    },
    {
      id: 'merge.energy.serve_plant', surface: 'merge',
      guide: { eyebrow: 'You did it', title: 'Give Mossprout the Plant.', body: 'Your memory brought you back here.' },
      actions: [{ id: 'merge.energy.serve_plant', title: 'Serve the Plant', description: 'Finish Mossproutâ€™s home.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_order_served', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'order_serve', target: { kind: 'order_serve', orderId: 'mossprout:chapter-0:energy-plant' } } },
      cue: { kind: 'tap', target: { kind: 'order_serve', orderId: 'mossprout:chapter-0:energy-plant' } },
      spotlight: { targets: [{ kind: 'order_requirement_item', orderId: 'mossprout:chapter-0:energy-plant', requirementIndex: 0 }, { kind: 'order_serve', orderId: 'mossprout:chapter-0:energy-plant' }], grouping: 'individual', padding: 7, radius: 14, dimOpacity: 0.64 },
      edges: [{ event: { type: 'order_served', orderId: 'mossprout:chapter-0:energy-plant' }, commitActionId: 'merge.energy.serve_plant', nextStepId: 'merge.return_note' }],
    },
    {
      id: 'merge.return_note', surface: 'merge',
      guide: { eyebrow: 'A note from Mossprout', title: 'The garden is ready.', body: 'Read what Mossprout left for you.' },
      actions: [{ id: 'merge.open_mossprout_note', title: 'Read Mossprout’s note', description: 'Return to Mossprout.', icon: 'envelope.fill', presentation: 'observed_game_action', handlerId: 'merge_chat_note_opened', backendEvent: true }],
      interaction: { mode: 'exclusive', allowed: { kind: 'chat_note_tap', target: { kind: 'tray_chat_note', noteId: MOSSPROUT_FTUE_RETURN_NOTE_ID } } },
      cue: { kind: 'tap', target: { kind: 'tray_chat_note', noteId: MOSSPROUT_FTUE_RETURN_NOTE_ID } },
      spotlight: { targets: [{ kind: 'tray_chat_note', noteId: MOSSPROUT_FTUE_RETURN_NOTE_ID }], padding: 7, radius: 14, dimOpacity: 0.64 },
      edges: [{ event: { type: 'chat_note_opened', noteId: MOSSPROUT_FTUE_RETURN_NOTE_ID }, commitActionId: 'merge.open_mossprout_note', nextStepId: 'companion.chapter_zero_return' }],
    },
    {
      id: 'companion.chapter_zero_return', surface: 'companion',
      guide: { eyebrow: 'A little place to begin', title: 'Mossprout has something to show you.', body: 'Finish your first chapter together.' },
      actions: [{ id: 'companion.complete_chapter_zero_return', title: 'Begin the next chapter', description: 'See Mossprout’s next request.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'companion_conversation', nextStepId: 'complete', backendEvent: true }],
      blockingBeat: 'chapter_complete',
    },
    { id: 'complete', surface: 'today', guide: { eyebrow: '', title: '', body: '' }, actions: [] },
  ],
};

const stepsById = new Map(MOSSPROUT_FTUE_SCRIPT.steps.map((step) => [step.id, step]));
export function mossproutFtueStep(stepId: string) { return stepsById.get(stepId) ?? null; }
export function mossproutFtueAction(stepId: string, actionId: string) { return mossproutFtueStep(stepId)?.actions.find((action) => action.id === actionId) ?? null; }

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
      const optionIds = new Set<string>();
      for (const option of action.options ?? []) {
        if (optionIds.has(option.id)) errors.push(`Duplicate option in ${action.id}: ${option.id}`);
        optionIds.add(option.id);
      }
    }
    for (const edge of step.edges ?? []) {
      if (!actionIds.has(edge.commitActionId)) errors.push(`Missing edge action in ${step.id}: ${edge.commitActionId}`);
      if (!MOSSPROUT_FTUE_SCRIPT.steps.some((candidate) => candidate.id === edge.nextStepId)) errors.push(`Missing edge step ${edge.nextStepId}`);
    }
    if (step.spotlight && step.spotlight.targets.length === 0) errors.push(`Spotlight has no targets: ${step.id}`);
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
    step?.actions.forEach((action) => { if (action.nextStepId) pending.push(action.nextStepId); });
    step?.edges?.forEach((edge) => pending.push(edge.nextStepId));
  }
  for (const step of MOSSPROUT_FTUE_SCRIPT.steps) if (!reachable.has(step.id)) errors.push(`Unreachable step: ${step.id}`);
  return errors;
}
