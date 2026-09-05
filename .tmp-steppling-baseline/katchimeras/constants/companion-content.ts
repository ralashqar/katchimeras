import {
  companionJourneyByFamilyId,
  companionJourneyDefinitions,
  type CompanionJourneyDefinition,
} from '@/constants/companion-journeys';
import { companionSpeechCopyIssues } from '@/constants/companion-speech-copy';
import {
  companionQuickGoalTemplateById,
  quickGoalTemplatesForFamily,
} from '@/constants/companion-quick-goals';
import {
  katchimeraRoleByFamilyId,
  katchimeraRoles,
  type KatchimeraRoleDefinition,
} from '@/constants/katchimera-roles';
import { canonicalFamilyId } from '@/constants/katchimera-skins';
import {
  STEPPLING_BOND_MOMENTS,
  STEPPLING_DAILY_PULSES,
  STEPPLING_PROGRESS_REVIEWS,
  STEPPLING_RETURN_CONVERSATIONS,
  type AuthoredCompanionContentSeed,
} from '@/constants/steppling-companion-content';
import { BATCH_ONE_COMPANION_CONTENT } from '@/constants/batch-one-companion-content';
import { BATCH_TWO_COMPANION_CONTENT } from '@/constants/batch-two-companion-content';
import { BATCH_THREE_COMPANION_CONTENT } from '@/constants/batch-three-companion-content';
import { BATCH_FOUR_COMPANION_CONTENT } from '@/constants/batch-four-companion-content';
import { BATCH_FIVE_COMPANION_CONTENT } from '@/constants/batch-five-companion-content';
import { BATCH_SIX_COMPANION_CONTENT } from '@/constants/batch-six-companion-content';
import { SPECIALIST_COMPANION_CONTENT } from '@/constants/specialist-companion-catalogue';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { manualJournalFlow } from '@/utils/manual-journal-registry';
import { questDefinition } from '@/utils/quests/definitions';
import { questUsesJournalEntrySystem } from '@/utils/quests/journal-templates';

export type CompanionContentKind = 'daily_pulse' | 'progress_review' | 'return' | 'bond_moment';

export type CompanionContentOption = {
  id: string;
  label: string;
};

export type CompanionContentItem = {
  id: string;
  familyId: KatchimeraFamilyId;
  kind: CompanionContentKind;
  title: string;
  prompt: string;
  helperText: string;
  options: readonly CompanionContentOption[];
  minimumBondLevel: 1 | 2 | 3 | 4;
  cooldownDays: number;
  memoryKey: string;
};

const PULSE_OPTIONS: readonly CompanionContentOption[] = [
  { id: 'supported', label: 'It supported me' },
  { id: 'mixed', label: 'It felt mixed' },
  { id: 'difficult', label: 'It felt difficult' },
  { id: 'noticed', label: 'I noticed something new' },
];

function pulseChoices(labels: readonly string[]): readonly CompanionContentOption[] {
  return labels.map((label, index) => ({ id: `choice-${index + 1}`, label }));
}

const REVIEW_OPTIONS: readonly CompanionContentOption[] = [
  { id: 'working', label: 'Something is working' },
  { id: 'adjust', label: 'I want to adjust it' },
  { id: 'pause', label: 'I need less pressure' },
  { id: 'unclear', label: 'I am still learning' },
];

const RETURN_OPTIONS: readonly CompanionContentOption[] = [
  { id: 'same', label: 'It still fits' },
  { id: 'changed', label: 'It has changed' },
  { id: 'complete', label: 'That chapter feels complete' },
  { id: 'later', label: 'Ask me another time' },
];

export const BOND_MOMENT_OPTIONS: Readonly<Record<2 | 3 | 4, readonly CompanionContentOption[]>> = {
  2: [
    { id: 'gentle-encouragement', label: 'Encourage me gently' },
    { id: 'notice-patterns', label: 'Help me notice patterns' },
    { id: 'small-suggestions', label: 'Keep suggestions small' },
    { id: 'set-my-pace', label: 'Let me set the pace' },
  ],
  3: [
    { id: 'what-supports-me', label: 'What supports me' },
    { id: 'what-gets-in-way', label: 'What gets in my way' },
    { id: 'repeating-pattern', label: 'A repeating pattern' },
    { id: 'what-matters', label: 'What matters most to me' },
  ],
  4: [
    { id: 'progress-made', label: 'The progress we made' },
    { id: 'things-learned', label: 'What I learned about myself' },
    { id: 'moments-mattered', label: 'The moments that mattered' },
    { id: 'direction-ahead', label: 'The direction ahead' },
  ],
};

