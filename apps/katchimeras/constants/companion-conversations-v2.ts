import { STEPPLING_TRAIL_CONVERSATIONS } from '@/constants/steppling-activities';
import type {
  ConversationDefinition,
  ConversationOption,
  ConversationProfileQuestion,
  ConversationV2FamilyId,
} from '@/types/companion-conversation';
import type { KatchimeraSkinId } from '@/types/katchimera';
import { companionInsightConversationDefinitions } from '@/constants/companion-insight-conversations';
import { feastleFirstMeetingConversationDefinition, feastleFriendshipConversationDefinitions } from '@/constants/feastle-friendship-conversations';
import { baristabbitStoryConversationDefinitions } from '@/constants/baristabbit-story-conversations';
import { journeyCohortStoryConversationDefinitions } from '@/constants/journey-cohort-story-conversations';
import { mossproutFtueConversationDefinitions } from '@/constants/mossprout-ftue-conversations';
import { mossproutStoryConversationDefinitions } from '@/constants/mossprout-story-conversations';
import { stepplingDayOneConversation } from '@/constants/steppling-day-one-conversation';
import { mossproutCampaignConversationDefinitions } from '@/constants/mossprout-campaign-conversations';
import {
  authoredConversationTopics,
  authoredFamilyConversationDefinitions,
} from '@/constants/companion-conversation-authored-families';

type JournalSeed = {
  id: string;
  prompt: string;
  options: readonly (readonly [string, string, string])[];
};

/** Retained as an editorial prompt archive; these short beats are no longer production flows. */
export type LegacyStorySeed = JournalSeed & {
  followUp: string;
  followOptions: readonly (readonly [string, string, string])[];
};

type PollSeed = { id: string; prompt: string; labels: readonly [string, string, string] };

const endNode = (message: string) => ({ id: 'end', kind: 'end' as const, message });
const options = (
  values: readonly (readonly [string, string, string])[],
  nextNodeId: string | null
): ConversationOption[] => values.map(([id, label, reply]) => ({ id, label, reply, nextNodeId }));

function poll(
  familyId: ConversationV2FamilyId,
  seed: PollSeed,
  index: number
): ConversationDefinition {
  const pollOptions = seed.labels.map((label, optionIndex) => ({
    id: `choice-${optionIndex + 1}`,
    label,
    reply: optionIndex === 0
      ? `I thought ${label.toLowerCase()} might win you over.`
      : optionIndex === 1
        ? `A good choice. ${label} has a loyal little corner of the village.`
        : `You picked ${label.toLowerCase()}. I like the less obvious answer.`,
    nextNodeId: 'end',
    villageWeight: [42, 34, 24][(optionIndex + index) % 3]!,
  }));
  return {
    id: `${familyId}:poll:${seed.id}`,
    version: 2,
    familyId,
    title: seed.prompt,
    trigger: 'poll',
    minimumBondLevel: 1,
    cooldownDays: 14,
    tags: ['play', 'preferences'],
    format: 'poll',
    entryNodeId: 'poll',
    nodes: [
      { id: 'poll', kind: 'poll', prompt: seed.prompt, helperText: 'Pick quickly. The village result is just for fun.', options: pollOptions, nextNodeId: 'end' },
      endNode('That one belongs in the village ledger now.'),
    ],
  };
}

function profileGame(input: {
  familyId: ConversationV2FamilyId;
  title: string;
  memoryKey: string;
  entryQuestionId: string;
  questions: readonly ConversationProfileQuestion[];
  descriptions: Partial<Record<KatchimeraSkinId, string>>;
}): ConversationDefinition {
  return {
    id: `${input.familyId}:game:form-finder`,
    version: 4,
    familyId: input.familyId,
    title: input.title,
    trigger: 'signature_game',
    minimumBondLevel: 1,
    cooldownDays: 90,
    tags: ['play', 'forms'],
    format: 'profile_game',
    entryNodeId: 'game',
    nodes: [
      { id: 'game', kind: 'profile_game', title: input.title, entryQuestionId: input.entryQuestionId, questions: input.questions, revealNodeId: 'reveal' },
      { id: 'reveal', kind: 'form_reveal', title: 'Your closest form right now', descriptions: input.descriptions, memoryKey: input.memoryKey, nextNodeId: 'remember' },
      { id: 'remember', kind: 'memory_proposal', prompt: 'Would you like me to add this closest-form result to Your insights?', summary: `My current ${input.familyId} form match is {topForm}.`, memoryKey: input.memoryKey, sensitivity: 'ordinary', nextNodeId: 'end' },
      endNode('A match can change. We can always play again in another season.'),
    ],
  };
}

const pilotConversationTopics = {
  baristabbit: [
    { id: 'ritual', label: 'Rituals' }, { id: 'comfort', label: 'Comfort' },
    { id: 'preferences', label: 'Drinks & favourites' }, { id: 'novelty', label: 'Try something new' },
    { id: 'social', label: 'People & cafes' }, { id: 'play', label: 'Quick game' },
    { id: 'goals', label: 'Goals & small steps' }, { id: 'memory', label: 'Shared memories' },
  ],
  steppling: [
    { id: 'route', label: 'Routes' }, { id: 'pace', label: 'Pace' },
    { id: 'exploration', label: 'Exploration' }, { id: 'headspace', label: 'Headspace' },
    { id: 'challenge', label: 'Challenges' }, { id: 'play', label: 'Quick game' },
    { id: 'goals', label: 'Goals & small steps' }, { id: 'memory', label: 'Shared memories' },
  ],
  flexel: [
    { id: 'practice', label: 'Practice' }, { id: 'energy', label: 'Energy' },
    { id: 'strength', label: 'Strength' }, { id: 'sport', label: 'Sports' },
    { id: 'recovery', label: 'Recovery' }, { id: 'play', label: 'Quick game' },
    { id: 'goals', label: 'Goals & small steps' }, { id: 'memory', label: 'Shared memories' },
  ],
} as const;

export const companionConversationTopics: Readonly<Record<ConversationV2FamilyId, readonly { id: string; label: string }[]>> = {
  ...authoredConversationTopics,
  ...pilotConversationTopics,
} as Readonly<Record<ConversationV2FamilyId, readonly { id: string; label: string }[]>>;

function openers(familyId: ConversationV2FamilyId): ConversationDefinition[] {
  const topics = companionConversationTopics[familyId];
  const lines = familyId === 'baristabbit'
    ? ['I was just rearranging the imaginary menu. What kind of conversation are we having?', 'You caught me between cups. Where should we wander?', 'Pull up a chair. What sounds good right now?', 'I have a question, a game, and one suspiciously cosy corner. Pick a direction.', 'The counter is open and there is no queue. What are you in the mood for?', 'I have been wondering what makes a pause actually work for you.', 'Today feels like a good day for either honesty or a ridiculous drink debate.', 'Stay for a bit. What should we talk about first?']
    : familyId === 'steppling'
      ? ['I was about to take the long way around. Want to choose the route?', 'Good timing. Where should this conversation wander?', 'We can stroll, explore, or make a tiny plan. Your call.', 'I found three possible paths and none of them require proper shoes.', 'Before we move: what kind of company do you need?', 'I have a route question for you, but you can change the subject.', 'Let us take one conversational lap. Where first?', 'There you are. Familiar path or a small detour?']
      : ['I was testing whether stretching counts when you are mostly thinking about it. What now?', 'Good timing. Want a game, a check-in, or something practical?', 'We can talk strength, play, recovery, or absolutely change the subject.', 'I have energy for one good conversation. Choose the first move.', 'No scoreboard today. What sounds interesting?', 'I was thinking about what makes practice feel alive instead of dutiful.', 'Warm-up question: where should this go?', 'You are here. Shall we play, reflect, or make a tiny plan?'];
  return lines.map((prompt, index) => {
    const conversationTopics = topics.filter((topic) => topic.id !== 'play');
    const a = conversationTopics[(index * 2) % conversationTopics.length]!;
    const b = conversationTopics[(index * 2 + 1) % conversationTopics.length]!;
    const c = topics.find((topic) => topic.id === 'play')!;
    const transitionFor = (topicId: string) => topicId === 'memory'
      ? ({ kind: 'continuation', destination: 'memory' } as const)
      : ({ kind: 'pool', poolId: topicId } as const);
    return {
      id: `${familyId}:opener:${index + 1}`,
      version: 1,
      familyId,
      title: prompt,
      trigger: 'evergreen',
      minimumBondLevel: 1,
      cooldownDays: 0,
      tags: ['opener'],
      isOpener: true,
      format: 'opener',
      weight: 1,
      entryNodeId: 'opening',
      nodes: [
        { id: 'opening', kind: 'choice', phase: 'opening', prompt, options: [
          { id: a.id, label: a.label, reply: `All right. Let us follow the ${a.label.toLowerCase()} thread.`, nextNodeId: 'end', transition: transitionFor(a.id) },
          { id: b.id, label: b.label, reply: `Good choice. I have something about ${b.label.toLowerCase()}.`, nextNodeId: 'end', transition: transitionFor(b.id) },
          { id: 'play', label: c.label, reply: 'Quick answers, no pressure, questionable village statistics.', nextNodeId: 'end', transition: { kind: 'pool', poolId: 'play' } },
        ] },
        endNode('Where should we go next?'),
      ],
    } satisfies ConversationDefinition;
  });
}

const commonFollow: LegacyStorySeed['followOptions'] = [
  ['meaning', 'What it meant in the moment', 'The meaning belongs to the actual moment, not a permanent profile label.'],
  ['context', 'What made it possible', 'The surrounding context explains more than a generic answer would.'],
  ['memory', 'What is worth remembering', 'The useful part is the specific detail you would want to recognise later.'],
];

