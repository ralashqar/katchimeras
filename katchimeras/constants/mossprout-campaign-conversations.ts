import { MOSSPROUT_CAMPAIGN_EPISODES } from '@/constants/mossprout-campaign';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import type { ConversationDefinition, ConversationOption, ConversationTurn } from '@/types/companion-conversation';
import type { KatchimeraStoryProgress } from '@/types/relationship-progression';

type SceneChoice = readonly [id: string, label: string, reply: string];

const episode = (number: number) => MOSSPROUT_CAMPAIGN_EPISODES[number - 1]!;

function scene(
  id: string,
  title: string,
  prompt: string,
  choices: readonly SceneChoice[],
  ending: string,
): ConversationDefinition {
  const options: ConversationOption[] = choices.map(([optionId, label, reply]) => ({
    id: optionId, label, reply, nextNodeId: 'end',
  }));
  return {
    id, version: 2, familyId: 'mossprout', title, actionTitle: title,
    trigger: 'evergreen', minimumBondLevel: 1, cooldownDays: 3650,
    contextualOnly: true, format: 'narrative', purpose: 'journey', returnTarget: 'character_home',
    repeatPolicy: 'once_ever', topicKey: id, tags: ['story', 'mossprout', 'campaign-v2'], entryNodeId: 'scene',
    nodes: [
      { id: 'scene', kind: 'choice', phase: 'deepen', prompt, options },
      { id: 'end', kind: 'end', message: ending },
    ],
  };
}

function opening(number: number, prompt: string, choices: readonly SceneChoice[], ending: string) {
  const definition = episode(number);
  return scene(definition.openingConversationId, definition.title, prompt, choices, ending);
}

function resolution(number: number, prompt: string, choices: readonly SceneChoice[], ending: string) {
  const definition = episode(number);
  return scene(definition.resolutionConversationId!, `${definition.title}: return`, prompt, choices, ending);
}

const residentMatch = opening(3,
  'Something rustles in the reeds. It has followed the first rain all the way here. Who steps out?',
  [
    ['resident-petalimp', 'Petalimp, carrying petals', 'Petalimp lands in the mud and immediately begins decorating it.'],
    ['resident-fernip', 'Fernip, following a hidden path', 'Fernip emerges backwards, as if the reeds were a secret door.'],
    ['resident-blossle', 'Blossle, bright with spring', 'Blossle shakes off three drops and an unreasonable amount of confetti.'],
    ['resident-amberleaf', 'Amberleaf, warm as autumn', 'Amberleaf bows to the pond. The pond bubbles back.'],
    ['resident-drizzlet', 'Drizzlet, pleased about the rain', 'Drizzlet looks at the tiny puddle as if personally responsible.'],
    ['resident-mistle', 'Mistle, quiet in the haze', 'Mistle appears where the mist thins, soft-footed and curious.'],
    ['resident-driftkin', 'Driftkin, pushed in by the wind', 'Driftkin arrives with a leaf stuck to their head and keeps it.'],
    ['resident-tempesto', 'Tempesto, chasing the storm', 'Tempesto points at the clouds. “Late,” Mossprout agrees.'],
  ],
  'The new neighbour stays. Mossprout pretends not to notice them choosing a favourite stone.');

