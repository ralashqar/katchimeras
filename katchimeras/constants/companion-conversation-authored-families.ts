import { quickGoalTemplatesForFamily } from '@/constants/companion-quick-goals';
import { katchimeraFamilyById, katchimeraSkinById } from '@/constants/katchimera-skins';
import { katchimeraRoleByFamilyId } from '@/constants/katchimera-roles';
import type {
  ConversationDefinition,
  ConversationInsightResultDefinition,
  ConversationProfileQuestion,
  ConversationV2FamilyId,
} from '@/types/companion-conversation';

export type ConversationTopic = { id: string; label: string };

export type AuthoredFamilyConversationManifest = {
  familyId: Exclude<ConversationV2FamilyId, 'baristabbit' | 'steppling' | 'flexel'>;
  subject: string;
  openingLine: string;
  journalRouteKeys: readonly string[];
  safetyNote?: string;
};

const manifest = (
  familyId: AuthoredFamilyConversationManifest['familyId'],
  subject: string,
  openingLine: string,
  journalRouteKeys: readonly string[],
  safetyNote?: string
): AuthoredFamilyConversationManifest => ({ familyId, subject, openingLine, journalRouteKeys, safetyNote });

/**
 * The pilots keep their hand-authored packs. These manifests are the complete
 * data-only rollout for every other durable family. They intentionally contain
 * no image references: runtime activation is a separate art-readiness gate.
 */
export const authoredFamilyConversationManifests = [
  manifest('feastle', 'food and cooking', 'Something good can begin with one manageable bite.', ['food.meal', 'food.cooking', 'food.snack', 'food.dessert', 'went_somewhere.restaurant']),
  manifest('bedrotte', 'rest and home comfort', 'Rest does not have to earn its place here.', ['people.solo'], 'Keep sleep support non-medical and free from promises.'),
  manifest('dawnle', 'mornings', 'Let us make the beginning kinder, not stricter.', ['food.meal', 'people.solo']),
  manifest('mendle', 'emotional recovery', 'We can notice what is here without turning it into a diagnosis.', ['people.solo', 'reflection.moment'], 'Never diagnose, score wellbeing, or present the companion as therapy.'),
  manifest('gatherglow', 'friendship and belonging', 'Connection can start with one honest, low-pressure opening.', ['people.friends', 'people.group', 'people.someone_new']),
  manifest('heartmote', 'close relationships', 'Care is often clearest in small, specific moments.', ['people.partner', 'people.someone_else'], 'Avoid blame, relationship diagnosis, and assumptions about relationship structure.'),
  manifest('kindling', 'community and contribution', 'Helping works best when it is freely chosen and sustainable.', ['people.group', 'people.someone_new']),
  manifest('snuglet', 'parenting and caregiving', 'The person giving care still belongs in the picture.', ['people.family', 'people.my_child'], 'Do not assume ages, family structure, or unlimited caregiver capacity.'),
  manifest('waglet', 'pet companionship', 'The quiet routines are part of the friendship too.', ['people.pet'], 'Keep animal guidance observational and non-medical.'),
  manifest('tasklet', 'work and focus', 'Useful work needs a clear doorway and a fair ending.', ['work.focus', 'work.office', 'work.creative', 'work.progress']),
  manifest('errandimp', 'life admin and home care', 'One closed loop can make the whole room feel lighter.', ['work.admin', 'work.home_tasks', 'movement.errands', 'work.planning']),
  manifest('pagelet', 'reading, learning and reflection', 'A good question is already a place to begin.', ['work.learning', 'people.solo']),
  manifest('relicoon', 'museums and cultural stories', 'Every object has a door hidden somewhere in it.', ['went_somewhere.museum', 'work.learning']),
  manifest('museling', 'creativity and making', 'A small made thing counts before anyone sees it.', ['work.creative', 'work.progress']),
  manifest('encora', 'music', 'One sound can change the shape of a moment.', ['work.creative', 'people.group']),
  manifest('flickerbun', 'film and television', 'Let us keep the part that stayed after the credits.', ['people.solo', 'people.friends']),
  manifest('pixooka', 'games and play', 'Play can be chosen, absorbing, and finished well.', ['people.solo', 'people.friends', 'people.group']),
  manifest('mossprout', 'nature and weather', 'The world nearby is always changing one detail at a time.', ['went_somewhere.forest', 'movement.walk']),
  manifest('shellio', 'water and the shore', 'Being near water counts even when swimming is not the plan.', ['movement.mixed', 'went_somewhere.other_place'], 'Keep every water action explicitly safe, supported, and capacity-aware.'),
  manifest('skylo', 'city and neighbourhood discovery', 'A familiar street can still reveal a new route.', ['movement.commute', 'movement.walk', 'went_somewhere.other_place']),
  manifest('voyagle', 'travel', 'A journey begins before departure and continues after returning.', ['went_somewhere.travel', 'movement.travel']),
  manifest('cheerlet', 'milestones and life chapters', 'Progress deserves a shape that feels true to the moment.', ['people.group', 'people.family', 'reflection.moment']),
] as const satisfies readonly AuthoredFamilyConversationManifest[];