export const legacyStoryFollowOptions: Readonly<Partial<Record<ConversationV2FamilyId, Readonly<Record<string, LegacyStorySeed['followOptions']>>>>> = {
  baristabbit: {
    'first-sip': [['cue', 'The cue that I have begun', 'Your first sip works like an opening bell: small, familiar, and enough to point your attention forward.'], ['warmth', 'The pause around it', 'The drink matters because it briefly protects a pocket of unhurried time.'], ['flavour', 'The pleasure of the taste', 'For you, enjoyment does not need another justification; the flavour is the meaningful part.']],
    'usual-or-new': [['dependable', 'Knowing it will be right', 'Reliability lets the drink feel restorative instead of becoming another decision.'], ['mood', 'Matching the mood I am in', 'You choose with the present moment in mind rather than following one permanent rule.'], ['curiosity', 'Having a small surprise', 'A little novelty gives an ordinary pause a story and keeps the ritual awake.']],
    temperature: [['comfort', 'How it feels to hold', 'Temperature is part of the physical comfort of the ritual, not only a serving detail.'], ['refresh', 'How it changes my energy', 'You notice temperature through its effect: either softening the moment or sharpening it.'], ['weather', 'Whether it belongs to the day', 'The right drink responds to its setting; weather and season are part of your choice.']],
    'cafe-seat': [['view', 'Something to watch', 'A good seat lets you pause while ordinary life stays interesting around you.'], ['quiet', 'A little privacy', 'You want the room to give you space, even when other people are nearby.'], ['energy', 'Feeling part of the room', 'The atmosphere matters because a little surrounding energy makes the pause feel alive.']],
    'drink-company': [['privacy', 'Time that is completely mine', 'A solitary drink gives you ownership of the pace and asks nothing in return.'], ['depth', 'One proper conversation', 'You prefer a shared cup when it creates room for attention rather than background chatter.'], ['buzz', 'The feeling of gathering', 'The drink becomes meaningful through collective energy and the sense of being included.']],
    strength: [['easy', 'Easy to return to', 'Your favourite intensity is the one that remains welcoming enough to become familiar.'], ['savour', 'Enough character to notice', 'Balance lets you pay attention without letting one note take over the whole cup.'], ['wake', 'A clear, unmistakable hit', 'You enjoy a drink that announces itself and creates a distinct change in the moment.']],
    sweetness: [['clarity', 'Tasting the drink clearly', 'You prefer sweetness to stay out of the way so the base drink keeps its identity.'], ['balance', 'A softer edge', 'A little sweetness works as balance for you, rounding the drink without redefining it.'], ['treat', 'Making the moment celebratory', 'Sweetness signals that this cup is an occasion rather than merely refreshment.']],
    making: [['sequence', 'Following the sequence', 'The repeated method gives your attention somewhere calm and predictable to land.'], ['senses', 'Smell, sound, and steam', 'For you the ritual starts before drinking; the sensory build-up is part of arriving.'], ['finish', 'Completing something tangible', 'Making a drink offers a rare compact task with an immediate, satisfying ending.']],
    afternoon: [['lift', 'A gentle lift', 'You want the drink to restore usable energy without turning the afternoon into a demand.'], ['boundary', 'A clean break between things', 'The cup works best as punctuation, giving one part of the day a real ending.'], ['comfort', 'A small kindness', 'Your afternoon drink is less about performance and more about changing the emotional weather.']],
    cup: [['familiarity', 'Recognising my own ritual', 'A favourite cup makes an ordinary drink feel personal and immediately familiar.'], ['feel', 'How it feels in my hands', 'The physical object matters when its weight, shape, or warmth supports the pause.'], ['place', 'Connecting it to a place', 'Certain cups carry the atmosphere of where you use them and become part of that setting.']],
    season: [['warmth', 'The feeling of shelter', 'Seasonal drinks matter when they make warmth and safety physically present.'], ['brightness', 'The feeling of freshness', 'Your seasonal favourite is a way to meet the weather with energy rather than hide from it.'], ['loyalty', 'The familiar taste returning', 'You enjoy a favourite that stays recognisably yours while the year changes around it.']],
    'last-drop': [['immersion', 'I am fully in the moment', 'Finishing quickly can mean the drink has your full attention rather than being background scenery.'], ['pacing', 'I let the ritual stretch', 'Making the drink last extends the shape of the pause and keeps it beside you.'], ['distraction', 'The day carries me elsewhere', 'An abandoned cup is useful evidence that the ritual often competes with whatever comes next.']],
  },
  steppling: {
    doorstep: [['headspace', 'My head feels roomier', 'The route earns its place by creating mental space that was not available indoors.'], ['body', 'My body wakes up', 'The worthwhile change is physical: movement creates the energy that was missing before it.'], ['world', 'I notice where I am', 'Walking reconnects you to nearby life and turns the day from background into a place.']],
    pace: [['notice', 'I can notice things', 'Your honest pace protects attention and lets the route contain more than distance.'], ['rhythm', 'I settle into a rhythm', 'A steady repeatable cadence is what makes movement feel natural rather than negotiated.'], ['effort', 'I can feel the effort', 'You enjoy a pace with a clear physical edge, as long as it still feels chosen.']],
    route: [['ease', 'I know I can begin it', 'Familiarity lowers the doorway and gives your mind freedom to travel elsewhere.'], ['purpose', 'It still takes me somewhere useful', 'A route feels right when exploration and practical life can coexist.'], ['discovery', 'I might find something new', 'Curiosity is real movement fuel for you; an unfamiliar detail can justify the whole turn.']],
    company: [['freedom', 'I control the pace', 'Solo movement gives you autonomy over speed, silence, and every change of plan.'], ['conversation', 'We can talk properly', 'One companion makes the route a moving conversation without overwhelming it.'], ['momentum', 'Other people carry the energy', 'Group movement works because shared momentum makes beginning and continuing easier.']],
    soundtrack: [['presence', 'I stay inside the place', 'The sounds around you help the walk feel grounded in the actual route.'], ['mood', 'It changes the emotional tone', 'Music turns movement into a private scene and can lend the pace its feeling.'], ['company', 'Another voice keeps me company', 'Conversation or spoken audio gives the route a social texture even when you walk alone.']],
    terrain: [['detail', 'There is always something nearby', 'City ground rewards attention with doors, corners, and small changes close to home.'], ['calm', 'The ground feels softer', 'Green paths appeal because they lower the sensory volume without demanding an expedition.'], ['challenge', 'The route asks for attention', 'Rougher terrain makes movement absorbing by turning each step into part of the experience.']],
    distance: [['accessible', 'I can begin without bargaining', 'A short route is valuable because it survives ordinary energy and crowded days.'], ['flow', 'I have time to settle in', 'The middle distance gives rhythm enough time to become its own satisfying state.'], ['journey', 'It becomes a real expedition', 'Long distance matters when preparation, effort, and arrival combine into a story.']],
    weather: [['light', 'The outside feels inviting', 'Clear weather removes friction and lets the route begin with very little negotiation.'], ['quiet', 'The world becomes quieter', 'Light rain changes familiar places and gives you a more private-feeling route.'], ['crisp', 'The air wakes me up', 'Cold air appeals because the contrast makes both movement and returning home feel vivid.']],
    destination: [['reward', 'There is a small reward ahead', 'A destination helps by giving the first step an immediate and pleasant reason.'], ['arrival', 'I can see where I am heading', 'A landmark gives effort a visible shape and makes arrival part of the satisfaction.'], ['freedom', 'The route can decide itself', 'Without a destination, wandering becomes permission to follow attention instead of efficiency.']],
    headspace: [['order', 'My thoughts fall into order', 'Rhythm gives crowded thoughts enough room to become simpler and more legible.'], ['ideas', 'Unexpected ideas appear', 'A moving mind finds useful side doors that stillness does not always reveal.'], ['quiet', 'The noise finally drops', 'Walking serves as a gentle off-switch when you need less thought rather than better thought.']],
    hill: [['comfort', 'I can stay comfortable', 'You value routes that respect capacity and do not need difficulty to prove their worth.'], ['variation', 'It changes the rhythm', 'A moderate challenge is enjoyable when it adds texture without taking over the route.'], ['test', 'It gives me an edge to meet', 'You like effort when it is visible, voluntary, and followed by a clear sense of having climbed.']],
    return: [['recovery', 'My body gets to register the effort', 'Stopping matters because it lets the physical experience resolve rather than simply disappear.'], ['contrast', 'Home feels newly familiar', 'The route changes your relationship to home by letting you leave it and return with fresh attention.'], ['evidence', 'I can see where I went', 'A map, distance, or remembered detail makes the journey concrete and easier to value.']],
  },
  flexel: {
    'showing-up': [['autonomy', 'I can choose how it unfolds', 'A session feels like yours when the plan leaves room for judgment rather than issuing orders.'], ['rhythm', 'I find a repeatable beginning', 'A familiar cue reduces negotiation and lets energy arrive after you start.'], ['low-barrier', 'The first step stays genuinely small', 'Permission to do very little protects the relationship with movement on difficult days.']],
    strength: [['usefulness', 'It helps outside the session', 'Progress feels real when capability appears in ordinary life rather than only on a chart.'], ['mastery', 'The movement becomes cleaner', 'Technique gives you precise evidence that attention and practice are changing something.'], ['return', 'I keep coming back', 'For you, consistency is not a consolation prize; it is the condition that makes other progress possible.']],
    mobility: [['daily', 'Everyday movement feels easier', 'Mobility matters when it removes small arguments from ordinary actions.'], ['ease', 'My body has more options', 'Range is meaningful as usable room rather than a number to chase.'], ['recovery', 'I leave more settled', 'Restorative movement works by changing tension and helping the system downshift.']],
    'gym-space': [['equipment', 'The right tools are ready', 'A well-equipped space helps when structure and possibility make the session feel purposeful.'], ['friction', 'Beginning takes almost nothing', 'Home works because removing travel and performance makes returning more realistic.'], ['air', 'The environment gives energy back', 'Outside movement appeals because weather, space, and light become part of the session.']],
    team: [['freedom', 'I can follow my own rhythm', 'Solo movement protects concentration and lets every adjustment stay private.'], ['support', 'One person helps me return', 'A partner adds encouragement and shared momentum without making the session feel crowded.'], ['belonging', 'The group creates the experience', 'Team movement matters because coordination and belonging become part of what you practise.']],
    intensity: [['restore', 'I leave with more than I arrived with', 'Gentle effort is successful when it restores capacity instead of consuming the last of it.'], ['flow', 'The work feels sustainable', 'Steady intensity suits you when effort and breathing can coexist for long enough to settle in.'], ['test', 'I meet a clear edge', 'Hard work appeals when the challenge is chosen, legible, and followed by a real ending.']],
    sport: [['mastery', 'I can keep learning the skill', 'Technical discovery makes the game worth returning to even when the result changes.'], ['uncertainty', 'Every round is alive', 'Play works because decisions and surprises prevent movement from becoming a script.'], ['people', 'We build something together', 'The social exchange gives sport meaning beyond score, fitness, or individual improvement.']],
    cardio: [['rhythm', 'I can settle into it', 'A dependable rhythm lets effort become absorbing rather than constantly demanding attention.'], ['clarity', 'Each effort has an ending', 'Intervals appeal because intensity arrives in clear, manageable pieces.'], ['play', 'I forget I am doing cardio', 'Games keep effort alive by giving attention something more interesting than duration.']],
    recovery: [['stop', 'The work is allowed to end', 'Proper rest matters because your body needs an unmistakable signal that effort is over.'], ['restore', 'Movement helps me loosen', 'Gentle activity works as a bridge, keeping recovery active without turning it into training.'], ['foundation', 'Basic needs are actually met', 'Food, water, and sleep are meaningful because they quietly determine what future effort can be.']],
    tracking: [['detail', 'I can see precise changes', 'Numbers motivate you when they make progress concrete and comparable over time.'], ['trend', 'I can see the direction without obsessing', 'A few markers work best when they inform the story without becoming the story.'], ['feel', 'I stay connected to my body', 'Internal feedback matters because success includes how movement fits today, not only what was recorded.']],
    practice: [['mastery', 'One detail becomes cleaner', 'Focused repetition holds your attention when small technical changes remain visible.'], ['curiosity', 'The session keeps changing', 'Variety helps because curiosity is one of the forces that brings you back.'], ['play', 'The skill answers in real time', 'Learning through play suits you because feedback arrives inside decisions rather than after a drill.']],
    after: [['energy', 'I have more usable momentum', 'A good session changes the charge of the day and gives something back.'], ['proof', 'I know I showed up for myself', 'Pride comes from keeping the appointment, even when the session itself is modest.'], ['calm', 'I feel more at home in my body', 'The best finish is a quieter internal state, not necessarily exhaustion or excitement.']],
  },
};

export const legacyBaristabbitStorySeeds: readonly LegacyStorySeed[] = [
  { id: 'first-sip', prompt: 'What does the first good sip do for you?', options: [['start', 'Starts the day', 'A tiny opening bell for the day.'], ['pause', 'Makes me actually pause', 'Then the drink is really permission to stop.'], ['taste', 'It just tastes good', 'A completely valid bit of pleasure.']], followUp: 'Which part deserves a little more attention next time?', followOptions: commonFollow },
  { id: 'usual-or-new', prompt: 'Today: the trusted usual or something unknown?', options: [['usual', 'My reliable usual', 'Reliability can be a kind of luxury.'], ['nearby', 'A small variation', 'Close enough to feel safe, different enough to notice.'], ['new', 'Surprise me', 'A brave order at the imaginary counter.']], followUp: 'What makes that choice feel right today?', followOptions: commonFollow },
  { id: 'temperature', prompt: 'Which temperature has your loyalty?', options: [['hot', 'Warm enough to hold', 'Warm hands are part of the ritual.'], ['cold', 'Cold and refreshing', 'A sharper kind of reset.'], ['seasonal', 'Whatever fits the weather', 'You let the day choose the cup.']], followUp: 'What is the drink really changing?', followOptions: commonFollow },
  { id: 'cafe-seat', prompt: 'Choose your imaginary cafe seat.', options: [['window', 'Window seat', 'A drink with a little people-watching.'], ['corner', 'Quiet corner', 'A small room inside the room.'], ['counter', 'At the counter', 'Close to the clatter and the making.']], followUp: 'What would make you stay for one extra minute?', followOptions: commonFollow },
  { id: 'drink-company', prompt: 'Is the best drink moment solitary or shared?', options: [['solo', 'A quiet one alone', 'A pause that belongs entirely to you.'], ['one-person', 'With one person', 'One cup and one proper conversation.'], ['group', 'At a busy table', 'The drink becomes part of the gathering.']], followUp: 'What matters most in that version?', followOptions: commonFollow },
  { id: 'strength', prompt: 'How bold should a drink be?', options: [['gentle', 'Soft and gentle', 'Nothing needs to shout.'], ['balanced', 'Balanced', 'Enough character, no unnecessary drama.'], ['bold', 'Strong and unmistakable', 'You want the cup to announce itself.']], followUp: 'Would you repeat that choice tomorrow?', followOptions: commonFollow },
  { id: 'sweetness', prompt: 'Where does sweetness belong?', options: [['none', 'Keep it clean', 'Let the base drink speak for itself.'], ['little', 'Just a little', 'A small soft edge.'], ['treat', 'Make it a treat', 'Then it should feel properly celebratory.']], followUp: 'What would make it feel intentional?', followOptions: commonFollow },
  { id: 'making', prompt: 'What is satisfying about making a drink?', options: [['method', 'The little method', 'A repeatable sequence can settle the mind.'], ['smell', 'The smell and steam', 'The ritual starts before the first sip.'], ['finished', 'Holding the finished cup', 'A small task with a warm, immediate ending.']], followUp: 'Which part could become your cue to pause?', followOptions: commonFollow },
  { id: 'afternoon', prompt: 'What should an afternoon drink rescue?', options: [['energy', 'My energy', 'A lift, but hopefully not a demand.'], ['attention', 'My attention', 'A clean break between two pieces of the day.'], ['mood', 'My mood', 'A small kindness in cup form.']], followUp: 'What would the gentlest version look like?', followOptions: commonFollow },
  { id: 'cup', prompt: 'Does the cup matter?', options: [['favorite', 'Yes, I have a favourite', 'The vessel is clearly part of the spell.'], ['whatever', 'Anything clean will do', 'Practical and impossible to disappoint.'], ['place', 'Only when I am out', 'Some cups belong to a particular place.']], followUp: 'What detail would make the ritual feel more yours?', followOptions: commonFollow },
  { id: 'season', prompt: 'Which drink season feels most like you?', options: [['winter', 'Steam in winter', 'A portable hearth.'], ['summer', 'Ice in summer', 'A cold bright punctuation mark.'], ['all-year', 'My favourite all year', 'Loyalty stronger than weather.']], followUp: 'What memory does that season carry?', followOptions: commonFollow },
  { id: 'last-drop', prompt: 'Do you finish a drink quickly or forget it exists?', options: [['quick', 'Gone immediately', 'No abandoned cups in your kingdom.'], ['slow', 'I make it last', 'The ritual stretches around the day.'], ['forgotten', 'I find it later', 'A small archaeological discovery.']], followUp: 'Would you want that habit to stay the same?', followOptions: commonFollow },
];