const campaignScenes: readonly ConversationDefinition[] = [
  opening(2,
    'At dawn, the dry pond knocks twice from underneath. Mossprout freezes. “Ponds do not usually knock.” How do we answer?',
    [
      ['approach-knock', 'Knock back', 'Mossprout taps the mud. Something taps back—politely this time.'],
      ['approach-mud', 'Inspect the mud', 'There are tiny wet footprints going in. None coming out.'],
      ['approach-help', 'Ask if it needs help', 'A bubble rises through the dust. Mossprout decides that counts as yes.'],
    ],
    'Beneath the cracked pond bed, a thin thread of water begins to move.'),
  residentMatch,
  resolution(3,
    'The Shell settles beside the first puddle. {{coStar}} circles it once, then sits on it like an official seal.',
    [['shell-seat', 'Let them keep the seat', '“Every pond needs an inspector,” Mossprout says.'], ['shell-move', 'Move it nearer the water', '{{coStar}} supervises the move from two inches away.']],
    '{{coStar}} has joined the garden—and already has opinions.'),
  opening(4,
    '{{coStar}} has built a tiny flag in the mud. Mossprout suspects this means “construction meeting.” What should the pond bank do first?',
    [
      ['priority-shelter', 'Make shelter', 'A safe edge first. Somewhere small lives can wait out weather.'],
      ['priority-colour', 'Bring back colour', 'Mossprout nods. “A place can be useful and still cheer when you arrive.”'],
      ['priority-water', 'Hold more water', '“Then we build for the next rain, not only this one.”'],
    ],
    'Mossprout sketches the plan on a leaf. {{coStar}} adds one muddy footprint.'),
  resolution(4,
    'The new Plant leans over the bank. Its roots grip the soil; its leaves catch the first drops.',
    [['bank-holds', 'The bank holds', 'Mossprout exhales. “So do we.”'], ['plant-wave', 'Wave to the Plant', 'One leaf moves. There is no wind.']],
    'The pond has an edge strong enough to begin again.'),
  opening(5,
    'Water has returned, but the pond still feels like a room with no chairs. Who should this place welcome?',
    [
      ['welcome-small-lives', 'Small lives', '“Then we leave gaps, shade, and no grand entrance fee.”'],
      ['welcome-visitors', 'Curious visitors', '“A path in, a reason to pause, and something worth noticing.”'],
      ['welcome-quiet', 'Anyone needing quiet', 'Mossprout lowers their voice. “We can grow that kind of welcome.”'],
    ],
    '{{coStar}} carries the first Flower to the water as if presenting a flag.'),
  resolution(5,
    'The Flower opens. A Tidepool answers with one bright ripple. Then another. The dry pond is dry no longer.',
    [['name-rain-garden', 'Call it the Rain Garden', 'Mossprout repeats the name slowly, making sure the pond hears.'], ['let-pond-name', 'Let the pond choose later', '“Fair. It has only just found its voice.”']],
    'The garden now has a place that remembers rain.'),
  opening(6,
    'A brass key hangs from a root where no key hung yesterday. It is warm. {{coStar}} refuses to touch it. Mossprout touches it immediately.',
    [['turn-key', 'Turn it', 'Somewhere beyond the hedge, a lock remembers it exists.'], ['follow-root', 'Follow the root first', 'The root leads to a gate hidden under years of ivy.']],
    'The gate opens onto a nursery full of empty labels—and one bed still breathing.'),
  resolution(6,
    'The restored nursery bed gives a soft green shiver. Mossprout finds an old sign: THINGS WE MEANT TO RETURN FOR.',
    [['keep-sign', 'Keep the sign', '“Then returning can be part of the place, not a failure.”'], ['turn-sign', 'Turn it into a new label', 'Mossprout leaves the old words faintly visible underneath.']],
    'The Memory Nursery is awake.'),
  opening(7,
    'A root lifts a small keepsake from the soil. It is not yours, but it feels familiar—the way forgotten intentions sometimes do. What should a garden do with old things?',
    [
      ['memory-keep', 'Keep them safe', '“A garden can hold something until we are ready.”'],
      ['memory-plant', 'Plant them into something new', '“Not erased. Changed into a shape that can keep growing.”'],
      ['memory-release', 'Let them go gently', 'Mossprout brushes off the soil. “Leaving can be an act of care too.”'],
    ],
    '{{coStar}} chooses a nursery bed and guards it with unnecessary seriousness.'),
  resolution(7,
    'The Keepsake Root curls into the bed. A new shoot rises beside it, carrying the old shape in its veins.',
    [['notice-new', 'Notice what changed', '“That is the nursery’s trick: memory without standing still.”'], ['sit-beside', 'Sit beside it', '{{coStar}} makes room. Barely.']],
    'The nursery learns how you want to meet what came before.'),
  opening(8,
    'Every label in the nursery has turned overnight. They now face the path, as if waiting to be read. One carries the promise from your first garden: {{promise}}.',
    [['read-labels', 'Read them aloud', 'The leaves rustle after each name.'], ['leave-blank', 'Add one blank label', '“For something we have not met yet,” Mossprout says.']],
    'At the far bed, the soil remembers a plant no one planted.'),
  resolution(8,
    'The remembered Plant unfolds in a shape made from several earlier choices. {{coStar}} stares, then bows.',
    [['bow-too', 'Bow too', 'Mossprout bows lower. This becomes competitive.'], ['touch-leaf', 'Touch one leaf', 'It is warm with every return that brought you here.']],
    'The garden is no longer only growing. It is remembering.'),
  opening(9,
    'The nursery path disappears at dusk. Mossprout has walked into the same watering can three times. Who should the new lanterns guide?',
    [
      ['lantern-home', 'Us, back home', '“A light that says: you know the way from here.”'],
      ['lantern-visitors', 'New visitors', '“Then the path should feel like an invitation, not a test.”'],
      ['lantern-lost-things', 'Anything that feels lost', 'Mossprout looks at the empty beds. “Yes. Especially that.”'],
    ],
    '{{coStar}} volunteers as lantern tester by standing directly in front of the first one.'),
  resolution(9,
    'The Lantern Bank glows along the nursery path. One light stays dark—until {{coStar}} nudges it.',
    [['follow-lights', 'Follow the lights', 'Each one brightens just before you reach it.'], ['save-dark-one', 'Keep one unlit', '“For the night sky,” Mossprout says. “It should get a lantern too.”']],
    'The nursery can now find its way through the dark.'),
  opening(10,
    'A storm arrives without rain. The pond turns silver and shows the garden as it used to be: taller, tidier, and entirely empty of you.',
    [['break-reflection', 'Touch the water', 'The old garden breaks into rings. Your garden remains.'], ['watch-longer', 'Look a little longer', 'Mossprout watches too. “Beautiful is not the same as ours.”']],
    '{{coStar}} drops a pebble into the reflection. The old garden vanishes with a plop.'),
  resolution(10,
    'The Rain Mirror settles into the pond. Now it reflects what is here—not what the garden thinks it should have been.',
    [['wave-mirror', 'Wave at the mirror', '{{coStar}} waves back first.'], ['thank-pond', 'Thank the pond', 'A bubble reaches the surface, perfectly on cue.']],
    'The garden chooses the present.'),
  opening(11,
    'A fallen trunk blocks the path. Inside it, rings glow with your returns: the pond, the nursery, {{coStar}}, and a promise to grow {{promise}}.',
    [['count-rings', 'Count the rings', 'There are more than days. Mossprout decides attention must leave extra rings.'], ['leave-uncounted', 'Leave some uncounted', '“Good. Not everything meaningful needs a total.”']],
    'The trunk opens a narrow path toward the Heartwood.'),
  resolution(11,
    'Roots lace the old trunk to the living garden. What blocked the path now holds it together.',
    [['cross-bridge', 'Cross together', 'Mossprout, {{coStar}}, and you step onto it at once. It holds.'], ['let-costar-first', 'Let {{coStar}} go first', '{{coStar}} crosses, returns, and crosses again for quality control.']],
    'The way forward is made from everything that once seemed in the way.'),
  opening(12,
    'At the Heartwood clearing, the wind asks one question in every leaf: what is this garden for?',
    [
      ['sanctuary-shelter', 'A place that shelters', '“Then it should hold people gently, without closing the world out.”'],
      ['sanctuary-welcome', 'A place that welcomes', '“A door in every direction.”'],
      ['sanctuary-remember', 'A place that remembers', '“Not a museum. A memory that keeps making leaves.”'],
    ],
    '{{coStar}} plants the muddy flag from the pond in the centre of the clearing.'),
  resolution(12,
    'The sanctuary takes shape around the flag. It carries the welcome you chose at the pond and the light you chose in the nursery.',
    [['step-inside', 'Step inside', 'The noise of the storm softens at the threshold.'], ['hold-door', 'Hold the way open', 'A line of tiny garden residents immediately accepts the invitation.']],
    'The garden has become a place that can hold more than itself.'),
  opening(13,
    'The Heartwood is ready, but Mossprout is not moving. “If we finish it, the journey changes.” {{coStar}} leans against them. What do you say?',
    [['finish-is-return', 'Finishing means we can return', 'Mossprout looks at the paths behind you. “We are good at that.”'], ['garden-keeps-growing', 'Gardens never really finish', '“True. They only become ready for a different question.”']],
    'Together, you carry the final living piece into the clearing.'),
  resolution(13,
    'The Heartwood opens—not upward, but outward. Pond water runs beneath it. Nursery lanterns glow in its bark. Every path leads home.',
    [['our-garden', 'This is our garden', 'Mossprout smiles. {{coStar}} plants the flag one final time.'], ['what-next', 'What grows next?', 'A new bud appears before Mossprout can answer.']],
    'The journey ends where a garden should: alive, unfinished, and ready for your next return.'),
];

