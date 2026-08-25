import {
  MOSSPROUT_CAMPAIGN_EPISODES,
  mossproutCampaignEpisodeByOpeningId,
  mossproutCampaignEpisodeByResolutionId,
} from '@/constants/mossprout-campaign';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import type {
  ConversationDefinition,
  ConversationInsightResultDefinition,
  ConversationOption,
  ConversationTurn,
} from '@/types/companion-conversation';
import type { KatchimeraStoryProgress } from '@/types/relationship-progression';

type Choice = readonly [id: string, label: string, reply: string];
type Insight = {
  key: string;
  category: string;
  title: string;
  end: string;
  results: readonly (readonly [id: string, title: string, reflection: string, matchOptionIds: readonly string[]])[];
};
type OpeningStory = {
  opening: string;
  openingChoices: readonly Choice[];
  bridge: string;
};
type DayStory = OpeningStory & {
  returnPrompt: string;
  returnChoices: readonly Choice[];
  insight: Insight;
};

const episode = (number: number) => MOSSPROUT_CAMPAIGN_EPISODES[number - 1]!;

function base(id: string, title: string, nodes: ConversationDefinition['nodes']): ConversationDefinition {
  return {
    id,
    version: 3,
    familyId: 'mossprout',
    title,
    actionTitle: title,
    trigger: 'evergreen',
    minimumBondLevel: 1,
    cooldownDays: 3650,
    contextualOnly: true,
    format: 'narrative',
    purpose: 'journey',
    returnTarget: 'character_home',
    repeatPolicy: 'once_ever',
    topicKey: id,
    tags: ['story', 'mossprout', 'campaign-v3'],
    entryNodeId: 'scene',
    nodes,
  };
}

function choiceOptions(choices: readonly Choice[], nextNodeId: string): ConversationOption[] {
  return choices.map(([id, label, reply]) => ({ id, label, reply, nextNodeId }));
}

function opening(number: number, story: OpeningStory): ConversationDefinition {
  const definition = episode(number);
  return base(definition.openingConversationId, definition.title, [
    { id: 'scene', kind: 'choice', phase: 'deepen', prompt: story.opening, options: choiceOptions(story.openingChoices, 'bridge') },
    { id: 'bridge', kind: 'end', message: story.bridge },
  ]);
}

const DAY_ONE_OPENING: OpeningStory = {
  opening: 'I found one brave patch of soil beside the door. It is small, quiet and currently home to one very suspicious pebble. What should our first garden make room for?',
  openingChoices: [
    ['first-quiet', 'A quiet corner', 'Yes. Somewhere we can hear small things beginning.'],
    ['first-wild', 'Something surprising', 'Good. Sensible paths are useful, but they should never become too confident.'],
    ['first-care', 'A place to care for', 'Then we begin with one living thing and give it a reason to stay.'],
  ],
  bridge: 'Let’s grow one small Plant for the doorway. I’ll meet you in the Garden—bring two Seeds and your best encouraging voice.',
};

function resolution(number: number, story: DayStory): ConversationDefinition {
  const definition = episode(number);
  const results: ConversationInsightResultDefinition[] = story.insight.results.map(([id, title, reflection, matchOptionIds]) => ({
    id,
    title,
    reflection,
    summary: reflection,
    emblemId: `mossprout-journey-${number}`,
    matchOptionIds,
  }));
  return base(definition.resolutionConversationId!, `${definition.title}: return`, [
    { id: 'scene', kind: 'choice', phase: 'resolve', prompt: story.returnPrompt, options: choiceOptions(story.returnChoices, 'insight') },
    {
      id: 'insight', kind: 'insight_reveal', title: story.insight.title,
      insightKey: story.insight.key, category: story.insight.category,
      persistence: 'offer_save', allowSecondary: false, results, nextNodeId: 'end',
    },
    { id: 'end', kind: 'end', message: story.insight.end },
  ]);
}

