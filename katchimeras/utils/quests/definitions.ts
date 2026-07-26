import type { QuestCapabilityId } from '@/utils/capabilities/quest-capabilities';
import type { Criterion } from '@/utils/signals/facts';
import { qualityThresholds } from '@/utils/intelligence/quality-registry';
import type {
  KatchimeraActivityLane,
  KatchimeraBondLevel,
} from '@/constants/katchimera-roles';
import type { KatchimeraFamilyId } from '@/types/katchimera';

// Declarative companion-quest catalogue (docs/katchimera-engagement-v1.md
// refactor). A quest is DATA: id + copy + a list of criteria against facts.
// The same criteria drive both the journal checklist and completion — no more
// parallel switch statements. Add a quest = add an entry; add a capability =
// add a fact + provider and reference it here.

export type QuestDefinition = {
  id: string;
  familyId?: KatchimeraFamilyId;
  lane?: Exclude<KatchimeraActivityLane, 'discovery'>;
  minimumBondLevel?: KatchimeraBondLevel;
  repeatPolicy?: {
    cadence: 'daily' | 'weekly' | 'anytime';
    cooldownDays: number;
  };
  progression?: {
    journeyId: string;
    stageId: string;
  };
  goalContribution?: {
    goalTypeIds?: readonly string[];
    amount: number;
  };
  family?: 'photo' | 'moment' | 'place' | 'movement' | 'note' | 'voice' | 'food' | 'studio' | 'sleep' | 'weather' | 'calendar';
  presentation?: {
    estimatedMinutes?: number;
    categoryLabel?: string;
    artworkKey?: string;
  };
  execution?:
    | { kind: 'evidence' }
    | { kind: 'live_steps'; challengeId: 'step_sprint' | 'step_time_trial'; difficultyCurveId: string }
    | { kind: 'trivia'; packIds: ('film' | 'books' | 'city')[]; questionCount: number }
    | { kind: 'paced_breathing'; patternId: 'bedrotte-calm-v1' | 'mendle-soften-v1'; difficultyCurveId: string }
    | { kind: 'timing_zone'; challengeId: 'steppling-stride' | 'mossprout-tend'; difficultyCurveId: string }
    | {
        kind: 'pattern_memory';
        gameId:
          | 'gatherglow-lights'
          | 'vesperitt-moon-signals'
          | 'coffee-ritual-brew-sequence'
          | 'dawnle-first-light'
          | 'quietome-still-signals';
        difficultyCurveId: string;
      }
    | { kind: 'sorting'; packId: 'feastle-table' | 'tasklet-triage' | 'errandimp-loops'; difficultyCurveId: string }
    | { kind: 'matching'; packId: 'relicoon-gallery' | 'mossprout-garden' | 'feastle-food'; difficultyCurveId: string }
    | { kind: 'merge'; packId: 'feastle-kitchen'; difficultyCurveId: 'feastle-merge-v1' }
    | { kind: 'block_jam'; packId: 'tasklet-desk'; difficultyCurveId: 'tasklet-desk-jam-v2' }
    | { kind: 'block_blast'; packId: 'cheerlet-party'; rulesetId: 'cheerlet-block-party-v2' }
    | { kind: 'rhythm'; gameId: 'encora-echo'; difficultyCurveId: string }
    | {
        kind: 'word_game';
        gameId: 'pagelet_lost_word';
        rulesetId: 'lost-word-v1';
        answerLength: 5;
        maxGuesses: 6;
        difficultyCurveId: 'pagelet-lost-word-v1';
      }
    | {
        kind: 'word_connect';
        gameId: 'pagelet_word_paths';
        packId: 'pagelet-word-paths';
        rulesetId: 'word-paths-v1';
        difficultyCurveId: 'pagelet-word-paths-v1';
      };
  eligibility?: {
    creatureKeys?: string[];
    minimumHomeLevel?: number;
    cooldownDays?: number;
    weight?: number;
  };
  submissionMode?: 'manual' | 'auto';
  themes?: string[];
  title: string;
  hint: string;
  criteria: Criterion[];
  requiresCapabilities?: QuestCapabilityId[];
  optionalCapabilities?: QuestCapabilityId[];
  suggestedActions?: string[];
  evidencePolicy?: {
    minConfidence?: number;
    allowCorroboration?: boolean;
  };
  offerVisibility?: 'default' | 'hide_when_unavailable';
  semanticVerification?: {
    id: string;
    version: number;
    request: string;
    matchCriteria: readonly string[];
    exclusions?: readonly string[];
    retryPrompt: string;
    modalities: readonly ('text' | 'voice')[];
    journalRouteFallbacks?: readonly string[];
  };
};

export type QuestPresentation = {
  categoryLabel: string;
  estimatedMinutes: number;
  artworkKey?: string;
};

export function questActivityLane(
  definition: QuestDefinition
): Exclude<KatchimeraActivityLane, 'discovery'> {
  if (definition.lane) return definition.lane;
  return definition.execution && definition.execution.kind !== 'evidence'
    ? 'mini_game'
    : 'real_life';
}

export function questPresentation(definition: QuestDefinition): QuestPresentation {
  const family = definition.family ?? inferQuestFamily(definition);
  const categoryLabel = definition.presentation?.categoryLabel ?? ({
    photo: 'Photo', moment: 'Moment', place: 'Explore', movement: 'Movement', note: 'Reflect', voice: 'Voice',
    food: 'Food', studio: 'Play', sleep: 'Calm', weather: 'Weather', calendar: 'Plan',
  } as const)[family];
  return {
    categoryLabel,
    estimatedMinutes: definition.presentation?.estimatedMinutes ?? estimatedMinutes(definition),
    artworkKey: definition.presentation?.artworkKey,
  };
}

function inferQuestFamily(definition: QuestDefinition): NonNullable<QuestDefinition['family']> {
  const kind = definition.execution?.kind;
  if (kind === 'live_steps') return 'movement';
  if (kind === 'paced_breathing') return 'sleep';
  if (kind === 'evidence') return 'photo';
  if (kind) return 'studio';
  return 'moment';
}

function estimatedMinutes(definition: QuestDefinition): number {
  const execution = definition.execution;
  if (execution?.kind === 'live_steps') return execution.challengeId === 'step_sprint' ? 1 : 5;
  if (execution?.kind === 'paced_breathing' || execution?.kind === 'timing_zone') return 2;
  if (execution?.kind === 'pattern_memory' || execution?.kind === 'sorting' || execution?.kind === 'matching' || execution?.kind === 'rhythm') return 3;
  if (execution?.kind === 'trivia' || execution?.kind === 'word_game' || execution?.kind === 'word_connect' || execution?.kind === 'merge' || execution?.kind === 'block_jam' || execution?.kind === 'block_blast') return 4;
  if (definition.family === 'movement' || definition.family === 'place') return 10;
  return 5;
}

function photoQualityCriterion(qualityId: string, label: string): Criterion {
  const thresholds = qualityThresholds(qualityId);
  return {
    fact: 'memory.qualities',
    op: 'qualityAtLeast',
    value: qualityId,
    qualityId,
    minimumScore: thresholds.ready,
    minConfidence: thresholds.ready,
    minimumCentrality: 'supporting',
    sourceTypes: ['photo'],
    label,
  };
}

type ProgressiveQuestSpec = {
  id: string;
  minimumBondLevel: KatchimeraBondLevel;
  title: string;
  hint: string;
  family: NonNullable<QuestDefinition['family']>;
  criteria: Criterion[];
  cooldownDays: number;
  weight: number;
  suggestedActions?: string[];
  requiresCapabilities?: QuestCapabilityId[];
  offerVisibility?: QuestDefinition['offerVisibility'];
  semanticVerification?: QuestDefinition['semanticVerification'];
};

function progressiveQuestPack(
  familyId: KatchimeraFamilyId,
  journeyId: string,
  creatureKey: string | readonly string[],
  specs: readonly ProgressiveQuestSpec[]
): Record<string, QuestDefinition> {
  return Object.fromEntries(specs.map((spec) => [
    spec.id,
    {
      id: spec.id,
      familyId,
      lane: 'real_life',
      minimumBondLevel: spec.minimumBondLevel,
      family: spec.family,
      title: spec.title,
      hint: spec.hint,
      criteria: spec.criteria,
      suggestedActions: spec.suggestedActions,
      requiresCapabilities: spec.requiresCapabilities,
      offerVisibility: spec.offerVisibility,
      semanticVerification: spec.semanticVerification,
      repeatPolicy: {
        cadence: spec.minimumBondLevel === 3 ? 'weekly' : 'anytime',
        cooldownDays: spec.cooldownDays,
      },
      progression: {
        journeyId,
        stageId: spec.minimumBondLevel === 3 ? 'review' : 'practice',
      },
      goalContribution: { amount: 1 },
      eligibility: {
        creatureKeys: typeof creatureKey === 'string' ? [creatureKey] : [...creatureKey],
        cooldownDays: spec.cooldownDays,
        weight: spec.weight,
      },
    },
  ]));
}

const SEMANTIC_QUEST_JOURNAL_ROUTE_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  'quest-flexel-training-detail': ['journal.route:movement.workout'],
  'quest-sprintail-run-detail': ['journal.route:movement.run'],
  'quest-hooplet-skill-detail': ['journal.route:movement.sport.basketball'],
  'quest-serveling-rally-detail': ['journal.route:movement.sport.tennis'],
  'quest-snuglet-care-detail': [
    'journal.route:people.my_child.care',
    'journal.route:people.family.care',
  ],
  'quest-rest-restored-detail': [
    'journal.route:general.rest',
    'journal.route:people.solo.rest',
  ],
  'quest-steppling-walk-detail': ['journal.route:movement.walk'],
  'quest-mossprout-living-detail': [
    'journal.route:went_somewhere.park',
    'journal.route:went_somewhere.garden',
    'journal.route:went_somewhere.forest',
  ],
  'quest-skylo-city-detail': [
    'journal.route:went_somewhere.city',
    'journal.route:went_somewhere.street',
  ],
  'quest-feastle-meal-detail': [
    'journal.route:food.meal',
    'journal.route:food.snack',
    'journal.route:food.cooking',
  ],
  'quest-tasklet-progress-detail': [
    'journal.route:work.progress',
    'journal.route:work.focus.progress',
    'journal.route:work.office.progress',
  ],
  'quest-cheerlet-progress-detail': [
    'journal.route:work.progress',
    'journal.route:big_event.achievement',
  ],
  'quest-shellio-water-detail': ['journal.route:went_somewhere.beach'],
};

function semanticNoteQuest(input: {
  id: string;
  minimumBondLevel: KatchimeraBondLevel;
  title: string;
  hint: string;
  request: string;
  criteria: readonly string[];
  exclusions?: readonly string[];
  retryPrompt: string;
  cooldownDays: number;
  weight: number;
}): ProgressiveQuestSpec {
  const journalRouteFallbacks = SEMANTIC_QUEST_JOURNAL_ROUTE_FALLBACKS[input.id] ?? [];
  return {
    id: input.id,
    minimumBondLevel: input.minimumBondLevel,
    title: input.title,
    hint: input.hint,
    family: 'note',
    criteria: [{
      fact: 'evidence.items',
      op: 'semanticQuestMatch',
      value: input.id,
      sourceTypes: ['text_note', 'voice_note'],
      journalRouteFallbacks,
      label: input.request,
    }],
    suggestedActions: ['add_note', 'record_voice'],
    requiresCapabilities: ['appleFoundation'],
    offerVisibility: 'hide_when_unavailable',
    semanticVerification: {
      id: input.id.replace(/^quest-/, ''),
      version: 1,
      request: input.request,
      matchCriteria: input.criteria,
      exclusions: input.exclusions,
      retryPrompt: input.retryPrompt,
      modalities: ['text', 'voice'],
      journalRouteFallbacks,
    },
    cooldownDays: input.cooldownDays,
    weight: input.weight,
  };
}