function optionalScene(id: string, title: string, prompt: string): ConversationDefinition {
  return scene(id, title, prompt, [
    ['wild', 'Follow the wild idea', 'Mossprout writes it down before good sense can catch up.'],
    ['careful', 'Test it carefully', '{{coStar}} has already begun the least careful version.'],
    ['snack', 'Bring snacks first', '“Finally,” Mossprout says, “a complete plan.”'],
  ], 'The experiment is officially inconclusive and unofficially excellent.');
}

export const mossproutCampaignConversationDefinitions: readonly ConversationDefinition[] = [
  ...campaignScenes,
  optionalScene(`${episode(2).openingConversationId.replace(':opening', '')}:playful`, 'Pond detective club', 'What is the correct way to investigate a knocking pond?'),
  scene(`${episode(7).openingConversationId.replace(':opening', '')}:goal-plan`, 'A small return', 'What kind of real-life return would fit this week?', [
    ['minute', 'Notice one growing thing', 'Small enough to do. Real enough to count.'],
    ['tend', 'Tend something briefly', 'Care does not need a grand ceremony.'],
    ['visit', 'Revisit a green place', 'Returning is how a place learns your footsteps.'],
  ], 'Mossprout folds the idea into a pocket-sized plan.'),
  optionalScene(`${episode(8).openingConversationId.replace(':opening', '')}:playful`, 'Nursery label emergency', 'A label has escaped. How do we persuade it to return?'),
  optionalScene(`${episode(12).openingConversationId.replace(':opening', '')}:playful`, 'Sanctuary opening committee', 'What does every excellent sanctuary absolutely need?'),
];