const STORIES: Readonly<Record<number, DayStory>> = {
  2: {
    opening: 'I heard it at dawn: knock, knock, from underneath the dry pond. I was deciding whether ponds have manners when {{guest}} arrived. How should we answer?',
    openingChoices: [
      ['approach-knock', 'Knock back', 'I tap twice. Something answers once, then twice, as if it is learning our rhythm.'],
      ['approach-mud', 'Inspect the mud', 'I find tiny wet footprints going in—and none coming out. That is either a clue or excellent pond mischief.'],
      ['approach-help', 'Ask if it needs help', 'I ask. One bubble pushes through the dust. I am counting that as a yes.'],
    ],
    bridge: 'I can hear a thin trickle below us. Let’s make a listening place, then give that water a path home. Two small jobs. No heroic pond-diving.',
    returnPrompt: 'You did it. The water followed your path, and {{guest}} has been staring into the first puddle as if expecting an encore. What do you notice?',
    returnChoices: [
      ['pond-listen', 'We listened first', 'Yes. We did not force an answer; we made enough quiet for one to arrive.'],
      ['pond-move', 'A small path changed everything', 'That is my favourite kind of change: small enough to miss, important enough to bring water home.'],
    ],
    insight: { key: 'mossprout-journey-2-mystery', category: 'Curiosity', title: 'What I noticed about you', end: 'The pond is only a puddle, but it has started talking. Tomorrow, we listen for what comes next.', results: [
      ['listen-first', 'You listen before you solve', 'When something is unclear, you make room for the clue before choosing the answer.', ['pond-listen']],
      ['gentle-change', 'You trust small changes', 'You notice how one thoughtful move can change the direction of a whole problem.', ['pond-move']],
    ] },
  },
  3: {
    opening: 'Rain found our little path last night. This morning {{guest}} slid in with it and claimed the driest stone. Should our first rain catcher be practical or playful?',
    openingChoices: [
      ['rain-practical', 'Practical', 'Good. First we help the rain stay. We can be ridiculous after the puddle is secure.'],
      ['rain-playful', 'Playful', 'Agreed. If we are inviting rain, the invitation should look delighted to see it.'],
    ],
    bridge: 'Let’s catch the next drops, then build the first proper puddle. {{guest}} has volunteered to test the splash radius.',
    returnPrompt: 'The catcher tipped, the puddle filled, and {{guest}} got exactly as wet as hoped. What made the difference today?',
    returnChoices: [['change-ready', 'We were ready for change', 'Yes. Rain is brief; readiness gave it somewhere to become more.'], ['change-welcome', 'We welcomed it', 'Yes. Some changes stay because the place looks ready to receive them.']],
    insight: { key: 'mossprout-journey-3-change', category: 'Change', title: 'What the rain showed me', end: 'Our pond can hold its first sky now.', results: [
      ['ready', 'You prepare for change', 'You meet change by making one useful place for it to land.', ['change-ready']],
      ['welcome', 'You welcome change', 'You are more open to change when it feels invited rather than imposed.', ['change-welcome']],
    ] },
  },
  4: {
    opening: 'The new puddle is tugging soil from the bank. {{guest}} found a root beneath it and refuses to let go. What should we protect first?',
    openingChoices: [['care-edge', 'The fragile edge', 'Then we start where the ground is giving way.'], ['care-shelter', 'The lives that may come', 'Then every root should make room for someone smaller than us.']],
    bridge: 'We need a root hold, then a sheltered edge. I will carry the mud. {{guest}} has made that responsibility very clear.',
    returnPrompt: 'The bank held. Under the new leaves, something tiny has already moved in. Which part feels most important?',
    returnChoices: [['care-strength', 'Making it strong', 'Strength matters most when it protects something gentle.'], ['care-room', 'Making room', 'Yes. Care is not only fixing; sometimes it is leaving a safe gap.']],
    insight: { key: 'mossprout-journey-4-care', category: 'Care', title: 'What I noticed in your care', end: 'The pond has an edge strong enough to be kind.', results: [
      ['protect', 'Your care protects', 'You naturally strengthen the parts that help other things feel safe.', ['care-strength']],
      ['make-room', 'Your care makes room', 'You show care by noticing what needs space, shelter or a softer edge.', ['care-room']],
    ] },
  },
  5: {
    opening: 'The pond has water and shelter, but it still feels like a room with no chairs. {{guest}} brought one petal and called that decorating. Who should feel at home here?',
    openingChoices: [['welcome-small-lives', 'Small lives', 'Then we leave shade, gaps and no grand entrance fee.'], ['welcome-visitors', 'Curious visitors', 'Then we need a path in and a reason to pause.'], ['welcome-quiet', 'Anyone needing quiet', 'Then we grow the sort of welcome that does not demand a conversation.']],
    bridge: 'First a flower. Then a living pool. If both work, this stops being our project and becomes a place others can belong.',
    returnPrompt: 'The flower opened and the pool answered with two bright ripples. What tells you a place belongs to everyone?',
    returnChoices: [['belong-arrive', 'You can arrive as you are', 'Yes. A welcome should not require a performance.'], ['belong-leave-mark', 'You can leave a little mark', 'Yes. Belonging grows when a place changes because you were there.']],
    insight: { key: 'mossprout-journey-5-belonging', category: 'Belonging', title: 'What our pond learned from you', end: 'I left a Root Parcel by the board. It belongs to the pond; you’ll know where to place what grows from it.', results: [
      ['open-door', 'You value open welcomes', 'You feel belonging where people can arrive without first proving they fit.', ['belong-arrive']],
      ['shared-place', 'You value shared places', 'You feel belonging when everyone is allowed to shape a place a little.', ['belong-leave-mark']],
    ] },
  },
  6: {
    opening: 'A brass key was hanging from a root this morning. {{guest}} would not touch it, so naturally I did. It opened an ivy gate I had forgotten. Do we enter quickly or carefully?',
    openingChoices: [['forgotten-quick', 'Before it changes its mind', 'Excellent. Caution can catch up with us by the second hedge.'], ['forgotten-careful', 'Read the roots first', 'Good. Forgotten places deserve to be approached, not invaded.']],
    bridge: 'Beyond the gate is a nursery full of blank labels—and one bed still breathing. Let’s open the ivy, then help that bed breathe properly.',
    returnPrompt: 'The bed gave one green shiver. Its old sign says THINGS WE MEANT TO RETURN FOR. What should we do with the sign?',
    returnChoices: [['forgotten-keep', 'Keep it', 'Then returning becomes part of this place, not evidence that we failed it.'], ['forgotten-rewrite', 'Write beneath it', 'Then the old words stay true, but they do not get the final word.']],
    insight: { key: 'mossprout-journey-6-returning', category: 'Returning', title: 'What the nursery showed me', end: 'There is another Root Parcel waiting. The nursery has chosen its first locked bed.', results: [
      ['honour', 'You honour unfinished things', 'You can return to something unfinished without treating the gap as a failure.', ['forgotten-keep']],
      ['renew', 'You renew old intentions', 'You like giving an old intention a new shape instead of abandoning it.', ['forgotten-rewrite']],
    ] },
  },
  7: {
    opening: 'A root lifted a keepsake from the soil. It is not ours, but it feels familiar—the way old intentions sometimes do. What should we do with it?',
    openingChoices: [['memory-keep', 'Keep it safe', 'A garden can hold something until we are ready.'], ['memory-plant', 'Plant it into something new', 'Not erased. Changed into a shape that can keep growing.'], ['memory-release', 'Let it go gently', 'Leaving can be an act of care too.']],
    bridge: 'Let’s find the keepsake a shape, then give it roots. {{guest}} has selected a bed and become unreasonably official about guarding it.',
    returnPrompt: 'A new shoot carries the keepsake’s old shape in its veins. What feels true about remembering?',
    returnChoices: [['memory-hold', 'Some things need holding', 'Yes. We do not have to solve every memory to carry it kindly.'], ['memory-change', 'Memory can keep changing', 'Yes. Remembering is alive; it changes as we do.']],
    insight: { key: 'mossprout-journey-7-memory', category: 'Memory', title: 'What I noticed about memory', end: 'The nursery remembers without standing still.', results: [
      ['keeper', 'You hold memories gently', 'You make room for memories without demanding that they explain themselves.', ['memory-hold']],
      ['grower', 'You let memories grow', 'You allow old experiences to change meaning as your life changes.', ['memory-change']],
    ] },
  },
  8: {
    opening: 'Every nursery label turned toward the path overnight. One carries our first promise: {{promise}}. Should we read the names aloud or leave room for a name we do not know yet?',
    openingChoices: [['names-read', 'Read them aloud', 'I will read. {{guest}} can handle the dramatic pauses.'], ['names-blank', 'Leave one label blank', 'For something we have not met yet. I like that.']],
    bridge: 'One bed is trying to remember its plant. Let’s wake the name first, then water the memory beneath it.',
    returnPrompt: 'The remembered plant unfolded in a shape none of us expected. What helped it return?',
    returnChoices: [['remember-name', 'Being named', 'A name can be a small path back.'], ['remember-space', 'Having room to be different', 'Yes. It returned because we did not demand an exact copy.']],
    insight: { key: 'mossprout-journey-8-remembering', category: 'Memory', title: 'What your remembering makes possible', end: 'The garden is no longer only growing. It is remembering.', results: [
      ['name', 'You remember through details', 'A name or small detail helps you reconnect with what matters.', ['remember-name']],
      ['space', 'You remember with flexibility', 'You let the past return in a new form instead of asking it to be exact.', ['remember-space']],
    ] },
  },
  9: {
    opening: 'The nursery path disappears at dusk. I have walked into the same watering can three times. Who should our new lights guide?',
    openingChoices: [['lantern-home', 'Us, back home', 'A light that says: you know the way from here.'], ['lantern-visitors', 'New visitors', 'Then the path should feel like an invitation, not a test.'], ['lantern-lost-things', 'Anything that feels lost', 'Yes. Especially that.']],
    bridge: 'We will make one low light, then a Memory Bloom. {{guest}} has volunteered to test them by standing directly in front of each one.',
    returnPrompt: 'The lanterns brighten just before we reach them. What makes guidance feel kind?',
    returnChoices: [['guide-enough', 'It shows only the next step', 'Yes. A path does not need to reveal itself all at once.'], ['guide-welcome', 'It feels like an invitation', 'Yes. Good guidance leaves the door open behind it.']],
    insight: { key: 'mossprout-journey-9-guidance', category: 'Guidance', title: 'How you find your way', end: 'The lanterns revealed another Root Parcel. One dark cell on the board is waiting for its light.', results: [
      ['next-step', 'You look for the next light', 'You move more easily when you can see one clear next step.', ['guide-enough']],
      ['invitation', 'You follow welcoming paths', 'You respond best to guidance that invites rather than pushes.', ['guide-welcome']],
    ] },
  },
  10: {
    opening: 'A storm arrived without rain. The pond turned silver and showed the old garden: taller, tidier and entirely empty of us. Do we look longer or break the reflection?',
    openingChoices: [['past-look', 'Look a little longer', 'Beautiful is not the same as ours. I needed to see that clearly.'], ['past-break', 'Touch the water', 'The old garden breaks into rings. Ours stays exactly where it is.']],
    bridge: 'Let’s calm one honest reflection, then make a Rain Mirror that shows what is here—not what the garden thinks it should have been.',
    returnPrompt: 'The mirror holds our pond, our muddy paths and {{guest}} waving too early. What should we keep from the old reflection?',
    returnChoices: [['past-lesson', 'The lesson, not the shape', 'Yes. We can learn from an old garden without rebuilding its emptiness.'], ['past-nothing', 'Nothing we do not need', 'Yes. The past can be seen without being obeyed.']],
    insight: { key: 'mossprout-journey-10-past', category: 'Perspective', title: 'How you meet the past', end: 'The garden chooses the present.', results: [
      ['learn', 'You take the lesson forward', 'You can learn from the past without copying its old shape.', ['past-lesson']],
      ['release', 'You release what no longer fits', 'You can acknowledge the past without letting it direct the present.', ['past-nothing']],
    ] },
  },
  11: {
    opening: 'A fallen trunk blocks the path. Inside it, rings glow with every return we made. {{guest}} has already climbed halfway across. Should we count the rings?',
    openingChoices: [['rings-count', 'Count them', 'There are more than days. Attention must leave extra rings.'], ['rings-leave', 'Leave some uncounted', 'Good. Not everything meaningful needs a total.']],
    bridge: 'Let’s wake the living rings, then lace the trunk into a root bridge. What blocked us may be exactly what holds the path together.',
    returnPrompt: 'The bridge held all three of us. When do you notice your own progress?',
    returnChoices: [['progress-look-back', 'When I look back', 'The distance is easier to see from the other side of a bridge.'], ['progress-use', 'When old problems become useful', 'Yes. Progress sometimes looks like using what once stopped us.']],
    insight: { key: 'mossprout-journey-11-progress', category: 'Growth', title: 'How you recognise progress', end: 'The way forward is made from things that once seemed in the way.', results: [
      ['distance', 'You see progress in distance travelled', 'Looking back helps you recognise change that was invisible day by day.', ['progress-look-back']],
      ['transform', 'You see progress in transformation', 'You notice growth when an old obstacle becomes something useful.', ['progress-use']],
    ] },
  },
  12: {
    opening: 'At the Heartwood clearing, every leaf asks the same question: what is this garden for?',
    openingChoices: [['sanctuary-shelter', 'A place that shelters', 'Then it should hold people gently without closing the world out.'], ['sanctuary-welcome', 'A place that welcomes', 'Then it needs a door in every direction.'], ['sanctuary-remember', 'A place that remembers', 'Not a museum. A memory that keeps making leaves.']],
    bridge: 'Let’s make the first shelter, then give memory a safe place inside it. {{guest}} is checking the threshold for unnecessary rules.',
    returnPrompt: 'The noise softens at the doorway, but the path stays open. What makes a place feel safe to you?',
    returnChoices: [['safe-soft', 'It lets me soften', 'Yes. Safety gives the body permission to stop bracing.'], ['safe-open', 'I can leave and return', 'Yes. A safe place does not trap you to prove it cares.']],
    insight: { key: 'mossprout-journey-12-safety', category: 'Safety', title: 'What safety means to you', end: 'The garden can hold more than itself now.', results: [
      ['soften', 'Safety lets you soften', 'You recognise safety in places where you do not have to stay guarded.', ['safe-soft']],
      ['freedom', 'Safety leaves you free', 'You feel safest where welcome and freedom can exist together.', ['safe-open']],
    ] },
  },
  13: {
    opening: 'The Heartwood is ready, but I am not moving. If we finish it, the journey changes. Every friend we met is waiting at the edge of the clearing. What do you tell me?',
    openingChoices: [['finish-return', 'Finishing means we can return', 'We are good at returning. The garden has taught us that much.'], ['finish-grow', 'Gardens never really finish', 'True. They only become ready for a different question.']],
    bridge: 'Then we carry the living pieces together and grow the Heartwood Sanctuary. Nobody is allowed to make me do the ceremonial speech alone.',
    returnPrompt: 'Pond water runs beneath the Heartwood. Nursery lanterns glow in its bark. Every path leads home. What does finishing feel like?',
    returnChoices: [['finish-home', 'Seeing everything together', 'Yes. The pieces were always becoming a home; we can finally see the whole shape.'], ['finish-next', 'Making room for what comes next', 'A new bud appeared while you said that. The garden agrees.']],
    insight: { key: 'mossprout-journey-13-finishing', category: 'Growth', title: 'What finishing means to you', end: 'One final Root Parcel is waiting on the board. The Heartwood cell is ready—and after that, the garden is alive, unfinished and ours.', results: [
      ['whole', 'Finishing helps you see the whole', 'Completion matters because it lets you recognise what all the small steps became.', ['finish-home']],
      ['beginning', 'Finishing opens the next beginning', 'Completion feels meaningful when it creates room for the next living thing.', ['finish-next']],
    ] },
  },
};