export const legacyStepplingStorySeeds: readonly LegacyStorySeed[] = [
  { id: 'doorstep', prompt: 'What gets you through the door for a walk?', options: [['purpose', 'Having somewhere to go', 'A destination gives the first step a reason.'], ['air', 'Wanting air or space', 'Sometimes the outside is the whole point.'], ['company', 'Someone coming with me', 'Company can carry the beginning.']], followUp: 'What usually makes the walk worth it?', followOptions: commonFollow },
  { id: 'pace', prompt: 'Choose today’s honest pace.', options: [['slow', 'Slow enough to notice', 'No need to outrun the scenery.'], ['steady', 'Steady and comfortable', 'A pace you could trust for a while.'], ['fast', 'Fast enough to feel it', 'A little spark in the legs.']], followUp: 'What would help that pace feel natural?', followOptions: commonFollow },
  { id: 'route', prompt: 'Familiar route or unfamiliar turn?', options: [['familiar', 'The route I know', 'Familiarity frees the mind to wander.'], ['variation', 'One different street', 'A tiny detour is still exploration.'], ['unknown', 'Somewhere new', 'Let the map become a suggestion.']], followUp: 'What would you hope to find?', followOptions: commonFollow },
  { id: 'company', prompt: 'Who belongs on the ideal route?', options: [['solo', 'Just me', 'Your own pace, your own thoughts.'], ['one', 'One good companion', 'Enough company without becoming a procession.'], ['group', 'A whole group', 'Movement with a shared story.']], followUp: 'What does that company change?', followOptions: commonFollow },
  { id: 'soundtrack', prompt: 'What should a walk sound like?', options: [['world', 'The world around me', 'Footsteps, weather, and whatever is nearby.'], ['music', 'Music', 'A private moving soundtrack.'], ['talk', 'Conversation or a podcast', 'A route with another voice inside it.']], followUp: 'When would silence be better?', followOptions: commonFollow },
  { id: 'terrain', prompt: 'Pick the ground beneath you.', options: [['pavement', 'City pavement', 'Doors, corners, and lives passing by.'], ['park', 'Soft park paths', 'A little green without needing an expedition.'], ['trail', 'A rough trail', 'The ground itself becomes part of the challenge.']], followUp: 'What makes that terrain appealing?', followOptions: commonFollow },
  { id: 'distance', prompt: 'What distance feels satisfying today?', options: [['short', 'A loop around the block', 'Small enough to begin without negotiation.'], ['medium', 'Long enough to settle in', 'The point where walking becomes its own part of the day.'], ['long', 'A proper journey', 'Shoes, snacks, and a story to bring home.']], followUp: 'How would you know it was enough?', followOptions: commonFollow },
  { id: 'weather', prompt: 'Which weather can still tempt you outside?', options: [['sun', 'Clear and bright', 'The easy invitation.'], ['rain', 'Light rain', 'A quieter world and a good coat.'], ['cold', 'Cold, crisp air', 'The kind that makes returning home better.']], followUp: 'What would make the weather feel manageable?', followOptions: commonFollow },
  { id: 'destination', prompt: 'Give the route a destination.', options: [['coffee', 'A drink at the end', 'A very respectable beacon.'], ['view', 'A view or landmark', 'Something that makes arrival visible.'], ['none', 'No destination', 'Then wandering is the destination.']], followUp: 'Would the return route be the same?', followOptions: commonFollow },
  { id: 'headspace', prompt: 'What happens to your thoughts while moving?', options: [['clear', 'They become clearer', 'The rhythm makes room around them.'], ['wander', 'They wander somewhere useful', 'A moving mind can find side doors.'], ['quiet', 'They finally quiet down', 'Then the route is doing gentle work.']], followUp: 'Is that something you want more often?', followOptions: commonFollow },
  { id: 'hill', prompt: 'How do you feel about a hill?', options: [['avoid', 'I choose the flatter way', 'Comfort is a legitimate route feature.'], ['fine', 'Fine if it appears', 'You will negotiate with the hill when necessary.'], ['seek', 'Point me uphill', 'You like a route with a visible challenge.']], followUp: 'What kind of challenge feels enjoyable?', followOptions: commonFollow },
  { id: 'return', prompt: 'What is the best part of coming back?', options: [['rest', 'Stopping and resting', 'The body gets to notice what it did.'], ['home', 'Home feeling different', 'A familiar room after outside time.'], ['record', 'Seeing the route or distance', 'A trace that proves the journey happened.']], followUp: 'What would you want to remember from it?', followOptions: commonFollow },
];

export const legacyFlexelStorySeeds: readonly LegacyStorySeed[] = [
  { id: 'showing-up', prompt: 'What helps you begin moving?', options: [['plan', 'A plan already made', 'Less bargaining at the starting line.'], ['music', 'The right music', 'A soundtrack can lend the first bit of energy.'], ['small', 'Promising to do very little', 'A tiny doorway is still a doorway.']], followUp: 'What keeps the session feeling like yours?', followOptions: commonFollow },
  { id: 'strength', prompt: 'Which kind of progress feels most satisfying?', options: [['stronger', 'Feeling stronger', 'A quiet change that shows up in ordinary life.'], ['skill', 'Moving with more skill', 'Technique makes effort feel intelligent.'], ['consistent', 'Simply returning', 'Consistency without punishment is real progress.']], followUp: 'What would make that progress visible?', followOptions: commonFollow },
  { id: 'mobility', prompt: 'What should mobility work give back?', options: [['comfort', 'More comfort', 'Less argument in everyday movement.'], ['range', 'More range', 'A little more room in the body.'], ['reset', 'A gentle reset', 'Movement that restores instead of demands.']], followUp: 'Where would you notice the difference first?', followOptions: commonFollow },
  { id: 'gym-space', prompt: 'Choose your ideal training space.', options: [['gym', 'A well-equipped gym', 'Everything has a place and a purpose.'], ['home', 'A small space at home', 'Low friction and no journey required.'], ['outside', 'Somewhere outside', 'Fresh air can be part of the equipment.']], followUp: 'What makes that space easier to return to?', followOptions: commonFollow },
  { id: 'team', prompt: 'How social should movement be?', options: [['solo', 'Mostly solo', 'Your own rhythm and no audience.'], ['partner', 'One training partner', 'Enough company for a little momentum.'], ['team', 'A whole team', 'Shared effort changes the energy completely.']], followUp: 'What does company add or remove?', followOptions: commonFollow },
  { id: 'intensity', prompt: 'Which intensity sounds right today?', options: [['gentle', 'Gentle and restorative', 'Today can be about leaving with more energy.'], ['moderate', 'Steady effort', 'Enough work to feel, enough room to breathe.'], ['hard', 'A proper challenge', 'You want a clear edge to meet.']], followUp: 'How would you know when to stop?', followOptions: commonFollow },
  { id: 'sport', prompt: 'What makes a sport fun?', options: [['skill', 'Learning the skill', 'The satisfying detail inside the game.'], ['play', 'The play itself', 'Movement with imagination and uncertainty.'], ['people', 'The people', 'The score is not the only thing being built.']], followUp: 'What would make you want another round?', followOptions: commonFollow },
  { id: 'cardio', prompt: 'Choose your version of cardio.', options: [['rhythm', 'A steady rhythm', 'Something the body can settle into.'], ['intervals', 'Short energetic bursts', 'Clear efforts with real endings.'], ['game', 'Hide it inside a game', 'Sometimes play is the best coach.']], followUp: 'What would keep it enjoyable?', followOptions: commonFollow },
  { id: 'recovery', prompt: 'What counts as good recovery?', options: [['rest', 'Proper rest', 'The work ends and the body gets the message.'], ['move', 'Gentle movement', 'A softer bridge into the next day.'], ['food', 'Food, water, and sleep', 'The unglamorous things doing excellent work.']], followUp: 'Which part is easiest to miss?', followOptions: commonFollow },
  { id: 'tracking', prompt: 'How much should numbers matter?', options: [['lots', 'I like clear numbers', 'A visible trail of progress can be motivating.'], ['some', 'A few useful markers', 'Enough information without letting it run the room.'], ['feel', 'I would rather go by feel', 'The body can be the dashboard.']], followUp: 'What would be a fair sign of progress?', followOptions: commonFollow },
  { id: 'practice', prompt: 'Which practice sounds most appealing?', options: [['repeat', 'Repeat one useful movement', 'There is satisfaction in a cleaner repetition.'], ['variety', 'Mix several things', 'Variety keeps curiosity alive.'], ['play', 'Learn through playing', 'The lesson hides inside the fun.']], followUp: 'What would make practice feel complete?', followOptions: commonFollow },
  { id: 'after', prompt: 'How do you want to feel afterwards?', options: [['energised', 'Energised', 'The session should give something back.'], ['proud', 'Proud I did it', 'Showing up can be the achievement.'], ['settled', 'Settled in my body', 'A quieter kind of finish.']], followUp: 'What kind of session creates that feeling?', followOptions: commonFollow },
];