const endNode = (message: string) => ({ id: 'end', kind: 'end' as const, message });

function familyData(manifestValue: AuthoredFamilyConversationManifest) {
  const family = katchimeraFamilyById.get(manifestValue.familyId);
  if (!family) throw new Error(`Missing family data for ${manifestValue.familyId}`);
  const skins = family.skinIds.map((id) => katchimeraSkinById.get(id)).filter((skin): skin is NonNullable<typeof skin> => Boolean(skin));
  if (skins.length < 6) throw new Error(`${family.id} needs at least six authored forms`);
  return { family, skins };
}

function topicsFor(manifestValue: AuthoredFamilyConversationManifest): readonly ConversationTopic[] {
  const { family } = familyData(manifestValue);
  const laneTopics = family.focusLanes.slice(0, 5).map(({ id, label }) => ({ id, label }));
  const fillers: ConversationTopic[] = [
    { id: 'preferences', label: 'Your preferences' },
    { id: 'reflection', label: 'A small reflection' },
  ];
  const utility: ConversationTopic[] = [
    { id: 'play', label: 'Quick game' },
    { id: 'goals', label: 'Goals & small steps' },
    { id: 'memory', label: 'Shared memories' },
  ];
  const primary = [...laneTopics, ...fillers]
    .filter((topic, index, all) => all.findIndex((candidate) => candidate.id === topic.id) === index)
    .slice(0, 5);
  return [...primary, ...utility];
}

export const authoredConversationTopics = Object.fromEntries(
  authoredFamilyConversationManifests.map((item) => [item.familyId, topicsFor(item)])
) as Readonly<Partial<Record<ConversationV2FamilyId, readonly ConversationTopic[]>>>;