type CompanionPulseSeed = Omit<AuthoredCompanionContentSeed, 'options'> & {
  options?: AuthoredCompanionContentSeed['options'];
};

const PILOT_PULSES: Readonly<Record<string, readonly CompanionPulseSeed[]>> = {
  steppling: STEPPLING_DAILY_PULSES,
  mossprout: [
    { prompt: 'What kind of living detail caught your attention today?', helperText: 'A plant, animal, texture, sound, or small change all count.' },
    { prompt: 'Did being outside change the pace of your day?', helperText: 'Choose the closest feeling, even if the moment was brief.' },
    { prompt: 'What felt different in a familiar outdoor place?', helperText: 'Mossprout remembers changes as well as discoveries.' },
    { prompt: 'Which sign of the season felt most present today?', helperText: 'Light, weather, colour, growth, and decay are all part of it.' },
  ],
  tasklet: [
    { prompt: 'What made the next step clearer today?', helperText: 'Progress can be deciding, simplifying, finishing, or changing course.' },
    { prompt: 'Where did friction show up in your work?', helperText: 'Notice it without turning it into a verdict.' },
    { prompt: 'What became easier after one thing moved forward?', helperText: 'Small unlocked steps are worth keeping.' },
    { prompt: 'What deserves to be first when you return?', helperText: 'Choose the useful next action, not the whole project.' },
  ],
  'sleep-rest': [
    { prompt: 'What restored even a little energy today?', helperText: 'Rest can be sleep, quiet, comfort, space, or doing less.' },
    { prompt: 'When did your body ask you to slow down?', helperText: 'This is an observation, not an instruction.' },
    { prompt: 'What helped the day feel finished?', helperText: 'A boundary, ritual, person, or small comfort all count.' },
    { prompt: 'Did rest feel chosen or merely necessary today?', helperText: 'There is no better answer; both are useful to notice.' },
  ],
  gatherglow: [
    { prompt: 'Which connection felt most genuine today?', helperText: 'A message, shared silence, laugh, or useful conversation all count.' },
    { prompt: 'Did you feel more reached for, or more like the one reaching?', helperText: 'Gatherglow is learning the shape of connection in your life.' },
    { prompt: 'What made it easier to be present with someone?', helperText: 'Think about the conditions around the moment.' },
    { prompt: 'Is there a small connection you would like to continue?', helperText: 'A reply or simple invitation is enough.' },
  ],
};

function sentence(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/[.]+$/, '');
}