const campaignScenes: readonly ConversationDefinition[] = Object.entries(STORIES).flatMap(([number, story]) => {
  const day = Number(number);
  return [opening(day, story), resolution(day, story)];
});

function optionalScene(id: string, title: string, prompt: string): ConversationDefinition {
  return base(id, title, [
    { id: 'scene', kind: 'choice', phase: 'deepen', prompt, options: choiceOptions([
      ['wild', 'Follow the wild idea', 'I am writing that down before good sense catches up.'],
      ['careful', 'Test it carefully', '{{guest}} has already begun the least careful version.'],
      ['snack', 'Bring snacks first', 'Finally: a complete plan.'],
    ], 'end') },
    { id: 'end', kind: 'end', message: 'Our experiment is officially inconclusive and unofficially excellent.' },
  ]);
}

export const mossproutCampaignConversationDefinitions: readonly ConversationDefinition[] = [
  opening(1, DAY_ONE_OPENING),
  ...campaignScenes,
  optionalScene(`${episode(2).openingConversationId.replace(':opening', '')}:playful`, 'Pond detective club', 'What is the correct way to investigate a knocking pond?'),
  optionalScene(`${episode(8).openingConversationId.replace(':opening', '')}:playful`, 'Nursery label emergency', 'A label has escaped. How should we persuade it to return?'),
  optionalScene(`${episode(12).openingConversationId.replace(':opening', '')}:playful`, 'Sanctuary opening committee', 'What does every excellent sanctuary need?'),
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
  home: ['mossprout:window-view', 'mossprout:care-for-plant'],
  route: ['mossprout:step-outside', 'mossprout:same-place', 'mossprout:season-change'],
  green: ['mossprout:visit-green', 'mossprout:sit-outside', 'mossprout:notice-living-thing'],
};