function journalSeeds(familyId: ConversationV2FamilyId): readonly { seed: JournalSeed; routes: readonly string[] }[] {
  if (familyId === 'baristabbit') return ([
    ['coffee', 'You recorded a coffee moment. What made that cup worth saving?', ['taste', 'The taste', 'Then the cup earned its place on flavour alone.'], ['pause', 'The pause', 'So the space around the coffee mattered most.'], ['place', 'Where I had it', 'The place became part of the drink.'], 'What would you want from the next one?', ['food.coffee']],
    ['tea', 'That tea made it into your day. What was it doing for you?', ['warmth', 'Bringing warmth', 'A small hearth in your hands.'], ['ritual', 'Marking a ritual', 'The sequence mattered as much as the tea.'], ['taste', 'Giving me a flavour I love', 'Some favourites do not need a deeper job.'], 'Would you choose the same tea again?', ['food.tea']],
    ['drink', 'You saved a drink moment. Was it refreshment, novelty, or company?', ['fresh', 'Refreshment', 'A clean little reset.'], ['new', 'Something new', 'Curiosity won that round.'], ['shared', 'The company', 'Then the drink was part of a larger moment.'], 'What part belongs in the memory?', ['food.drink']],
    ['cafe', 'You went to a cafe. What made that place work for you?', ['room', 'The room itself', 'Light, sound, and a table can change a pause.'], ['order', 'What I ordered', 'The menu delivered.'], ['company', 'Who I was with', 'Then the cafe held the conversation.'], 'Would you return for the same reason?', ['went_somewhere.cafe']],
    ['home', 'A home drink can be almost invisible. What made this one noticeable?', ['method', 'Making it', 'The method gave the moment a shape.'], ['quiet', 'A quiet minute', 'The cup protected a little quiet.'], ['comfort', 'It was comforting', 'Familiarity did exactly what it needed to.'], 'What would help the ritual happen again?', ['food.coffee', 'food.tea']],
    ['shared', 'That drink was part of time with someone. What did it make easier?', ['talk', 'Talking', 'A cup gives conversation somewhere to rest.'], ['stay', 'Staying a little longer', 'The last sip stretched the visit.'], ['celebrate', 'Marking something', 'A small toast still counts.'], 'What would you like to repeat?', ['food.coffee', 'food.tea', 'food.drink']],
  ] as const).map(([id, prompt, a, b, c, followUp, routes]) => ({ seed: { id: `journal-${id}`, prompt, options: [a, b, c], followUp, followOptions: commonFollow }, routes }));
  if (familyId === 'steppling') return ([
    ['walk', 'You saved a walk. What changed between leaving and returning?', ['mind', 'My head felt different', 'The route made space around the thoughts.'], ['body', 'My body woke up', 'A useful bit of momentum.'], ['world', 'I noticed the world', 'The day became less background.'], 'What part of that walk would you keep?', ['movement.walk']],
    ['run', 'You recorded a run. What felt most real about it?', ['rhythm', 'Finding a rhythm', 'The body and route briefly agreed.'], ['effort', 'Meeting the effort', 'You stayed with the difficult bit.'], ['finish', 'Finishing', 'The ending made the whole run visible.'], 'What would make the next run inviting?', ['movement.run']],
    ['hike', 'That hike earned a place in the journal. Was it the climb, the view, or the distance?', ['climb', 'The climb', 'The route asked something clear of you.'], ['view', 'The view', 'Arrival changed what you could see.'], ['distance', 'The distance', 'A proper stretch of world underfoot.'], 'What deserves to be remembered?', ['movement.hike']],
    ['errand', 'You turned an everyday errand into movement. How did that feel?', ['useful', 'Efficient', 'The journey did two jobs at once.'], ['pleasant', 'More pleasant than expected', 'The practical route found a little life.'], ['hard', 'Harder than expected', 'Useful evidence for making the next one fairer.'], 'Would you choose that route again?', ['movement.errands']],
    ['commute', 'Your commute became part of the day’s movement. What did walking add?', ['transition', 'A transition', 'The route made a border between parts of the day.'], ['air', 'Air and space', 'A little outside time inside the routine.'], ['time', 'It mostly cost time', 'That matters too; not every active route is a gift.'], 'What would make it fit better?', ['movement.commute']],
    ['trail', 'You recorded time on a trail. What did the rougher ground change?', ['attention', 'I paid more attention', 'The ground kept you in the moment.'], ['challenge', 'It felt like a challenge', 'The route gave effort a shape.'], ['place', 'I felt inside the place', 'The trail made the landscape immediate.'], 'What kind of trail would call you back?', ['movement.hike', 'went_somewhere.forest']],
  ] as const).map(([id, prompt, a, b, c, followUp, routes]) => ({ seed: { id: `journal-${id}`, prompt, options: [a, b, c], followUp, followOptions: commonFollow }, routes }));
  return ([
    ['workout', 'You saved a workout. What made it worth recording?', ['showed', 'I showed up', 'Sometimes beginning is the whole win.'], ['strong', 'I felt capable', 'The body gave you a clear answer.'], ['learned', 'I learned something', 'A session that leaves knowledge behind.'], 'What would you carry into the next session?', ['movement.workout']],
    ['mobility', 'That movement moment sounded more restorative. What shifted?', ['comfort', 'More comfort', 'A little less resistance in the body.'], ['range', 'More room to move', 'Space is progress too.'], ['calm', 'I felt calmer', 'The nervous system joined the session.'], 'What would make that easier to repeat?', ['movement.workout']],
    ['basketball', 'You recorded sport. What was alive in the game?', ['team', 'The team', 'Movement and trust happening together.'], ['skill', 'A skill clicking', 'One detail became newly possible.'], ['pace', 'The pace of play', 'The game kept changing the question.'], 'What would bring you back to the court?', ['movement.sport']],
    ['racket', 'That racket-sport moment made the journal. What held your attention?', ['rally', 'The rally', 'A moving conversation across the net.'], ['serve', 'A particular skill', 'Repetition with a very clear purpose.'], ['opponent', 'Playing someone', 'Another person made every choice matter.'], 'What would you practise next?', ['movement.sport']],
    ['cardio', 'You saved an energetic session. What kept it going?', ['rhythm', 'A steady rhythm', 'The pace became something you could inhabit.'], ['interval', 'Short intervals', 'Clear beginnings and endings helped.'], ['music', 'Music', 'The soundtrack carried some of the work.'], 'What intensity would fit next time?', ['movement.workout']],
    ['dance', 'That movement sounded playful. What mattered most?', ['music', 'The music', 'The beat made the invitation.'], ['freedom', 'Moving freely', 'No perfect repetition required.'], ['people', 'Doing it with people', 'Shared energy changed the room.'], 'What part would you gladly repeat?', ['movement.sport', 'movement.workout']],
  ] as const).map(([id, prompt, a, b, c, followUp, routes]) => ({ seed: { id: `journal-${id}`, prompt, options: [a, b, c], followUp, followOptions: commonFollow }, routes }));
}

function journalMemory(
  familyId: ConversationV2FamilyId,
  seed: JournalSeed,
  routes: readonly string[]
): ConversationDefinition {
  return {
    id: `${familyId}:conversation:${seed.id}`,
    version: 4,
    familyId,
    title: seed.prompt,
    trigger: 'journal',
    triggerRouteKeys: routes,
    minimumBondLevel: 1,
    cooldownDays: 3,
    tags: ['memory'],
    contextualOnly: true,
    format: 'narrative',
    entryNodeId: 'question',
    nodes: [
      {
        id: 'question',
        kind: 'choice',
        phase: 'explore',
        prompt: seed.prompt,
        options: seed.options.map(([id, label, reply]) => ({
          id,
          label,
          reply,
          nextNodeId: `remember-${id}`,
        })),
      },
      ...seed.options.map(([id, label, reply]) => ({
        id: `remember-${id}`,
        kind: 'memory_proposal' as const,
        prompt: 'Would you like me to remember this about that journal moment?',
        summary: `${label}. ${reply}`,
        memoryKey: `journal:${familyId}:${seed.id}:${id}`,
        sensitivity: 'ordinary' as const,
        nextNodeId: 'end',
      })),
      endNode('That journal moment stays yours whether or not you add it to Long Memory.'),
    ],
  };
}

function debriefs(familyId: ConversationV2FamilyId): ConversationDefinition[] {
  const subject = familyId === 'baristabbit' ? 'ritual' : familyId === 'steppling' ? 'route' : 'practice';
  const goalTypeId = familyId === 'baristabbit' ? 'ritual' : familyId === 'steppling' ? 'walking-rhythm' : 'flexel-direction';
  const suggestedQuickGoalIds = familyId === 'baristabbit'
    ? ['coffee-ritual:make-pause', 'coffee-ritual:choose-intention', 'coffee-ritual:share-drink']
    : familyId === 'steppling'
      ? ['steppling:ten-minute-walk', 'steppling:fresh-air-break', 'steppling:notice-route']
      : ['flexel:show-up', 'flexel:one-exercise', 'flexel:recovery-choice'];
  const goalSeeds = [
    { id: 'goal-progress', prompt: `What has made your current ${subject} goal easier lately?`, options: [['smaller', 'Keeping it small', 'Small enough to return to is a strong design.'], ['time', 'Giving it a real time', 'A place in the day made it less abstract.'], ['support', 'Having support', 'The right support changes the weight of a plan.']] as const, title: `Build on what is helping your ${subject} goal` },
    { id: 'goal-friction', prompt: `Where is the ${subject} goal catching?`, options: [['energy', 'Energy or recovery', 'Then the next version has to respect capacity.'], ['time', 'Time', 'A smaller or better-placed action may fit.'], ['interest', 'It is not pulling me in', 'The next goal should earn your interest instead of relying on guilt.']] as const, title: `Make your ${subject} goal easier to return to` },
  ];
  const goalDefinitions = goalSeeds.map((seed): ConversationDefinition => ({
    id: `${familyId}:conversation:${seed.id}`,
    version: 4,
    familyId,
    title: seed.prompt,
    trigger: 'goal_debrief',
    minimumBondLevel: 1,
    cooldownDays: 7,
    tags: ['goals'],
    contextualOnly: true,
    format: 'outcome',
    entryNodeId: 'question',
    nodes: [
      { id: 'question', kind: 'choice', phase: 'explore', prompt: seed.prompt, options: options(seed.options, 'goal') },
      { id: 'goal', kind: 'goal_proposal', prompt: 'Here are a few concrete ways to respond. Choose only what would genuinely help.', goalTypeId, goalTitle: seed.title, suggestedQuickGoalIds, nextNodeId: 'end' },
      endNode('The useful outcome is the adjustment, not another label about you.'),
    ],
  }));
  const returnOptions = [
    ['tiny', 'A smaller first step', 'The quest does not need more motivation; it needs a lower doorway.'],
    ['plan', 'A specific time', 'The useful change is giving the quest a real place instead of carrying it as an open possibility.'],
    ['leave', 'Leaving it for now', 'Choosing not to force the quest is a valid decision, not a failed attempt.'],
  ] as const;
  const questReturn: ConversationDefinition = {
    id: `${familyId}:conversation:quest-return`, version: 4, familyId,
    title: 'Make the open quest easier to hold', trigger: 'quest_debrief', minimumBondLevel: 1,
    cooldownDays: 7, tags: ['goals'], contextualOnly: true, format: 'outcome', entryNodeId: 'question',
    nodes: [
      { id: 'question', kind: 'choice', phase: 'explore', prompt: 'That adventure is still open. What would make it easier to begin?', options: returnOptions.map(([id, label, reply]) => ({ id, label, reply, nextNodeId: 'goal' })) },
      { id: 'goal', kind: 'goal_proposal', prompt: 'These are concrete ways to lower the doorway. Add only one that would make the open quest easier.', goalTypeId, goalTitle: `Make the open ${subject} quest easier to begin`, suggestedQuickGoalIds, nextNodeId: 'end' },
      endNode('The goal is there to support the existing quest, not create another obligation.'),
    ],
  };
  const completionOptions = [
    ['easy', 'It was easier than expected', 'Completing it gave me evidence that beginning may be lighter than I predict.'],
    ['hard', 'It was genuinely hard', 'Completing it mattered, and I want the real effort remembered rather than edited out.'],
    ['different', 'It was different than expected', 'Completing it gave me a better map for how this kind of experience actually feels.'],
  ] as const;
  const questDebrief: ConversationDefinition = {
    id: `${familyId}:conversation:quest-debrief`, version: 4, familyId,
    title: 'Keep what the completed quest taught you', trigger: 'quest_debrief', minimumBondLevel: 1,
    cooldownDays: 7, tags: ['memory'], contextualOnly: true, format: 'outcome', entryNodeId: 'question',
    nodes: [
      { id: 'question', kind: 'choice', phase: 'explore', prompt: 'You completed something real. What did it show you?', options: completionOptions.map(([id, label, reply]) => ({ id, label, reply, nextNodeId: `remember-${id}` })) },
      ...completionOptions.map(([id, , summary]) => ({ id: `remember-${id}`, kind: 'memory_proposal' as const, prompt: 'Would you like me to keep that lesson in Long Memory?', summary, memoryKey: `quest-lesson:${familyId}:${id}`, sensitivity: 'ordinary' as const, nextNodeId: 'end' })),
      endNode('The lesson belongs to you even if you do not save it.'),
    ],
  };
  return [...goalDefinitions, questReturn, questDebrief];
}

function bonds(familyId: ConversationV2FamilyId): ConversationDefinition[] {
  const name = familyId === 'baristabbit' ? 'small rituals' : familyId === 'steppling' ? 'moving through the world' : 'practice and movement';
  const preferences = [
    ['gentle', 'Keep it gentle', 'I prefer gentle support around this; pressure makes the conversation less useful.'],
    ['curious', 'Ask curious questions', 'I prefer curious questions that help me notice without turning the answer into a test.'],
    ['direct', 'Be clear and practical', 'I prefer clear, practical support with small choices and no unnecessary scoring.'],
  ] as const;
  return ([2, 3, 4] as const).map((level): ConversationDefinition => {
    const prompt = level === 2
      ? `We know each other a little now. How should I talk about ${name}?`
      : level === 3
        ? `When I ask about ${name}, what kind of support feels useful?`
        : `What kind of companion should I keep being around ${name}?`;
    return {
      id: `${familyId}:conversation:bond-${level}`, version: 4, familyId, title: prompt,
      trigger: 'bond', minimumBondLevel: level, cooldownDays: 3650, tags: ['memory'],
      contextualOnly: true, format: 'outcome', entryNodeId: 'question',
      nodes: [
        { id: 'question', kind: 'choice', phase: 'explore', prompt, options: preferences.map(([id, label, reply]) => ({ id, label, reply, nextNodeId: `remember-${id}` })) },
        ...preferences.map(([id, , summary]) => ({ id: `remember-${id}`, kind: 'memory_proposal' as const, prompt: 'Would you like me to remember how you want me to support you?', summary, memoryKey: `support-style:${familyId}`, sensitivity: 'ordinary' as const, nextNodeId: 'end' })),
        endNode('You can change how you want me to support you at any time.'),
      ],
    };
  });
}

type GoalDiscoveryChoice = readonly [
  id: string,
  label: string,
  reply: string,
  nextPrompt: string,
];

type GoalDiscoveryDirection = {
  id: string;
  label: string;
  reply: string;
  contextPrompt: string;
  contextOptions: readonly GoalDiscoveryChoice[];
  goalTitle: string;
  reflection: string;
  quickGoalIds: readonly string[];
};

type GoalDiscoveryShape = {
  id: string;
  label: string;
  reply: string;
  resultLine: string;
  preferredQuickGoalIds: readonly string[];
};

type GoalDiscoveryConfig = {
  title: string;
  openingPrompt: string;
  openingHelperText: string;
  goalTypeId: string;
  directions: readonly GoalDiscoveryDirection[];
  frictionOptions: readonly GoalDiscoveryChoice[];
  shapes: readonly GoalDiscoveryShape[];
};

