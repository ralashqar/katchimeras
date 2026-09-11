import type {
  ConversationDefinition,
  ConversationInsightResultDefinition,
  ConversationOption,
  ConversationProfileQuestion,
  ConversationV2FamilyId,
} from '@/types/companion-conversation';
import { spokenAnswerText } from '@/utils/companion-conversation';

type Answer = readonly [id: string, label: string, reply: string];
type Question = readonly [
  id: string,
  prompt: string,
  answers: readonly Answer[],
  promptByPriorOptionId?: Readonly<Record<string, string>>,
];
type Result = ConversationInsightResultDefinition;

const option = ([id, label, reply]: Answer): ConversationOption => {
  const spokenText = spokenAnswerText(label);
  return { id, label, reply, nextNodeId: null, ...(spokenText ? { spokenText } : {}) };
};
const question = ([id, prompt, answers, promptByPriorOptionId]: Question): ConversationProfileQuestion => ({
  id,
  prompt,
  options: answers.map(option),
  ...(promptByPriorOptionId ? { promptByPriorOptionId } : {}),
});

function insightGame(input: {
  familyId: ConversationV2FamilyId;
  id: string;
  title: string;
  category: string;
  tags: readonly string[];
  questions: readonly Question[];
  results: readonly Result[];
}): ConversationDefinition {
  return {
    id: `${input.familyId}:insight:${input.id}`,
    version: 4,
    familyId: input.familyId,
    title: input.title,
    trigger: 'signature_game',
    minimumBondLevel: 1,
    cooldownDays: 0,
    tags: ['play', ...input.tags],
    format: 'insight_game',
    entryNodeId: 'game',
    nodes: [
      { id: 'game', kind: 'insight_game', title: input.title, questions: input.questions.slice(0, 5).map(question), revealNodeId: 'reveal' },
      {
        id: 'reveal', kind: 'insight_reveal', title: 'What I learned about you',
        insightKey: input.id, category: input.category, results: input.results, nextNodeId: 'end',
      },
      { id: 'end', kind: 'end', message: 'That feels worth keeping. We can update it whenever you change.' },
    ],
  };
}

const baristaDrinkCompass = insightGame({
  familyId: 'baristabbit', id: 'drink-compass', title: 'Find your drink compass', category: 'Drinks', tags: ['preferences', 'ritual', 'novelty'],
  questions: [
    ['base', 'The whole menu is open. Where do your eyes go first?', [
      ['classic-base', 'Coffee in one of its many forms', 'A coffee answer, but with plenty of room inside it.'],
      ['gentle-base', 'Tea, chocolate, or something soothing', 'You are looking for the cup that softens the room.'],
      ['curious-base', 'Something seasonal or unfamiliar', 'You want the menu to contain a small surprise.'],
    ]],
    ['temperature', 'What makes the temperature feel right?', [
      ['classic-temp', 'Hot enough to mark a proper pause', 'The warmth is part of the punctuation.'],
      ['gentle-temp', 'Warm enough to hold for a while', 'The cup has a job before you even taste it.'],
      ['curious-temp', 'Cold, sparkling, or chosen by the weather', 'You let the day influence the drink.'],
    ]],
    ['flavour', 'Which flavour direction wins most often?', [
      ['classic-flavour', 'Clear, strong, and not too sweet', 'You like knowing exactly what the drink is.'],
      ['gentle-flavour', 'Soft, milky, mellow, or fragrant', 'Gentle edges matter more than impact.'],
      ['curious-flavour', 'Fruity, spiced, unusual, or playful', 'A drink can be a tiny expedition.'],
    ]],
    ['order', 'How do you feel when it is your turn to order?', [
      ['classic-order', 'Relieved when my usual is available', 'Reliability is doing real work for you.'],
      ['gentle-order', 'I choose what sounds kindest today', 'You order for the person you are in that moment.'],
      ['curious-order', 'Tempted by whatever I have not tried', 'The unknown item has excellent marketing.'],
    ]],
    ['finish', 'What should the last sip leave behind?', [
      ['classic-finish', 'A clean sense that the ritual is complete', 'A satisfying full stop.'],
      ['gentle-finish', 'A little more settled than before', 'The drink changed the temperature of the moment.'],
      ['curious-finish', 'A flavour or idea worth talking about', 'The cup should leave a story behind.'],
    ]],
  ],
  results: [
    { id: 'reliable-classic', title: 'The Reliable Classic', reflection: 'You do not choose the same drink from lack of imagination. You choose it because a trusted cup clears a small piece of the day.', summary: 'Your favourite drinks tend to be clear, dependable, and recognisably themselves. The ritual works best when ordering is effortless and the final sip feels like a clean full stop.', emblemId: 'barista-drink-compass-classic', matchOptionIds: ['classic-base', 'classic-temp', 'classic-flavour', 'classic-order', 'classic-finish'] },
    { id: 'soft-landing', title: 'The Soft Landing', reflection: 'Your best drink is less about impact and more about how gently it changes the room around you.', summary: 'You lean toward warm, mellow, or soothing drinks chosen for the moment you are actually having. Holding the cup, taking your time, and feeling more settled are part of the flavour.', emblemId: 'barista-drink-compass-soft', matchOptionIds: ['gentle-base', 'gentle-temp', 'gentle-flavour', 'gentle-order', 'gentle-finish'] },
    { id: 'curious-menu', title: 'The Curious Menu', reflection: 'For you, a drink can be a very small adventure: low stakes, sensory, and worth telling someone about afterward.', summary: 'Seasonal flavours, playful formats, and unfamiliar menu choices catch your attention. You enjoy letting weather and curiosity choose, especially when the result leaves a story.', emblemId: 'barista-drink-compass-curious', matchOptionIds: ['curious-base', 'curious-temp', 'curious-flavour', 'curious-order', 'curious-finish'] },
  ],
});