function profileGame(manifestValue: AuthoredFamilyConversationManifest): ConversationDefinition {
  const { family, skins } = familyData(manifestValue);
  const groups = [0, 1, 2].map((groupIndex) => skins.filter((_, index) => index % 3 === groupIndex));
  const groupLabels = groups.map((group) => group
    .slice(0, 2)
    .map((skin) => skin.hatchCues[0] ?? skin.displayName)
    .join(' / '));
  const questions: ConversationProfileQuestion[] = [
    {
      id: 'direction',
      prompt: `Which side of ${manifestValue.subject} feels closest to you?`,
      options: groups.map((group, index) => ({
        id: `direction-${index + 1}`,
        label: groupLabels[index] ?? `Direction ${index + 1}`,
        reply: `That gives us a clear ${manifestValue.subject} direction.`,
        nextNodeId: null,
        nextQuestionId: `forms-${index + 1}`,
        affinity: Object.fromEntries(group.map((skin) => [skin.id, 1])),
      })),
    },
    ...groups.map((group, groupIndex): ConversationProfileQuestion => ({
      id: `forms-${groupIndex + 1}`,
      prompt: 'Which specific version sounds most naturally yours?',
      options: group.map((skin) => ({
        id: `form-${skin.id}`,
        label: skin.hatchCues[0] ?? skin.displayName,
        reply: `${skin.displayName} is listening closely.`,
        nextNodeId: null,
        nextQuestionId: 'finish',
        affinity: { [skin.id]: 5 },
      })),
    })),
    {
      id: 'finish',
      prompt: 'What should this part of life give back?',
      options: [
        { id: 'finish-ease', label: 'More ease', reply: 'A form that lowers the doorway.', nextNodeId: null, nextQuestionId: null, affinity: Object.fromEntries(skins.filter((_, index) => index % 3 === 0).map((skin) => [skin.id, 1])) },
        { id: 'finish-interest', label: 'More interest', reply: 'A form that keeps curiosity awake.', nextNodeId: null, nextQuestionId: null, affinity: Object.fromEntries(skins.filter((_, index) => index % 3 === 1).map((skin) => [skin.id, 1])) },
        { id: 'finish-connection', label: 'More connection', reply: 'A form that makes the experience feel shared.', nextNodeId: null, nextQuestionId: null, affinity: Object.fromEntries(skins.filter((_, index) => index % 3 === 2).map((skin) => [skin.id, 1])) },
      ],
    },
  ];
  const descriptions = Object.fromEntries(skins.map((skin) => [
    skin.id,
    `${skin.displayName} is drawn to ${skin.hatchCues.slice(0, 3).join(', ')}. It reflects a preference, not a permanent label.`,
  ]));
  return {
    id: `${family.id}:game:form-finder`, version: 4, familyId: family.id as ConversationV2FamilyId,
    title: `Find your ${family.displayName} form`, trigger: 'signature_game', minimumBondLevel: 1,
    cooldownDays: 90, tags: ['play', 'forms'], format: 'profile_game', entryNodeId: 'game',
    nodes: [
      { id: 'game', kind: 'profile_game', title: `Find your ${family.displayName} form`, entryQuestionId: 'direction', questions, revealNodeId: 'reveal' },
      { id: 'reveal', kind: 'form_reveal', title: 'Your closest form right now', descriptions, memoryKey: `preference:${family.id}:form-match`, nextNodeId: 'end' },
      endNode('A match can change as your life changes.'),
    ],
  };
}

function insightGames(manifestValue: AuthoredFamilyConversationManifest): ConversationDefinition[] {
  const { family } = familyData(manifestValue);
  const axes = [0, 1, 2].map((index) => family.focusLanes[index % family.focusLanes.length]!);
  const games = [
    ['instinct', `Find your ${manifestValue.subject} instinct`, 'Preferences'],
    ['gift', `What should ${manifestValue.subject} give you?`, 'Meaning'],
    ['rhythm', `Discover your ${manifestValue.subject} rhythm`, 'Rhythm'],
    ['conditions', `What keeps ${manifestValue.subject} realistic?`, 'Conditions'],
  ] as const;
  const questionFrames = [
    'Which beginning feels most inviting?',
    'What keeps your attention there?',
    'What usually makes the experience worthwhile?',
    'When capacity changes, what should remain?',
    'Which ending would make you want to return?',
  ];
  return games.map(([gameId, title, category], gameIndex): ConversationDefinition => {
    const questions: ConversationProfileQuestion[] = questionFrames.map((prompt, questionIndex) => ({
      id: `q-${questionIndex + 1}`,
      prompt: gameIndex === 3 && questionIndex === 3
        ? 'What adaptation would keep this fair on a difficult day?'
        : prompt,
      options: axes.map((axis, axisIndex) => ({
        id: `${gameId}-q${questionIndex + 1}-${axisIndex + 1}`,
        label: questionIndex === 0 ? axis.label : `${axis.label}: ${axis.description}`,
        reply: axis.description,
        nextNodeId: null,
      })),
    }));
    const results: ConversationInsightResultDefinition[] = axes.map((axis, axisIndex) => ({
      id: `${gameId}-${axis.id}`,
      title: `The ${axis.label} Thread`,
      reflection: `Your answers keep returning to ${axis.label.toLowerCase()}. ${axis.description}`,
      summary: `In ${manifestValue.subject}, you currently value ${axis.label.toLowerCase()}. This is a useful preference to design around, not a score or fixed identity.`,
      emblemId: `${family.id}-${gameId}-${axisIndex + 1}`,
      matchOptionIds: questions.map((question) => question.options[axisIndex]!.id),
    }));
    return {
      id: `${family.id}:insight:${gameId}`, version: 4, familyId: family.id as ConversationV2FamilyId,
      title, trigger: 'signature_game', minimumBondLevel: 1, cooldownDays: 0,
      tags: ['play', ...topicsFor(manifestValue).filter((topic) => !['play', 'goals', 'memory'].includes(topic.id)).map((topic) => topic.id)], format: 'insight_game', entryNodeId: 'game',
      nodes: [
        { id: 'game', kind: 'insight_game', title, questions, revealNodeId: 'reveal' },
        { id: 'reveal', kind: 'insight_reveal', title: 'What I learned about you', insightKey: `${family.id}-${gameId}`, category, results, nextNodeId: 'end' },
        endNode('That insight is saved as a current preference, and it can change.'),
      ],
    };
  });
}