const GOAL_DISCOVERY_CONFIGS: Readonly<Partial<Record<ConversationV2FamilyId, GoalDiscoveryConfig>>> = {
  baristabbit: {
    title: 'Shape a drink ritual that fits your life',
    openingPrompt: 'What would you most like a drink ritual to give you lately?',
    openingHelperText: 'Choose the experience around the drink, not the drink you think you should choose.',
    goalTypeId: 'ritual',
    directions: [
      {
        id: 'begin', label: 'A clearer beginning', reply: 'Then the ritual can work as a threshold into what comes next.',
        contextPrompt: 'Which beginning would benefit most from a recognisable cue?',
        contextOptions: [
          ['morning', 'Starting the day', 'A gentle opening can give the morning a shape.', 'What usually prevents that morning cue from feeling deliberate?'],
          ['work', 'Beginning focused work', 'The cup can mark the moment attention changes jobs.', 'What tends to blur the beginning of focused work?'],
          ['return', 'Coming back after a break', 'A return cue can be as useful as a starting cue.', 'What makes it difficult to re-enter the day after stopping?'],
          ['variable', 'It changes from day to day', 'Then the cue needs to travel rather than depend on one schedule.', 'What makes a flexible beginning difficult to recognise?'],
        ],
        goalTitle: 'Use my first drink to begin deliberately',
        reflection: 'You are looking for a small, recognisable threshold—not a stricter morning routine.',
        quickGoalIds: ['coffee-ritual:make-pause', 'coffee-ritual:first-sip', 'coffee-ritual:choose-intention'],
      },
      {
        id: 'pause', label: 'A real pause', reply: 'Then stopping has to become part of the ritual rather than an accident.',
        contextPrompt: 'When would that pause do the most useful work?',
        contextOptions: [
          ['midwork', 'Between demanding things', 'A pause between demands can stop one thing spilling into the next.', 'What usually keeps the gap between demanding things from becoming a real pause?'],
          ['afternoon', 'When the afternoon blurs', 'That is often when a small boundary matters most.', 'What tends to take over when the afternoon starts to blur?'],
          ['afterwork', 'At the end of work', 'The ritual can help work release its grip on the rest of the day.', 'What makes the end of work difficult to mark?'],
          ['overload', 'Whenever everything feels crowded', 'Then the pause needs to be easy to reach under pressure.', 'What makes a crowded moment hard to interrupt?'],
        ],
        goalTitle: 'Protect one small drink break in the day',
        reflection: 'You want the drink to create actual breathing room, not accompany another screen or task.',
        quickGoalIds: ['coffee-ritual:weekday-pause', 'coffee-ritual:make-pause', 'coffee-ritual:notice-cue'],
      },
      {
        id: 'comfort', label: 'Comfort and familiarity', reply: 'Then the familiar details matter because they help the moment feel safe and settled.',
        contextPrompt: 'Which part of comfort matters most right now?',
        contextOptions: [
          ['holding', 'Something warm to hold', 'The physical feeling arrives before any grand meaning.', 'What stops that warm, held moment from feeling restorative?'],
          ['familiar', 'A familiar taste or method', 'Recognition can lower the amount of deciding the moment requires.', 'What interrupts the familiarity you are looking for?'],
          ['home', 'Making home feel softer', 'A small ritual can change the emotional temperature of a room.', 'What makes it hard for the ritual to soften time at home?'],
          ['reset', 'Coming back to myself', 'The ritual is serving as a return rather than an escape.', 'What tends to prevent that return from happening?'],
        ],
        goalTitle: 'Make one familiar drink ritual genuinely comforting',
        reflection: 'You are not chasing novelty; you want a dependable sensory cue that helps you settle.',
        quickGoalIds: ['coffee-ritual:favourite-cup', 'coffee-ritual:notice-cue', 'coffee-ritual:first-sip'],
      },
      {
        id: 'connect', label: 'A moment with someone', reply: 'Then the cup is useful because it gives connection somewhere to happen.',
        contextPrompt: 'What kind of shared moment are you hoping for?',
        contextOptions: [
          ['invite', 'An easy reason to invite someone', 'A small invitation can carry less pressure than a large plan.', 'What usually stops the invitation from leaving your head?'],
          ['present', 'Being more present with someone', 'The drink can hold attention in the same place for a while.', 'What tends to divide your attention during shared time?'],
          ['regular', 'A ritual we can repeat', 'Repeating something small can make connection easier to protect.', 'What makes a shared ritual difficult to repeat?'],
          ['casual', 'More unplanned, casual connection', 'The best version may need room for spontaneity.', 'What makes casual connection difficult to notice or accept?'],
        ],
        goalTitle: 'Create more shared drink-break moments',
        reflection: 'The ritual matters most as a gentle container for company, not as a perfectly prepared drink.',
        quickGoalIds: ['coffee-ritual:share-drink', 'coffee-ritual:try-method', 'coffee-ritual:favourite-cup'],
      },
    ],
    frictionOptions: [
      ['rush', 'I move straight through it', 'Then the goal needs a visible stopping point.', 'If rushing is the main friction, what size of experiment could interrupt it without becoming another demand?'],
      ['screen', 'Another screen or task takes over', 'The ritual needs one protected edge, not more discipline.', 'If divided attention is the friction, what boundary would feel realistic this week?'],
      ['automatic', 'It becomes automatic', 'Then noticing one detail may matter more than adding complexity.', 'If autopilot is the friction, what would make the ritual visible again?'],
      ['capacity', 'My time or energy changes', 'Then the plan has to survive imperfect days.', 'If capacity changes, what flexible version could still count?'],
    ],
    shapes: [
      { id: 'single', label: 'One intentional drink', reply: 'One complete moment is enough to test the idea.', resultLine: 'Start with one contained moment rather than a schedule.', preferredQuickGoalIds: ['coffee-ritual:make-pause', 'coffee-ritual:first-sip'] },
      { id: 'cue', label: 'Attach it to a familiar cue', reply: 'An existing moment can carry the reminder.', resultLine: 'Use an existing part of the day as the doorway.', preferredQuickGoalIds: ['coffee-ritual:choose-intention', 'coffee-ritual:weekday-pause'] },
      { id: 'sensory', label: 'Make one detail easy to notice', reply: 'A cup, flavour, or first sip can bring the ritual back into view.', resultLine: 'Let one familiar sensory detail do the remembering.', preferredQuickGoalIds: ['coffee-ritual:favourite-cup', 'coffee-ritual:notice-cue'] },
      { id: 'shared', label: 'Try it with someone', reply: 'Company can give the ritual a natural boundary.', resultLine: 'Give the experiment a social shape when the opportunity appears.', preferredQuickGoalIds: ['coffee-ritual:share-drink', 'coffee-ritual:try-method'] },
    ],
  },
  steppling: {
    title: 'Find a walking goal that fits',
    openingPrompt: 'What would you most like movement to give you lately?',
    openingHelperText: 'Choose what would make a route worthwhile in your actual life.',
    goalTypeId: 'walking-rhythm',
    directions: [
      {
        id: 'headspace', label: 'A clearer head', reply: 'Then the destination is a change in mental space, not a distance.',
        contextPrompt: 'When would that reset help most?',
        contextOptions: [
          ['morning', 'Before the day gets busy', 'A short route can create room before demands arrive.', 'What usually prevents you from taking that early breathing room?'],
          ['between', 'Between demanding things', 'Movement can help one demand stop following you into the next.', 'What makes the gap between demanding things difficult to use?'],
          ['after', 'After work or study', 'A route can mark the point when concentrated effort releases.', 'What tends to keep you stuck when work or study ends?'],
          ['crowded', 'When my thoughts feel crowded', 'Then the route needs to be available without much planning.', 'What makes movement hard to reach when your head already feels full?'],
        ],
        goalTitle: 'Use short walks to make headspace',
        reflection: 'You want walking to change the texture of your attention, without needing the route to be impressive.',
        quickGoalIds: ['steppling:fresh-air-break', 'steppling:notice-route', 'steppling:ten-minute-walk'],
      },
      {
        id: 'energy', label: 'More everyday energy', reply: 'Then the route should wake the day up without draining it.',
        contextPrompt: 'When does your energy most need a small lift?',
        contextOptions: [
          ['start', 'Getting started', 'The first movement can create energy instead of waiting for it.', 'What makes starting movement feel larger than it needs to be?'],
          ['midday', 'In the middle of the day', 'A short change of place may be enough to shift the afternoon.', 'What usually keeps you in the same place when energy dips?'],
          ['stuck', 'When I feel physically stuck', 'The useful result is feeling a little more alive in your body.', 'What makes it difficult to answer that stuck feeling with movement?'],
          ['outside', 'When I have been indoors too long', 'Fresh air may be part of the energy change you are looking for.', 'What keeps the outside break from happening when you need it?'],
        ],
        goalTitle: 'Make room for short energising walks',
        reflection: 'You are looking for movement that creates a little energy, not a routine that consumes what you have.',
        quickGoalIds: ['steppling:ten-minute-walk', 'steppling:fresh-air-break', 'steppling:after-meal-walk'],
      },
      {
        id: 'useful', label: 'An easier way to stay active', reply: 'Then movement can belong inside ordinary life instead of competing with it.',
        contextPrompt: 'Where could walking replace or accompany something already happening?',
        contextOptions: [
          ['journey', 'Part of an everyday journey', 'A useful destination removes the need to invent a separate workout.', 'What usually makes that everyday journey difficult to walk?'],
          ['errand', 'A nearby errand', 'The errand can provide the reason while walking provides the movement.', 'What keeps nearby errands from becoming walkable opportunities?'],
          ['call', 'A call or conversation', 'Walking can sit beside something that already has a place in the day.', 'What makes it difficult to pair movement with a call?'],
          ['meal', 'Before or after something routine', 'A stable everyday anchor can carry a small route.', 'What interrupts movement around that existing routine?'],
        ],
        goalTitle: 'Use walking for more everyday journeys',
        reflection: 'You want activity to earn its place by helping ordinary life, rather than requiring a separate campaign.',
        quickGoalIds: ['steppling:walk-one-journey', 'steppling:weekday-steps', 'steppling:walking-call'],
      },
      {
        id: 'explore', label: 'More outside curiosity', reply: 'Then a route succeeds when it gives you something new to notice.',
        contextPrompt: 'What kind of exploration sounds inviting rather than demanding?',
        contextOptions: [
          ['detour', 'One unfamiliar turn', 'A tiny detour can be enough to refresh a known place.', 'What usually stops you from taking the unfamiliar turn?'],
          ['detail', 'Noticing familiar streets differently', 'Exploration can come from attention rather than distance.', 'What makes familiar routes disappear into the background?'],
          ['destination', 'Walking toward somewhere interesting', 'A point of curiosity can pull the route forward.', 'What makes an interesting destination feel too difficult to choose?'],
          ['open', 'Leaving some of the route undecided', 'A little uncertainty can make ordinary movement feel alive.', 'What makes an open-ended route uncomfortable or impractical?'],
        ],
        goalTitle: 'Use walks to notice and explore nearby',
        reflection: 'You want routes to reveal something, even when the distance is small and the place is familiar.',
        quickGoalIds: ['steppling:explore-turn', 'steppling:notice-route', 'steppling:ten-minute-walk'],
      },
    ],
    frictionOptions: [
      ['large', 'Starting feels too large', 'Then the doorway needs to shrink before motivation enters the picture.', 'If starting feels large, what is the smallest route shape that would still feel worthwhile?'],
      ['window', 'The day passes before I find a window', 'The route needs an anchor, not better intentions.', 'If timing disappears, what kind of anchor could hold the experiment?'],
      ['route', 'I do not have a useful route or reason', 'Then purpose and place need to come before distance.', 'If the route lacks a reason, what would make leaving feel naturally worthwhile?'],
      ['capacity', 'Energy, access, or weather changes', 'A real plan needs more than one valid size.', 'If conditions change, what flexible version should still count?'],
    ],
    shapes: [
      { id: 'short', label: 'One deliberately short route', reply: 'Short enough to begin can still be long enough to help.', resultLine: 'Begin with a contained route that does not require momentum first.', preferredQuickGoalIds: ['steppling:ten-minute-walk', 'steppling:fresh-air-break'] },
      { id: 'anchor', label: 'A repeatable moment in the day', reply: 'An existing moment can remember the route for you.', resultLine: 'Attach the route to something the day already contains.', preferredQuickGoalIds: ['steppling:after-meal-walk', 'steppling:weekday-steps'] },
      { id: 'journey', label: 'Movement inside something useful', reply: 'A destination can carry the reason to begin.', resultLine: 'Let an everyday journey or conversation provide the structure.', preferredQuickGoalIds: ['steppling:walk-one-journey', 'steppling:walking-call'] },
      { id: 'wander', label: 'An exploratory route when space appears', reply: 'The plan can protect curiosity without demanding a fixed schedule.', resultLine: 'Leave room for a detour or noticing practice when conditions suit it.', preferredQuickGoalIds: ['steppling:explore-turn', 'steppling:notice-route'] },
    ],
  },
  flexel: {
    title: 'Build a movement goal around your life',
    openingPrompt: 'What would you most like practice to give you lately?',
    openingHelperText: 'Choose the benefit that matters now. Harder, heavier, and more frequent are not assumed.',
    goalTypeId: 'flexel-direction',
    directions: [
      {
        id: 'strength', label: 'Useful strength', reply: 'Then progress should show up in capability, not comparison.',
        contextPrompt: 'Where would feeling stronger matter most to you?',
        contextOptions: [
          ['daily', 'Ordinary daily movement', 'Useful strength belongs beyond the session.', 'What makes strength practice difficult to connect to everyday life?'],
          ['movement', 'One movement I want to improve', 'A specific movement gives practice a clear job.', 'What gets in the way of practising that movement consistently?'],
          ['confidence', 'Feeling more capable in my body', 'Capability can be a kinder measure than performance.', 'What most often disrupts that sense of capability?'],
          ['gradual', 'Seeing gradual progress', 'Visible progress can be small and still meaningful.', 'What makes gradual progress difficult to notice or sustain?'],
        ],
        goalTitle: 'Explore gradual strength progress without comparison',
        reflection: 'You want practice to build usable capability while keeping the measure personal and adaptable.',
        quickGoalIds: ['flexel:one-exercise', 'flexel:record-set', 'flexel:form-cue'],
      },
      {
        id: 'rhythm', label: 'Enjoyable energy and rhythm', reply: 'Then returning matters more than making every session substantial.',
        contextPrompt: 'What kind of movement energy sounds most inviting?',
        contextOptions: [
          ['steady', 'A steady rhythm', 'A repeatable rhythm can make starting less negotiable.', 'What usually breaks the rhythm you are looking for?'],
          ['play', 'Something playful', 'Interest can carry effort that obligation cannot.', 'What makes play disappear from movement?'],
          ['shift', 'A change in mood or energy', 'The after-feeling can be the purpose of the session.', 'What stops you from beginning when you want that energy shift?'],
          ['variety', 'Enough variety to stay interested', 'A flexible practice can change form without losing continuity.', 'What makes variety turn into difficulty choosing?'],
        ],
        goalTitle: 'Build a flexible movement rhythm that suits my capacity',
        reflection: 'You want a practice you can return to because it feels alive, not because it never changes.',
        quickGoalIds: ['flexel:show-up', 'flexel:weekday-training', 'flexel:warm-up'],
      },
      {
        id: 'technique', label: 'Confidence and technique', reply: 'Then one clearer skill can matter more than a larger session.',
        contextPrompt: 'What would make practice feel safer and more understandable?',
        contextOptions: [
          ['cue', 'One useful form cue', 'A good cue reduces noise and gives attention somewhere specific to go.', 'What makes it difficult to trust or remember useful technique?'],
          ['adapt', 'Knowing how to adapt a movement', 'Adaptation makes practice responsive rather than all-or-nothing.', 'What makes choosing an adaptation feel uncertain?'],
          ['space', 'Feeling that I belong in the space', 'Confidence includes the environment, not only the movement.', 'What most affects whether the practice space feels usable?'],
          ['learn', 'Learning one skill properly', 'A single skill can give practice a satisfying thread.', 'What keeps skill practice from feeling clear enough to continue?'],
        ],
        goalTitle: 'Learn adaptations and technique that suit my body',
        reflection: 'You are looking for clearer choices and trustworthy technique, not pressure to push through uncertainty.',
        quickGoalIds: ['flexel:warm-up', 'flexel:form-cue', 'flexel:one-exercise'],
      },
      {
        id: 'recovery', label: 'Mobility and recovery', reply: 'Then recovery belongs inside the practice rather than after it fails.',
        contextPrompt: 'What would supportive recovery help you do?',
        contextOptions: [
          ['ready', 'Feel readier to move', 'Preparation can be the whole useful session on some days.', 'What makes it difficult to give preparation enough value?'],
          ['release', 'Release stiffness or tension', 'The goal is a more workable body state, not earning rest.', 'What usually keeps a gentle release practice from happening?'],
          ['respond', 'Respond better to changing energy', 'A responsive plan needs valid options at several intensities.', 'What makes it hard to choose the version that fits today?'],
          ['protect', 'Protect recovery between sessions', 'Recovery can support continuity without becoming another performance task.', 'What tends to crowd recovery out between sessions?'],
        ],
        goalTitle: 'Make mobility and recovery part of practice',
        reflection: 'You want practice to include listening, preparation, and recovery as real forms of progress.',
        quickGoalIds: ['flexel:mobility-five', 'flexel:recovery-choice', 'flexel:warm-up'],
      },
    ],
    frictionOptions: [
      ['time', 'Time or access changes', 'Then the practice needs more than one valid setting and size.', 'If time or access changes, what version could travel with the week?'],
      ['body', 'I am unsure what suits my body', 'Then clarity and adaptation should come before intensity.', 'If uncertainty is the friction, what small experiment would feel informative rather than risky?'],
      ['belonging', 'Confidence or belonging gets in the way', 'The environment is part of the plan, not a personal failing.', 'If confidence is the friction, what private or familiar starting point would help?'],
      ['recovery', 'Pain, fatigue, or recovery changes', 'Then reducing, changing, or resting must remain valid outcomes.', 'If capacity changes, what responsive version should count as keeping faith with the goal?'],
    ],
    shapes: [
      { id: 'tiny', label: 'One deliberately small session', reply: 'A complete small session can teach you more than a postponed ideal one.', resultLine: 'Begin with a session small enough to start without negotiating.', preferredQuickGoalIds: ['flexel:show-up', 'flexel:one-exercise'] },
      { id: 'rhythm', label: 'A repeatable weekly place', reply: 'A loose rhythm can provide structure without demanding identical weeks.', resultLine: 'Give practice a recognisable place while keeping its size flexible.', preferredQuickGoalIds: ['flexel:weekday-training', 'flexel:warm-up'] },
      { id: 'skill', label: 'One movement or skill to explore', reply: 'Specific curiosity can make the next session easier to enter.', resultLine: 'Let one movement, adaptation, or cue provide the thread.', preferredQuickGoalIds: ['flexel:form-cue', 'flexel:record-set'] },
      { id: 'recover', label: 'A recovery-sized option', reply: 'Recovery can be the right expression of the goal, not a substitute for it.', resultLine: 'Keep a mobility or recovery version available when capacity changes.', preferredQuickGoalIds: ['flexel:mobility-five', 'flexel:recovery-choice'] },
    ],
  },
};