function buildFamilyContent(familyId: KatchimeraFamilyId): CompanionContentItem[] {
  const role = katchimeraRoleByFamilyId.get(familyId);
  const familyName = role?.displayName ?? familyId;
  const authoredFamilyId = familyId === 'bedrotte'
    ? 'sleep-rest'
    : familyId === 'baristabbit'
      ? 'coffee-ritual'
      : familyId;
  const lenses = role?.reflectionLenses.length ? role.reflectionLenses : ['what this part of life meant'];
  const authoredPack = familyId === 'steppling'
    ? {
        pulses: STEPPLING_DAILY_PULSES,
        reviews: STEPPLING_PROGRESS_REVIEWS,
        returns: STEPPLING_RETURN_CONVERSATIONS,
        bonds: STEPPLING_BOND_MOMENTS,
      }
    : BATCH_ONE_COMPANION_CONTENT[authoredFamilyId]
      ?? BATCH_TWO_COMPANION_CONTENT[authoredFamilyId]
    ?? BATCH_THREE_COMPANION_CONTENT[authoredFamilyId]
    ?? BATCH_FOUR_COMPANION_CONTENT[authoredFamilyId]
    ?? BATCH_FIVE_COMPANION_CONTENT[authoredFamilyId]
    ?? BATCH_SIX_COMPANION_CONTENT[authoredFamilyId]
    ?? SPECIALIST_COMPANION_CONTENT[authoredFamilyId];
  const pilot = authoredPack?.pulses ?? PILOT_PULSES[authoredFamilyId] ?? [];
  const genericPulses: readonly CompanionPulseSeed[] = [
    {
      prompt: `What did ${familyName} help you notice today?`,
      helperText: 'Choose the closest kind of detail. Nothing has to be dramatic.',
      options: pulseChoices(['A feeling', 'A small detail', 'A pattern', 'A change', 'Nothing yet']),
    },
    {
      prompt: 'How did this part of today feel?',
      helperText: 'A mixed or uncertain answer is still useful.',
      options: pulseChoices(['Supportive', 'Mostly easy', 'Mixed', 'Difficult', 'It did not come up']),
    },
    {
      prompt: `Is there a ${familyName} moment worth remembering?`,
      helperText: 'A brief or ordinary moment can be worth keeping.',
      options: pulseChoices(['Yes, clearly', 'A small one', 'It felt mixed', 'Not really', 'I am not sure']),
    },
    {
      prompt: 'What would you like to understand better here?',
      helperText: 'Pick the question that feels most useful now.',
      options: pulseChoices(['What helps', 'What gets in the way', 'How I feel', 'What I want', 'Nothing yet']),
    },
    {
      prompt: 'What felt most natural in this part of today?',
      helperText: 'Think about what needed the least forcing.',
      options: pulseChoices(['The whole moment', 'One small part', 'My pace', 'My choice', 'Nothing felt natural']),
    },
    {
      prompt: 'How much effort did this ask from you?',
      helperText: 'Effort can be physical, practical, social, or emotional.',
      options: pulseChoices(['Very little', 'A little', 'Quite a bit', 'Too much', 'I am not sure']),
    },
    {
      prompt: 'What supported you in this part of life today?',
      helperText: 'Choose the closest source of support.',
      options: pulseChoices(['Time or energy', 'Another person', 'A place or tool', 'My own choice', 'Nothing helped yet']),
    },
    {
      prompt: 'What got in the way, even a little?',
      helperText: 'This is for understanding, not blame.',
      options: pulseChoices(['Time', 'Energy or health', 'Access or cost', 'Other demands', 'Nothing in particular']),
    },
    {
      prompt: 'What would you gladly make room for again?',
      helperText: 'Repeating only one helpful part still counts.',
      options: pulseChoices(['The whole moment', 'One small part', 'A gentler version', 'Something different', 'Nothing right now']),
    },
    {
      prompt: 'What might help if this comes up tomorrow?',
      helperText: 'Choose a light adjustment, not a promise.',
      options: pulseChoices(['Make it smaller', 'Plan a time', 'Ask for support', 'Keep it flexible', 'Leave it for now']),
    },
    {
      prompt: 'What surprised you about this moment?',
      helperText: 'Surprise can be pleasant, difficult, or simply different.',
      options: pulseChoices(['It was easier', 'It was harder', 'It felt different', 'I noticed something new', 'Nothing surprised me']),
    },
    {
      prompt: 'What mattered most in this part of today?',
      helperText: `Think about ${sentence(lenses[0], 'what it meant')}.`,
      options: pulseChoices(['How it felt', 'Who was involved', 'The setting', 'The choice I made', 'I am not sure']),
    },
  ];
  const pulseSeeds = Array.from({ length: 12 }, (_, index) => {
    const authored = pilot[index % pilot.length];
    if (authored && index < pilot.length) return authored;
    return genericPulses[index]!;
  });
  const pulses: CompanionContentItem[] = pulseSeeds.map((seed, index) => ({
    id: `${familyId}:pulse:${index + 1}`,
    familyId,
    kind: 'daily_pulse',
    title: seed.title ?? (index < 4 ? 'A moment from today' : 'Something to notice'),
    prompt: seed.prompt,
    helperText: seed.helperText,
    options: seed.options ?? PULSE_OPTIONS,
    minimumBondLevel: index < 6 ? 1 : index < 10 ? 2 : 3,
    cooldownDays: 14,
    memoryKey: `${familyId}:pulse:${index + 1}`,
  }));
  const authoredReviews = authoredPack?.reviews ?? [];
  const reviews: CompanionContentItem[] = Array.from({ length: 4 }, (_, index) => {
    const authored = authoredReviews[index];
    return ({
    id: `${familyId}:review:${index + 1}`,
    familyId,
    kind: 'progress_review',
    title: authored?.title ?? (index === 0 ? 'Notice the pattern' : 'Read what is changing'),
    prompt: authored?.prompt ?? [
      `Across your recent ${familyName} moments, what seems to be helping?`,
      'What has become easier since you chose this direction?',
      'Where does the current Focus need to become smaller or more specific?',
      'What is worth carrying into the next few days?',
    ][index],
    helperText: authored?.helperText ?? 'This is a review, not a score. You can continue, reshape, or pause.',
    options: authored?.options ?? REVIEW_OPTIONS,
    minimumBondLevel: index < 2 ? 2 : 3,
    cooldownDays: 7,
    memoryKey: `${familyId}:review:${index + 1}`,
    });
  });
  const authoredReturns = authoredPack?.returns ?? [];
  const returns: CompanionContentItem[] = Array.from({ length: 4 }, (_, index) => {
    const authored = authoredReturns[index];
    return ({
    id: `${familyId}:return:${index + 1}`,
    familyId,
    kind: 'return',
    title: authored?.title ?? 'Has this changed?',
    prompt: authored?.prompt ?? [
      'Does the direction you chose still fit your life now?',
      'Would you describe what you want from this part of life differently now?',
      'Is an earlier obstacle still the thing getting in the way?',
      'Does this Focus need another chapter, or has it done its work?',
    ][index],
    helperText: authored?.helperText ?? 'Katchimeras can remember change without treating the earlier answer as wrong.',
    options: authored?.options ?? RETURN_OPTIONS,
    minimumBondLevel: index < 2 ? 2 : 3,
    cooldownDays: 21,
    memoryKey: `${familyId}:return:${index + 1}`,
    });
  });
  const bonds: CompanionContentItem[] = ([2, 3, 4] as const).map((level) => {
    const authored = authoredPack?.bonds[level] ?? null;
    return ({
    id: `${familyId}:bond:${level}`,
    familyId,
    kind: 'bond_moment',
    title: authored?.title ?? (level === 2 ? 'You feel familiar now' : level === 3 ? 'A pattern between you' : 'A shared history'),
    prompt: authored?.prompt ?? (level === 2
      ? `What would you like ${familyName} to understand about you?`
      : level === 3
        ? `What has ${familyName} helped you notice that you might otherwise have missed?`
        : `What part of your history with ${familyName} feels most worth carrying forward?`),
    helperText: authored?.helperText ?? 'I can use this in later conversations. It does not lock you into anything.',
    options: authored?.options ?? BOND_MOMENT_OPTIONS[level],
    minimumBondLevel: level,
    cooldownDays: 3650,
    memoryKey: `${familyId}:bond:${level}`,
    });
  });
  return [...pulses, ...reviews, ...returns, ...bonds];
}

