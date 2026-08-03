import {
  createEditorialCompanionPack,
  type EditorialCompanionPack,
  type EditorialCompanionProfile,
  type EditorialOptions,
} from '@/constants/editorial-companion-pack';
import type { CompanionJourneyDefinition } from '@/constants/companion-journeys';
import type { CompanionQuickGoalTemplate } from '@/constants/companion-quick-goals';
import type { KatchimeraFamilyId } from '@/types/katchimera';

type QuickGoalSeed = {
  suffix: string;
  title: string;
  cadence?: CompanionQuickGoalTemplate['defaultCadence'];
};

type DirectionSeed = {
  id: string;
  label: string;
  goalTitle: string;
  quickGoalSuffixes: readonly [string, string, ...string[]];
};

export type SpecialistCompanionSystemConfig = {
  familyId: KatchimeraFamilyId;
  journeyId: string;
  version?: number;
  title: string;
  subject: string;
  introduction: string;
  first: {
    prompt: string;
    helperText: string;
    options: EditorialOptions;
  };
  second: {
    prompt: string;
    helperText: string;
    options: EditorialOptions;
  };
  directions: readonly [DirectionSeed, DirectionSeed, DirectionSeed, ...DirectionSeed[]];
  quickGoals: readonly [QuickGoalSeed, QuickGoalSeed, QuickGoalSeed, QuickGoalSeed, QuickGoalSeed, QuickGoalSeed, QuickGoalSeed, QuickGoalSeed, ...QuickGoalSeed[]];
  editorial: EditorialCompanionProfile;
};

export type SpecialistCompanionSystem = {
  familyId: KatchimeraFamilyId;
  journeyId: string;
  journey: CompanionJourneyDefinition;
  quickGoals: readonly CompanionQuickGoalTemplate[];
  content: EditorialCompanionPack;
};

export type CompactSpecialistCompanionSystemConfig = Omit<
  SpecialistCompanionSystemConfig,
  'first' | 'second' | 'editorial'
> & {
  companionName: string;
  focusName: string;
  momentName: string;
  firstPrompt: string;
  firstHelperText: string;
  values: readonly [string, string, string, string, string];
  secondPrompt: string;
  secondHelperText: string;
  barriers: readonly [string, string, string, string, string];
  moments: readonly [string, string, string, string, string];
  supports: readonly [string, string, string, string, string];
  details: readonly [string, string, string, string, string];
  adaptations?: readonly [string, string, string, string, string];
};

const indexedOptions = (prefix: string, values: readonly string[]): EditorialOptions =>
  values.map((label, index) => [`${prefix}-${index + 1}`, label] as const);

export function createCompactSpecialistCompanionSystem(
  config: CompactSpecialistCompanionSystemConfig
): SpecialistCompanionSystem {
  const adaptations = config.adaptations ?? ['Make it smaller', 'Choose another form', 'Use available support', 'Try another time', 'Pause the Focus'];
  return createSpecialistCompanionSystem({
    familyId: config.familyId,
    journeyId: config.journeyId,
    title: config.title,
    subject: config.subject,
    introduction: config.introduction,
    first: { prompt: config.firstPrompt, helperText: config.firstHelperText, options: indexedOptions('value', config.values) },
    second: { prompt: config.secondPrompt, helperText: config.secondHelperText, options: indexedOptions('barrier', config.barriers) },
    directions: config.directions,
    quickGoals: config.quickGoals,
    editorial: {
      companionName: config.companionName,
      focusName: config.focusName,
      momentName: config.momentName,
      kinds: indexedOptions('moment', config.moments),
      effects: indexedOptions('effect', ['Enjoyment or interest', 'Connection or meaning', 'A useful shift in attention', 'Difficulty or discomfort', 'Mixed or no clear effect']),
      supports: indexedOptions('support', config.supports),
      barriers: indexedOptions('barrier', config.barriers),
      details: indexedOptions('detail', config.details),
      fit: indexedOptions('fit', ['It fitted well enough', 'A smaller version fitted', 'I adapted it', 'I chose something else', 'It did not fit today']),
      next: indexedOptions('next', [...config.directions.slice(0, 4).map((direction) => direction.label), 'No extra task for now']),
      conditions: indexedOptions('condition', config.barriers),
      limits: indexedOptions('limit', ['Time, energy, or capacity', 'Access, cost, or equipment', 'Safety or environmental conditions', 'A personal or social boundary', 'No limit stood out']),
      learning: indexedOptions('learning', config.details),
      keep: indexedOptions('keep', [...config.directions.slice(0, 4).map((direction) => direction.label), 'An honest record of what did not fit']),
      adapt: indexedOptions('adapt', adaptations),
    },
  });
}