const baristaCupPurpose = insightGame({
  familyId: 'baristabbit', id: 'cup-purpose', title: 'What is the cup really for?', category: 'Rituals', tags: ['comfort', 'ritual'],
  questions: [
    ['moment', 'When does a drink matter most?', [['begin-moment', 'At the beginning of something', 'A small opening ceremony.'], ['restore-moment', 'When I need to come back to myself', 'A cup-sized place to land.'], ['connect-moment', 'When there is someone to share it with', 'The drink holds the conversation open.']]],
    ['attention', 'What happens to your attention after the first sip?', [['begin-attention', 'It knows what to do next', 'The day gains a direction.'], ['restore-attention', 'It stops scattering for a minute', 'The pause gathers you back together.'], ['connect-attention', 'It moves toward the person or place', 'The cup makes the moment easier to enter.']]],
    ['absence', 'If the drink disappeared from that moment, what would you miss?', [['begin-absence', 'The signal that I have started', 'The ritual is a threshold.'], ['restore-absence', 'The permission to stop', 'Without it, the day might keep rushing past.'], ['connect-absence', 'The excuse to stay and talk', 'A drink makes time feel shareable.']]],
    ['pace', 'How long should the good part last?', [['begin-pace', 'Long enough to get moving', 'A useful, contained beginning.'], ['restore-pace', 'Until I feel different', 'The clock is not the important measure.'], ['connect-pace', 'As long as the conversation needs', 'The cup can go cold; the company matters.']]],
    ['meaning', 'Finish the sentence: this cup helps me…', [['begin-meaning', 'Begin with intention', 'A gentle starting line.'], ['restore-meaning', 'Reset without disappearing', 'A small return rather than an escape.'], ['connect-meaning', 'Make ordinary time feel shared', 'The ritual turns company into an occasion.']]],
  ],
  results: [
    { id: 'opening-bell', title: 'The Opening Bell', reflection: 'Your drink is a beginning you can hold: a small ceremony that tells your attention where to go next.', summary: 'The cup matters most as a starting cue. You value a contained ritual that turns intention into motion without making the beginning feel harsh.', emblemId: 'barista-purpose-begin', matchOptionIds: ['begin-moment', 'begin-attention', 'begin-absence', 'begin-pace', 'begin-meaning'] },
    { id: 'returning-cup', title: 'The Returning Cup', reflection: 'Your drink gives you a way to pause without vanishing from the day. It gathers the scattered pieces back together.', summary: 'You use drink rituals as restoration: warmth, permission, and enough unclaimed time to feel different afterward. The effect matters more than the clock.', emblemId: 'barista-purpose-restore', matchOptionIds: ['restore-moment', 'restore-attention', 'restore-absence', 'restore-pace', 'restore-meaning'] },
    { id: 'shared-table', title: 'The Shared Table', reflection: 'For you, the drink is often the invitation rather than the event. Its real work is making ordinary time easier to share.', summary: 'Company and conversation give the cup its meaning. You value rituals that create an excuse to stay, listen, and let the moment take as long as it needs.', emblemId: 'barista-purpose-connect', matchOptionIds: ['connect-moment', 'connect-attention', 'connect-absence', 'connect-pace', 'connect-meaning'] },
  ],
});