const RAW_QUEST_DEFINITIONS: Record<string, QuestDefinition> = {
  ...progressiveQuestPack('flexel', 'flexel-stronger-rhythm', 'flexel', [
    {
      id: 'quest-flexel-session-note', minimumBondLevel: 1, title: 'Show up to train',
      hint: 'Log a gym, strength, or mobility session you completed.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Log a training session' }],
      cooldownDays: 2, weight: 4, suggestedActions: ['add_note'],
    },
    semanticNoteQuest({
      id: 'quest-flexel-training-detail', minimumBondLevel: 1, title: 'Name what you trained',
      hint: 'Write or record what you trained and one concrete effort, form, resistance, or mobility detail.',
      request: 'Describe a real gym, strength, or mobility session and include one concrete training detail.',
      criteria: ['A real completed training session is described', 'At least one exercise, body area, form cue, resistance, set, repetition, or mobility detail is included'],
      exclusions: ['Plans for a future workout without completing it', 'Walking or running without strength, gym, or mobility work'],
      retryPrompt: 'Add what you trained and one concrete exercise, effort, form, resistance, or mobility detail.',
      cooldownDays: 2, weight: 6,
    }),
    {
      id: 'quest-flexel-recovery-note', minimumBondLevel: 2, title: 'Train, then listen',
      hint: 'Log how your body responded after training and one recovery choice.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a training recovery note' }],
      cooldownDays: 3, weight: 4, suggestedActions: ['add_note'],
    },
    semanticNoteQuest({
      id: 'quest-flexel-weekly-review', minimumBondLevel: 3, title: 'Read the training week',
      hint: 'Review what you trained, what progressed, and what you will adjust next.',
      request: 'Review the week of gym, strength, or mobility practice with a concrete example and one next adjustment.',
      criteria: ['At least one completed training example is named', 'A change, difficulty, or sign of progress is identified', 'One next adjustment or continuation is stated'],
      retryPrompt: 'Add one session example, what changed, and what you want to adjust or repeat next.',
      cooldownDays: 7, weight: 5,
    }),
  ]),
  ...progressiveQuestPack('sprintail', 'sprintail-running-rhythm', 'sprintail', [
    {
      id: 'quest-sprintail-run-day', minimumBondLevel: 1, title: 'Make room to run',
      hint: 'Complete a run or run-walk and let today’s movement support it.',
      family: 'movement', criteria: [{ fact: 'steps.count', op: 'gte', value: 3000, label: 'Build a movement day around a run' }],
      cooldownDays: 2, weight: 4,
    },
    semanticNoteQuest({
      id: 'quest-sprintail-run-detail', minimumBondLevel: 1, title: 'Keep the run',
      hint: 'Describe a real run and one pace, distance, route, endurance, or body-response detail.',
      request: 'Describe a real completed run or run-walk and include one concrete running detail.',
      criteria: ['A completed run or run-walk is explicit', 'At least one pace, distance, duration, route, endurance, interval, or body-response detail is included'],
      exclusions: ['Walking only', 'A future running plan without a completed run'],
      retryPrompt: 'Add what run you completed and one pace, distance, duration, route, or body-response detail.',
      cooldownDays: 2, weight: 6,
    }),
    {
      id: 'quest-sprintail-recovery', minimumBondLevel: 2, title: 'Notice the finish',
      hint: 'Keep a note about recovery, energy, or what helped you finish your run.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a run recovery note' }],
      cooldownDays: 3, weight: 4, suggestedActions: ['add_note'],
    },
    semanticNoteQuest({
      id: 'quest-sprintail-weekly-review', minimumBondLevel: 3, title: 'Read the running week',
      hint: 'Review one run, what it revealed, and the next realistic running step.',
      request: 'Review the week of running with one concrete run example, what it revealed, and one next step.',
      criteria: ['A completed run from the week is described', 'A pace, endurance, consistency, route, or recovery pattern is noticed', 'A realistic next running step is stated'],
      retryPrompt: 'Add one run example, what you learned from it, and the next running step.',
      cooldownDays: 7, weight: 5,
    }),
  ]),
  ...progressiveQuestPack('hooplet', 'hooplet-court-rhythm', 'hooplet', [
    {
      id: 'quest-hooplet-court-note', minimumBondLevel: 1, title: 'Get on court',
      hint: 'Log a basketball practice, shoot-around, or game.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Log a basketball session' }],
      cooldownDays: 2, weight: 4, suggestedActions: ['add_note'],
    },
    semanticNoteQuest({
      id: 'quest-hooplet-skill-detail', minimumBondLevel: 1, title: 'Work one court skill',
      hint: 'Describe a basketball session and one specific skill, drill, play, or team moment.',
      request: 'Describe a real basketball session and one specific basketball detail.',
      criteria: ['A completed basketball practice, shoot-around, or game is explicit', 'A shot, pass, dribble, defensive play, drill, decision, or team moment is described'],
      exclusions: ['Watching basketball without playing', 'General exercise with no basketball activity'],
      retryPrompt: 'Add the basketball activity and one shot, pass, dribble, defensive, drill, or team detail.',
      cooldownDays: 2, weight: 6,
    }),
    {
      id: 'quest-hooplet-team-moment', minimumBondLevel: 2, title: 'Notice the team',
      hint: 'Log one moment of communication, support, decision-making, or shared play.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a basketball team moment' }],
      cooldownDays: 3, weight: 4, suggestedActions: ['add_note'],
    },
    semanticNoteQuest({
      id: 'quest-hooplet-weekly-review', minimumBondLevel: 3, title: 'Read the court week',
      hint: 'Review one court moment, a skill pattern, and what to practise next.',
      request: 'Review the week of basketball with one concrete court example, one skill or teamwork pattern, and a next practice focus.',
      criteria: ['A real basketball moment from the week is named', 'A skill or teamwork pattern is identified', 'A next practice focus is stated'],
      retryPrompt: 'Add one court example, the pattern you noticed, and what you want to practise next.',
      cooldownDays: 7, weight: 5,
    }),
  ]),
  ...progressiveQuestPack('serveling', 'serveling-rally-rhythm', 'serveling', [
    {
      id: 'quest-serveling-session-note', minimumBondLevel: 1, title: 'Make time to rally',
      hint: 'Log a tennis or racket-sport practice or match.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Log a racket-sport session' }],
      cooldownDays: 2, weight: 4, suggestedActions: ['add_note'],
    },
    semanticNoteQuest({
      id: 'quest-serveling-rally-detail', minimumBondLevel: 1, title: 'Keep one rally',
      hint: 'Describe a racket-sport session and one serve, rally, stroke, match, or footwork detail.',
      request: 'Describe a real tennis or racket-sport session and one specific play detail.',
      criteria: ['A completed tennis or racket-sport practice or match is explicit', 'A serve, rally, stroke, return, point, match, or footwork detail is included'],
      exclusions: ['Watching a match without playing', 'General exercise with no racket sport'],
      retryPrompt: 'Add what you played and one serve, rally, stroke, return, match, or footwork detail.',
      cooldownDays: 2, weight: 6,
    }),
    {
      id: 'quest-serveling-reset-note', minimumBondLevel: 2, title: 'Reset between points',
      hint: 'Keep a note about one reset, adjustment, or recovery choice during play.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a between-points note' }],
      cooldownDays: 3, weight: 4, suggestedActions: ['add_note'],
    },
    semanticNoteQuest({
      id: 'quest-serveling-weekly-review', minimumBondLevel: 3, title: 'Read the rally week',
      hint: 'Review one session, a repeatable pattern, and your next practice focus.',
      request: 'Review the week of racket sport with one concrete session example, a play pattern, and a next practice focus.',
      criteria: ['A real session from the week is named', 'A serve, rally, stroke, movement, match, or mindset pattern is identified', 'A next practice focus is stated'],
      retryPrompt: 'Add one session example, the pattern you noticed, and what you want to practise next.',
      cooldownDays: 7, weight: 5,
    }),
  ]),
  ...progressiveQuestPack('snuglet', 'snuglet-everyday-care', 'snuglet', [
    {
      id: 'quest-snuglet-care-photo', minimumBondLevel: 1, title: 'Keep a caring moment',
      hint: 'Capture a real caregiving or family-care moment.',
      family: 'photo', criteria: [photoQualityCriterion('subject.baby', 'Capture a caregiving moment')],
      cooldownDays: 2, weight: 4, suggestedActions: ['take_photo'],
    },
    semanticNoteQuest({
      id: 'quest-snuglet-care-detail', minimumBondLevel: 1, title: 'Name the care you gave',
      hint: 'Describe one concrete act of care, who it supported, and what was needed.',
      request: 'Describe one real act of human caregiving and the need it supported.',
      criteria: ['A concrete completed act of care is described', 'The person or relationship being supported is clear', 'The need, routine, comfort, safety, or practical support is identified'],
      exclusions: ['A vague intention to be caring', 'Pet care'],
      retryPrompt: 'Add what you did, who it helped, and what they needed in that moment.',
      cooldownDays: 2, weight: 6,
    }),
    {
      id: 'quest-snuglet-caregiver-pause', minimumBondLevel: 2, title: 'Care for the carer',
      hint: 'Keep a note about one small pause, boundary, or request for support.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a caregiver support note' }],
      cooldownDays: 3, weight: 4, suggestedActions: ['add_note'],
    },
    semanticNoteQuest({
      id: 'quest-snuglet-weekly-review', minimumBondLevel: 3, title: 'Read the care week',
      hint: 'Review one care moment, what was needed repeatedly, and one adjustment for next week.',
      request: 'Review the week of caregiving with one concrete example, a repeated need or pattern, and one next adjustment.',
      criteria: ['A real caregiving example is named', 'A recurring need, pressure, connection, or routine is noticed', 'One next adjustment, boundary, or support choice is stated'],
      retryPrompt: 'Add one care example, the pattern you noticed, and one adjustment or support choice for next week.',
      cooldownDays: 7, weight: 5,
    }),
  ]),
  ...progressiveQuestPack('waglet', 'waglet-shared-routine', 'waglet', [
    {
      id: 'quest-waglet-companion-photo', minimumBondLevel: 1, title: 'Keep a dog moment',
      hint: 'Capture a real moment with your dog.',
      family: 'photo', criteria: [photoQualityCriterion('subject.dog', 'Capture a dog-companionship moment')],
      cooldownDays: 2, weight: 4, suggestedActions: ['take_photo'],
    },
    semanticNoteQuest({
      id: 'quest-waglet-care-detail', minimumBondLevel: 1, title: 'Share the routine',
      hint: 'Describe a real walk, play, training, comfort, or care moment with your dog.',
      request: 'Describe a real dog-companionship moment and one concrete activity or care detail.',
      criteria: ['The note is about the player’s real dog or a dog they care for', 'A completed walk, play, training, feeding, grooming, health, comfort, or shared-routine detail is included'],
      exclusions: ['Merely seeing an unfamiliar dog', 'Planning an activity without doing it'],
      retryPrompt: 'Add what you and the dog actually did and one walk, play, training, comfort, or care detail.',
      cooldownDays: 2, weight: 6,
    }),
    {
      id: 'quest-waglet-routine-note', minimumBondLevel: 2, title: 'Notice what they need',
      hint: 'Keep a note about one signal, preference, or routine your dog showed you.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a dog-routine note' }],
      cooldownDays: 3, weight: 4, suggestedActions: ['add_note'],
    },
    semanticNoteQuest({
      id: 'quest-waglet-weekly-review', minimumBondLevel: 3, title: 'Read the shared week',
      hint: 'Review one dog moment, a routine pattern, and one way to support the bond next.',
      request: 'Review the week with a dog using one concrete example, a routine or behaviour pattern, and one next care or connection choice.',
      criteria: ['A real dog-companionship example is named', 'A routine, need, behaviour, or connection pattern is noticed', 'One next care, training, play, or connection choice is stated'],
      retryPrompt: 'Add one dog moment, the pattern you noticed, and one care or connection choice for next week.',
      cooldownDays: 7, weight: 5,
    }),
  ]),
  ...progressiveQuestPack('whiskit', 'whiskit-gentle-attention', 'whiskit', [
    {
      id: 'quest-whiskit-companion-photo', minimumBondLevel: 1, title: 'Keep a cat moment',
      hint: 'Capture a real moment with your cat.',
      family: 'photo', criteria: [photoQualityCriterion('subject.cat', 'Capture a cat-companionship moment')],
      cooldownDays: 2, weight: 4, suggestedActions: ['take_photo'],
    },
    semanticNoteQuest({
      id: 'quest-whiskit-enrichment-detail', minimumBondLevel: 1, title: 'Follow their curiosity',
      hint: 'Describe a real play, enrichment, comfort, behaviour, or care moment with your cat.',
      request: 'Describe a real cat-companionship moment and one concrete play, enrichment, behaviour, comfort, or care detail.',
      criteria: ['The note is about the player’s real cat or a cat they care for', 'A completed play, enrichment, feeding, grooming, health, comfort, observation, or care detail is included'],
      exclusions: ['Merely seeing an unfamiliar cat', 'Planning an activity without doing it'],
      retryPrompt: 'Add what happened with the cat and one play, enrichment, behaviour, comfort, or care detail.',
      cooldownDays: 2, weight: 6,
    }),
    {
      id: 'quest-whiskit-pattern-note', minimumBondLevel: 2, title: 'Notice their pattern',
      hint: 'Keep a note about one preference, signal, hiding place, or repeated behaviour.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a cat-pattern note' }],
      cooldownDays: 3, weight: 4, suggestedActions: ['add_note'],
    },
    semanticNoteQuest({
      id: 'quest-whiskit-weekly-review', minimumBondLevel: 3, title: 'Read the quiet week',
      hint: 'Review one cat moment, a behaviour pattern, and one way to support comfort or connection.',
      request: 'Review the week with a cat using one concrete example, a behaviour or routine pattern, and one next care or connection choice.',
      criteria: ['A real cat-companionship example is named', 'A behaviour, preference, need, comfort, or routine pattern is noticed', 'One next care, enrichment, comfort, or connection choice is stated'],
      retryPrompt: 'Add one cat moment, the pattern you noticed, and one care or connection choice for next week.',
      cooldownDays: 7, weight: 5,
    }),
  ]),
  ...progressiveQuestPack('sleep-rest', 'sleep-rest-gentle-recovery', ['bedrotte', 'snoozle'], [
    semanticNoteQuest({
      id: 'quest-rest-restored-detail', minimumBondLevel: 1, title: 'What restored you?',
      hint: 'Write or record one real thing you did to rest or recover, and what changed afterward.',
      request: 'Describe one real rest or recovery action you completed and one concrete effect it had on you.',
      criteria: ['A completed rest, recovery, or wind-down action is described', 'A concrete effect on energy, tension, mood, attention, or readiness is included'],
      exclusions: ['Only saying that rest is important', 'A future plan with no completed action'],
      retryPrompt: 'Add what you actually did to rest or recover and what changed afterward.',
      cooldownDays: 2, weight: 12,
    }),
  ]),
  ...progressiveQuestPack('steppling', 'steppling-everyday-momentum', 'steppling', [
    semanticNoteQuest({
      id: 'quest-steppling-walk-detail', minimumBondLevel: 1, title: 'What did the walk give you?',
      hint: 'After a real walk, share one detail from it and how you felt by the end.',
      request: 'Describe a walk you completed, one concrete detail from it, and how your body, energy, attention, or mood felt afterward.',
      criteria: ['A real completed walk is described', 'A route, sensory, pace, body, or surroundings detail is included', 'An afterward effect or feeling is included'],
      exclusions: ['Planning a future walk', 'General thoughts about walking without a real walk'],
      retryPrompt: 'Add one detail from the walk and how you felt by the end.',
      cooldownDays: 2, weight: 12,
    }),
  ]),
  ...progressiveQuestPack('mossprout', 'mossprout-nearby-nature', 'mossprout', [
    semanticNoteQuest({
      id: 'quest-mossprout-living-detail', minimumBondLevel: 1, title: 'Notice one living detail',
      hint: 'Share something specific you noticed in a real green or outdoor place today.',
      request: 'Describe a real moment in nature or a green space and one specific living, seasonal, sensory, or changing detail you noticed.',
      criteria: ['A real outdoor, nature, garden, park, plant, or green-space moment is described', 'A specific observed detail is included'],
      exclusions: ['A generic statement about liking nature', 'A future plan to go outside'],
      retryPrompt: 'Add where you were and one specific thing you noticed growing, moving, sounding, smelling, or changing.',
      cooldownDays: 2, weight: 12,
    }),
  ]),
  ...progressiveQuestPack('skylo', 'skylo-local-discovery', 'skylo', [
    semanticNoteQuest({
      id: 'quest-skylo-city-detail', minimumBondLevel: 1, title: 'Read one city detail',
      hint: 'Share one overlooked detail from a real local place, street, or journey.',
      request: 'Describe a real local urban place or journey and one concrete detail you noticed about how it looked, felt, worked, or changed.',
      criteria: ['A real street, neighbourhood, local venue, public space, or urban journey is described', 'A concrete observed detail is included'],
      exclusions: ['A future travel wish', 'Naming a city without describing a real moment'],
      retryPrompt: 'Add the local place or journey and one specific detail you noticed there.',
      cooldownDays: 2, weight: 12,
    }),
  ]),
  ...progressiveQuestPack('feastle', 'feastle-meaningful-meals', 'feastle', [
    semanticNoteQuest({
      id: 'quest-feastle-meal-detail', minimumBondLevel: 1, title: 'Why did this meal matter?',
      hint: 'Share a real meal and one detail that made it nourishing, interesting, comforting, or connecting.',
      request: 'Describe a real meal you ate, made, or shared and one concrete detail about its taste, care, novelty, comfort, or connection.',
      criteria: ['A real meal, snack, cooking, or shared-food moment is described', 'A concrete taste, preparation, care, novelty, comfort, or connection detail is included'],
      exclusions: ['Only listing food with no lived detail', 'A future meal plan'],
      retryPrompt: 'Add what you ate or made and one detail about its taste, care, comfort, novelty, or company.',
      cooldownDays: 2, weight: 12,
    }),
  ]),
  ...progressiveQuestPack('tasklet', 'tasklet-focus-journey', 'tasklet', [
    semanticNoteQuest({
      id: 'quest-tasklet-progress-detail', minimumBondLevel: 1, title: 'What moved forward?',
      hint: 'Share one task you actually moved and the concrete step that changed it.',
      request: 'Describe a real task or project you moved forward, the concrete action you completed, and what that unlocked or made next.',
      criteria: ['A real task or project is named', 'A completed concrete action is described', 'A result, decision, or next step is included'],
      exclusions: ['A to-do list with no completed action', 'Only saying that work was busy'],
      retryPrompt: 'Add the action you actually completed and what it unlocked or made possible next.',
      cooldownDays: 2, weight: 12,
    }),
  ]),
  ...progressiveQuestPack('cheerlet', 'cheerlet-visible-progress', 'cheerlet', [
    semanticNoteQuest({
      id: 'quest-cheerlet-progress-detail', minimumBondLevel: 1, title: 'Why does this progress matter?',
      hint: 'Name one real bit of progress and why it is worth noticing.',
      request: 'Describe one real piece of progress, effort, milestone, or brave step and explain why it matters to you.',
      criteria: ['A concrete progress moment, effort, milestone, or brave step is described', 'Its personal meaning or value is included'],
      exclusions: ['Generic positive affirmations with no real event', 'A future hope with no present progress'],
      retryPrompt: 'Add what actually happened and why that piece of progress matters to you.',
      cooldownDays: 2, weight: 12,
    }),
  ]),
  ...progressiveQuestPack('vesperitt', 'vesperitt-intentional-nights', 'vesperitt', [
    semanticNoteQuest({
      id: 'quest-vesperitt-night-detail', minimumBondLevel: 1, title: 'Was the night chosen?',
      hint: 'Share what filled a real late night and whether it felt intentional or drifted.',
      request: 'Describe a real late-night moment, what you were doing, and whether it felt deliberately chosen or like unplanned drift.',
      criteria: ['A real late-night moment or activity is described', 'The player reflects on whether it was intentional or drifted'],
      exclusions: ['A general opinion about sleep with no real night', 'A future bedtime plan only'],
      retryPrompt: 'Add what actually filled the late hours and whether you chose it or drifted into it.',
      cooldownDays: 2, weight: 12,
    }),
  ]),
  ...progressiveQuestPack('shellio', 'shellio-water-connection', 'shellio', [
    semanticNoteQuest({
      id: 'quest-shellio-water-detail', minimumBondLevel: 1, title: 'Notice the waterline',
      hint: 'Share a real moment by water and one sensory or changing detail you noticed.',
      request: 'Describe a real moment by the sea, a river, lake, canal, or other water and one concrete sensory, movement, weather, wildlife, or changing detail.',
      criteria: ['A real waterside or water-related moment is described', 'A specific sensory, movement, weather, wildlife, or changing detail is included'],
      exclusions: ['A future beach plan', 'Naming a body of water without a real observed moment'],
      retryPrompt: 'Add where you were by water and one specific thing you saw, heard, felt, smelled, or noticed changing.',
      cooldownDays: 2, weight: 12,
    }),
  ]),
  ...progressiveQuestPack('flickerbun', 'flickerbun-intentional-watching', 'flickerbun', [
    {
      id: 'quest-flickerbun-watch',
      minimumBondLevel: 1,
      title: 'Choose a story on purpose',
      hint: 'Log a film or show you deliberately chose to spend time with.',
      family: 'studio',
      criteria: [{ fact: 'studio.media', op: 'includes', value: 'film', label: 'Log a film or show' }],
      cooldownDays: 2,
      weight: 5,
    },
    {
      id: 'quest-flickerbun-scene-note',
      minimumBondLevel: 1,
      title: 'Keep one scene',
      hint: 'Keep a short note about one scene, feeling, or idea that stayed after the credits.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a screen-story note' }],
      cooldownDays: 2,
      weight: 4,
      suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-flickerbun-new-perspective',
      minimumBondLevel: 2,
      title: 'Watch beyond the familiar',
      hint: 'Try a story outside your usual genre or viewpoint, then note what felt different.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record a new screen-story perspective' }],
      cooldownDays: 3,
      weight: 4,
      suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-flickerbun-weekly-review',
      minimumBondLevel: 3,
      title: 'Read the week’s watchlist',
      hint: 'Review what you watched, what stayed with you, and which choices felt genuinely worthwhile.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short watching review' }],
      cooldownDays: 7,
      weight: 5,
      suggestedActions: ['add_note', 'record_voice'],
    },
  ]),
  ...progressiveQuestPack('relicoon', 'relicoon-cultural-trail', 'relicoon', [
    {
      id: 'quest-relicoon-object-note',
      minimumBondLevel: 1,
      title: 'Follow one object’s story',
      hint: 'Choose an object, artwork, or building and keep one detail about the people or time behind it.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep an object-story note' }],
      cooldownDays: 2,
      weight: 4,
      suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-relicoon-museum-visit',
      minimumBondLevel: 1,
      title: 'Wander the halls',
      hint: 'Visit a museum or gallery and confirm it on your map.',
      family: 'place',
      criteria: [{ fact: 'places.categories', op: 'includes', value: 'museum', label: 'Confirm a museum or gallery' }],
      cooldownDays: 3,
      weight: 5,
    },
    {
      id: 'quest-relicoon-context-note',
      minimumBondLevel: 2,
      title: 'Add the human context',
      hint: 'Follow one cultural detail far enough to learn who made, used, protected, or contested it.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a cultural context note' }],
      cooldownDays: 3,
      weight: 4,
      suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-relicoon-weekly-review',
      minimumBondLevel: 3,
      title: 'Gather the week’s traces',
      hint: 'Review the objects, places, and stories you followed and choose one cultural thread to carry onward.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short cultural review' }],
      cooldownDays: 7,
      weight: 5,
      suggestedActions: ['add_note', 'record_voice'],
    },
  ]),
  ...progressiveQuestPack('encora', 'encora-active-music', 'encora', [
    {
      id: 'quest-encora-listening-note',
      minimumBondLevel: 1,
      title: 'Hear one song closely',
      hint: 'Listen without multitasking, then keep one detail you heard or felt differently.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep an active-listening note' }],
      cooldownDays: 2,
      weight: 5,
      suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-encora-music-moment',
      minimumBondLevel: 1,
      title: 'Name the music in this moment',
      hint: 'Keep a note about a song, performance, or sound that met the mood today.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record a meaningful music moment' }],
      cooldownDays: 2,
      weight: 4,
      suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-encora-practice-note',
      minimumBondLevel: 2,
      title: 'Return to the sound',
      hint: 'Make, sing, or practise music, then note one thing that changed through the repetition.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a music-practice note' }],
      cooldownDays: 3,
      weight: 4,
      suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-encora-weekly-review',
      minimumBondLevel: 3,
      title: 'Hear the week’s pattern',
      hint: 'Review what you listened to, made, or shared and choose the musical direction worth repeating.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short music review' }],
      cooldownDays: 7,
      weight: 5,
      suggestedActions: ['add_note', 'record_voice'],
    },
  ]),
  ...progressiveQuestPack('gatherglow', 'gatherglow-tended-connection', 'gatherglow', [
    {
      id: 'quest-gatherglow-reach-out',
      minimumBondLevel: 1,
      title: 'Reach out first',
      hint: 'Send a genuine message, then keep a note about the relationship you chose to tend.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record one intentional reach-out' }],
      cooldownDays: 2,
      weight: 5,
      suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-gatherglow-shared-moment',
      minimumBondLevel: 1,
      title: 'Keep a shared moment',
      hint: 'Capture one moment that felt genuinely shared rather than merely crowded.',
      family: 'moment',
      criteria: [{ fact: 'moments.captured', op: 'gte', value: 1, label: 'Capture a shared moment' }],
      cooldownDays: 2,
      weight: 4,
      suggestedActions: ['take_photo', 'add_note'],
    },
    {
      id: 'quest-gatherglow-deeper-checkin',
      minimumBondLevel: 2,
      title: 'Ask one layer deeper',
      hint: 'Make space for a more genuine check-in, then note what helped the conversation feel real.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a deeper-connection note' }],
      cooldownDays: 3,
      weight: 4,
      suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-gatherglow-weekly-review',
      minimumBondLevel: 3,
      title: 'Read the week’s connections',
      hint: 'Review when connection felt mutual, who you want to return to, and one social rhythm worth tending.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short connection review' }],
      cooldownDays: 7,
      weight: 5,
      suggestedActions: ['add_note', 'record_voice'],
    },
  ]),
  ...progressiveQuestPack('cheerlet', 'cheerlet-visible-progress', 'cheerlet', [
    {
      id: 'quest-cheerlet-name-progress',
      minimumBondLevel: 1,
      title: 'Give progress a name',
      hint: 'Keep a short note about one thing that moved, improved, began, or came to an end.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Name one piece of progress' }],
      cooldownDays: 2,
      weight: 5,
      suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-cheerlet-celebrate-note',
      minimumBondLevel: 1,
      title: 'Say what deserves celebration',
      hint: 'Record a voice note about a win, milestone, or chapter worth acknowledging.',
      family: 'voice',
      criteria: [{ fact: 'notes.voiceAdded', op: 'gte', value: 1, label: 'Record a celebration voice note' }],
      cooldownDays: 2,
      weight: 4,
      suggestedActions: ['record_voice', 'add_note'],
    },
    {
      id: 'quest-cheerlet-mark-chapter',
      minimumBondLevel: 2,
      title: 'Mark the chapter',
      hint: 'Keep what changed, what it took, and who helped before the moment moves on.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a chapter-change note' }],
      cooldownDays: 3,
      weight: 4,
      suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-cheerlet-weekly-review',
      minimumBondLevel: 3,
      title: 'Gather the week’s wins',
      hint: 'Review the week for progress, support, beginnings, and endings that deserve credit.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short progress review' }],
      cooldownDays: 7,
      weight: 5,
      suggestedActions: ['add_note', 'record_voice'],
    },
  ]),
  ...progressiveQuestPack('skylo', 'skylo-local-discovery', 'skylo', [
    {
      id: 'quest-skylo-city-photo',
      minimumBondLevel: 1,
      title: 'Catch one city detail',
      hint: 'Photograph a detail that makes this street, building, or neighbourhood feel distinct.',
      family: 'photo',
      criteria: [photoQualityCriterion('place.city', 'Photograph the city')],
      cooldownDays: 2,
      weight: 5,
      suggestedActions: ['take_photo'],
    },
    {
      id: 'quest-skylo-local-stop',
      minimumBondLevel: 1,
      title: 'Stop instead of passing',
      hint: 'Visit or confirm one local place you would usually pass without entering.',
      family: 'place',
      criteria: [{ fact: 'places.confirmed', op: 'gte', value: 1, label: 'Confirm a local place' }],
      cooldownDays: 2,
      weight: 4,
    },
    {
      id: 'quest-skylo-neighbourhood-note',
      minimumBondLevel: 2,
      title: 'Know one neighbourhood better',
      hint: 'Explore beyond your usual route and keep one note about what made the area feel different.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a neighbourhood note' }],
      cooldownDays: 3,
      weight: 4,
      suggestedActions: ['add_note', 'take_photo'],
    },
    {
      id: 'quest-skylo-weekly-review',
      minimumBondLevel: 3,
      title: 'Map the week’s detours',
      hint: 'Review the places, streets, and details you discovered and choose where curiosity should lead next.',
      family: 'note',
      criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short local-exploration review' }],
      cooldownDays: 7,
      weight: 5,
      suggestedActions: ['add_note', 'record_voice'],
    },
  ]),
  ...progressiveQuestPack('coffee-ritual', 'coffee-ritual-intentional-pause', 'baristabbit', [
    {
      id: 'quest-coffee-ritual-pause', minimumBondLevel: 1,
      title: 'Pause for the first sip', hint: 'Capture a drink moment you chose to experience without rushing.',
      family: 'food', criteria: [{ fact: 'food.moments', op: 'gte', value: 1, label: 'Log a drink or café moment' }],
      cooldownDays: 2, weight: 5, suggestedActions: ['take_photo', 'add_note'],
    },
    {
      id: 'quest-coffee-ritual-note', minimumBondLevel: 1,
      title: 'Name what the pause was for', hint: 'Keep a short note about whether the ritual helped you begin, pause, connect, or feel comforted.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a ritual note' }],
      cooldownDays: 2, weight: 4, suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-coffee-ritual-redesign', minimumBondLevel: 2,
      title: 'Redesign one small ritual', hint: 'Change one cue, setting, or boundary around the ritual and note what became more intentional.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record a ritual experiment' }],
      cooldownDays: 3, weight: 4, suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-coffee-ritual-weekly-review', minimumBondLevel: 3,
      title: 'Read the week’s pauses', hint: 'Review when the ritual became a real pause and which version is worth repeating.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short ritual review' }],
      cooldownDays: 7, weight: 5, suggestedActions: ['add_note', 'record_voice'],
    },
  ]),
  ...progressiveQuestPack('errandimp', 'errandimp-lighter-loops', 'errandimp', [
    {
      id: 'quest-errandimp-close-loop', minimumBondLevel: 1,
      title: 'Close one loose loop', hint: 'Finish one practical task, then keep a short record of what is no longer occupying attention.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record one closed practical loop' }],
      cooldownDays: 2, weight: 5, suggestedActions: ['add_note'],
    },
    {
      id: 'quest-errandimp-reset-note', minimumBondLevel: 1,
      title: 'Reset one useful space', hint: 'Do a small household reset and note what became easier to use.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record one household reset' }],
      cooldownDays: 2, weight: 4, suggestedActions: ['add_note', 'take_photo'],
    },
    {
      id: 'quest-errandimp-maintenance', minimumBondLevel: 2,
      title: 'Handle it before it becomes urgent', hint: 'Complete one maintenance or admin task early and note the future friction it removed.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record proactive maintenance' }],
      cooldownDays: 3, weight: 4, suggestedActions: ['add_note'],
    },
    {
      id: 'quest-errandimp-weekly-review', minimumBondLevel: 3,
      title: 'Clear the week’s practical fog', hint: 'Review what was closed, what still matters, and what can consciously wait.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short life-admin review' }],
      cooldownDays: 7, weight: 5, suggestedActions: ['add_note', 'record_voice'],
    },
  ]),
  ...progressiveQuestPack('dawnle', 'dawnle-kinder-beginnings', 'dawnle', [
    {
      id: 'quest-dawnle-first-light-photo', minimumBondLevel: 1,
      title: 'Catch the first light', hint: 'Capture a morning moment before 8am that helped the day begin.',
      family: 'photo', criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'time.before_8am', sourceTypes: ['photo'], label: 'A photo before 8am' }],
      cooldownDays: 2, weight: 5, suggestedActions: ['take_photo'],
    },
    {
      id: 'quest-dawnle-morning-note', minimumBondLevel: 1,
      title: 'Name what set the tone', hint: 'Keep a short note about the first action, cue, or interruption that shaped the morning.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a morning-start note' }],
      cooldownDays: 2, weight: 4, suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-dawnle-prepare-start', minimumBondLevel: 2,
      title: 'Prepare a kinder beginning', hint: 'Prepare one morning cue the night before, then note whether the start felt easier.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record a prepared morning start' }],
      cooldownDays: 3, weight: 4, suggestedActions: ['add_note'],
    },
    {
      id: 'quest-dawnle-weekly-review', minimumBondLevel: 3,
      title: 'Read the week’s beginnings', hint: 'Review which first actions reduced rushing or supported energy and choose one to continue.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short morning review' }],
      cooldownDays: 7, weight: 5, suggestedActions: ['add_note', 'record_voice'],
    },
  ]),
  ...progressiveQuestPack('mendle', 'mendle-gentle-repair', 'mendle', [
    {
      id: 'quest-mendle-honest-checkin', minimumBondLevel: 1,
      title: 'Name the tender truth', hint: 'Keep one honest check-in about what you feel and what the next hour needs.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep an emotional check-in' }],
      cooldownDays: 2, weight: 5, suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-mendle-kind-action', minimumBondLevel: 1,
      title: 'Choose one kind action', hint: 'Do one small supportive thing, then note what pressure it softened.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record one act of self-kindness' }],
      cooldownDays: 2, weight: 4, suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-mendle-repair-note', minimumBondLevel: 2,
      title: 'Find the fairer story', hint: 'Notice one harsh interpretation and write a more accurate, compassionate version.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a gentle repair note' }],
      cooldownDays: 3, weight: 4, suggestedActions: ['add_note'],
    },
    {
      id: 'quest-mendle-weekly-review', minimumBondLevel: 3,
      title: 'Notice what helped repair', hint: 'Review the week without grading it: what softened pressure, supported honesty, or helped you reach out?',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short emotional-recovery review' }],
      cooldownDays: 7, weight: 5, suggestedActions: ['add_note', 'record_voice'],
    },
  ]),
  ...progressiveQuestPack('quietome', 'quietome-chosen-solitude', 'quietome', [
    {
      id: 'quest-quietome-one-line', minimumBondLevel: 1,
      title: 'Keep one honest line', hint: 'Use one line to name what is present without turning it into a full solution.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write one honest reflective line' }],
      cooldownDays: 2, weight: 5, suggestedActions: ['add_note'],
    },
    {
      id: 'quest-quietome-solo-pause', minimumBondLevel: 1,
      title: 'Choose a quiet pause', hint: 'Take a short pause with less input and keep a note about what became noticeable.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a chosen-solitude note' }],
      cooldownDays: 2, weight: 4, suggestedActions: ['add_note', 'record_voice'],
    },
    {
      id: 'quest-quietome-returning-question', minimumBondLevel: 2,
      title: 'Return without forcing an answer', hint: 'Spend time with one recurring question and record what shifted, even if nothing resolved.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a returning-question note' }],
      cooldownDays: 3, weight: 4, suggestedActions: ['add_note'],
    },
    {
      id: 'quest-quietome-weekly-review', minimumBondLevel: 3,
      title: 'Read the week’s quiet', hint: 'Review what solitude clarified, what kept returning, and which question can remain open.',
      family: 'note', criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short solitude review' }],
      cooldownDays: 7, weight: 5, suggestedActions: ['add_note', 'record_voice'],
    },
  ]),
  'quest-step-sprint': {
    id: 'quest-step-sprint',
    familyId: 'steppling',
    family: 'movement',
    title: 'Quick feet',
    hint: 'See how many steps you can take before the minute runs out.',
    criteria: [],
    requiresCapabilities: ['health.steps'],
    execution: { kind: 'live_steps', challengeId: 'step_sprint', difficultyCurveId: 'step-sprint-v1' },
    eligibility: { creatureKeys: ['steppling'], cooldownDays: 1, weight: 3 },
  },
  'quest-step-time-trial': {
    id: 'quest-step-time-trial',
    familyId: 'steppling',
    family: 'movement',
    title: 'Beat the trail clock',
    hint: 'Reach the step target and see how long it takes.',
    criteria: [],
    requiresCapabilities: ['health.steps'],
    execution: { kind: 'live_steps', challengeId: 'step_time_trial', difficultyCurveId: 'step-time-trial-v1' },
    eligibility: { creatureKeys: ['steppling'], cooldownDays: 1, weight: 2 },
  },
  'quest-film-trivia': {
    id: 'quest-film-trivia',
    familyId: 'flickerbun',
    family: 'studio',
    title: 'Five frames of film trivia',
    hint: 'Answer five quick film questions. Finishing the round completes the quest.',
    criteria: [],
    execution: { kind: 'trivia', packIds: ['film'], questionCount: 5 },
    eligibility: { creatureKeys: ['flickerbun'], cooldownDays: 1, weight: 3 },
  },
  'quest-book-trivia': {
    id: 'quest-book-trivia',
    familyId: 'pagelet',
    family: 'studio',
    title: 'Five questions from the shelves',
    hint: 'Answer five quick book questions. Finishing the round completes the quest.',
    criteria: [],
    execution: { kind: 'trivia', packIds: ['books'], questionCount: 5 },
    eligibility: { creatureKeys: ['pagelet'], cooldownDays: 1, weight: 3 },
  },
  'quest-pagelet-lost-word': {
    id: 'quest-pagelet-lost-word',
    familyId: 'pagelet',
    family: 'studio',
    title: 'Pagelet\'s Lost Word',
    hint: 'Find a five-letter word from Pagelet\'s shelves. Finishing the round completes the quest.',
    criteria: [],
    execution: {
      kind: 'word_game',
      gameId: 'pagelet_lost_word',
      rulesetId: 'lost-word-v1',
      answerLength: 5,
      maxGuesses: 6,
      difficultyCurveId: 'pagelet-lost-word-v1',
    },
    eligibility: { creatureKeys: ['pagelet'], cooldownDays: 1, weight: 3 },
  },
  'quest-pagelet-word-paths': {
    id: 'quest-pagelet-word-paths',
    familyId: 'pagelet',
    family: 'studio',
    title: 'Pagelet\'s Word Paths',
    hint: 'Link the shelf letters to uncover every crossing word.',
    criteria: [],
    execution: {
      kind: 'word_connect',
      gameId: 'pagelet_word_paths',
      packId: 'pagelet-word-paths',
      rulesetId: 'word-paths-v1',
      difficultyCurveId: 'pagelet-word-paths-v1',
    },
    requiresCapabilities: [],
    submissionMode: 'auto',
    eligibility: { creatureKeys: ['pagelet'], cooldownDays: 1, weight: 3 },
  },
  'quest-bedrotte-breathe': {
    id: 'quest-bedrotte-breathe', familyId: 'sleep-rest', family: 'sleep', title: 'Breathe together',
    hint: 'Settle into a few slow breaths with your rest companion.', criteria: [],
    execution: { kind: 'paced_breathing', patternId: 'bedrotte-calm-v1', difficultyCurveId: 'bedrotte-calm-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['bedrotte', 'snoozle'], cooldownDays: 1, weight: 3 },
  },
  'quest-bedrotte-rest-note': {
    id: 'quest-bedrotte-rest-note',
    familyId: 'sleep-rest',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'note',
    title: 'Name what restored you',
    hint: 'Keep a short note about something that helped you slow down or recover today.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Add a rest or recovery note today' }],
    suggestedActions: ['add_note'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'sleep-rest-gentle-recovery', stageId: 'practice' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['bedrotte', 'snoozle'], cooldownDays: 2, weight: 5 },
  },
  'quest-rest-wind-down': {
    id: 'quest-rest-wind-down',
    familyId: 'sleep-rest',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'note',
    title: 'Make one gentle landing',
    hint: 'Try one small wind-down ritual, then keep a note about whether it helped the day feel finished.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record one wind-down ritual you tried' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'sleep-rest-gentle-recovery', stageId: 'practice' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['bedrotte', 'snoozle'], cooldownDays: 2, weight: 5 },
  },
  'quest-rest-boundary': {
    id: 'quest-rest-boundary',
    familyId: 'sleep-rest',
    lane: 'real_life',
    minimumBondLevel: 2,
    family: 'note',
    title: 'Leave one thing for tomorrow',
    hint: 'Choose one non-urgent thing not to finish tonight, and keep a short note about the boundary.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record one thing you consciously left for tomorrow' }],
    suggestedActions: ['add_note'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 3 },
    progression: { journeyId: 'sleep-rest-gentle-recovery', stageId: 'practice' },
    goalContribution: { goalTypeIds: ['wind-down', 'recovery', 'restorative-downtime', 'rest-boundary'], amount: 1 },
    eligibility: { creatureKeys: ['bedrotte', 'snoozle'], cooldownDays: 3, weight: 4 },
  },
  'quest-rest-recovery-checkin': {
    id: 'quest-rest-recovery-checkin',
    familyId: 'sleep-rest',
    lane: 'real_life',
    minimumBondLevel: 2,
    family: 'note',
    title: 'Check what restored you',
    hint: 'After a demanding stretch, note what changed your energy—even if the answer is “not enough yet.”',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep an honest recovery check-in' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 3 },
    progression: { journeyId: 'sleep-rest-gentle-recovery', stageId: 'practice' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['bedrotte', 'snoozle'], cooldownDays: 3, weight: 4 },
  },
  'quest-rest-weekly-review': {
    id: 'quest-rest-weekly-review',
    familyId: 'sleep-rest',
    lane: 'real_life',
    minimumBondLevel: 3,
    family: 'note',
    title: 'Read the week’s recovery pattern',
    hint: 'Review what restored you, what drained you, and one rest choice worth carrying into next week.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short weekly rest and recovery review' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'weekly', cooldownDays: 7 },
    progression: { journeyId: 'sleep-rest-gentle-recovery', stageId: 'review' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['bedrotte', 'snoozle'], cooldownDays: 7, weight: 5 },
  },
  'quest-steppling-stride': {
    id: 'quest-steppling-stride', familyId: 'steppling', family: 'movement', title: 'Catch the stride',
    hint: 'Tap as the marker crosses Steppling’s stride zone.', criteria: [],
    execution: { kind: 'timing_zone', challengeId: 'steppling-stride', difficultyCurveId: 'steppling-stride-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['steppling'], cooldownDays: 1, weight: 3 },
  },
  'quest-steppling-gentle-walk': {
    id: 'quest-steppling-gentle-walk',
    familyId: 'steppling',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'movement',
    title: 'A walk that counts',
    hint: 'Let an ordinary walk carry you past 4,000 steps today.',
    criteria: [{ fact: 'steps.count', op: 'gte', value: 4000, label: 'Walk 4,000+ steps today' }],
    requiresCapabilities: ['health.steps'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 1 },
    progression: { journeyId: 'steppling-everyday-momentum', stageId: 'walk' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['steppling'], cooldownDays: 1, weight: 4 },
  },
  'quest-steppling-walk-note': {
    id: 'quest-steppling-walk-note',
    familyId: 'steppling',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'note',
    title: 'What the walk gave you',
    hint: 'After a walk, keep one short note about what changed in your energy, attention, or mood.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a short walking note' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'steppling-everyday-momentum', stageId: 'walk' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['steppling'], cooldownDays: 2, weight: 4 },
  },
  'quest-steppling-weekly-review': {
    id: 'quest-steppling-weekly-review',
    familyId: 'steppling',
    lane: 'real_life',
    minimumBondLevel: 3,
    family: 'note',
    title: 'Read your walking week',
    hint: 'Review when walking fit most naturally, what it gave you, and one route or rhythm worth repeating.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short walking review' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'weekly', cooldownDays: 7 },
    progression: { journeyId: 'steppling-everyday-momentum', stageId: 'review' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['steppling'], cooldownDays: 7, weight: 5 },
  },
  'quest-mossprout-tend': {
    id: 'quest-mossprout-tend', familyId: 'mossprout', family: 'place', title: 'Tend Mossprout’s patch',
    hint: 'Time each drop so the little patch gets just enough water.', criteria: [],
    execution: { kind: 'timing_zone', challengeId: 'mossprout-tend', difficultyCurveId: 'mossprout-tend-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['mossprout'], cooldownDays: 1, weight: 3 },
  },
  'quest-mossprout-memory': {
    id: 'quest-mossprout-memory', familyId: 'mossprout', family: 'place', title: 'Mossprout’s garden pairs',
    hint: 'Turn over the garden cards and find every matching plant.', criteria: [],
    execution: { kind: 'matching', packId: 'mossprout-garden', difficultyCurveId: 'mossprout-memory-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['mossprout'], cooldownDays: 1, weight: 3 },
  },
  'quest-mossprout-green-photo': {
    id: 'quest-mossprout-green-photo',
    familyId: 'mossprout',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'photo',
    title: 'A nearby patch of green',
    hint: 'Photograph an ordinary green place you could realistically return to.',
    criteria: [photoQualityCriterion('place.park', 'Photograph nearby greenery')],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'mossprout-nearby-nature', stageId: 'return' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['mossprout'], cooldownDays: 2, weight: 5 },
  },
  'quest-mossprout-nature-note': {
    id: 'quest-mossprout-nature-note',
    familyId: 'mossprout',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'note',
    title: 'Notice one living thing',
    hint: 'Keep a short note about a plant, animal, sound, texture, or seasonal change you noticed outside.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a nearby-nature note' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'mossprout-nearby-nature', stageId: 'return' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['mossprout'], cooldownDays: 2, weight: 4 },
  },
  'quest-mossprout-return': {
    id: 'quest-mossprout-return',
    familyId: 'mossprout',
    lane: 'real_life',
    minimumBondLevel: 2,
    family: 'note',
    title: 'Return and look again',
    hint: 'Return to a familiar outdoor place and note one thing that changed or that you missed before.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record what changed in a familiar place' }],
    suggestedActions: ['add_note', 'take_photo'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 3 },
    progression: { journeyId: 'mossprout-nearby-nature', stageId: 'return' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['mossprout'], cooldownDays: 3, weight: 4 },
  },
  'quest-mossprout-weekly-review': {
    id: 'quest-mossprout-weekly-review',
    familyId: 'mossprout',
    lane: 'real_life',
    minimumBondLevel: 3,
    family: 'note',
    title: 'Read the week outdoors',
    hint: 'Review where you went outside, what you noticed, and which nearby place is worth returning to.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short nearby-nature review' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'weekly', cooldownDays: 7 },
    progression: { journeyId: 'mossprout-nearby-nature', stageId: 'review' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['mossprout'], cooldownDays: 7, weight: 5 },
  },
  'quest-skylo-city-trivia': {
    id: 'quest-skylo-city-trivia', familyId: 'skylo', family: 'place', title: 'Skylo’s city circuit',
    hint: 'Take a five-stop trip through cities around the world.', criteria: [],
    execution: { kind: 'trivia', packIds: ['city'], questionCount: 5 }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['skylo'], cooldownDays: 1, weight: 3 },
  },
  'quest-gatherglow-pattern': {
    id: 'quest-gatherglow-pattern', familyId: 'gatherglow', family: 'moment', title: 'Follow Gatherglow’s lights',
    hint: 'Watch the glow pattern, then play it back.', criteria: [],
    execution: { kind: 'pattern_memory', gameId: 'gatherglow-lights', difficultyCurveId: 'gatherglow-lights-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['gatherglow'], cooldownDays: 1, weight: 3 },
  },
  'quest-coffee-ritual-brew-sequence': {
    id: 'quest-coffee-ritual-brew-sequence', familyId: 'coffee-ritual', family: 'food',
    title: 'Remember Baristabbit’s brew', hint: 'Watch the ritual cues, then repeat the sequence.', criteria: [],
    execution: { kind: 'pattern_memory', gameId: 'coffee-ritual-brew-sequence', difficultyCurveId: 'coffee-ritual-brew-v1' },
    requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['baristabbit', 'lattelet', 'hearthsip'], cooldownDays: 1, weight: 3 },
  },
  'quest-dawnle-first-light': {
    id: 'quest-dawnle-first-light', familyId: 'dawnle', family: 'moment',
    title: 'Wake Dawnle’s first lights', hint: 'Watch the morning lights rise, then repeat their order.', criteria: [],
    execution: { kind: 'pattern_memory', gameId: 'dawnle-first-light', difficultyCurveId: 'dawnle-first-light-v1' },
    requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['dawnle'], cooldownDays: 1, weight: 3 },
  },
  'quest-quietome-still-signals': {
    id: 'quest-quietome-still-signals', familyId: 'quietome', family: 'moment',
    title: 'Hold Quietome’s still signals', hint: 'Watch the quiet symbols appear, then return them in order.', criteria: [],
    execution: { kind: 'pattern_memory', gameId: 'quietome-still-signals', difficultyCurveId: 'quietome-still-signals-v1' },
    requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['quietome'], cooldownDays: 1, weight: 3 },
  },
  'quest-mendle-breathe': {
    id: 'quest-mendle-breathe', familyId: 'mendle', family: 'moment',
    title: 'Soften with Mendle', hint: 'Follow a few slow breaths without asking the feeling to disappear.', criteria: [],
    execution: { kind: 'paced_breathing', patternId: 'mendle-soften-v1', difficultyCurveId: 'mendle-soften-v1' },
    requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['mendle'], cooldownDays: 1, weight: 3 },
  },
  'quest-errandimp-sort': {
    id: 'quest-errandimp-sort', familyId: 'errandimp', family: 'studio',
    title: 'Clear Errandimp’s loose loops', hint: 'Sort each practical task by the kind of action it needs.', criteria: [],
    execution: { kind: 'sorting', packId: 'errandimp-loops', difficultyCurveId: 'errandimp-loops-v1' },
    requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['errandimp'], cooldownDays: 1, weight: 3 },
  },
  'quest-vesperitt-moon-signals': {
    id: 'quest-vesperitt-moon-signals',
    familyId: 'vesperitt',
    lane: 'mini_game',
    minimumBondLevel: 1,
    family: 'studio',
    title: 'Trace Vesperitt’s moon signals',
    hint: 'Watch the constellations wake, then echo their order through the quiet night.',
    criteria: [],
    presentation: { categoryLabel: 'Play', estimatedMinutes: 3, artworkKey: 'vesperitt' },
    execution: {
      kind: 'pattern_memory',
      gameId: 'vesperitt-moon-signals',
      difficultyCurveId: 'vesperitt-moon-signals-v1',
    },
    requiresCapabilities: [],
    submissionMode: 'auto',
    eligibility: { creatureKeys: ['vesperitt'], cooldownDays: 1, weight: 4 },
  },
  'quest-feastle-sort': {
    id: 'quest-feastle-sort', familyId: 'feastle', family: 'food', title: 'Set Feastle’s table',
    hint: 'Sort food, drinks and tableware into their proper places.', criteria: [],
    execution: { kind: 'sorting', packId: 'feastle-table', difficultyCurveId: 'feastle-table-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['feastle'], cooldownDays: 1, weight: 3 },
  },
  'quest-feastle-merge': {
    id: 'quest-feastle-merge', familyId: 'feastle', family: 'food', title: 'Feastle’s Merge Feast',
    hint: 'Merge matching ingredients into bigger dishes and serve two hungry orders.', criteria: [],
    execution: { kind: 'merge', packId: 'feastle-kitchen', difficultyCurveId: 'feastle-merge-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['feastle'], cooldownDays: 1, weight: 4 },
  },
  'quest-feastle-meal-photo': {
    id: 'quest-feastle-meal-photo',
    familyId: 'feastle',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'photo',
    title: 'A meal worth noticing',
    hint: 'Photograph a meal that felt caring, enjoyable, shared, or simply worth pausing for.',
    criteria: [photoQualityCriterion('subject.food', 'Photograph a meal')],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'feastle-meaningful-meals', stageId: 'taste' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['feastle'], cooldownDays: 2, weight: 5 },
  },
  'quest-feastle-meal-note': {
    id: 'quest-feastle-meal-note',
    familyId: 'feastle',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'note',
    title: 'What made the meal matter',
    hint: 'Keep one short note about what made a meal easy, comforting, connecting, or interesting.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a short meal note' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'feastle-meaningful-meals', stageId: 'taste' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['feastle'], cooldownDays: 2, weight: 4 },
  },
  'quest-feastle-new-flavour': {
    id: 'quest-feastle-new-flavour',
    familyId: 'feastle',
    lane: 'real_life',
    minimumBondLevel: 2,
    family: 'food',
    title: 'Make room for a new flavour',
    hint: 'Try or prepare something unfamiliar, then tag the cuisine or ingredient you explored.',
    criteria: [{ fact: 'food.cuisines', op: 'gte', value: 1, label: 'Tag a cuisine today' }],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 3 },
    progression: { journeyId: 'feastle-meaningful-meals', stageId: 'taste' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['feastle'], cooldownDays: 3, weight: 4 },
  },
  'quest-feastle-weekly-review': {
    id: 'quest-feastle-weekly-review',
    familyId: 'feastle',
    lane: 'real_life',
    minimumBondLevel: 3,
    family: 'note',
    title: 'Read the week’s table',
    hint: 'Review which meals felt easiest or most meaningful, then choose one food moment worth repeating.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short meal-pattern review' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'weekly', cooldownDays: 7 },
    progression: { journeyId: 'feastle-meaningful-meals', stageId: 'review' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['feastle'], cooldownDays: 7, weight: 5 },
  },
  'quest-tasklet-sort': {
    id: 'quest-tasklet-sort', familyId: 'tasklet', family: 'studio', title: 'Clear Tasklet’s desk',
    hint: 'Sort each task by what it needs next.', criteria: [],
    execution: { kind: 'sorting', packId: 'tasklet-triage', difficultyCurveId: 'tasklet-triage-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['tasklet'], cooldownDays: 1, weight: 3 },
  },
  'quest-tasklet-desk-jam': {
    id: 'quest-tasklet-desk-jam', familyId: 'tasklet', family: 'studio', title: 'Tasklet’s Desk Jam',
    hint: 'Slide each scattered task into its matching tray before the desk jams.', criteria: [],
    execution: { kind: 'block_jam', packId: 'tasklet-desk', difficultyCurveId: 'tasklet-desk-jam-v2' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['tasklet'], cooldownDays: 1, weight: 4 },
  },
  'quest-tasklet-focus': {
    id: 'quest-tasklet-focus',
    familyId: 'tasklet',
    lane: 'real_life',
    minimumBondLevel: 2,
    family: 'note',
    title: 'Protect one focus block',
    hint: 'Capture a note or photo that records a period of focused work or study.',
    criteria: [{
      fact: 'memory.qualities',
      op: 'qualityAtLeast',
      value: 'work.focus',
      qualityId: 'work.focus',
      minimumScore: qualityThresholds('work.focus').ready,
      minConfidence: qualityThresholds('work.focus').ready,
      minimumCentrality: 'supporting',
      label: 'Record focused work or study',
    }],
    suggestedActions: ['add_note', 'take_photo'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'tasklet-focus-journey', stageId: 'momentum' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['tasklet'], cooldownDays: 1, weight: 4 },
  },
  'quest-tasklet-next-action': {
    id: 'quest-tasklet-next-action',
    familyId: 'tasklet',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'note',
    title: 'Name the next visible step',
    hint: 'Keep one short note naming the smallest concrete action that would move your current goal.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write down one concrete next action' }],
    suggestedActions: ['add_note'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'tasklet-focus-journey', stageId: 'momentum' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['tasklet'], cooldownDays: 2, weight: 5 },
  },
  'quest-tasklet-clear-three': {
    id: 'quest-tasklet-clear-three',
    familyId: 'tasklet',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'note',
    title: 'Clear three small things',
    hint: 'Finish three small loose ends, then keep a quick note of what you cleared.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record three small things you finished' }],
    suggestedActions: ['add_note'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 3 },
    progression: { journeyId: 'tasklet-focus-journey', stageId: 'momentum' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['tasklet'], cooldownDays: 3, weight: 3 },
  },
  'quest-tasklet-tomorrow-first': {
    id: 'quest-tasklet-tomorrow-first',
    familyId: 'tasklet',
    lane: 'real_life',
    minimumBondLevel: 2,
    family: 'note',
    title: 'Choose tomorrow’s first move',
    hint: 'Before you finish for the day, write the first meaningful action you want to begin with tomorrow.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Choose tomorrow’s first meaningful action' }],
    suggestedActions: ['add_note'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 3 },
    progression: { journeyId: 'tasklet-focus-journey', stageId: 'momentum' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['tasklet'], cooldownDays: 3, weight: 4 },
  },
  'quest-tasklet-weekly-review': {
    id: 'quest-tasklet-weekly-review',
    familyId: 'tasklet',
    lane: 'real_life',
    minimumBondLevel: 3,
    family: 'note',
    title: 'Review the week’s direction',
    hint: 'Keep a note about what moved, what stalled, and the one priority you want to carry forward.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short weekly progress review' }],
    suggestedActions: ['add_note'],
    repeatPolicy: { cadence: 'weekly', cooldownDays: 7 },
    progression: { journeyId: 'tasklet-focus-journey', stageId: 'review' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['tasklet'], cooldownDays: 7, weight: 5 },
  },
  'quest-cheerlet-block-party': {
    id: 'quest-cheerlet-block-party', familyId: 'cheerlet', family: 'studio', title: 'Cheerlet’s Block Party',
    hint: 'Fit the party blocks together, clear rows and columns, and keep the celebration going.', criteria: [],
    presentation: { categoryLabel: 'Play', estimatedMinutes: 4, artworkKey: 'cheerlet' },
    execution: { kind: 'block_blast', packId: 'cheerlet-party', rulesetId: 'cheerlet-block-party-v2' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['cheerlet'], cooldownDays: 1, weight: 5 },
  },
  'quest-feastle-memory': {
    id: 'quest-feastle-memory', familyId: 'feastle', family: 'food', title: 'Feastle’s matching feast',
    hint: 'Turn over the table cards and find every matching food.', criteria: [],
    execution: { kind: 'matching', packId: 'feastle-food', difficultyCurveId: 'feastle-memory-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['feastle'], cooldownDays: 1, weight: 2 },
  },
  'quest-relicoon-match': {
    id: 'quest-relicoon-match', familyId: 'relicoon', family: 'place', title: 'Relicoon’s gallery pairs',
    hint: 'Turn over the gallery cards and reunite each pair.', criteria: [],
    execution: { kind: 'matching', packId: 'relicoon-gallery', difficultyCurveId: 'relicoon-gallery-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['relicoon'], cooldownDays: 1, weight: 3 },
  },
  'quest-encora-rhythm': {
    id: 'quest-encora-rhythm', familyId: 'encora', family: 'studio', title: 'Echo Encora’s rhythm',
    hint: 'Remember the phrase and tap it back in time.', criteria: [],
    execution: { kind: 'rhythm', gameId: 'encora-echo', difficultyCurveId: 'encora-echo-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['encora'], cooldownDays: 1, weight: 3 },
  },
  'quest-new-place': {
    id: 'quest-new-place',
    title: 'Somewhere new',
    hint: 'Visit a spot you haven’t confirmed before and give it meaning.',
    criteria: [{ fact: 'places.confirmedNew', op: 'isTrue', label: 'Reach a new place' }],
  },
  'quest-new-cafe': {
    id: 'quest-new-cafe',
    title: 'Try somewhere new',
    hint: 'Visit a café you haven’t been to and snap a moment there.',
    criteria: [
      { fact: 'places.confirmed', op: 'gte', value: 1, label: 'Confirm a place today' },
      { fact: 'food.moments', op: 'gte', value: 1, label: 'Log a food moment' },
    ],
  },
  'quest-new-park': {
    id: 'quest-new-park',
    family: 'photo',
    submissionMode: 'manual',
    suggestedActions: ['take_photo'],
    title: 'A green spot',
    hint: 'Snap a photo of a park or green space to show me.',
    criteria: [photoQualityCriterion('place.park', 'Photograph a park')],
  },
  'quest-visit-beach': {
    id: 'quest-visit-beach',
    title: 'To the shore',
    hint: 'Spend time by the beach and confirm it on your map.',
    criteria: [{ fact: 'places.categories', op: 'includes', value: 'beach', label: 'Confirm a beach' }],
  },
  'quest-visit-forest': {
    id: 'quest-visit-forest',
    title: 'Into the trees',
    hint: 'Walk in a forest or woodland and confirm it on your map.',
    criteria: [{ fact: 'places.categories', op: 'includes', value: 'forest', label: 'Confirm a forest' }],
  },
  'quest-visit-garden': {
    id: 'quest-visit-garden',
    title: 'Among the beds',
    hint: 'Visit a garden and confirm it on your map.',
    criteria: [{ fact: 'places.categories', op: 'includes', value: 'garden', label: 'Confirm a garden' }],
  },
  'quest-visit-museum': {
    id: 'quest-visit-museum',
    title: 'A wander through the halls',
    hint: 'Visit a museum or gallery and confirm it on your map.',
    criteria: [{ fact: 'places.categories', op: 'includes', value: 'museum', label: 'Confirm a museum' }],
  },
  'quest-weather-storm': {
    id: 'quest-weather-storm',
    title: 'Weather the storm',
    hint: 'Catch a stormy day — a photo of the rain and clouds counts.',
    criteria: [{ fact: 'weather.condition', op: 'equals', value: 'storm', label: 'A stormy day' }],
  },
  'quest-weather-fog': {
    id: 'quest-weather-fog',
    title: 'Into the mist',
    hint: 'Catch a foggy morning — a hazy photo counts.',
    criteria: [{ fact: 'weather.condition', op: 'equals', value: 'fog', label: 'A foggy day' }],
  },
  'quest-long-walk': {
    id: 'quest-long-walk',
    familyId: 'steppling',
    lane: 'real_life',
    minimumBondLevel: 2,
    title: 'One long wander',
    hint: 'Take a walk that beats your recent daily average.',
    criteria: [{ fact: 'steps.count', op: 'gte', value: 8000, label: 'Walk 8,000+ steps today' }],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 3 },
    progression: { journeyId: 'steppling-everyday-momentum', stageId: 'walk' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['steppling'], cooldownDays: 3, weight: 4 },
  },
  'quest-snap-today': {
    id: 'quest-snap-today',
    title: 'Catch today',
    hint: 'Capture one moment before the day ends.',
    criteria: [{ fact: 'moments.captured', op: 'gte', value: 1, label: 'Capture a moment today' }],
  },
  'quest-celebrate-note': {
    id: 'quest-celebrate-note',
    family: 'voice',
    title: 'Worth celebrating',
    hint: 'Record a voice note about a moment worth celebrating — yours or someone you love.',
    criteria: [{ fact: 'notes.voiceAdded', op: 'gte', value: 1, label: 'Record a voice note today' }],
    requiresCapabilities: ['microphone'],
    optionalCapabilities: ['speech.transcription', 'appleFoundation'],
    suggestedActions: ['record_voice', 'add_note'],
  },
  'quest-goal-note': {
    id: 'quest-goal-note',
    familyId: 'tasklet',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'note',
    title: 'One goal, done',
    hint: 'Capture a note about a goal you moved forward today.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Add a note (or voice note) today' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'tasklet-focus-journey', stageId: 'momentum' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['tasklet'], cooldownDays: 2, weight: 4 },
  },
  'quest-early-night': {
    id: 'quest-early-night',
    familyId: 'sleep-rest',
    lane: 'real_life',
    minimumBondLevel: 2,
    title: 'An early night',
    hint: 'Get to sleep before midnight tonight.',
    criteria: [{ fact: 'sleep.quality', op: 'equals', value: 'good', label: 'Sleep well tonight' }],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 3 },
    progression: { journeyId: 'sleep-rest-gentle-recovery', stageId: 'practice' },
    goalContribution: { goalTypeIds: ['sleep-rhythm', 'wind-down'], amount: 1 },
    eligibility: { creatureKeys: ['bedrotte', 'snoozle'], cooldownDays: 3, weight: 3 },
  },

  // Cuisine explorers (food_spot creatures) — each wants ITS cuisine family.
  'quest-cuisine-japanese': {
    id: 'quest-cuisine-japanese',
    title: 'A taste of Japan',
    hint: 'Log a Japanese food moment — sushi, ramen, anything.',
    criteria: [{ fact: 'food.cuisines', op: 'includes', value: 'japanese', label: 'Log a Japanese meal' }],
  },
  'quest-cuisine-italian': {
    id: 'quest-cuisine-italian',
    title: 'Buon appetito',
    hint: 'Log an Italian food moment.',
    criteria: [{ fact: 'food.cuisines', op: 'includes', value: 'italian', label: 'Log an Italian meal' }],
  },
  'quest-cuisine-any-new': {
    id: 'quest-cuisine-any-new',
    title: 'Somewhere flavourful',
    hint: 'Log any food moment and tag its cuisine.',
    criteria: [{ fact: 'food.cuisines', op: 'gte', value: 1, label: 'Tag a cuisine today' }],
  },

  // Culture / inspiration (bookstore, cinema, library, museum creatures).
  'quest-read-book': {
    id: 'quest-read-book',
    familyId: 'pagelet',
    lane: 'real_life',
    minimumBondLevel: 1,
    title: 'Between the pages',
    hint: 'Log a book in your Studio.',
    criteria: [{ fact: 'studio.media', op: 'includes', value: 'book', label: 'Log a book' }],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'pagelet-living-curiosity', stageId: 'learn' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['pagelet'], cooldownDays: 2, weight: 5 },
  },
  'quest-pagelet-learning-note': {
    id: 'quest-pagelet-learning-note',
    familyId: 'pagelet',
    lane: 'real_life',
    minimumBondLevel: 2,
    family: 'note',
    title: 'Keep one idea',
    hint: 'Write or record one thing you learned or want to understand better.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a learning note today' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'pagelet-living-curiosity', stageId: 'learn' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['pagelet'], cooldownDays: 2, weight: 4 },
  },
  'quest-pagelet-curiosity-note': {
    id: 'quest-pagelet-curiosity-note',
    familyId: 'pagelet',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'note',
    title: 'Follow one question',
    hint: 'Keep a question you genuinely want to follow, along with one thing you found.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Keep a curiosity note' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'pagelet-living-curiosity', stageId: 'learn' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['pagelet'], cooldownDays: 2, weight: 4 },
  },
  'quest-pagelet-weekly-review': {
    id: 'quest-pagelet-weekly-review',
    familyId: 'pagelet',
    lane: 'real_life',
    minimumBondLevel: 3,
    family: 'note',
    title: 'Gather the week’s ideas',
    hint: 'Review what you read or learned, keep one idea, and name the question you want to carry forward.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short learning review' }],
    suggestedActions: ['add_note', 'record_voice'],
    repeatPolicy: { cadence: 'weekly', cooldownDays: 7 },
    progression: { journeyId: 'pagelet-living-curiosity', stageId: 'review' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['pagelet'], cooldownDays: 7, weight: 5 },
  },
  'quest-watch-film': {
    id: 'quest-watch-film',
    title: 'Roll the reel',
    hint: 'Log a film or show in your Studio.',
    criteria: [{ fact: 'studio.media', op: 'includes', value: 'film', label: 'Log a film' }],
  },
  'quest-any-inspiration': {
    id: 'quest-any-inspiration',
    title: 'Something that moved you',
    hint: 'Log any inspiration — a book, film, show, or game.',
    criteria: [{ fact: 'studio.media', op: 'gte', value: 1, label: 'Log an inspiration' }],
  },

  // Subject photos (subject/moment creatures) — Apple Vision labels via the
  // photo-labels provider. `includes` matches the canonical concept.
  'quest-photo-cat': {
    id: 'quest-photo-cat',
    title: 'A cat in the frame',
    hint: 'Snap a photo with a cat in it.',
    criteria: [photoQualityCriterion('subject.cat', 'Photograph a cat')],
  },
  'quest-photo-dog': {
    id: 'quest-photo-dog',
    title: 'Good dog',
    hint: 'Snap a photo with a dog in it.',
    criteria: [photoQualityCriterion('subject.dog', 'Photograph a dog')],
  },
  'quest-photo-food': {
    id: 'quest-photo-food',
    title: 'Feast for the eyes',
    hint: 'Snap a photo of your food.',
    criteria: [photoQualityCriterion('subject.food', 'Photograph a meal')],
  },
  'quest-photo-flowers': {
    id: 'quest-photo-flowers',
    title: 'In bloom',
    hint: 'Snap a photo of some flowers.',
    criteria: [photoQualityCriterion('nature.flowers', 'Photograph flowers')],
  },
  'quest-photo-water': {
    id: 'quest-photo-water',
    title: 'By the water',
    hint: 'Snap a photo of the sea, a lake, or a river.',
    criteria: [photoQualityCriterion('nature.water', 'Photograph water')],
  },
  'quest-photo-mountains': {
    id: 'quest-photo-mountains',
    title: 'Reach the heights',
    hint: 'Snap a photo of mountains or hills.',
    criteria: [photoQualityCriterion('nature.mountains', 'Photograph the hills')],
  },
  'quest-photo-stars': {
    id: 'quest-photo-stars',
    title: 'Under the stars',
    hint: 'Snap a photo of the night sky.',
    criteria: [photoQualityCriterion('nature.stars', 'Photograph the night sky')],
  },
  'quest-photo-sunset': {
    id: 'quest-photo-sunset',
    title: 'Chase the light',
    hint: 'Snap a photo at sunset or sunrise.',
    criteria: [photoQualityCriterion('nature.sunset', 'Photograph the golden hour')],
  },
  'quest-photo-snow': {
    id: 'quest-photo-snow',
    title: 'First flurries',
    hint: 'Snap a photo of the snow.',
    criteria: [photoQualityCriterion('nature.snow', 'Photograph snow')],
  },
  'quest-photo-autumn': {
    id: 'quest-photo-autumn',
    title: 'Turning leaves',
    hint: 'Snap a photo of autumn colours.',
    criteria: [photoQualityCriterion('nature.autumn', 'Photograph autumn')],
  },
  'quest-photo-blossom': {
    id: 'quest-photo-blossom',
    title: 'Blossom season',
    hint: 'Snap a photo of spring blossom.',
    criteria: [photoQualityCriterion('nature.blossom', 'Photograph blossom')],
  },
  'quest-photo-baby': {
    id: 'quest-photo-baby',
    title: 'Little one',
    hint: 'Snap a photo of the little one.',
    criteria: [photoQualityCriterion('subject.baby', 'Photograph the little one')],
  },
  'quest-photo-city': {
    id: 'quest-photo-city',
    title: 'City lights',
    hint: 'Snap a photo of the city skyline.',
    criteria: [photoQualityCriterion('place.city', 'Photograph the city')],
  },

  // Time-of-day (dawn / small-hours creatures) — from capture timestamps.
  'quest-dawn-capture': {
    id: 'quest-dawn-capture',
    title: 'Catch the dawn',
    hint: 'Capture a moment early — before 8am.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'time.before_8am', sourceTypes: ['photo'], label: 'A photo before 8am' }],
  },
  'quest-late-capture': {
    id: 'quest-late-capture',
    familyId: 'vesperitt',
    lane: 'real_life',
    minimumBondLevel: 1,
    family: 'photo',
    title: 'The small hours',
    hint: 'Capture something that made a late hour feel meaningful between 11pm and 5am.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'time.late_night', sourceTypes: ['photo'], label: 'A photo between 11pm and 5am' }],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'vesperitt-intentional-nights', stageId: 'observe' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['vesperitt'], cooldownDays: 2, weight: 4 },
  },
  'quest-vesperitt-night-note': {
    id: 'quest-vesperitt-night-note',
    familyId: 'vesperitt',
    lane: 'real_life',
    minimumBondLevel: 2,
    family: 'note',
    title: 'Name what kept you up',
    hint: 'Keep a short note about what filled the late hours and whether the night felt chosen.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Add a note about a late night' }],
    suggestedActions: ['add_note'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 2 },
    progression: { journeyId: 'vesperitt-intentional-nights', stageId: 'observe' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['vesperitt'], cooldownDays: 2, weight: 4 },
  },
  'quest-vesperitt-next-day-note': {
    id: 'quest-vesperitt-next-day-note',
    familyId: 'vesperitt',
    lane: 'real_life',
    minimumBondLevel: 2,
    family: 'note',
    title: 'Notice the morning after',
    hint: 'Keep a short note about how a recent late night affected your energy, mood, or attention the next day.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Record a late night’s next-day effect' }],
    suggestedActions: ['add_note'],
    repeatPolicy: { cadence: 'anytime', cooldownDays: 3 },
    progression: { journeyId: 'vesperitt-intentional-nights', stageId: 'observe' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['vesperitt'], cooldownDays: 3, weight: 5 },
  },
  'quest-vesperitt-weekly-review': {
    id: 'quest-vesperitt-weekly-review',
    familyId: 'vesperitt',
    lane: 'real_life',
    minimumBondLevel: 3,
    family: 'note',
    title: 'Read the week’s night pattern',
    hint: 'Review the week: which late nights felt chosen, which drifted, and what boundary or ritual would help next?',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Write a short late-night pattern review' }],
    suggestedActions: ['add_note'],
    repeatPolicy: { cadence: 'weekly', cooldownDays: 7 },
    progression: { journeyId: 'vesperitt-intentional-nights', stageId: 'review' },
    goalContribution: { amount: 1 },
    eligibility: { creatureKeys: ['vesperitt'], cooldownDays: 7, weight: 5 },
  },
};