export function createSpecialistCompanionSystem(
  config: SpecialistCompanionSystemConfig
): SpecialistCompanionSystem {
  const goalTypeId = `${config.familyId}-direction`;
  const goalNodeId = `${config.familyId}-goal`;
  const firstNodeId = `${config.familyId}-meaning`;
  const secondNodeId = `${config.familyId}-conditions`;
  const quickGoals = config.quickGoals.map((goal) => ({
    id: `${config.familyId}:${goal.suffix}`,
    familyId: config.familyId,
    title: goal.title,
    defaultCadence: goal.cadence ?? { kind: 'once' as const },
  }));
  const quickGoalIds = new Set(quickGoals.map((goal) => goal.id));
  for (const direction of config.directions) {
    for (const suffix of direction.quickGoalSuffixes) {
      const id = `${config.familyId}:${suffix}`;
      if (!quickGoalIds.has(id)) throw new Error(`${config.familyId}: direction ${direction.id} references missing quick goal ${id}`);
    }
  }

  const journey: CompanionJourneyDefinition = {
    id: config.journeyId,
    version: config.version ?? 3,
    familyId: config.familyId,
    title: config.title,
    introduction: config.introduction,
    conversationTitle: `Choose your ${config.subject} direction`,
    conversationStartLabel: `Explore ${config.subject}`,
    startNodeId: firstNodeId,
    nodes: [
      {
        id: firstNodeId,
        kind: 'single_choice',
        prompt: config.first.prompt,
        helperText: config.first.helperText,
        options: config.first.options.map(([id, label]) => ({ id, label, nextNodeId: secondNodeId })),
      },
      {
        id: secondNodeId,
        kind: 'single_choice',
        prompt: config.second.prompt,
        helperText: config.second.helperText,
        options: config.second.options.map(([id, label]) => ({ id, label, nextNodeId: goalNodeId })),
      },
      {
        id: goalNodeId,
        kind: 'single_choice',
        createsGoalTypeId: goalTypeId,
        prompt: 'Which direction would feel useful now?',
        helperText: 'Choose a direction that can fit an ordinary week. You can make it smaller, change it, or pause it later.',
        options: config.directions.map((direction) => ({
          id: direction.id,
          label: direction.label,
          goalTitle: direction.goalTitle,
          suggestedQuickGoalIds: direction.quickGoalSuffixes.map((suffix) => `${config.familyId}:${suffix}`),
          nextNodeId: null,
        })),
        nextNodeId: null,
      },
    ],
    goalTypes: {
      [goalTypeId]: { label: `${config.title} direction`, fallbackTitle: config.title },
    },
    checkIn: {
      prompt: `What happened with ${config.subject} today?`,
      options: [
        { id: 'real-moment', label: 'I had a real moment with it' },
        { id: 'noticed-detail', label: 'I noticed something useful' },
        { id: 'adapted', label: 'I adapted the plan' },
        { id: 'not-today', label: 'It did not fit today' },
        { id: 'mixed', label: 'It felt mixed or unclear' },
      ],
    },
    stages: [
      { id: 'choose', title: 'Choose a direction', description: `Name what you want from ${config.subject}.`, requirement: { kind: 'goal_created', target: 1 } },
      { id: 'practice', title: 'Build real moments', description: `Share three real ${config.subject} moments.`, requirement: { kind: 'quest_completions', target: 3 } },
      { id: 'review', title: 'Notice the pattern', description: `Reflect on what your ${config.subject} moments are showing you.`, requirement: { kind: 'reflections', target: 1 } },
      { id: 'decide', title: 'Choose what continues', description: 'Keep, reshape, pause, or complete this Focus.', requirement: { kind: 'goal_resolved', target: 1 } },
    ],
    reflectionPrompts: {
      choose: `What would make this ${config.subject} direction worth returning to?`,
      practice: `What happened today that supported “{goal}”, and what did you notice?`,
      review: `Across your recent ${config.subject} moments, what is helping “{goal}” fit your life?`,
      decide: `What should happen next with “{goal}”: keep it, reshape it, pause it, or call it complete?`,
    },
  };

  return {
    familyId: config.familyId,
    journeyId: config.journeyId,
    journey,
    quickGoals,
    content: createEditorialCompanionPack(config.editorial),
  };
}