function uniqueGoalIds(...groups: readonly (readonly string[])[]): string[] {
  return [...new Set(groups.flat())].slice(0, 3);
}

function goalStarter(familyId: ConversationV2FamilyId): ConversationDefinition {
  const config = GOAL_DISCOVERY_CONFIGS[familyId];
  if (!config) throw new Error(`Missing pilot goal discovery config for ${familyId}`);
  return {
    id: `${familyId}:conversation:goal-discovery`,
    version: 3,
    familyId,
    title: config.title,
    trigger: 'evergreen',
    minimumBondLevel: 2,
    cooldownDays: 0,
    tags: ['goals'],
    format: 'outcome',
    entryNodeId: 'desired-change',
    nodes: [
      {
        id: 'desired-change',
        kind: 'choice',
        phase: 'opening',
        prompt: config.openingPrompt,
        helperText: config.openingHelperText,
        options: config.directions.map((direction) => ({
          id: direction.id,
          label: direction.label,
          reply: direction.reply,
          nextNodeId: `context-${direction.id}`,
        })),
      },
      ...config.directions.flatMap((direction) => [
        {
          id: `context-${direction.id}`,
          kind: 'choice' as const,
          phase: 'explore' as const,
          prompt: direction.contextPrompt,
          options: direction.contextOptions.map(([id, label, reply]) => ({
            id,
            label,
            reply,
            nextNodeId: `friction-${direction.id}-${id}`,
          })),
        },
        ...direction.contextOptions.map(([contextId, , , frictionPrompt]) => ({
          id: `friction-${direction.id}-${contextId}`,
          kind: 'choice' as const,
          phase: 'deepen' as const,
          prompt: frictionPrompt,
          options: config.frictionOptions.map(([id, label, reply]) => ({
            id,
            label,
            reply,
            nextNodeId: `shape-${direction.id}-${id}`,
          })),
        })),
        ...config.frictionOptions.map(([frictionId, , , shapePrompt]) => ({
          id: `shape-${direction.id}-${frictionId}`,
          kind: 'choice' as const,
          phase: 'resolve' as const,
          prompt: shapePrompt,
          options: config.shapes.map((shape) => ({
            id: shape.id,
            label: shape.label,
            reply: shape.reply,
            nextNodeId: `goal-${direction.id}-${shape.id}`,
          })),
        })),
        ...config.shapes.map((shape) => ({
          id: `goal-${direction.id}-${shape.id}`,
          kind: 'goal_proposal' as const,
          prompt: 'I followed the whole thread. This is the direction I would start with.',
          goalTypeId: config.goalTypeId,
          goalTitle: direction.goalTitle,
          summary: `${direction.reflection} ${shape.resultLine}`,
          suggestedQuickGoalIds: uniqueGoalIds(shape.preferredQuickGoalIds, direction.quickGoalIds),
          nextNodeId: 'end',
        })),
      ]),
      endNode('The plan came from what you told me. You can keep it, adjust it, or leave it here.'),
    ],
  };
}

function smallStepOffer(familyId: ConversationV2FamilyId): ConversationDefinition {
  const choices = familyId === 'baristabbit'
    ? [
        ['pause', 'Protect one real pause', 'coffee-ritual:make-pause', 'Make one drink without doing anything else'],
        ['sip', 'Notice the first sip', 'coffee-ritual:first-sip', 'Pause for the first sip of one drink'],
        ['share', 'Make it social', 'coffee-ritual:share-drink', 'Share a drink moment with someone'],
      ] as const
    : familyId === 'steppling'
      ? [
          ['short', 'Take a ten-minute route', 'steppling:ten-minute-walk', 'Take one ten-minute walk'],
          ['air', 'Use movement as a reset', 'steppling:fresh-air-break', 'Take one short fresh-air break'],
          ['notice', 'Notice one route detail', 'steppling:notice-route', 'Notice one thing along a familiar route'],
        ] as const
      : [
          ['show', 'Make showing up enough', 'flexel:show-up', 'Begin one deliberately small movement session'],
          ['move', 'Choose one useful movement', 'flexel:one-exercise', 'Practise one useful movement'],
          ['recover', 'Give recovery a place', 'flexel:mobility-five', 'Take five minutes for mobility or recovery'],
        ] as const;
  return {
    id: `${familyId}:conversation:small-step`, version: 1, familyId,
    title: 'Choose one small step without turning it into a campaign',
    trigger: 'evergreen', minimumBondLevel: 1, cooldownDays: 0,
    tags: ['goals'], format: 'outcome', entryNodeId: 'choose',
    nodes: [
      { id: 'choose', kind: 'choice', phase: 'resolve', prompt: 'Would one small, concrete action help more than another big idea?', options: choices.map(([id, label]) => ({ id, label, reply: 'Small enough to do is more useful than impressive enough to postpone.', nextNodeId: `task-${id}` })) },
      ...choices.map(([id, , templateId, title]) => ({ id: `task-${id}`, kind: 'quick_goal_proposal' as const, prompt: 'Add this as a small task?', templateId, title, nextNodeId: 'end' })),
      endNode('The task is optional. The conversation still counts without it.'),
    ],
  };
}