const baristaSetting = insightGame({
  familyId: 'baristabbit', id: 'ideal-drink-setting', title: 'Build your ideal drink moment', category: 'Places', tags: ['social', 'ritual'],
  questions: [
    ['place', 'Choose the setting before the drink arrives.', [['nest-place', 'My own familiar corner', 'You already know where everything belongs.'], ['observe-place', 'A cafe window or busy counter', 'A front-row seat to ordinary life.'], ['share-place', 'A table with people I like', 'The place is really the company.']]],
    ['sound', 'What belongs in the background?', [['nest-sound', 'Quiet, weather, or familiar home sounds', 'Nothing competing for the moment.'], ['observe-sound', 'A little clatter and passing conversation', 'Enough life to watch without joining all of it.'], ['share-sound', 'One conversation I want to be in', 'The background becomes the foreground.']]],
    ['making', 'Who should make the drink?', [['nest-making', 'I like making it my way', 'The method is part of arriving.'], ['observe-making', 'Someone who knows their craft', 'You enjoy watching a small competence at work.'], ['share-making', 'Whoever lets us sit down together', 'Convenience protects the shared time.']]],
    ['time', 'Which stretch of time fits best?', [['nest-time', 'An unhurried private gap', 'A pocket of time with your name on it.'], ['observe-time', 'A pause while the world is moving', 'Stillness feels sharper beside motion.'], ['share-time', 'Long enough to lose track together', 'No one is checking the last sip.']]],
    ['detail', 'What makes you want to return?', [['nest-detail', 'Knowing exactly how it will feel', 'Familiarity becomes a form of care.'], ['observe-detail', 'Always noticing one new detail', 'The same seat never shows the same scene.'], ['share-detail', 'Remembering who was there', 'The place becomes a container for people.']]],
  ],
  results: [
    { id: 'private-nest', title: 'The Private Nest', reflection: 'Your ideal drink setting is a place that already knows you. Familiarity lets the ritual do its quiet work.', summary: 'You prefer control over the pace, method, and noise around a drink. A familiar corner and an unhurried private gap make the experience feel restorative rather than performative.', emblemId: 'barista-setting-nest', matchOptionIds: ['nest-place', 'nest-sound', 'nest-making', 'nest-time', 'nest-detail'] },
    { id: 'window-observer', title: 'The Window Observer', reflection: 'You like being still while the world remains interesting around you: present, observant, and not required to join every story.', summary: 'A cafe window, skilled making, and gentle background life create your ideal setting. You return for the mixture of familiarity and small new details.', emblemId: 'barista-setting-observer', matchOptionIds: ['observe-place', 'observe-sound', 'observe-making', 'observe-time', 'observe-detail'] },
    { id: 'company-table', title: 'The Company Table', reflection: 'Your favourite drink places are measured in people, not furniture. The cup simply keeps the shared moment open.', summary: 'You value settings where ordering is easy and conversation has room to stretch. What makes a place memorable is who sat across from you.', emblemId: 'barista-setting-shared', matchOptionIds: ['share-place', 'share-sound', 'share-making', 'share-time', 'share-detail'] },
  ],
});

function movementFlow(input: {
  familyId: 'steppling' | 'flexel'; id: string; title: string; category: string; tags: readonly string[];
  axis: readonly [string, string, string]; questions: readonly [string, string, readonly [string, string, string]][];
  summaries: readonly [string, string, string][];
}): ConversationDefinition {
  const prefix = input.id;
  const questions: Question[] = input.questions.map(([id, prompt, labels]) => [id, prompt, labels.map((labelsForAxis, axisIndex) => [
    `${prefix}-${id}-${axisIndex}`,
    labelsForAxis,
    axisIndex === 0 ? 'That gives the experience a dependable shape.' : axisIndex === 1 ? 'That changes what the moment is for.' : 'That leaves room for discovery.',
  ])]);
  const results = input.axis.map((axis, axisIndex): Result => ({
    id: `${prefix}-${axisIndex}`,
    title: axis,
    reflection: input.summaries[axisIndex]![1],
    summary: input.summaries[axisIndex]![2],
    emblemId: `${input.familyId}-${prefix}-${axisIndex}`,
    matchOptionIds: input.questions.map(([id]) => `${prefix}-${id}-${axisIndex}`),
  }));
  return insightGame({ familyId: input.familyId, id: input.id, title: input.title, category: input.category, tags: input.tags, questions, results });
}

function fourAxisFlow(input: {
  familyId: ConversationV2FamilyId;
  id: string;
  title: string;
  category: string;
  tags: readonly string[];
  axes: readonly [string, string, string, string];
  questions: readonly [string, string, readonly [readonly [string, string], readonly [string, string], readonly [string, string], readonly [string, string]]][];
  branchPrompts?: Readonly<Record<string, readonly [string, string, string, string]>>;
  summaries: readonly [readonly [string, string, string], readonly [string, string, string], readonly [string, string, string], readonly [string, string, string]];
}): ConversationDefinition {
  const questions: Question[] = input.questions.map(([questionId, prompt, answers], questionIndex) => {
    const priorQuestionId = input.questions[questionIndex - 1]?.[0];
    const branchPrompts = input.branchPrompts?.[questionId];
    const promptByPriorOptionId = priorQuestionId && branchPrompts
      ? Object.fromEntries(branchPrompts.map((branchPrompt, axisIndex) => [
          `${input.id}-${priorQuestionId}-${axisIndex}`,
          branchPrompt,
        ]))
      : undefined;
    return [
      questionId,
      prompt,
      answers.map(([label, reply], axisIndex) => [`${input.id}-${questionId}-${axisIndex}`, label, reply]),
      promptByPriorOptionId,
    ];
  });
  const results: Result[] = input.axes.map((title, axisIndex) => ({
    id: input.summaries[axisIndex]![0],
    title,
    reflection: input.summaries[axisIndex]![1],
    summary: input.summaries[axisIndex]![2],
    emblemId: `${input.familyId}-${input.id}-${axisIndex}`,
    matchOptionIds: input.questions.map(([questionId]) => `${input.id}-${questionId}-${axisIndex}`),
  }));
  return insightGame({
    familyId: input.familyId,
    id: input.id,
    title: input.title,
    category: input.category,
    tags: input.tags,
    questions,
    results,
  });
}