function openers(manifestValue: AuthoredFamilyConversationManifest): ConversationDefinition[] {
  const topics = topicsFor(manifestValue);
  const talkTopics = topics.filter((topic) => !['play', 'goals', 'memory'].includes(topic.id));
  const prompts = [
    manifestValue.openingLine,
    `Where should we begin with ${manifestValue.subject}?`,
    `I have one curious question about ${manifestValue.subject}. Choose the direction.`,
    `No score today. What part of ${manifestValue.subject} sounds useful?`,
    `We can keep this light or make one small plan. Where first?`,
    `What has your attention in ${manifestValue.subject} right now?`,
    `Choose the thread that fits the day you are actually having.`,
    `One conversational lap, then you decide whether to continue.`,
  ];
  return prompts.map((prompt, index) => {
    const first = talkTopics[index % talkTopics.length]!;
    const second = talkTopics[(index + 1) % talkTopics.length]!;
    return {
      id: `${manifestValue.familyId}:opener:${index + 1}`, version: 1, familyId: manifestValue.familyId,
      title: prompt, trigger: 'evergreen', minimumBondLevel: 1, cooldownDays: 0,
      tags: ['opener'], isOpener: true, format: 'opener', weight: 1, entryNodeId: 'opening',
      nodes: [{ id: 'opening', kind: 'choice', phase: 'opening', prompt, options: [
        { id: first.id, label: first.label, reply: `Let us follow the ${first.label.toLowerCase()} thread.`, nextNodeId: 'end', transition: { kind: 'pool', poolId: first.id } },
        { id: second.id, label: second.label, reply: `Good choice. ${second.label} it is.`, nextNodeId: 'end', transition: { kind: 'pool', poolId: second.id } },
        { id: 'play', label: 'Quick game', reply: 'Quick answers, no pressure.', nextNodeId: 'end', transition: { kind: 'pool', poolId: 'play' } },
      ] }, endNode('We can choose another thread whenever you like.')],
    };
  });
}