const PHOTO_QUALITY_IDS: Record<string, string> = {
  cat: 'subject.cat', dog: 'subject.dog', food: 'subject.food', flowers: 'nature.flowers',
  water: 'nature.water', mountains: 'nature.mountains', stars: 'nature.stars', sunset: 'nature.sunset',
  snow: 'nature.snow', autumn: 'nature.autumn', blossom: 'nature.blossom', baby: 'subject.baby',
  city: 'place.city', park: 'place.park',
};

export const QUEST_DEFINITIONS: Record<string, QuestDefinition> = withQuestMetadata(RAW_QUEST_DEFINITIONS);

function withQuestMetadata(definitions: Record<string, QuestDefinition>): Record<string, QuestDefinition> {
  return Object.fromEntries(
    Object.entries(definitions).map(([id, definition]) => {
      const criteria = definition.criteria.map((criterion) => {
        const qualityId =
          criterion.fact === 'evidence.items' && criterion.sourceTypes?.includes('photo')
            ? PHOTO_QUALITY_IDS[String(criterion.value ?? '')]
            : null;
        return qualityId
          ? {
              ...criterion,
              fact: 'memory.qualities' as const,
              op: 'qualityAtLeast' as const,
              value: qualityId,
              minConfidence: qualityThresholds(qualityId).ready,
            }
          : criterion;
      });
      const normalizedDefinition = { ...definition, criteria };
      const family = definition.family ?? inferFamily(normalizedDefinition);
      const familyId = definition.familyId;
      const lane = definition.lane ?? (definition.execution && definition.execution.kind !== 'evidence' ? 'mini_game' : 'real_life');
      const requiresCapabilities = definition.requiresCapabilities ?? inferRequiredCapabilities(definition, family);
      const optionalCapabilities = definition.optionalCapabilities ?? inferOptionalCapabilities(definition, family);
      const suggestedActions = definition.suggestedActions ?? inferSuggestedActions(family);
      const themes = Array.from(new Set([...(definition.themes ?? []), ...inferThemes(definition, family)]));
      const evidencePolicy = definition.evidencePolicy ?? inferEvidencePolicy(normalizedDefinition);
      return [
        id,
        {
          ...normalizedDefinition,
          family: family ?? undefined,
          familyId: familyId ?? undefined,
          lane,
          minimumBondLevel: definition.minimumBondLevel ?? inferMinimumBondLevel(definition),
          submissionMode: definition.submissionMode ?? inferSubmissionMode(family),
          themes,
          requiresCapabilities,
          optionalCapabilities,
          suggestedActions,
          evidencePolicy,
        },
      ];
    })
  );
}