function goalSuggestions(turns: readonly ConversationTurn[], fallback: readonly string[]): string[] {
  const answered = new Set(turns.map((turn) => turn.optionId));
  const ranked = [...turns].reverse().flatMap((turn) => goalIdsByAnswer[turn.optionId] ?? []);
  if (answered.has('time-minute') || answered.has('minute')) ranked.push('mossprout:window-view', 'mossprout:notice-living-thing');
  return [...new Set([...ranked, ...fallback])].slice(0, 3);
}

/** Resolve story callbacks, featured guests and answer-shaped suggestions at serve time. */
export function resolveMossproutCampaignConversation(
  definition: ConversationDefinition,
  story: KatchimeraStoryProgress | undefined,
  turns: readonly ConversationTurn[] = [],
): ConversationDefinition {
  if (definition.familyId !== 'mossprout') return definition;
  const campaignEpisode = mossproutCampaignEpisodeByOpeningId.get(definition.id)
    ?? mossproutCampaignEpisodeByResolutionId.get(definition.id);
  const matchedSkinId = story?.coStarSkinId ?? null;
  const guestSkinId = campaignEpisode?.guestSkinId === 'matched' ? matchedSkinId : campaignEpisode?.guestSkinId ?? matchedSkinId;
  const guest = guestSkinId ? katchimeraSkinById.get(guestSkinId)?.displayName ?? 'a passing beetle' : 'a passing beetle';
  const promise = promiseCopy[story?.storyFacts?.garden_promise ?? ''] ?? 'space for whatever needs it';
  const completed = story?.completedBeatIds ?? [];
  const place = completed.some((beatId) => beatId.startsWith('heartwood:')) ? 'the Heartwood'
    : completed.some((beatId) => beatId.startsWith('memory-nursery:')) ? 'the nursery'
      : completed.some((beatId) => beatId.startsWith('returning-pond:') || beatId.endsWith('pond-knock')) ? 'the rain garden' : 'the garden';
  const replace = (value: unknown): unknown => {
    if (typeof value === 'string') return value.replaceAll('{{guest}}', guest).replaceAll('{{coStar}}', guest).replaceAll('{{promise}}', promise).replaceAll('{{place}}', place);
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