function questHandoff(familyId: ConversationV2FamilyId): ConversationDefinition {
  const suggestedQuestIds = familyId === 'baristabbit'
    ? ['quest-coffee-ritual-pause', 'quest-coffee-ritual-note']
    : familyId === 'steppling'
      ? ['quest-steppling-gentle-walk', 'quest-steppling-walk-note']
      : ['quest-flexel-session-note', 'quest-flexel-training-detail'];
  const subject = familyId === 'baristabbit' ? 'ritual' : familyId === 'steppling' ? 'route' : 'practice';
  const goalFallback = familyId === 'baristabbit'
    ? { goalTypeId: 'ritual', title: 'Give this drink moment a small next step', ids: ['coffee-ritual:make-pause', 'coffee-ritual:choose-intention', 'coffee-ritual:share-drink'] }
    : familyId === 'steppling'
      ? { goalTypeId: 'walking-rhythm', title: 'Give this route idea a small next step', ids: ['steppling:ten-minute-walk', 'steppling:fresh-air-break', 'steppling:notice-route'] }
      : { goalTypeId: 'flexel-direction', title: 'Give this practice idea a small next step', ids: ['flexel:show-up', 'flexel:one-exercise', 'flexel:recovery-choice'] };
  const questions = familyId === 'baristabbit'
    ? {
        first: 'What kind of drink moment would feel good today?',
        firstOptions: [['pause', 'A proper pause', 'Then the moment needs room around it.'], ['curious', 'Something different', 'A little curiosity can wake up a familiar ritual.'], ['company', 'A shared cup', 'Then the people matter more than perfect preparation.']] as const,
        second: 'What would make that moment feel worthwhile?',
        secondOptions: [['notice', 'Actually noticing it', 'Attention can be the whole result.'], ['make', 'Enjoying how it is made', 'The method can be part of the pleasure.'], ['share', 'Having someone there', 'A cup can hold a conversation open.']] as const,
      }
    : familyId === 'steppling'
      ? {
          first: 'What would you want from a route today?',
          firstOptions: [['clarity', 'A clearer head', 'Then the route can be thinking space.'], ['energy', 'A little more energy', 'Movement may create the spark you do not have yet.'], ['discover', 'Something new to notice', 'Then even one unfamiliar turn can matter.']] as const,
          second: 'What would make the route feel worthwhile?',
          secondOptions: [['calmer', 'Coming back calmer', 'That is a real destination.'], ['alive', 'Feeling more awake', 'The change in energy is enough to count.'], ['story', 'Returning with a detail or story', 'Then noticing belongs to the route.']] as const,
        }
      : {
          first: 'What would you want from practice today?',
          firstOptions: [['capable', 'To feel more capable', 'Then useful, adaptable work matters most.'], ['play', 'To enjoy a skill or game', 'Interest can carry the effort.'], ['shift', 'To change my energy', 'The session can be about how you feel afterward.']] as const,
          second: 'What would make the practice feel worthwhile?',
          secondOptions: [['clean', 'One movement feeling cleaner', 'A small technical change is real progress.'], ['start', 'Simply getting started', 'Beginning can be the entire win today.'], ['different', 'Feeling different afterward', 'The internal shift is useful evidence.']] as const,
        };
  return {
    id: `${familyId}:conversation:quest-handoff`, version: 2, familyId,
    title: `Turn this ${subject} thread into an optional adventure`,
    trigger: 'evergreen', minimumBondLevel: 1, cooldownDays: 0,
    tags: ['goals'], format: 'outcome', requiresNoActiveQuest: true, entryNodeId: 'question-one',
    nodes: [
      { id: 'question-one', kind: 'choice', phase: 'explore', prompt: questions.first, options: options(questions.firstOptions, 'question-two') },
      { id: 'question-two', kind: 'choice', phase: 'deepen', prompt: questions.second, options: options(questions.secondOptions, 'handoff') },
      { id: 'handoff', kind: 'quest_handoff', prompt: 'I’m matching what you told me to something useful.', suggestedQuestIds, fallbackNodeId: 'goal-fallback', nextNodeId: 'end' },
      { id: 'goal-fallback', kind: 'goal_proposal', prompt: 'A few small goals fit what you told me.', goalTypeId: goalFallback.goalTypeId, goalTitle: goalFallback.title, suggestedQuickGoalIds: goalFallback.ids, nextNodeId: 'end' },
      endNode('That thread can stay as a conversation even if the quest is not right today.'),
    ],
  };
}

const BARISTA_POLLS: readonly PollSeed[] = ([
  ['first', 'The first drink of the day should be…', ['Reliable', 'Strong', 'Slow']], ['cup', 'Pick the cup.', ['Favourite mug', 'Tiny cafe cup', 'Tall cold glass']], ['milk', 'Choose the finish.', ['No milk', 'A little', 'Cloud-like']], ['sweet', 'Choose the sweetness.', ['None', 'A hint', 'Dessert-level']], ['seat', 'Choose the cafe seat.', ['Window', 'Corner', 'Counter']], ['sound', 'Choose the background.', ['Quiet', 'Soft music', 'Busy chatter']], ['order', 'How do you order?', ['The usual', 'Seasonal special', 'Ask for a surprise']], ['tea', 'Tea should be…', ['Dark and strong', 'Fresh and green', 'Herbal and soft']], ['coffee', 'Coffee should be…', ['Short and bold', 'Milky and gentle', 'Cold and bright']], ['bubbles', 'Bubble tea mood?', ['Fruit tea', 'Milk tea', 'No bubbles today']], ['time', 'Best drink hour?', ['Early morning', 'Afternoon pause', 'Late evening']], ['weather', 'Rainy-day cup?', ['Coffee', 'Tea', 'Hot chocolate']], ['summer', 'Hot-day rescue?', ['Iced coffee', 'Iced tea', 'Something fruity']], ['share', 'A shared drink needs…', ['Good conversation', 'A treat beside it', 'Plenty of time']], ['home', 'Home ritual essential?', ['A good kettle', 'A favourite method', 'The right mug']], ['cafe-food', 'Cafe companion?', ['Pastry', 'Toast', 'Nothing']], ['new', 'Try one unusual note.', ['Floral', 'Spiced', 'Smoky']], ['pace', 'How long should the pause last?', ['Five minutes', 'Half an hour', 'Lose track of time']], ['walk', 'Drink destination?', ['Neighbourhood cafe', 'Park kiosk', 'Kitchen']], ['temperature', 'Absolute loyalty?', ['Always hot', 'Always cold', 'Season decides']], ['foam', 'Foam opinion?', ['Essential', 'Nice extra', 'No thank you']], ['ritual', 'The ritual is mostly about…', ['Beginning', 'Stopping', 'Connecting']], ['refill', 'Second cup?', ['Obviously', 'Sometimes', 'One is enough']], ['last', 'The last sip should be…', ['Still hot', 'Long forgotten', 'Saved for later']],
] as const).map(([id, prompt, labels]) => ({ id, prompt, labels }));

const STEPPLING_POLLS: readonly PollSeed[] = ([
  ['pace', 'Choose the pace.', ['Stroll', 'Steady', 'Fast']], ['route', 'Choose the route.', ['Familiar', 'One detour', 'Entirely new']], ['ground', 'Choose the ground.', ['Pavement', 'Park path', 'Trail']], ['company', 'Choose the company.', ['Solo', 'One person', 'A group']], ['sound', 'Choose the sound.', ['The world', 'Music', 'Podcast']], ['distance', 'Choose the distance.', ['One block', 'A proper loop', 'All-day route']], ['weather', 'Choose the weather.', ['Sun', 'Light rain', 'Crisp cold']], ['time', 'Choose the hour.', ['Dawn', 'Afternoon', 'Evening']], ['destination', 'Choose the destination.', ['A drink', 'A view', 'Nowhere']], ['hill', 'A hill appears.', ['Avoid it', 'Accept it', 'Race it']], ['map', 'Navigation style?', ['Know the route', 'Check sometimes', 'Wander']], ['shoes', 'Route priority?', ['Comfort', 'Speed', 'Grip']], ['city', 'City walk detail?', ['Architecture', 'People', 'Hidden corners']], ['nature', 'Trail detail?', ['Trees', 'Water', 'Wide views']], ['break', 'Mid-route pause?', ['Never', 'Quick stop', 'Long sit']], ['return', 'Come home by…', ['Same way', 'A loop', 'Transit']], ['errand', 'Best useful walk?', ['Groceries', 'Coffee', 'Visiting']], ['photo', 'Stop for a photo?', ['Often', 'Only special ones', 'Keep moving']], ['steps', 'Numbers after the walk?', ['Show me', 'A glance', 'Do not care']], ['rain', 'Rain equipment?', ['Umbrella', 'Good coat', 'Stay in']], ['run', 'Running rhythm?', ['Run-walk', 'Steady', 'Intervals']], ['hike', 'Trail reward?', ['Summit', 'Picnic', 'The route itself']], ['thought', 'Walking is best for…', ['Thinking', 'Not thinking', 'Talking']], ['end', 'Best ending?', ['Tired', 'Energised', 'Calm']],
] as const).map(([id, prompt, labels]) => ({ id, prompt, labels }));

const FLEXEL_POLLS: readonly PollSeed[] = ([
  ['start', 'Best way to start?', ['Warm-up ritual', 'Favourite movement', 'Just begin']], ['space', 'Choose the space.', ['Gym', 'Home', 'Outside']], ['style', 'Choose the style.', ['Strength', 'Cardio', 'Mobility']], ['company', 'Choose the company.', ['Solo', 'Partner', 'Team']], ['music', 'Training soundtrack?', ['Silence', 'One playlist', 'Maximum energy']], ['length', 'Ideal session?', ['Ten minutes', 'Forty minutes', 'Long and varied']], ['progress', 'Best progress sign?', ['More weight', 'Better skill', 'Returning']], ['sport', 'Sport is mostly about…', ['Competition', 'Skill', 'Play']], ['court', 'Choose the court.', ['Basketball', 'Tennis', 'No court']], ['cardio', 'Choose the cardio.', ['Steady rhythm', 'Intervals', 'Dance']], ['mobility', 'Mobility moment?', ['Morning', 'Warm-up', 'Recovery']], ['rest', 'Recovery priority?', ['Sleep', 'Food and water', 'Gentle movement']], ['numbers', 'Training numbers?', ['All of them', 'A few', 'Go by feel']], ['coach', 'Best coaching voice?', ['Direct', 'Encouraging', 'Curious']], ['challenge', 'Choose the challenge.', ['Heavier', 'Longer', 'More precise']], ['team', 'Team role?', ['Lead', 'Support', 'Adapt']], ['racket', 'Racket joy?', ['Serve', 'Rally', 'Match']], ['basketball', 'Court joy?', ['Shooting', 'Passing', 'Defence']], ['gym', 'Gym favourite?', ['Free weights', 'Machines', 'Open floor']], ['finish', 'Best finish?', ['One last effort', 'Cool down', 'Stop on a high']], ['weather', 'Outdoor training weather?', ['Clear', 'Cool', 'Light rain']], ['energy', 'Low-energy choice?', ['Rest', 'Mobility', 'Tiny session']], ['skill', 'Practise by…', ['Repeating', 'Playing', 'Watching then trying']], ['after', 'Afterwards I want…', ['Energy', 'Pride', 'Calm']],
] as const).map(([id, prompt, labels]) => ({ id, prompt, labels }));

const profileOption = (
  id: string,
  label: string,
  reply: string,
  affinity: Partial<Record<KatchimeraSkinId, number>>,
  nextQuestionId: string | null
): ConversationOption => ({ id, label, reply, nextNodeId: null, nextQuestionId, affinity });

const BARISTA_PROFILE = profileGame({
  familyId: 'baristabbit', title: 'Find your drink-side form', memoryKey: 'preference:baristabbit:form-match', entryQuestionId: 'drink-world',
  questions: [
    { id: 'drink-world', prompt: 'Which drink world feels most like you?', options: [profileOption('coffee', 'Coffee', 'The beans get the first word.', { baristabbit: 1, lattelet: 1, dripkin: 1, frostaflop: 1 }, 'coffee-style'), profileOption('tea', 'Tea', 'Leaves, warmth, and a little room to breathe.', { hearthsip: 1, matchamallow: 1, chaihare: 1, infusprig: 1 }, 'tea-style'), profileOption('other', 'Something playful or fresh', 'The menu opens beyond coffee and tea.', { bobaloo: 1, cocoabun: 1, zestlet: 1 }, 'other-style')] },
    { id: 'coffee-style', prompt: 'Which coffee moment would you choose?', options: [profileOption('coffee-bold', 'Short, bold, and crafted', 'A small cup with a clear point of view.', { baristabbit: 4 }, 'ritual-purpose'), profileOption('coffee-soft', 'Soft, milky, and easy', 'The edges can stay gentle.', { lattelet: 4 }, 'ritual-purpose'), profileOption('coffee-slow', 'Slow filter or pour-over', 'The making is part of the pause.', { dripkin: 4 }, 'ritual-purpose'), profileOption('coffee-cold', 'Iced or blended', 'Cool, bright, and a little indulgent.', { frostaflop: 4 }, 'ritual-purpose')] },
    { id: 'tea-style', prompt: 'Which tea moment would you choose?', options: [profileOption('tea-classic', 'A familiar everyday tea', 'A dependable cup that feels like home.', { hearthsip: 4 }, 'ritual-purpose'), profileOption('tea-matcha', 'Matcha or green tea', 'A greener, more focused ritual.', { matchamallow: 4 }, 'ritual-purpose'), profileOption('tea-chai', 'Warm and spiced chai', 'The cup arrives with warmth and character.', { chaihare: 4 }, 'ritual-purpose'), profileOption('tea-herbal', 'Herbal or fruit infusion', 'Gentle flavour without needing a buzz.', { infusprig: 4 }, 'ritual-purpose')] },
    { id: 'other-style', prompt: 'What sounds best?', options: [profileOption('other-bubble', 'Bubble tea', 'Texture, colour, and choosing something fun.', { bobaloo: 4 }, 'ritual-purpose'), profileOption('other-cocoa', 'Hot chocolate or cocoa', 'Comfort is allowed to be the whole point.', { cocoabun: 4 }, 'ritual-purpose'), profileOption('other-fresh', 'A smoothie or fresh juice', 'Something vivid and freshly made.', { zestlet: 4 }, 'ritual-purpose')] },
    { id: 'ritual-purpose', prompt: 'What should the drink moment give you?', options: [profileOption('craft', 'A focused little ritual', 'Attention makes the cup feel complete.', { baristabbit: 1, dripkin: 2, matchamallow: 1 }, null), profileOption('comfort', 'Comfort and softness', 'A familiar place to land.', { lattelet: 1, hearthsip: 1, chaihare: 1, cocoabun: 2 }, null), profileOption('connect', 'Something enjoyable to share', 'The drink joins the gathering.', { bobaloo: 2, frostaflop: 1, zestlet: 1 }, null), profileOption('gentle', 'A gentle pause', 'Nothing needs to be pushed.', { infusprig: 2, hearthsip: 1, matchamallow: 1 }, null)] },
  ],
  descriptions: { baristabbit: 'An espresso-minded cafe craft form drawn to bold flavour and a clear ritual.', lattelet: 'A softer coffee form drawn to milky drinks, gentle flavour, and comfortable cafe time.', hearthsip: 'A classic tea form drawn to familiar warmth, home rituals, and unhurried cups.', bobaloo: 'A playful social form drawn to bubble tea, texture, novelty, and company.', dripkin: 'A patient coffee form drawn to filter brewing, pour-over craft, and slow preparation.', matchamallow: 'A focused green-tea form drawn to matcha, calm attention, and considered ritual.', chaihare: 'A warming tea form drawn to chai, spice, aroma, and cups with character.', cocoabun: 'A comfort-first form drawn to cocoa, sweetness, softness, and cosy pauses.', frostaflop: 'A bright cold-coffee form drawn to iced drinks, frappes, and easy refreshment.', infusprig: 'A gentle infusion form drawn to herbal leaves, fruit flavours, and caffeine-free pauses.', zestlet: 'A fresh drink form drawn to smoothies, juice, vivid colour, and lively flavour.' },
});