function goalDefinitions(manifestValue: AuthoredFamilyConversationManifest): ConversationDefinition[] {
  const { family } = familyData(manifestValue);
  const allTemplates = quickGoalTemplatesForFamily(family.id);
  const canonical = allTemplates.filter((item) => item.id.startsWith(`${family.id}:`)).slice(0, 8);
  const templates = canonical.length >= 3 ? canonical : allTemplates.slice(0, 8);
  if (templates.length < 3) throw new Error(`${family.id} needs at least three quick goals`);
  const ids = templates.map((item) => item.id);
  const firstThree = templates.slice(0, 3);
  const roleQuestIds = katchimeraRoleByFamilyId.get(family.id)?.realLifeQuestIds.slice(0, 2) ?? [];
  const goal: ConversationDefinition = {
    id: `${family.id}:conversation:goal-discovery`, version: 4, familyId: manifestValue.familyId,
    title: `Shape a ${manifestValue.subject} goal that fits`, trigger: 'evergreen', minimumBondLevel: 2,
    cooldownDays: 0, tags: ['goals'], format: 'outcome', entryNodeId: 'direction',
    nodes: [
      { id: 'direction', kind: 'choice', phase: 'opening', prompt: `What would you most like ${manifestValue.subject} to give you?`, options: [
        { id: 'ease', label: 'More ease', reply: 'Then the doorway matters more than ambition.', nextNodeId: 'context' },
        { id: 'interest', label: 'More interest', reply: 'Curiosity can carry the effort.', nextNodeId: 'context' },
        { id: 'connection', label: 'More connection', reply: 'The experience can have a shared shape.', nextNodeId: 'context' },
        { id: 'progress', label: 'Visible progress', reply: 'Then the evidence should stay personal and concrete.', nextNodeId: 'context' },
      ] },
      { id: 'context', kind: 'choice', phase: 'deepen', prompt: 'What most often gets in the way?', options: [
        { id: 'time', label: 'Time or access', reply: 'The plan needs a smaller valid version.', nextNodeId: 'friction' },
        { id: 'energy', label: 'Changing energy', reply: 'Adaptation belongs inside the goal.', nextNodeId: 'friction' },
        { id: 'choice', label: 'Too many choices', reply: 'One clear next action can help.', nextNodeId: 'friction' },
        { id: 'pressure', label: 'It starts feeling like pressure', reply: 'The goal should protect choice rather than manufacture guilt.', nextNodeId: 'friction' },
      ] },
      { id: 'friction', kind: 'choice', phase: 'deepen', prompt: 'What would make the next attempt feel more honest?', options: [
        { id: 'smaller', label: 'A genuinely smaller version', reply: 'Small enough to begin remains real.', nextNodeId: 'shape' },
        { id: 'clearer', label: 'One clearer decision', reply: 'Clarity can remove unnecessary negotiation.', nextNodeId: 'shape' },
        { id: 'flexible', label: 'More than one valid version', reply: 'Capacity can change without cancelling the goal.', nextNodeId: 'shape' },
        { id: 'supported', label: 'Some company or support', reply: 'Support can change the weight of starting.', nextNodeId: 'shape' },
      ] },
      { id: 'shape', kind: 'choice', phase: 'resolve', prompt: 'Which shape feels fairest this week?', options: [
        { id: 'single', label: 'One contained action', reply: 'One complete moment is enough to test the idea.', nextNodeId: 'goal-1' },
        { id: 'cue', label: 'Attach it to a familiar cue', reply: 'Let something existing carry the reminder.', nextNodeId: 'goal-2' },
        { id: 'shared', label: 'Try it with support', reply: 'Company can lower the doorway.', nextNodeId: 'goal-3' },
        { id: 'adaptive', label: 'Keep two valid sizes', reply: 'A smaller version can preserve continuity.', nextNodeId: 'goal-4' },
      ] },
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `goal-${index + 1}`,
        kind: 'goal_proposal' as const,
        prompt: 'Here is a direction based on the whole thread.',
        goalTypeId: `${family.id}-direction`,
        goalTitle: `Build a fair ${manifestValue.subject} rhythm`,
        summary: `${manifestValue.openingLine} Start with the shape you chose and keep adaptation valid.`,
        suggestedQuickGoalIds: [ids[(index * 2) % ids.length]!, ids[(index * 2 + 1) % ids.length]!],
        nextNodeId: 'end',
      })),
      endNode('You can keep it, adjust it, or leave it here.'),
    ],
  };
  const small: ConversationDefinition = {
    id: `${family.id}:conversation:small-step`, version: 2, familyId: manifestValue.familyId,
    title: `Choose one small ${manifestValue.subject} step`, trigger: 'evergreen', minimumBondLevel: 1,
    cooldownDays: 0, tags: ['goals'], format: 'outcome', entryNodeId: 'choose',
    nodes: [
      { id: 'choose', kind: 'choice', phase: 'resolve', prompt: 'Would one concrete action help more than another big idea?', options: firstThree.map((item, index) => ({ id: `choice-${index + 1}`, label: item.title, reply: 'Small and real is enough.', nextNodeId: `task-${index + 1}` })) },
      ...firstThree.map((item, index) => ({ id: `task-${index + 1}`, kind: 'quick_goal_proposal' as const, prompt: 'Add this as a small task?', templateId: item.id, title: item.title, nextNodeId: 'end' })),
      endNode('The task is optional. The conversation still counts.'),
    ],
  };
  const quest: ConversationDefinition = {
    id: `${family.id}:conversation:quest-handoff`, version: 3, familyId: manifestValue.familyId,
    title: `Turn this ${manifestValue.subject} thread into an optional adventure`, trigger: 'evergreen', minimumBondLevel: 1,
    cooldownDays: 0, tags: ['reflection'], format: 'outcome', entryNodeId: 'question',
    nodes: [
      { id: 'question', kind: 'choice', phase: 'explore', prompt: `What would make ${manifestValue.subject} feel worthwhile today?`, options: [
        { id: 'notice', label: 'Noticing one detail', reply: 'Attention can be the whole result.', nextNodeId: 'handoff' },
        { id: 'try', label: 'Trying one small thing', reply: 'A small experiment keeps the stakes fair.', nextNodeId: 'handoff' },
        { id: 'share', label: 'Sharing the moment', reply: 'Company can give it a natural shape.', nextNodeId: 'handoff' },
      ] },
      { id: 'handoff', kind: 'quest_handoff', prompt: 'Choose an adventure only if it fits today.', suggestedQuestIds: roleQuestIds, fallbackNodeId: 'fallback', nextNodeId: 'end' },
      { id: 'fallback', kind: 'goal_proposal', prompt: 'No matching adventure is available, so here is a smaller option.', goalTypeId: `${family.id}-direction`, goalTitle: `Take one ${manifestValue.subject} step`, suggestedQuickGoalIds: firstThree.map((item) => item.id), nextNodeId: 'end' },
      endNode('Leaving the adventure for another day is valid too.'),
    ],
  };
  return [goal, small, quest];
}