const baristaRitualRhythm = fourAxisFlow({
  familyId: 'baristabbit', id: 'ritual-rhythm', title: 'Discover your ritual rhythm', category: 'Rituals', tags: ['ritual', 'comfort', 'preferences'],
  axes: ['The Opening Cue', 'The Sensory Maker', 'The Protected Pause', 'The Flexible Companion'],
  branchPrompts: { missing: ['When the opening cue matters, which missing part would make the ritual feel incomplete?', 'When making draws you in, which missing part would flatten the experience?', 'When the pause is the point, what would you miss most?', 'When the ritual changes with the day, what still has to remain?'] },
  questions: [
    ['arrival', 'When does the ritual begin for you?', [['When I decide it is time', 'The decision itself creates a threshold.'], ['With the smell, sound, or first movement', 'Your senses enter the ritual before the cup is ready.'], ['When everything else finally stops', 'The protected space matters more than preparation.'], ['It depends on the day and who is there', 'Your ritual changes shape without losing its purpose.']]],
    ['missing', 'If one part disappeared, what would you miss most?', [['The signal that one part of the day has started', 'You would miss the clarity of a recognisable beginning.'], ['Making it in the particular way I like', 'The method carries attention and ownership.'], ['A few minutes that belong to nothing else', 'Unclaimed time is the rare ingredient.'], ['Having a drink that fits the actual moment', 'Responsiveness matters more than repeating one script.']]],
    ['object', 'How much do the cup and tools matter?', [['They help me recognise the routine', 'Familiar objects make the cue easier to trust.'], ['A great deal — handling them is part of the pleasure', 'The tactile details are central rather than decorative.'], ['Only if they help me slow down', 'Objects matter through the pace they create.'], ['I am happy to use whatever works here', 'The ritual travels because it is not tied to one setup.']]],
    ['pressure', 'What most easily spoils the moment?', [['Starting without feeling properly ready', 'A broken opening cue can make the ritual feel unfinished.'], ['Rushing or skipping the making', 'Speed removes the absorbing part you value.'], ['Doing something else at the same time', 'Divided attention erases the pause.'], ['Expecting the same ritual to work every day', 'Rigidity is the friction, not inconsistency.']]],
    ['proof', 'How do you know the ritual worked?', [['I know what comes next', 'The cup leaves you oriented.'], ['I enjoyed the making as much as the drink', 'Process and result both mattered.'], ['I feel more present than before', 'The real evidence is an internal change of pace.'], ['It met the need of that particular moment', 'Success is contextual rather than identical.']]],
  ],
  summaries: [
    ['opening-cue', 'Your ritual works as a threshold: a small dependable signal that helps attention cross into what comes next.', 'You value a recognisable beginning more than an elaborate method. Familiar timing and objects help the ritual orient you, and it feels complete when the next part of the day becomes clearer.'],
    ['sensory-maker', 'For you, making is not preparation for the ritual; it is the ritual.', 'Smell, sound, handling, and method hold your attention in a satisfying sequence. Rushing weakens the experience because the process carries as much meaning as the finished drink.'],
    ['protected-pause', 'The most valuable ingredient in your ritual is undivided time.', 'You use the cup to protect a small pause from competing demands. The ritual works when you feel more present afterward, even if the drink and method themselves are simple.'],
    ['flexible-companion', 'Your ritual stays meaningful because it can change with the day rather than demanding one perfect form.', 'You choose drinks, settings, and methods responsively. The consistent element is not the recipe but the way the ritual meets a real need in the moment.'],
  ],
});