function inferMinimumBondLevel(definition: QuestDefinition): KatchimeraBondLevel {
  if (
    definition.id === 'quest-step-time-trial' ||
    definition.id === 'quest-feastle-merge' ||
    definition.id === 'quest-tasklet-desk-jam' ||
    definition.id === 'quest-pagelet-word-paths'
  ) return 2;
  return 1;
}

function inferFamily(definition: QuestDefinition): QuestDefinition['family'] | undefined {
  if (definition.criteria.some((criterion) => criterion.fact === 'places.categories' || criterion.fact === 'places.confirmed')) return 'place';
  if (definition.criteria.some((criterion) => criterion.fact === 'memory.qualities')) return 'photo';
  if (definition.criteria.some((criterion) => criterion.fact === 'evidence.items' && criterion.sourceTypes?.includes('photo'))) return 'photo';
  if (definition.criteria.some((criterion) => criterion.fact === 'moments.captured')) return 'moment';
  if (definition.criteria.some((criterion) => criterion.fact === 'steps.count')) return 'movement';
  if (definition.criteria.some((criterion) => criterion.fact === 'notes.added')) {
    return definition.id.includes('celebrate') ? 'voice' : 'note';
  }
  if (definition.criteria.some((criterion) => criterion.fact === 'food.cuisines' || criterion.fact === 'food.moments')) return 'food';
  if (definition.criteria.some((criterion) => criterion.fact === 'studio.media')) return 'studio';
  if (definition.criteria.some((criterion) => criterion.fact === 'sleep.quality')) return 'sleep';
  if (definition.criteria.some((criterion) => criterion.fact === 'weather.condition')) return 'weather';
  if (definition.criteria.some((criterion) => criterion.fact === 'capture.earliestHour' || criterion.fact === 'capture.latestHour')) return 'photo';
  return undefined;
}