function journalThreads(manifestValue: AuthoredFamilyConversationManifest): ConversationDefinition[] {
  const topics = topicsFor(manifestValue).filter((topic) => !['play', 'goals', 'memory'].includes(topic.id));
  return Array.from({ length: 6 }, (_, index): ConversationDefinition => {
    const topic = topics[index % topics.length]!;
    const prompt = `You recorded a ${manifestValue.subject} moment. What made the ${topic.label.toLowerCase()} part worth noticing?`;
    return {
      id: `${manifestValue.familyId}:conversation:journal-${index + 1}`, version: 4, familyId: manifestValue.familyId,
      title: prompt, trigger: 'journal', triggerRouteKeys: manifestValue.journalRouteKeys,
      minimumBondLevel: 1, cooldownDays: 3, tags: ['memory', topic.id], contextualOnly: true,
      format: 'narrative', entryNodeId: 'question', nodes: [
        { id: 'question', kind: 'choice', phase: 'explore', prompt, options: [
          { id: 'feeling', label: 'How it felt', reply: 'The internal change made the moment visible.', nextNodeId: 'remember-feeling' },
          { id: 'detail', label: 'One specific detail', reply: 'A concrete detail gives the memory somewhere to live.', nextNodeId: 'remember-detail' },
          { id: 'company', label: 'Who or what was there', reply: 'The setting and company shaped the experience.', nextNodeId: 'remember-company' },
        ] },
        ...['feeling', 'detail', 'company'].map((id) => ({ id: `remember-${id}`, kind: 'memory_proposal' as const, prompt: 'Keep this specific moment in shared memory?', summary: `The ${id} made this ${manifestValue.subject} moment worth noticing.`, memoryKey: `journal:${manifestValue.familyId}:${index + 1}:${id}`, sensitivity: 'ordinary' as const, nextNodeId: 'end' })),
        endNode('The moment remains yours whether or not it is saved.'),
      ],
    };
  });
}