export const companionContentItems: readonly CompanionContentItem[] = companionJourneyDefinitions
  .flatMap((definition) => buildFamilyContent(definition.familyId));

export const companionContentById = new Map(companionContentItems.map((item) => [item.id, item]));

export function companionContentForFamily(familyId: KatchimeraFamilyId): readonly CompanionContentItem[] {
  const ownerFamilyId = canonicalFamilyId(familyId) ?? familyId;
  return companionContentItems.filter((item) => item.familyId === ownerFamilyId);
}

/** Cross-catalogue authoring contract for every playable companion family. */
export function validateCompleteCompanionContent(): string[] {
  const issues: string[] = [];
  for (const role of katchimeraRoles.filter((item) => item.status !== 'planned')) {
    validateRoleQuests(role, issues);
    validateQuickGoals(role, issues);
    validateJourney(role, companionJourneyByFamilyId.get(role.familyId), issues);
  }
  issues.push(...validateKatchimeraQuestEvidenceSystem());
  issues.push(...validateEvolvingCompanionContent());
  return issues;
}

export function validateEvolvingCompanionContent(): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const definition of companionJourneyDefinitions) {
    const items = companionContentForFamily(definition.familyId);
    const pulses = items.filter((item) => item.kind === 'daily_pulse');
    const reviews = items.filter((item) => item.kind === 'progress_review');
    const returns = items.filter((item) => item.kind === 'return');
    const bonds = items.filter((item) => item.kind === 'bond_moment');
    if (pulses.length < 12) issues.push(`${definition.familyId}: needs twelve daily pulse prompts`);
    if (reviews.length < 4) issues.push(`${definition.familyId}: needs four progress reviews`);
    if (returns.length < 4) issues.push(`${definition.familyId}: needs four return conversations`);
    if (bonds.length < 3) issues.push(`${definition.familyId}: needs Familiar, Devoted, and Kindred moments`);
    for (const item of items) {
      if (seen.has(item.id)) issues.push(`${definition.familyId}: duplicate evolving content id ${item.id}`);
      seen.add(item.id);
      if (!item.prompt.trim() || item.options.length < 3) issues.push(`${item.id}: incomplete prompt or answer set`);
      issues.push(...companionSpeechCopyIssues(item.id, item.prompt, item.helperText));
      if (item.cooldownDays < 1) issues.push(`${item.id}: cooldown must be positive`);
    }
  }
  return issues;
}