function inferRequiredCapabilities(
  definition: QuestDefinition,
  family: QuestDefinition['family'] | undefined
): QuestCapabilityId[] {
  const required = new Set<QuestCapabilityId>();
  if (family === 'photo' || family === 'moment') required.add('camera.capture');
  if (family === 'place') required.add('location.foreground');
  if (family === 'movement') required.add('health.steps');
  if (family === 'sleep') required.add('health.sleep');
  if (family === 'voice') {
    required.add('microphone');
    required.add('speech.transcription');
  }
  if (definition.criteria.some((criterion) => criterion.sourceTypes?.includes('photo') || criterion.fact === 'memory.qualities')) required.add('camera.capture');
  if (definition.criteria.some((criterion) => criterion.fact === 'places.categories' || criterion.fact === 'places.confirmed')) {
    required.add('location.foreground');
  }
  return [...required];
}

function inferOptionalCapabilities(
  definition: QuestDefinition,
  family: QuestDefinition['family'] | undefined
): QuestCapabilityId[] {
  const optional = new Set<QuestCapabilityId>();
  if (family === 'photo' || definition.criteria.some((criterion) => criterion.sourceTypes?.includes('photo') || criterion.fact === 'memory.qualities')) {
    optional.add('photos.read');
    optional.add('appleVision');
  }
  if (family === 'place' || definition.criteria.some((criterion) => criterion.fact === 'places.categories' || criterion.fact === 'places.confirmed')) {
    optional.add('location.background');
  }
  if (family === 'voice') optional.add('appleFoundation');
  return [...optional];
}