function debriefsAndBonds(manifestValue: AuthoredFamilyConversationManifest): ConversationDefinition[] {
  const { family } = familyData(manifestValue);
  const templates = quickGoalTemplatesForFamily(family.id).filter((item) => item.id.startsWith(`${family.id}:`)).slice(0, 3);
  const quickIds = (templates.length ? templates : quickGoalTemplatesForFamily(family.id).slice(0, 3)).map((item) => item.id);
  const goalDebriefs = ['progress', 'friction'].map((kind): ConversationDefinition => ({
    id: `${family.id}:conversation:goal-${kind}`, version: 4, familyId: manifestValue.familyId,
    title: kind === 'progress' ? 'Keep what is helping' : 'Make the goal easier to return to',
    trigger: 'goal_debrief', minimumBondLevel: 1, cooldownDays: 7, tags: ['goals'], contextualOnly: true,
    format: 'outcome', entryNodeId: 'question', nodes: [
      { id: 'question', kind: 'choice', phase: 'explore', prompt: kind === 'progress' ? 'What has helped lately?' : 'Where is the goal catching?', options: [
        { id: 'size', label: 'Its size', reply: 'A fair size changes the doorway.', nextNodeId: 'goal' },
        { id: 'time', label: 'Its place in the day', reply: 'A real time makes it less abstract.', nextNodeId: 'goal' },
        { id: 'support', label: 'The support around it', reply: 'Support changes the weight of a plan.', nextNodeId: 'goal' },
      ] },
      { id: 'goal', kind: 'goal_proposal', prompt: 'Choose only what would genuinely help.', goalTypeId: `${family.id}-direction`, goalTitle: `Adjust the ${manifestValue.subject} goal`, suggestedQuickGoalIds: quickIds, nextNodeId: 'end' },
      endNode('The adjustment is the useful result.'),
    ],
  }));
  const questDebriefs: ConversationDefinition[] = [
    {
      id: `${family.id}:conversation:quest-return`, version: 4, familyId: manifestValue.familyId,
      title: 'Make the open quest easier to hold', trigger: 'quest_debrief', minimumBondLevel: 1,
      cooldownDays: 7, tags: ['goals'], contextualOnly: true, format: 'outcome', entryNodeId: 'question', nodes: [
        { id: 'question', kind: 'choice', phase: 'explore', prompt: 'What would make the open adventure easier to begin?', options: [
          { id: 'tiny', label: 'A smaller first step', reply: 'Lowering the doorway is useful design.', nextNodeId: 'goal' },
          { id: 'time', label: 'A specific time', reply: 'A place in the day makes it concrete.', nextNodeId: 'goal' },
          { id: 'leave', label: 'Leaving it for now', reply: 'Not forcing it is a valid decision.', nextNodeId: 'goal' },
        ] },
        { id: 'goal', kind: 'goal_proposal', prompt: 'Choose only what would make the existing quest lighter.', goalTypeId: `${family.id}-direction`, goalTitle: 'Lower the doorway to the open quest', suggestedQuickGoalIds: quickIds, nextNodeId: 'end' },
        endNode('This supports the existing quest; it does not create an obligation.'),
      ],
    },
    {
      id: `${family.id}:conversation:quest-debrief`, version: 4, familyId: manifestValue.familyId,
      title: 'Keep what the completed quest taught you', trigger: 'quest_debrief', minimumBondLevel: 1,
      cooldownDays: 7, tags: ['memory'], contextualOnly: true, format: 'outcome', entryNodeId: 'question', nodes: [
        { id: 'question', kind: 'choice', phase: 'explore', prompt: 'What did completing it show you?', options: [
          { id: 'easy', label: 'It was easier than expected', reply: 'Beginning may be lighter than predicted.', nextNodeId: 'remember' },
          { id: 'hard', label: 'It was genuinely hard', reply: 'The real effort deserves to stay visible.', nextNodeId: 'remember' },
          { id: 'different', label: 'It was different than expected', reply: 'Now you have a better map.', nextNodeId: 'remember' },
        ] },
        { id: 'remember', kind: 'memory_proposal', prompt: 'Keep that lesson in shared memory?', summary: `A completed ${manifestValue.subject} quest gave me a more accurate map.`, memoryKey: `quest-lesson:${family.id}`, sensitivity: 'ordinary', nextNodeId: 'end' },
        endNode('The lesson belongs to you either way.'),
      ],
    },
  ];
  const bonds = ([2, 3, 4] as const).map((level): ConversationDefinition => ({
    id: `${family.id}:conversation:bond-${level}`, version: 4, familyId: manifestValue.familyId,
    title: `How should I support you around ${manifestValue.subject}?`, trigger: 'bond', minimumBondLevel: level,
    cooldownDays: 3650, tags: ['memory'], contextualOnly: true, format: 'outcome', entryNodeId: 'question', nodes: [
      { id: 'question', kind: 'choice', phase: 'explore', prompt: `What kind of companion should I be around ${manifestValue.subject}?`, options: [
        { id: 'gentle', label: 'Keep it gentle', reply: 'Pressure makes this less useful.', nextNodeId: 'remember' },
        { id: 'curious', label: 'Ask curious questions', reply: 'Noticing can come before planning.', nextNodeId: 'remember' },
        { id: 'direct', label: 'Be clear and practical', reply: 'Small concrete choices help.', nextNodeId: 'remember' },
      ] },
      { id: 'remember', kind: 'memory_proposal', prompt: 'Remember this support preference?', summary: `My preferred support around ${manifestValue.subject} should stay gentle, curious, or practical according to what I chose.`, memoryKey: `support-style:${family.id}`, sensitivity: 'ordinary', nextNodeId: 'end' },
      endNode('You can change that preference at any time.'),
    ],
  }));
  return [...goalDebriefs, ...questDebriefs, ...bonds];
}