export function validateKatchimeraQuestEvidenceSystem(): string[] {
  const issues: string[] = [];
  const visited = new Set<string>();
  for (const role of katchimeraRoles) {
    for (const questId of role.realLifeQuestIds) {
      if (visited.has(questId)) continue;
      visited.add(questId);
      const quest = questDefinition(questId);
      if (!quest) continue;
      const mustUseJournal = quest.family === 'note' || quest.family === 'voice' || questUsesJournalEntrySystem(questId);
      if (mustUseJournal && quest.evidenceInput?.kind !== 'journal') {
        issues.push(`${role.familyId}: ${questId} must use the focused quest journal`);
        continue;
      }
      if (quest.family === 'photo' && quest.evidenceInput?.kind === 'journal') {
        issues.push(`${role.familyId}: ${questId} must remain a photo quest`);
      }
      if (quest.evidenceInput?.kind !== 'journal') continue;
      const template = quest.evidenceInput.template;
      const flow = manualJournalFlow(template.flowId);
      const choiceIds = new Set(flow?.choices.map((choice) => choice.id) ?? []);
      if (!flow) issues.push(`${role.familyId}: ${questId} uses missing journal flow ${template.flowId}`);
      if (!template.initialChoiceId || !choiceIds.has(template.initialChoiceId)) {
        issues.push(`${role.familyId}: ${questId} needs a valid focused journal category`);
      }
      if (!template.allowedChoiceIds?.length || !template.allowedChoiceIds.includes(template.initialChoiceId ?? '')) {
        issues.push(`${role.familyId}: ${questId} must allow its initial journal category`);
      }
      for (const choiceId of template.allowedChoiceIds ?? []) {
        if (!choiceIds.has(choiceId)) issues.push(`${role.familyId}: ${questId} allows missing journal category ${choiceId}`);
      }
      if (!quest.semanticVerification) {
        issues.push(`${role.familyId}: ${questId} needs optional on-device answer evaluation`);
      } else {
        if (!quest.semanticVerification.modalities.includes('text') || !quest.semanticVerification.modalities.includes('voice')) {
          issues.push(`${role.familyId}: ${questId} must support both note and voice input`);
        }
        if (!quest.semanticVerification.journalRouteFallbacks?.length) {
          issues.push(`${role.familyId}: ${questId} needs a deterministic manual journal fallback`);
        }
      }
      if (quest.requiresCapabilities?.length) issues.push(`${role.familyId}: ${questId} must keep its text fallback free of required capabilities`);
      if (!quest.optionalCapabilities?.includes('appleFoundation')) issues.push(`${role.familyId}: ${questId} must keep appleFoundation optional`);
    }
  }
  return issues;
}