const STEPPLING_PROFILE = profileGame({
  familyId: 'steppling', title: 'Find your route-side form', memoryKey: 'preference:steppling:form-match', entryQuestionId: 'route-rhythm',
  questions: [
    { id: 'route-rhythm', prompt: 'Which route rhythm feels most like you?', options: [profileOption('walk', 'An outdoor walk', 'The route can be useful, social, or surprising.', { steppling: 1, promenip: 1, metrostep: 1, wanderling: 1 }, 'everyday-route'), profileOption('run', 'A running rhythm', 'Momentum takes the lead.', { sprintail: 1, dashkit: 1, enduroo: 1 }, 'running-route'), profileOption('trail', 'A trail or trek', 'The ground gets a vote.', { peakle: 1, trekkin: 1, wanderling: 1 }, 'trail-route'), profileOption('indoor', 'A dependable indoor route', 'Weather does not get the final say.', { treadlet: 2 }, 'indoor-route')] },
    { id: 'everyday-route', prompt: 'What makes an everyday walk worth taking?', options: [profileOption('useful', 'It gets me somewhere', 'Movement fits inside ordinary life.', { steppling: 4 }, 'route-purpose'), profileOption('social', 'I can share the stroll', 'The route leaves room for company.', { promenip: 4 }, 'route-purpose'), profileOption('city', 'The city changes around me', 'Pavement, people, and useful detours.', { metrostep: 4 }, 'route-purpose'), profileOption('wander', 'I can follow what catches my eye', 'The route should reveal something.', { wanderling: 4 }, 'route-purpose')] },
    { id: 'running-route', prompt: 'What pulls you into a running rhythm?', options: [profileOption('flow', 'Finding a steady flow', 'The rhythm arrives and carries you.', { sprintail: 4 }, 'route-purpose'), profileOption('speed', 'Short speed and intervals', 'A quick effort with sharp edges.', { dashkit: 4 }, 'route-purpose'), profileOption('distance', 'Settling into a long run', 'Endurance grows one stretch at a time.', { enduroo: 4 }, 'route-purpose')] },
    { id: 'trail-route', prompt: 'What should the trail give you?', options: [profileOption('day-hike', 'Hills and an earned view', 'A route with texture and a destination.', { peakle: 4 }, 'route-purpose'), profileOption('long-trek', 'A long, demanding journey', 'The route becomes the day.', { trekkin: 4 }, 'route-purpose'), profileOption('trail-wander', 'Space to explore without a plan', 'Curiosity chooses the next turn.', { wanderling: 4 }, 'route-purpose')] },
    { id: 'indoor-route', prompt: 'What makes an indoor route work?', options: [profileOption('treadmill-steady', 'A steady treadmill rhythm', 'Simple, repeatable, and sheltered.', { treadlet: 4 }, 'route-purpose'), profileOption('treadmill-run', 'A controlled indoor run', 'Pace stays close and measurable.', { treadlet: 3, sprintail: 1 }, 'route-purpose'), profileOption('indoor-short', 'A short walk I can always access', 'Dependability matters more than scenery.', { treadlet: 3, steppling: 1 }, 'route-purpose')] },
    { id: 'route-purpose', prompt: 'Choose the best ending.', options: [profileOption('clearer', 'Coming back clearer', 'The route shifted your headspace.', { steppling: 2, wanderling: 1 }, null), profileOption('together', 'Glad I shared it', 'Company gave the route its shape.', { promenip: 2, metrostep: 1 }, null), profileOption('managed', 'Seeing what I managed', 'The effort became visible.', { sprintail: 1, dashkit: 1, enduroo: 1 }, null), profileOption('story', 'Returning with a story', 'The route revealed something.', { peakle: 1, trekkin: 2, wanderling: 1 }, null), profileOption('repeatable', 'Ready to do it again', 'A dependable route earns its place.', { treadlet: 2, metrostep: 1 }, null)] },
  ],
  descriptions: { steppling: 'An everyday route-maker who values useful walks, headspace, and nearby life.', sprintail: 'A rhythm-seeking running form drawn to steady pace, flow, and regular practice.', peakle: 'A day-hiking form drawn to hills, changing ground, and earned views.', promenip: 'A relaxed walking form drawn to shared strolls, scenery, and unhurried company.', metrostep: 'An urban route form drawn to city walking, commuting, pavement, and useful detours.', wanderling: 'A curious route form drawn to unplanned turns, photo walks, and noticing what appears.', dashkit: 'A quick running form drawn to sprints, intervals, speed, and compact challenges.', enduroo: 'An endurance form drawn to distance, sustained rhythm, and the long-run mindset.', trekkin: 'A long-trail form drawn to demanding terrain, backpacking, and journeys that fill the day.', treadlet: 'A dependable indoor form drawn to treadmills, controlled conditions, and repeatable routes.' },
});

const FLEXEL_PROFILE = profileGame({
  familyId: 'flexel', title: 'Find your movement-side form', memoryKey: 'preference:flexel:form-match', entryQuestionId: 'movement-world',
  questions: [
    { id: 'movement-world', prompt: 'Which movement world feels most like you?', options: [profileOption('strength', 'Strength, lifting, or controlled movement', 'Power can be built in different ways.', { flexel: 1, ironel: 1, flowlet: 1 }, 'strength-style'), profileOption('team-ball', 'A team ball sport', 'Shared decisions at speed.', { kickit: 1, hooplet: 1, scrumple: 1, volleyhop: 1 }, 'team-ball-style'), profileOption('bat-racket', 'A bat or racket sport', 'Timing turns effort into skill.', { serveling: 1, sluggeroo: 1 }, 'bat-racket-style'), profileOption('body-skill', 'Body skill, combat, or control', 'Technique lives in the whole body.', { tumblet: 1, dojoko: 1, flowlet: 1 }, 'body-skill-style'), profileOption('cardio', 'Cardio or endurance', 'Energy finds a repeatable rhythm.', { pedalop: 2, flexel: 1 }, 'cardio-style')] },
    { id: 'strength-style', prompt: 'What feels most satisfying in that space?', options: [profileOption('strong', 'Useful all-round strength', 'Each repetition has a job.', { flexel: 4 }, 'movement-finish'), profileOption('physique', 'Heavy lifting and building muscle', 'Visible power grows through patient work.', { ironel: 4 }, 'movement-finish'), profileOption('flow', 'Balance, mobility, and controlled flow', 'Precision can feel quiet and strong.', { flowlet: 4 }, 'movement-finish')] },
    { id: 'team-ball-style', prompt: 'Which kind of team play pulls you in?', options: [profileOption('football', 'Football', 'Space opens, closes, and opens again.', { kickit: 4 }, 'movement-finish'), profileOption('basketball', 'Basketball', 'Passing and quick court decisions.', { hooplet: 4 }, 'movement-finish'), profileOption('rugby', 'Rugby', 'Contact, support, and committed field play.', { scrumple: 4 }, 'movement-finish'), profileOption('volleyball', 'Volleyball', 'Timing, rotation, and keeping the rally alive.', { volleyhop: 4 }, 'movement-finish')] },
    { id: 'bat-racket-style', prompt: 'Which timing challenge sounds best?', options: [profileOption('racket', 'Rallies, serves, and racket play', 'Skill becomes a conversation.', { serveling: 4 }, 'movement-finish'), profileOption('baseball', 'Batting, throwing, and fielding', 'One clean moment can change the play.', { sluggeroo: 4 }, 'movement-finish')] },
    { id: 'body-skill-style', prompt: 'Which kind of body skill draws you in?', options: [profileOption('gymnastics', 'Gymnastics or acrobatics', 'Balance and bravery meet in motion.', { tumblet: 4 }, 'movement-finish'), profileOption('combat', 'Martial arts or boxing', 'Discipline sharpens every movement.', { dojoko: 4 }, 'movement-finish'), profileOption('control', 'Yoga, Pilates, or mobility', 'Control can be quiet and exact.', { flowlet: 4 }, 'movement-finish')] },
    { id: 'cardio-style', prompt: 'Which energy sounds best?', options: [profileOption('cycling', 'Cycling or spin', 'Cadence carries the effort forward.', { pedalop: 4 }, 'movement-finish'), profileOption('mixed', 'Mixed gym conditioning', 'Variety keeps the whole practice useful.', { flexel: 4 }, 'movement-finish'), profileOption('steady', 'A controlled, repeatable rhythm', 'Consistency matters more than spectacle.', { pedalop: 2, flexel: 2 }, 'movement-finish')] },
    { id: 'movement-finish', prompt: 'How do you want to feel afterward?', options: [profileOption('capable', 'Capable and grounded', 'Useful strength stays with you.', { flexel: 2, ironel: 1, flowlet: 1 }, null), profileOption('team', 'Part of a team effort', 'Shared play carried the work.', { kickit: 1, hooplet: 1, scrumple: 1, volleyhop: 1 }, null), profileOption('skilled', 'More precise than before', 'One detail became cleaner.', { serveling: 1, sluggeroo: 1, tumblet: 1, dojoko: 1 }, null), profileOption('charged', 'Charged with energy', 'The session lit something up.', { pedalop: 2, flexel: 1 }, null)] },
  ],
  descriptions: { flexel: 'A strong, adaptable practice form drawn to useful strength and all-round technique.', hooplet: 'A basketball form drawn to shared court play, quick decisions, and passing.', serveling: 'A racket-sport form drawn to focused skill, rallies, serves, and one-to-one play.', kickit: 'A football form drawn to space, teamwork, passing, and continuous field play.', sluggeroo: 'A baseball and softball form drawn to timing, batting, throwing, and field awareness.', scrumple: 'A rugby form drawn to contact, support, resilience, and committed team play.', ironel: 'A heavy-strength form drawn to bodybuilding, powerlifting, muscle, and patient progression.', tumblet: 'A gymnastics form drawn to balance, tumbling, acrobatics, and precise body control.', pedalop: 'A cycling form drawn to cadence, endurance, outdoor rides, and spin sessions.', dojoko: 'A combat-practice form drawn to martial arts, boxing, discipline, and deliberate technique.', volleyhop: 'A volleyball form drawn to timing, rotation, teamwork, and keeping the rally alive.', flowlet: 'A controlled-movement form drawn to yoga, Pilates, balance, mobility, and steady breath.' },
});

function familyPack(
  familyId: ConversationV2FamilyId,
  polls: readonly PollSeed[],
  profile: ConversationDefinition
): ConversationDefinition[] {
  return [
    ...openers(familyId),
    ...companionInsightConversationDefinitions.filter((definition) => definition.familyId === familyId),
    profile,
    goalStarter(familyId),
    smallStepOffer(familyId),
    questHandoff(familyId),
    ...journalSeeds(familyId).map(({ seed, routes }) => journalMemory(familyId, seed, routes)),
    ...debriefs(familyId),
    ...bonds(familyId),
    ...polls.map((seed, index) => poll(familyId, seed, index)),
  ];
}

export const companionConversationDefinitionsV2: readonly ConversationDefinition[] = [
  stepplingDayOneConversation,
  ...STEPPLING_TRAIL_CONVERSATIONS,
  ...mossproutFtueConversationDefinitions,
  ...mossproutCampaignConversationDefinitions,
  ...mossproutStoryConversationDefinitions,
  ...familyPack('baristabbit', BARISTA_POLLS, BARISTA_PROFILE),
  ...baristabbitStoryConversationDefinitions,
  ...journeyCohortStoryConversationDefinitions,
  ...familyPack('steppling', STEPPLING_POLLS, STEPPLING_PROFILE),
  ...familyPack('flexel', FLEXEL_POLLS, FLEXEL_PROFILE),
  ...authoredFamilyConversationDefinitions,
  feastleFirstMeetingConversationDefinition,
  ...feastleFriendshipConversationDefinitions,
];

export const companionConversationDefinitionById = new Map(
  companionConversationDefinitionsV2.map((definition) => [definition.id, definition])
);

export function companionConversationDefinitionsForFamily(familyId: string): readonly ConversationDefinition[] {
  return companionConversationDefinitionsV2.filter((definition) => definition.familyId === familyId);
}