const stepplingOutsideConditions = fourAxisFlow({
  familyId: 'steppling', id: 'outside-conditions', title: 'What makes movement possible?', category: 'Conditions', tags: ['route', 'pace', 'headspace', 'exploration'],
  axes: ['The Easy Doorway', 'The Useful Journey', 'The Shared Start', 'The Curiosity Spark'],
  branchPrompts: { 'bad-day': ['When an easy doorway usually helps, what could still work on a difficult day?', 'When usefulness gets you moving, what could still work on a difficult day?', 'When company helps you begin, what could still work on a difficult day?', 'When curiosity pulls you outside, what could still work on a difficult day?'] },
  questions: [
    ['begin', 'What most reliably gets you through the door?', [['Knowing the route can stay short and easy', 'Low friction gives the first step a fair chance.'], ['Having somewhere real to reach', 'A destination gives movement a practical reason.'], ['Knowing someone is coming too', 'Company carries some of the starting energy.'], ['Wondering what I might find outside', 'Curiosity makes leaving feel like discovery.']]],
    ['bad-day', 'On a difficult day, what still has a chance of working?', [['One very small loop with no performance target', 'The route survives because it asks almost nothing.'], ['Combining movement with something I already need to do', 'Usefulness protects it from becoming extra work.'], ['A low-pressure invitation from someone I trust', 'The relationship makes beginning gentler.'], ['One unfamiliar street, detail, or destination', 'A small unknown can still pull attention outward.']]],
    ['friction', 'Which obstacle matters most?', [['The route feels too long before I start', 'Anticipated scale can close the doorway.'], ['It feels disconnected from the rest of my day', 'Movement needs a legitimate place in ordinary life.'], ['I do not want to begin alone', 'Isolation changes the weight of the plan.'], ['Every available route feels too familiar', 'Repetition without discovery drains the invitation.']]],
    ['reward', 'What makes the effort feel worthwhile?', [['I began without a battle', 'Ease is evidence of good design, not low ambition.'], ['I arrived somewhere or completed something useful', 'Arrival gives the route a satisfying shape.'], ['We talked or shared the experience', 'The route matters through connection.'], ['I returned with a detail or story', 'Noticing turns distance into experience.']]],
    ['repeat', 'What would make you choose movement again soon?', [['Remembering how manageable it was', 'A gentle memory lowers the next doorway.'], ['Seeing where it naturally fits in the week', 'A practical slot makes repetition believable.'], ['Having another shared plan already forming', 'Future company creates momentum.'], ['Knowing the next route will not be identical', 'Variation keeps the invitation alive.']]],
  ],
  summaries: [
    ['easy-doorway', 'Your strongest movement condition is a beginning that does not require negotiation.', 'Short, pressure-free routes work because they remain possible on ordinary days. You value the evidence that movement can begin gently and still change the moment.'],
    ['useful-journey', 'Movement becomes sustainable when it belongs to real life instead of sitting beside it as another obligation.', 'Destinations, errands, and natural places in the week give your routes legitimacy. Usefulness does not diminish the experience; it is often what allows it to happen.'],
    ['shared-start', 'Company changes the weight of beginning for you.', 'A trusted person can make movement feel less isolated and more inviting. Conversation, shared plans, and gentle accountability are part of the route rather than optional extras.'],
    ['curiosity-spark', 'Curiosity is one of your most practical forms of motivation.', 'New details, small detours, and routes that might produce a story pull you outside. Repetition works best when it leaves a little room for discovery.'],
  ],
});

const flexelRecoveryLanguage = fourAxisFlow({
  familyId: 'flexel', id: 'recovery-language', title: 'Learn your recovery language', category: 'Recovery', tags: ['recovery', 'energy', 'practice'],
  axes: ['The Full Stop', 'The Gentle Reset', 'The Foundation Keeper', 'The Adaptive Listener'],
  branchPrompts: { best: ['When you need effort to end, which recovery choice gives the most back?', 'When your body wants something softer, which recovery choice gives the most back?', 'When the basics have slipped, which recovery choice gives the most back?', 'When today no longer matches the plan, which recovery choice gives the most back?'] },
  questions: [
    ['signal', 'What tells you recovery is needed?', [['I want effort to be completely over', 'The clearest need is a real ending.'], ['My body wants movement, but softer', 'Stillness is not always the most restorative answer.'], ['Sleep, food, or hydration has slipped', 'The basic foundation is asking to be noticed.'], ['Today feels different from the plan', 'Context is giving you information worth using.']]],
    ['best', 'Which recovery choice usually gives the most back?', [['Proper rest with no hidden workout', 'Rest works when it is not disguised productivity.'], ['Mobility, walking, or easy rhythmic movement', 'Gentle motion helps tension resolve.'], ['Eating, drinking, and protecting sleep', 'Unglamorous support creates future capacity.'], ['Choosing again after checking how I actually feel', 'Reassessment is part of the practice.']]],
    ['mistake', 'What most often makes recovery less useful?', [['Feeling that stopping has to be earned', 'Guilt prevents rest from becoming a true full stop.'], ['Turning gentle movement into another hard session', 'The reset disappears when intensity quietly returns.'], ['Looking for an advanced fix before the basics', 'Complexity can distract from the missing foundation.'], ['Following the schedule after its assumptions changed', 'Rigid loyalty can ignore better information.']]],
    ['return', 'What should recovery make possible?', [['Wanting to move again without resentment', 'A clean ending protects the next beginning.'], ['Feeling more comfortable and settled in my body', 'The immediate change is ease rather than performance.'], ['Having enough capacity for ordinary life', 'Training support is also life support.'], ['Returning with a plan that fits the new reality', 'Adaptation keeps continuity honest.']]],
    ['proof', 'How do you know you chose well?', [['I no longer feel chased by the previous session', 'The effort has genuinely released you.'], ['Tension or heaviness has shifted', 'Your body offers direct feedback.'], ['My energy is steadier across the next day', 'The foundation shows itself over time.'], ['I can explain why today needed a different choice', 'The adjustment is deliberate rather than accidental.']]],
  ],
  summaries: [
    ['full-stop', 'Your recovery begins when effort is allowed to end without negotiation.', 'You benefit from clear full stops that release the previous session instead of keeping it psychologically open. Rest protects your willingness to return because it is not treated as a reward you must earn.'],
    ['gentle-reset', 'Your body often recovers through softer movement rather than complete stillness.', 'Mobility, walking, and easy rhythm help tension change state. The important boundary is keeping the reset genuinely gentle instead of letting it become another session.'],
    ['foundation-keeper', 'Your most effective recovery tools are often the least theatrical.', 'Sleep, food, hydration, and ordinary capacity are the foundation you trust. You recognise that future movement depends on needs that matter well beyond training.'],
    ['adaptive-listener', 'For you, recovery is an act of interpretation.', 'You work best when the plan can respond to current energy and circumstances. Changing the choice is not abandoning the practice; it is how you keep the relationship honest.'],
  ],
});