function validateRoleQuests(role: KatchimeraRoleDefinition, issues: string[]) {
  if (role.realLifeQuestIds.length < 4) issues.push(`${role.familyId}: complete content needs four progressive real-life quests`);
  for (const questId of role.realLifeQuestIds) {
    const quest = questDefinition(questId);
    if (!quest) { issues.push(`${role.familyId}: missing real-life quest ${questId}`); continue; }
    if (quest.lane !== 'real_life') issues.push(`${role.familyId}: ${questId} must use the real-life lane`);
    if (quest.familyId !== role.familyId) issues.push(`${role.familyId}: ${questId} must belong to the same family`);
    if (!quest.repeatPolicy) issues.push(`${role.familyId}: ${questId} needs an explicit repeat policy`);
    const journey = companionJourneyByFamilyId.get(role.familyId);
    if (journey && !quest.progression) {
      issues.push(`${role.familyId}: ${questId} needs Journey progression`);
    } else if (journey && quest.progression?.journeyId !== journey.id) {
      issues.push(`${role.familyId}: ${questId} points to the wrong Journey`);
    } else if (journey && quest.progression && !journey.stages.some((stage) => stage.id === quest.progression?.stageId)) {
      issues.push(`${role.familyId}: ${questId} points to missing Journey stage ${quest.progression.stageId}`);
    }
    if ((quest.family === 'note' || quest.family === 'voice') && quest.evidenceInput?.kind !== 'journal') issues.push(`${role.familyId}: ${questId} needs a structured journal template`);
    if (quest.criteria.some((criterion) => criterion.fact === 'notes.added' || criterion.fact === 'notes.voiceAdded')) issues.push(`${role.familyId}: ${questId} must not use an unrelated note counter`);
    if (quest.semanticVerification) {
      if (quest.requiresCapabilities?.includes('appleFoundation')) issues.push(`${role.familyId}: ${questId} must remain usable without appleFoundation`);
      if (!quest.optionalCapabilities?.includes('appleFoundation')) issues.push(`${role.familyId}: ${questId} must keep appleFoundation optional`);
      if (quest.evidenceInput?.kind !== 'journal') issues.push(`${role.familyId}: ${questId} semantic verification needs a manual journal path`);
      if (!quest.semanticVerification.modalities.length) issues.push(`${role.familyId}: ${questId} semantic verification needs an input modality`);
    }
  }
  for (const questId of role.miniGameQuestIds) {
    const quest = questDefinition(questId);
    if (!quest) { issues.push(`${role.familyId}: missing mini-game ${questId}`); continue; }
    if (quest.lane !== 'mini_game') issues.push(`${role.familyId}: ${questId} must use the mini-game lane`);
    if (quest.familyId !== role.familyId) issues.push(`${role.familyId}: ${questId} must belong to the same family`);
  }
}

function validateQuickGoals(role: KatchimeraRoleDefinition, issues: string[]) {
  const templates = quickGoalTemplatesForFamily(role.familyId);
  if (templates.length < 8) issues.push(`${role.familyId}: complete content needs at least eight quick goals`);
  const ids = new Set<string>();
  for (const template of templates) {
    if (ids.has(template.id)) issues.push(`${role.familyId}: duplicate quick-goal id ${template.id}`);
    ids.add(template.id);
    if (!template.title.trim()) issues.push(`${role.familyId}: ${template.id} has no title`);
  }
}

function validateJourney(role: KatchimeraRoleDefinition, journey: CompanionJourneyDefinition | undefined, issues: string[]) {
  if (!journey) { issues.push(`${role.familyId}: complete content needs a You journey`); return; }
  if (journey.nodes.length < 3) issues.push(`${role.familyId}: journey needs at least three questionnaire nodes`);
  if (!journey.nodes.some((node) => node.createsGoalTypeId)) issues.push(`${role.familyId}: journey does not create a Focus goal`);
  if (journey.stages.length < 4) issues.push(`${role.familyId}: journey needs choose, practice, review, and decide stages`);
  const nodeIds = new Set(journey.nodes.map((node) => node.id));
  if (!nodeIds.has(journey.startNodeId)) issues.push(`${role.familyId}: journey start node does not exist`);
  for (const node of journey.nodes) {
    const nextIds = [node.nextNodeId, ...(node.options ?? []).map((choice) => choice.nextNodeId)].filter((id): id is string => Boolean(id));
    for (const nextId of nextIds) if (!nodeIds.has(nextId)) issues.push(`${role.familyId}: journey points to missing node ${nextId}`);
    if (node.createsGoalTypeId) {
      const choices = node.options?.length ? node.options : [null];
      for (const choice of choices) {
        const resultSuggestions = choice?.suggestedQuickGoalIds ?? node.suggestedQuickGoalIds ?? [];
        if (resultSuggestions.length < 2) {
          issues.push(`${role.familyId}: Focus result ${node.id}:${choice?.id ?? 'custom'} needs at least two small-goal suggestions`);
        }
      }
    }
    const suggestionIds = [...(node.suggestedQuickGoalIds ?? []), ...(node.options ?? []).flatMap((choice) => choice.suggestedQuickGoalIds ?? [])];
    for (const suggestionId of suggestionIds) {
      const template = companionQuickGoalTemplateById.get(suggestionId);
      if (!template) issues.push(`${role.familyId}: journey suggests missing quick goal ${suggestionId}`);
      else if (template.familyId !== role.familyId) issues.push(`${role.familyId}: journey suggests another family’s goal ${suggestionId}`);
    }
  }
}