function polls(manifestValue: AuthoredFamilyConversationManifest): ConversationDefinition[] {
  const { skins } = familyData(manifestValue);
  const topics = topicsFor(manifestValue);
  return Array.from({ length: 24 }, (_, index): ConversationDefinition => {
    const topic = topics[index % topics.length]!;
    const skin = skins[index % skins.length]!;
    const labels = [topic.label, skin.hatchCues[0] ?? skin.displayName, index % 2 ? 'Keep it familiar' : 'Try a small change'];
    const prompt = `${topic.label}: which direction wins today?`;
    return {
      id: `${manifestValue.familyId}:poll:${index + 1}`, version: 2, familyId: manifestValue.familyId,
      title: prompt, trigger: 'poll', minimumBondLevel: 1, cooldownDays: 14, tags: ['play', 'preferences'],
      format: 'poll', entryNodeId: 'poll', nodes: [
        { id: 'poll', kind: 'poll', prompt, helperText: 'A fictional village vote, just for fun.', nextNodeId: 'end', options: labels.map((label, optionIndex) => ({ id: `choice-${optionIndex + 1}`, label, reply: `${label} has its own corner of the village.`, nextNodeId: 'end', villageWeight: [42, 34, 24][(optionIndex + index) % 3]! })) },
        endNode('That choice is in the village ledger now.'),
      ],
    };
  });
}

export function buildAuthoredFamilyConversationPack(
  manifestValue: AuthoredFamilyConversationManifest
): readonly ConversationDefinition[] {
  const pack = [
    ...openers(manifestValue),
    ...insightGames(manifestValue),
    profileGame(manifestValue),
    ...goalDefinitions(manifestValue),
    ...journalThreads(manifestValue),
    ...debriefsAndBonds(manifestValue),
    ...polls(manifestValue),
  ];
  if (pack.length !== 53) throw new Error(`${manifestValue.familyId} built ${pack.length} conversations instead of 53`);
  return pack;
}

export const authoredFamilyConversationDefinitions: readonly ConversationDefinition[] =
  authoredFamilyConversationManifests.flatMap(buildAuthoredFamilyConversationPack);

export const authoredFamilyManifestById = new Map(
  authoredFamilyConversationManifests.map((item) => [item.familyId, item])
);