/**
 * A scenario flow: five tiny situations, three ways to meet each, one axis per
 * way. The player answers a story, not a questionnaire; the result is what
 * their five instincts had in common.
 */
function scenarioFlow(input: {
  familyId: 'steppling' | 'flexel'; id: string; title: string; category: string; tags: readonly string[];
  axis: readonly [string, string, string];
  questions: readonly [id: string, prompt: string, answers: readonly [readonly [string, string], readonly [string, string], readonly [string, string]]][];
  summaries: readonly [readonly [string, string, string], readonly [string, string, string], readonly [string, string, string]];
}): ConversationDefinition {
  const questions: Question[] = input.questions.map(([id, prompt, answers]) => [id, prompt, answers.map(([label, reply], axisIndex) => [`${input.id}-${id}-${axisIndex}`, label, reply])]);
  const results = input.axis.map((axis, axisIndex): Result => ({
    id: input.summaries[axisIndex]![0],
    title: axis,
    reflection: input.summaries[axisIndex]![1],
    summary: input.summaries[axisIndex]![2],
    emblemId: `${input.familyId}-${input.id}-${axisIndex}`,
    matchOptionIds: input.questions.map(([id]) => `${input.id}-${id}-${axisIndex}`),
  }));
  return insightGame({ familyId: input.familyId, id: input.id, title: input.title, category: input.category, tags: input.tags, questions, results });
}