const promiseCopy: Readonly<Record<string, string>> = {
  quiet: 'quiet', surprise: 'room for surprise', care: 'care for small living things',
};

const goalIdsByAnswer: Readonly<Record<string, readonly string[]>> = {
  'style-notice': ['mossprout:notice-living-thing', 'mossprout:season-change', 'mossprout:window-view'],
  'style-pause': ['mossprout:step-outside', 'mossprout:sit-outside', 'mossprout:window-view'],
  'style-tend': ['mossprout:care-for-plant', 'mossprout:notice-living-thing', 'mossprout:same-place'],
  'style-visit': ['mossprout:visit-green', 'mossprout:same-place', 'mossprout:season-change'],
  notice: ['mossprout:notice-living-thing', 'mossprout:season-change', 'mossprout:window-view'],
  outside: ['mossprout:step-outside', 'mossprout:sit-outside', 'mossprout:notice-living-thing'],
  plant: ['mossprout:care-for-plant', 'mossprout:notice-living-thing', 'mossprout:same-place'],
  'place-home': ['mossprout:window-view', 'mossprout:care-for-plant'],
  home: ['mossprout:window-view', 'mossprout:care-for-plant'],
  'place-route': ['mossprout:step-outside', 'mossprout:same-place', 'mossprout:season-change'],
  route: ['mossprout:step-outside', 'mossprout:same-place', 'mossprout:season-change'],
  'place-green': ['mossprout:visit-green', 'mossprout:sit-outside', 'mossprout:notice-living-thing'],
  green: ['mossprout:visit-green', 'mossprout:sit-outside', 'mossprout:notice-living-thing'],
};

function goalSuggestions(turns: readonly ConversationTurn[], fallback: readonly string[]): string[] {
  const answered = new Set(turns.map((turn) => turn.optionId));
  const ranked = [...turns].reverse().flatMap((turn) => goalIdsByAnswer[turn.optionId] ?? []);
  if (answered.has('time-minute') || answered.has('minute')) {
    ranked.push('mossprout:window-view', 'mossprout:notice-living-thing', 'mossprout:step-outside');
  }
  if (answered.has('time-outing') || answered.has('outing')) ranked.unshift('mossprout:visit-green', 'mossprout:same-place');
  const suggestions = [...new Set([...ranked, ...fallback])];
  const sized = answered.has('time-minute') || answered.has('minute')
    ? suggestions.filter((goalId) => goalId !== 'mossprout:visit-green' && goalId !== 'mossprout:sit-outside')
    : suggestions;
  return sized.slice(0, 3);
}

/** Resolve story callbacks and answer-shaped suggestions at serve time. */
export function resolveMossproutCampaignConversation(
  definition: ConversationDefinition,
  story: KatchimeraStoryProgress | undefined,
  turns: readonly ConversationTurn[] = [],
): ConversationDefinition {
  if (definition.familyId !== 'mossprout') return definition;
  const coStar = story?.coStarSkinId
    ? katchimeraSkinById.get(story.coStarSkinId)?.displayName ?? 'a passing beetle'
    : 'a passing beetle';
  const promise = promiseCopy[story?.storyFacts?.garden_promise ?? ''] ?? 'space for whatever needs it';
  const completed = story?.completedBeatIds ?? [];
  const place = completed.some((beatId) => beatId.startsWith('heartwood:'))
    ? 'the Heartwood'
    : completed.some((beatId) => beatId.startsWith('memory-nursery:'))
      ? 'the nursery'
      : completed.some((beatId) => beatId.startsWith('returning-pond:') || beatId.endsWith('pond-knock'))
        ? 'the rain garden'
        : 'the garden';
  const replace = (value: unknown): unknown => {
    if (typeof value === 'string') return value
      .replaceAll('{{coStar}}', coStar)
      .replaceAll('{{promise}}', promise)
      .replaceAll('{{place}}', place);
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    return value;
  };
  const resolved = replace(definition) as ConversationDefinition;
  if (!turns.length || (!definition.id.includes('goal-plan') && definition.id !== 'mossprout:conversation:nature-goal-discovery')) return resolved;
  return {
    ...resolved,
    nodes: resolved.nodes.map((node) => node.kind === 'goal_proposal'
      ? { ...node, suggestedQuickGoalIds: goalSuggestions(turns, node.suggestedQuickGoalIds) }
      : node),
  };
}