function inferSuggestedActions(family: QuestDefinition['family'] | undefined): string[] {
  switch (family) {
    case 'photo':
    case 'moment':
      return ['take_photo'];
    case 'place':
      return ['confirm_place'];
    case 'voice':
      return ['record_voice'];
    case 'note':
      return ['add_note'];
    case 'movement':
    case 'sleep':
      return ['open_health'];
    default:
      return [];
  }
}

function inferSubmissionMode(family: QuestDefinition['family'] | undefined): QuestDefinition['submissionMode'] {
  switch (family) {
    case 'photo':
    case 'moment':
    case 'note':
    case 'voice':
    case 'food':
    case 'studio':
      return 'manual';
    default:
      return 'auto';
  }
}

function inferThemes(definition: QuestDefinition, family: QuestDefinition['family'] | undefined): string[] {
  const themes = new Set<string>();
  if (family) themes.add(family);
  for (const criterion of definition.criteria) {
    if (typeof criterion.value === 'string') themes.add(criterion.value);
    if (criterion.fact === 'weather.condition') themes.add('weather');
    if (criterion.fact === 'studio.media') themes.add('culture');
  }
  if (definition.id.includes('cuisine')) themes.add('food');
  if (definition.id.includes('dawn')) themes.add('morning');
  if (definition.id.includes('late')) themes.add('night');
  return [...themes];
}

function inferEvidencePolicy(definition: QuestDefinition): QuestDefinition['evidencePolicy'] | undefined {
  const evidenceCriteria = definition.criteria.filter((criterion) => criterion.fact === 'evidence.items' || criterion.fact === 'memory.qualities');
  if (evidenceCriteria.length === 0) return undefined;
  const confidenceValues = evidenceCriteria
    .map((criterion) => criterion.minConfidence)
    .filter((value): value is number => typeof value === 'number');
  return {
    minConfidence: confidenceValues.length ? Math.min(...confidenceValues) : 0.6,
    allowCorroboration: evidenceCriteria.some((criterion) => criterion.op === 'evidenceCorroborated'),
  };
}

export function questDefinition(questId: string): QuestDefinition | null {
  return QUEST_DEFINITIONS[questId] ?? null;
}