const stepplingFlows = [
  scenarioFlow({ familyId: 'steppling', id: 'setting-out', title: 'How you set out', category: 'Routes', tags: ['route', 'exploration'], axis: ['The Straight-In', 'The Look-First', 'The Bring-Someone'], questions: [
    ['path', 'A path off the trail isn’t on the map.', [['👀 I’m already halfway down it', 'Halfway down already. I’ll catch up.'], ['🧭 I check where it goes first', 'Check first, then go. That’s how you get back for tea.'], ['👥 Only if someone comes with me', 'Company makes a path braver.']]],
    ['box', 'A box on the trail, marked OPEN WHEN READY.', [['📦 Open it now', 'Open. Ready is a state of mind.'], ['👀 Shake it, weigh it, then decide', 'Science first. Then opening.'], ['👥 Ask who else has seen it', 'A box is more fun with witnesses.']]],
    ['circle', 'A map with one place circled and no explanation.', [['🏃 I go', 'You go. I’m lacing up.'], ['🔎 I find out what’s there first', 'Maps can lie. Worth a look before the walk.'], ['👥 I bring a friend', 'Circles are better shared.']]],
    ['stranger', 'A stranger says the best view is off the marked path.', [['🔥 I’m gone', 'Gone. Leave a note for the rest of us.'], ['🤔 I ask how far, and how safe', 'How far, how safe. Then probably gone.'], ['👯 I’d go if they came too', 'You’d go with a guide. Sensible and sociable.']]],
    ['fork', 'The trail forks. One way is signposted, one isn’t.', [['🌲 The unsigned one, obviously', 'Unsigned. Obviously.'], ['🪧 The signed one, then maybe the other', 'Signed first. The other one will keep.'], ['👣 Whichever the people ahead took', 'Follow the footprints. Paths are made by company.']]],
  ], summaries: [
    ['straight-in', 'You set out first and find out on the way.', 'Given a path, a box, or a circle on a map, your instinct is to move. You trust that the route will explain itself once you are on it, and it usually does. The thing to watch is only that you tell someone where you went.'],
    ['look-first', 'You like to know the ground before you give it your feet.', 'Curiosity is there every time, but it waits for a quick check first: how far, how safe, what is in the box. That is not hesitation. It is how you get to go more often and get home for tea.'],
    ['bring-someone', 'A path gets braver with company, and so do you.', 'You will take the unmapped path, the circled place, the stranger’s view. You would just rather not take them alone. Company is not a condition for you; it is what makes the going good.'],
  ] }),
  scenarioFlow({ familyId: 'steppling', id: 'free-day', title: 'What a free day is for', category: 'Wellbeing', tags: ['headspace', 'pace'], axis: ['The Quiet Corner', 'The Maker', 'The Wanderer'], questions: [
    ['first', 'A whole free day, nothing planned. First move?', [['🌿 Somewhere peaceful', 'Trees, no signal, snacks. I’ll come.'], ['🎨 The thing I’ve been meaning to make or do', 'The thing has been waiting. Good.'], ['🗺️ Somewhere I’ve never been', 'Somewhere new. Boots on.']]],
    ['room', 'A beautiful empty room. What goes in first?', [['🛋️ Somewhere comfortable', 'Comfort first. A room is for sitting in.'], ['🎨 Something that feels like me', 'Something that’s yours. Rooms should know who lives there.'], ['🪟 A window I can leave through', 'A window to leave through. That’s a walker’s room.']]],
    ['week', 'At the end of a really good week, what happened?', [['🌿 I actually felt calm', 'Calm. Your good weeks have air in them.'], ['✅ I made or finished something', 'Made or finished. Your good weeks have a shape.'], ['🎁 Something unexpected happened', 'Unexpected. Your good weeks have a twist.']]],
    ['full', 'You can keep one thing permanently full.', [['⏳ My free time', 'Free time. The rarest one.'], ['🔋 My energy for projects', 'Energy for projects. Enough for one more.'], ['🧠 My curiosity', 'Curiosity. Never runs out anyway, but nice.']]],
    ['hour', 'An hour appears in the middle of the day.', [['🛋️ I sit down properly', 'Sit down properly. An underrated skill.'], ['🔧 I pick up the thing I left half-done', 'Back to the half-done thing. It missed you.'], ['🚶 I go out and see what’s about', 'Out to see what’s about. Same.']]],
  ], summaries: [
    ['quiet-corner', 'Free time, for you, is for turning the volume down.', 'Given an empty day, a room, or an hour, you reach for peace first: comfort, quiet, a calmer week. That is not laziness. It is how you refill, and it is worth protecting from the things that would fill it for you.'],
    ['maker', 'A free hour is a workbench to you.', 'Space shows up and you fill it with the thing you have been meaning to make or finish. Your good weeks have a shape you built. The trick is remembering the walk in between, so the workbench does not become the whole day.'],
    ['wanderer', 'You spend free time finding out what is out there.', 'The empty day goes somewhere new, the room gets a window to leave through, the good week had a twist. Curiosity is your rest. Just keep a little of it back for the day after.'],
  ] }),
  scenarioFlow({ familyId: 'steppling', id: 'when-it-goes-wrong', title: 'When the plan goes wrong', category: 'Pace', tags: ['pace', 'challenge'], axis: ['The Other Way', 'The Slow Recovery', 'The Day-Taker'], questions: [
    ['closed', 'The route you wanted is closed.', [['🔧 Find another way', 'Another way. There’s always another way.'], ['😤 Be annoyed, then get over it', 'Annoyed, then fine. Honest.'], ['🌊 Shrug and see where the day goes', 'Shrug. Days have their own ideas.']]],
    ['behind', 'You’ve fallen behind on something important.', [['🌱 Just do one bit', 'One bit. That’s how everything gets done.'], ['💭 Sit with it a while first', 'Sit with it. Then a bit. That works too.'], ['🙈 Tomorrow-me can handle it', 'Tomorrow-you. Leave them a note.']]],
    ['cant', 'Someone says “You can’t do that.”', [['🧠 I start working out how', 'Figuring out how. Already.'], ['🤔 Maybe they have a point. I’ll think.', 'Maybe they’re right. Listening is underrated.'], ['🍃 Depends whether I cared', 'Depends if you cared. Not every hill.']]],
    ['rain', 'Rain, halfway out.', [['🧥 Coat on, keep going', 'Coat on. The view is still there.'], ['⛺ Shelter and wait it out', 'Shelter. Rain is a good excuse for a sit.'], ['💦 Get wet. It’s only water.', 'Only water. I like you.']]],
    ['bother', 'Which bothers you longer?', [['🔧 Not finding the workaround', 'The workaround you missed. It nags.'], ['🌀 How you felt in the moment', 'The feeling. It fades slower than the rain.'], ['🍃 Neither, for long', 'Neither, for long. Enviable.']]],
  ], summaries: [
    ['other-way', 'A closed route is a puzzle to you, not a verdict.', 'When the plan breaks, you look for the other way through: one bit now, a workaround, a coat. Setbacks cost you time, not confidence. What lingers is a fix you did not find, so it is worth noticing when there was not one to find.'],
    ['slow-recovery', 'You feel the setback first, then you move.', 'Annoyance, a sit, a think: you let the moment land before you answer it. That is not weakness. It is honesty, and it means the recovery, when it comes, is real. The one thing to watch is the sitting turning into staying.'],
    ['day-taker', 'When the plan goes, you let the day have its say.', 'Closed route, rain, someone doubting you: you shrug and see where it goes. Very little sticks to you. Just make sure tomorrow-you gets the note, and that the shrug is a choice and not a habit of not caring.'],
  ] }),
];

const flexelFlows = [
  movementFlow({ familyId: 'flexel', id: 'movement-motive', title: 'Find your movement motive', category: 'Motivation', tags: ['energy', 'strength'], axis: ['The Capability Builder', 'The Play Seeker', 'The Energy Shifter'], questions: [
    ['pull', 'What makes a session worth beginning?', ['Becoming more capable', 'Getting to play or practise a skill', 'Changing how I feel']],
    ['progress', 'Which progress do you trust most?', ['Something feels stronger or cleaner', 'A move begins to click in real time', 'My energy is different afterward']],
    ['hard', 'When effort gets hard, what keeps you there?', ['Knowing the work is useful', 'The challenge stays interesting', 'The rhythm carries me']],
    ['miss', 'What do you miss when movement disappears?', ['Feeling physically prepared', 'Having a place for play', 'The shift in mood and momentum']],
    ['finish', 'What should a good session say?', ['I can do more than before', 'I got to be fully in the game', 'I changed the charge of the day']],
  ], summaries: [
    ['capability', 'You are motivated by useful evidence: steadier form, more strength, and a body that feels prepared for real life.', 'Capability is your strongest movement reward. You value sessions whose purpose is legible and whose progress appears in what you can do, not merely in completed minutes.'],
    ['play', 'Effort holds your attention when it becomes a live problem to solve rather than a list to finish.', 'Skill, play, and immediate feedback keep movement interesting for you. You are most engaged when practice feels like participation rather than maintenance.'],
    ['energy', 'You use movement to change the internal weather of a day. Rhythm matters because it carries you somewhere emotionally different.', 'Mood and energy shifts are central to your motivation. You value movement that creates momentum and leaves a noticeable charge after the session ends.'],
  ] }),
  movementFlow({ familyId: 'flexel', id: 'practice-style', title: 'Discover your practice style', category: 'Practice', tags: ['practice', 'sport'], axis: ['The Quiet Craftsperson', 'The Responsive Player', 'The Shared-Momentum Teammate'], questions: [
    ['room', 'Where does attention work best?', ['In my own focused space', 'Where I can react to a live challenge', 'Where other people bring energy']],
    ['plan', 'How much structure helps?', ['A clear sequence I can refine', 'Enough rules to create interesting choices', 'A shared plan everyone can adapt']],
    ['feedback', 'Which feedback lands?', ['Feeling the movement become cleaner', 'Seeing the immediate result of a decision', 'Sensing the group click together']],
    ['repeat', 'What makes repetition bearable?', ['Tiny technical improvements', 'Variation inside the same skill', 'Doing it alongside other people']],
    ['return', 'Why return next time?', ['To keep building the craft', 'To meet a new version of the challenge', 'Because people expect and encourage me']],
  ], summaries: [
    ['craft', 'You practise best when attention can narrow and small technical changes become visible.', 'Focused solo structure suits your practice style. You enjoy refining a movement, noticing clean execution, and returning because the craft still has another layer.'],
    ['responsive', 'You learn through exchange: reading what happens, choosing, and receiving an immediate answer from the game.', 'Live challenges and varied repetition keep your practice awake. You prefer enough structure to create decisions, with feedback that arrives in the movement itself.'],
    ['team', 'Other people do more than accompany your practice; they create its momentum, meaning, and accountability.', 'Shared plans, group energy, and the feeling of clicking together suit you. You return partly for the movement and partly because practice belongs to a small community.'],
  ] }),
  movementFlow({ familyId: 'flexel', id: 'effort-rhythm', title: 'Find your effort rhythm', category: 'Recovery', tags: ['recovery', 'practice'], axis: ['The Consistent Builder', 'The Deep-Dive Mover', 'The Adaptive Listener'], questions: [
    ['start', 'What makes beginning realistic?', ['A repeatable time and modest plan', 'Enough time to get fully absorbed', 'Permission to choose based on today']],
    ['load', 'Which effort feels satisfying?', ['Manageable work I can repeat', 'A demanding session with real depth', 'The right amount for my current energy']],
    ['schedule', 'What should a week of movement look like?', ['Several dependable touchpoints', 'A few substantial sessions', 'Different shapes depending on life']],
    ['recovery', 'How does recovery belong?', ['Built into the routine', 'Earned after a deep effort', 'Used as information for the next choice']],
    ['success', 'What proves the rhythm works?', ['I keep returning', 'I leave knowing I went deep', 'I can adapt without abandoning myself']],
  ], summaries: [
    ['consistent', 'Your strongest rhythm is repeatable rather than dramatic. Returning is the achievement that makes every other gain possible.', 'Modest plans, built-in recovery, and several dependable touchpoints suit you. You trust consistency because it survives ordinary weeks.'],
    ['deep', 'You enjoy giving effort enough room to become immersive. Depth makes the session feel distinct from the rest of the day.', 'Substantial sessions and demanding but contained effort suit your rhythm. Recovery feels meaningful when it follows work that absorbed you fully.'],
    ['adaptive', 'Your rhythm works when it can listen. Adjusting the plan is part of staying committed, not evidence that commitment failed.', 'You prefer choosing effort in response to real energy and circumstances. Success means adapting without abandoning the relationship with movement.'],
  ] }),
];

export const companionInsightConversationDefinitions: readonly ConversationDefinition[] = [
  baristaDrinkCompass,
  baristaCupPurpose,
  baristaSetting,
  baristaRitualRhythm,
  ...stepplingFlows,
  stepplingOutsideConditions,
  ...flexelFlows,
  flexelRecoveryLanguage,
];
