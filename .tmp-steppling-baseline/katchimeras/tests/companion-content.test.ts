import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOND_MOMENT_OPTIONS,
  companionContentForFamily,
  companionContentItems,
  validateEvolvingCompanionContent,
} from '@/constants/companion-content';
import { companionJourneyByFamilyId } from '@/constants/companion-journeys';
import {
  companionIntroductionDefinitions,
  validateCompanionIntroductionDefinitions,
} from '@/constants/companion-introductions';
import { quickGoalTemplatesForFamily } from '@/constants/companion-quick-goals';
import { BESPOKE_FAMILY_QUEST_PACKS } from '@/constants/katchimera-bespoke-quests';
import { SPECIALIST_COMPANION_SYSTEMS } from '@/constants/specialist-companion-catalogue';
import { COMPANION_SPEECH_COPY_LIMITS } from '@/constants/companion-speech-copy';
import {
  emptyCompanionContentState,
  completeCompanionIntroduction,
  completeCompanionVisit,
  deferCompanionIntroduction,
  ensureCompanionInvitation,
  ensureCompanionVisitPlan,
  invitationForDay,
  introductionForFamily,
  migrateCompanionIntroduction,
  normaliseCompanionContentState,
  recordCompanionVisit,
  resetCompanionMemory,
  selectCompanionDailyInvitation,
  updateCompanionInvitation,
  updateCompanionMemoryStatus,
  upsertCompanionInsight,
  upsertCompanionMemory,
} from '@/utils/companion-content';
import { buildCompanionVisitPlan } from '@/utils/companion-visit';
import { deriveCompanionPatternCandidates } from '@/utils/companion-memory-patterns';
import type { StoredHomeDayRecord } from '@/types/home';
import { companionFirstPersonText } from '@/utils/companion-dialogue';
import { companionCheckInQuestion } from '@/utils/companion-check-in';
import {
  activeConversationForFamily,
  answerJourneyConversation,
  emptyCompanionJourneyState,
  startJourneyCheckIn,
  startJourneyConversation,
} from '@/utils/companion-journey';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import { QUEST_DEFINITIONS } from '@/utils/quests/definitions';
import { withDailyQuestPresentationVariant } from '@/utils/quests/presentation-variants';

const mossContent = companionContentForFamily('mossprout');
const stepplingContent = companionContentForFamily('steppling');
const emptyQuestState = (): CompanionQuestState => ({
  schemaVersion: 3,
  quests: [],
  submissions: [],
  offerCycles: [],
  attempts: [],
});

test('all 25 life-area families have the evolving authored content contract', () => {
  assert.deepEqual(validateEvolvingCompanionContent(), []);
  assert.equal(companionContentItems.length, 25 * 23);
  assert.equal(mossContent.filter((item) => item.kind === 'daily_pulse').length, 12);
  assert.match(mossContent[0].prompt, /nature moment/i);
  for (const level of [2, 3, 4] as const) {
    const bondMoment = mossContent.find((item) => item.id === `mossprout:bond:${level}`);
    assert.notDeepEqual(bondMoment?.options, BOND_MOMENT_OPTIONS[level]);
    assert.equal(bondMoment?.options.some((option) => option.id === 'supported'), false);
  }
});

test('each family has concise first-person introduction and return copy', () => {
  assert.deepEqual(validateCompanionIntroductionDefinitions(), []);
  assert.equal(companionFirstPersonText('How should Steppling use this?', 'Steppling'), 'How should I use this?');
  assert.equal(companionFirstPersonText('Steppling will remember it.', 'Steppling'), 'I’ll remember it.');
  for (const introduction of companionIntroductionDefinitions) {
    const name = introduction.greeting.match(/^I[’']m ([^.]+)\./)?.[1] ?? introduction.familyId;
    const presented = companionFirstPersonText(introduction.greeting, name);
    assert.equal(presented, introduction.greeting, `${name}'s first-person greeting must remain unchanged`);
    assert.doesNotMatch(presented, /\bI[’']m I\b/i);
  }
});

test('introduction choices persist per family and defer without nagging', () => {
  const preference = { nodeId: 'first', optionId: 'walk', label: 'Walk more often' };
  const deferred = deferCompanionIntroduction(emptyCompanionContentState(), {
    companionId: 'companion:steppling', familyId: 'steppling', preference, occurredAt: 10,
  });
  assert.equal(introductionForFamily(deferred, 'steppling')?.status, 'deferred');
  assert.deepEqual(introductionForFamily(deferred, 'steppling')?.preference, preference);

  const completed = completeCompanionIntroduction(deferred, {
    companionId: 'companion:steppling', familyId: 'steppling', preference,
    supportStyle: 'gentle', occurredAt: 20,
  });
  assert.equal(introductionForFamily(completed, 'steppling')?.status, 'completed');
  assert.equal(introductionForFamily(completed, 'steppling')?.supportStyle, 'gentle');

  const migrated = migrateCompanionIntroduction(emptyCompanionContentState(), {
    companionId: 'companion:steppling', familyId: 'steppling', hasExistingRelationship: true, occurredAt: 30,
  });
  assert.equal(introductionForFamily(migrated, 'steppling')?.migrated, true);
});

test('visits distinguish returning companions and newly equipped skins', () => {
  const first = recordCompanionVisit(emptyCompanionContentState(), {
    companionId: 'companion:shellio', familyId: 'shellio', skinId: 'shellio', dayId: '2026-07-01', visitedAt: 1,
  });
  assert.equal(first.greeting, 'regular');
  const returning = recordCompanionVisit(first.state, {
    companionId: 'companion:shellio', familyId: 'shellio', skinId: 'shellio', dayId: '2026-07-15', visitedAt: 2,
  });
  assert.equal(returning.greeting, 'returning');
  const newSkin = recordCompanionVisit(returning.state, {
    companionId: 'companion:shellio', familyId: 'shellio', skinId: 'shellio-pool', dayId: '2026-07-15', visitedAt: 3,
  });
  assert.equal(newSkin.greeting, 'new_skin');
});

test('speech-bubble copy stays within the mobile authoring budget', () => {
  for (const definition of companionJourneyByFamilyId.values()) {
    for (const node of definition.nodes) {
      assert.ok(node.prompt.length <= COMPANION_SPEECH_COPY_LIMITS.prompt, `${definition.familyId}:${node.id} prompt is too long`);
      assert.ok(node.helperText.length <= COMPANION_SPEECH_COPY_LIMITS.helperText, `${definition.familyId}:${node.id} helper is too long`);
      assert.ok(node.prompt.length + node.helperText.length <= COMPANION_SPEECH_COPY_LIMITS.combined, `${definition.familyId}:${node.id} combined copy is too long`);
    }
  }
  for (const item of companionContentItems) {
    assert.ok(item.prompt.length <= COMPANION_SPEECH_COPY_LIMITS.prompt, `${item.id} prompt is too long`);
    assert.ok(item.helperText.length <= COMPANION_SPEECH_COPY_LIMITS.helperText, `${item.id} helper is too long`);
    assert.ok(item.prompt.length + item.helperText.length <= COMPANION_SPEECH_COPY_LIMITS.combined, `${item.id} combined copy is too long`);
  }
});

test('legacy specialist content is retained under complete canonical Focus systems', () => {
  assert.equal(SPECIALIST_COMPANION_SYSTEMS.length, 29);
  assert.equal(BESPOKE_FAMILY_QUEST_PACKS.length, 31);

  for (const system of SPECIALIST_COMPANION_SYSTEMS) {
    const canonicalJourney = companionJourneyByFamilyId.get(QUEST_DEFINITIONS[`quest-${system.familyId}-${BESPOKE_FAMILY_QUEST_PACKS.find((pack) => pack.familyId === system.familyId)!.quests[0]!.suffix}`]!.familyId!);
    assert.ok(canonicalJourney, `${system.familyId} needs a canonical parent Journey`);
    assert.equal(system.quickGoals.length >= 8, true, `${system.familyId} needs at least eight small goals`);
    assert.equal(new Set(system.quickGoals.map((goal) => goal.title)).size, system.quickGoals.length, `${system.familyId} small goals must be distinct`);
    const familyContent = companionContentForFamily(system.familyId);
    assert.equal(familyContent.length, 23, `${system.familyId} needs complete rotating content`);
    assert.equal(new Set(familyContent.map((item) => item.prompt)).size, 23, `${system.familyId} prompts must be distinct`);
    assert.equal(familyContent.every((item) => item.options.length >= 4), true, `${system.familyId} prompts need accessible answer choices`);

    const goalNode = canonicalJourney.nodes.find((node) => node.createsGoalTypeId);
    assert.ok(goalNode, `${system.familyId} needs a goal-producing result question`);
    for (const choice of goalNode?.options ?? []) {
      assert.ok(choice.goalTitle?.trim(), `${system.familyId}:${choice.id} needs an actionable goal title`);
    }

    const pack = BESPOKE_FAMILY_QUEST_PACKS.find((candidate) => candidate.familyId === system.familyId)!;
    for (const quest of pack.quests) {
      const definition = QUEST_DEFINITIONS[`quest-${system.familyId}-${quest.suffix}`];
      assert.equal(definition?.progression?.journeyId, canonicalJourney.id);
      assert.ok(canonicalJourney.stages.some((stage) => stage.id === definition?.progression?.stageId));
      assert.equal(definition?.familyId, canonicalJourney.familyId);
    }
  }
});

test('Shellio owns swimming, beach, and non-entry water connection as distinct safe directions', () => {
  const shellio = SPECIALIST_COMPANION_SYSTEMS.find((system) => system.familyId === 'shellio');
  assert.ok(shellio);
  assert.equal(shellio.journey.version, 4);
  assert.match(shellio.journey.introduction, /swimming/i);
  assert.match(shellio.journey.introduction, /beach/i);
  assert.match(shellio.journey.introduction, /never asks you to swim beyond your ability/i);

  const desiredRelationship = shellio.journey.nodes[0];
  assert.match(desiredRelationship.prompt, /bring into your life/i);
  assert.equal(desiredRelationship.options?.some((option) => /swimming rhythm/i.test(option.label)), true);
  assert.equal(desiredRelationship.options?.some((option) => /shoreline time/i.test(option.label)), true);
  assert.equal(desiredRelationship.options?.some((option) => /without needing to swim/i.test(option.label)), true);

  const conditions = shellio.journey.nodes[1];
  assert.match(conditions.helperText ?? '', /ability.*health.*access.*cost.*supervision.*weather.*water quality/i);

  const direction = shellio.journey.nodes[2];
  assert.deepEqual(direction.options?.map((option) => option.id), ['swim-rhythm', 'confidence', 'movement', 'shore', 'connection']);
  assert.equal(shellio.quickGoals.length, 10);
  assert.equal(shellio.quickGoals.some((goal) => /qualified lesson/i.test(goal.title)), true);
  assert.equal(shellio.quickGoals.some((goal) => /does not require entering/i.test(goal.title)), true);

  const questPack = BESPOKE_FAMILY_QUEST_PACKS.find((pack) => pack.familyId === 'shellio');
  assert.ok(questPack);
  assert.match(questPack.role, /swimming, beaches, shores/i);
  assert.match(questPack.boundary, /unsafe water entry/i);
  assert.equal(questPack.quests.every((quest) => /swim|water|beach|shore/i.test(`${quest.title} ${quest.hint}`)), true);

  const semanticQuest = QUEST_DEFINITIONS['quest-shellio-water-detail'];
  assert.match(semanticQuest.semanticVerification?.request ?? '', /swimming, beach, shore, or water-place moment/i);
  assert.match((semanticQuest.semanticVerification?.exclusions ?? []).join(' '), /unsafe water entry/i);
});

test('Batch 1 families use complete, coherent, pressure-aware authored packs', () => {
  for (const familyId of ['bedrotte', 'tasklet', 'mossprout', 'gatherglow'] as const) {
    const content = companionContentForFamily(familyId);
    assert.equal(content.length, 23);
    const pulses = content.filter((item) => item.kind === 'daily_pulse');
    assert.equal(new Set(pulses.map((item) => item.prompt)).size, 12);
    assert.equal(content.every((item) => item.options.length >= 4), true);
    assert.equal(content.some((item) => item.options.some((option) => option.id === 'supported')), false);
    assert.ok((companionJourneyByFamilyId.get(familyId)?.version ?? 0) >= 3);
  }

  assert.equal(companionContentForFamily('bedrotte').some((item) => item.options.some((option) => option.id === 'not-possible')), false);
  assert.equal(companionContentForFamily('tasklet').some((item) => item.options.some((option) => option.id === 'no-movement')), true);
  assert.equal(companionContentForFamily('mossprout').some((item) => item.options.some((option) => option.id === 'window')), true);
  assert.equal(companionContentForFamily('gatherglow').some((item) => item.options.some((option) => option.id === 'solitude')), true);
});

test('Batch 2 families use complete authored packs and accessible Focus journeys', () => {
  for (const familyId of ['feastle', 'baristabbit', 'errandimp', 'skylo'] as const) {
    const content = companionContentForFamily(familyId);
    assert.equal(content.length, 23);
    assert.equal(new Set(content.filter((item) => item.kind === 'daily_pulse').map((item) => item.prompt)).size, 12);
    assert.equal(content.every((item) => item.options.length >= 4), true);
    assert.equal(content.some((item) => item.options.some((option) => option.id === 'supported')), false);
    assert.ok((companionJourneyByFamilyId.get(familyId)?.version ?? 0) >= 3);
    assert.equal(quickGoalTemplatesForFamily(familyId).length >= 8, true);
  }
  assert.equal(companionContentForFamily('feastle').some((item) => item.options.some((option) => option.id === 'limited')), true);
  assert.equal(companionContentForFamily('baristabbit').some((item) => item.options.some((option) => option.id === 'none')), true);
  assert.equal(companionContentForFamily('errandimp').some((item) => item.options.some((option) => option.id === 'wait')), true);
  assert.equal(companionContentForFamily('skylo').some((item) => item.options.some((option) => option.id === 'safety')), true);
});

test('Steppling uses a fully authored, pressure-aware content set', () => {
  const pulses = stepplingContent.filter((item) => item.kind === 'daily_pulse');
  assert.equal(pulses.length, 12);
  assert.equal(new Set(pulses.map((item) => item.prompt)).size, 12);
  assert.equal(pulses.every((item) => item.options.length >= 4), true);
  assert.equal(pulses.some((item) => item.options.some((option) => option.id === 'supported')), false);
  assert.equal(pulses.some((item) => item.options.some((option) => option.id === 'no-walk' || option.id === 'none-now' || option.id === 'pause')), true);

  const obstacleReturn = stepplingContent.find((item) => item.id === 'steppling:return:3');
  assert.match(obstacleReturn?.prompt ?? '', /making walking difficult/i);
  assert.equal(obstacleReturn?.options.some((option) => option.id === 'different-barrier'), true);

  const journey = companionJourneyByFamilyId.get('steppling');
  assert.equal(journey?.version, 3);
  assert.match(journey?.introduction ?? '', /leave room for days/i);
  assert.equal(journey?.checkIn.options.some((option) => option.id === 'no-walk'), true);

  const quickGoals = quickGoalTemplatesForFamily('steppling');
  assert.equal(quickGoals.some((goal) => /usually skip|call while walking|unfamiliar turn/i.test(goal.title)), false);

  const familiar = stepplingContent.find((item) => item.id === 'steppling:bond:2')!;
  const started = startJourneyCheckIn(emptyCompanionJourneyState(), {
    companionId: 'companion:steppling', familyId: 'steppling', dayId: '2026-08-03',
    contentItemId: familiar.id, contentPrompt: familiar.prompt,
    contentHelperText: familiar.helperText, contentOptions: familiar.options,
  });
  const bondQuestion = companionCheckInQuestion({
    checkIn: started.checkIn, definition: journey!, role: null, goal: null,
  });
  assert.deepEqual(bondQuestion?.options, familiar.options);
});

test('Steppling quest copy states thresholds honestly and uses activity-specific variants', () => {
  const everyday = QUEST_DEFINITIONS['quest-steppling-gentle-walk'];
  const longer = QUEST_DEFINITIONS['quest-long-walk'];
  assert.equal(everyday.title, 'An everyday walking day');
  assert.match(everyday.hint, /4,000 steps/i);
  assert.match(longer.hint, /8,000 steps/i);
  assert.equal(longer.hint.includes('recent daily average'), false);
  for (const quest of [everyday, longer]) {
    const variantCopy = quest.presentationVariants?.map((variant) => variant.hint).join(' ') ?? '';
    assert.equal(/detail you have not used|changed since last time/i.test(variantCopy), false);
  }
  const reflectionQuest = QUEST_DEFINITIONS['quest-steppling-walk-detail'];
  assert.equal(reflectionQuest.presentationVariants?.length, 3);
  assert.match(reflectionQuest.presentationVariants?.[1]?.hint ?? '', /sight, sound, or physical feeling/i);
});

test('Batch 1 repeatable quests use evidence-matched authored variants', () => {
  const ids = [
    'quest-rest-restored-detail',
    'quest-tasklet-progress-detail',
    'quest-mossprout-living-detail',
    'quest-gatherglow-reach-out',
  ];
  for (const id of ids) {
    const quest = QUEST_DEFINITIONS[id];
    assert.equal(quest.presentationVariants?.length, 3);
    const copy = quest.presentationVariants?.map((variant) => variant.hint).join(' ') ?? '';
    assert.equal(/detail you have not used|changed since last time/i.test(copy), false);
  }
  assert.match(QUEST_DEFINITIONS['quest-mossprout-living-detail'].semanticVerification?.matchCriteria.join(' ') ?? '', /window view/i);
  assert.equal(QUEST_DEFINITIONS['quest-early-night'].criteria[0]?.fact, 'evidence.items');
  assert.equal(QUEST_DEFINITIONS['quest-early-night'].criteria[0]?.op, 'questJournalMatch');
});

test('Batch 2 repeatable quests use family-specific authored variants', () => {
  const ids = [
    'quest-feastle-meal-photo',
    'quest-coffee-ritual-note',
    'quest-errandimp-maintenance',
    'quest-skylo-neighbourhood-note',
  ];
  for (const id of ids) {
    const quest = QUEST_DEFINITIONS[id];
    assert.equal(quest.presentationVariants?.length, 3);
    const copy = quest.presentationVariants?.map((variant) => variant.hint).join(' ') ?? '';
    assert.equal(/detail you have not used|changed since last time/i.test(copy), false);
  }
  assert.match(QUEST_DEFINITIONS['quest-coffee-ritual-pause'].hint, /coffee, tea, water/i);
  assert.match(QUEST_DEFINITIONS['quest-errandimp-maintenance'].hint, /concrete result/i);
  assert.match(QUEST_DEFINITIONS['quest-skylo-city-photo'].hint, /accessible local detail/i);
});

test('Batch 3 families use complete authored packs and accessible Focus journeys', () => {
  for (const familyId of ['pagelet', 'flickerbun', 'relicoon', 'encora'] as const) {
    const content = companionContentForFamily(familyId);
    assert.equal(content.length, 23);
    assert.equal(new Set(content.filter((item) => item.kind === 'daily_pulse').map((item) => item.prompt)).size, 12);
    assert.equal(content.every((item) => item.options.length >= 4), true);
    assert.equal(content.some((item) => item.options.some((option) => option.id === 'supported')), false);
    assert.ok((companionJourneyByFamilyId.get(familyId)?.version ?? 0) >= 3);
    assert.equal(quickGoalTemplatesForFamily(familyId).length >= 8, true);
  }
  assert.equal(companionContentForFamily('pagelet').some((item) => item.options.some((option) => option.id === 'audio' || option.id === 'format')), true);
  assert.equal(companionContentForFamily('flickerbun').some((item) => item.options.some((option) => option.id === 'stopped')), true);
  assert.equal(companionContentForFamily('relicoon').some((item) => item.options.some((option) => option.id === 'absence' || option.id === 'uncertainty')), true);
  assert.equal(companionContentForFamily('encora').some((item) => item.options.some((option) => option.id === 'quiet')), true);
});

test('Batch 3 repeatable quests change the lens while preserving family meaning', () => {
  const ids = [
    'quest-read-book',
    'quest-pagelet-learning-note',
    'quest-pagelet-curiosity-note',
    'quest-pagelet-weekly-review',
    'quest-flickerbun-watch',
    'quest-flickerbun-scene-note',
    'quest-flickerbun-new-perspective',
    'quest-flickerbun-weekly-review',
    'quest-relicoon-object-note',
    'quest-relicoon-museum-visit',
    'quest-relicoon-context-note',
    'quest-relicoon-weekly-review',
    'quest-encora-listening-note',
    'quest-encora-music-moment',
    'quest-encora-practice-note',
    'quest-encora-weekly-review',
  ];
  for (const id of ids) {
    const quest = QUEST_DEFINITIONS[id];
    assert.equal(quest.presentationVariants?.length, 3, id);
    const copy = quest.presentationVariants?.map((variant) => `${variant.title} ${variant.hint}`).join(' ') ?? '';
    assert.equal(/detail you have not used|changed since last time/i.test(copy), false, id);
    assert.equal(new Set(quest.presentationVariants?.map((variant) => variant.title)).size, 3, id);
  }
  assert.match(QUEST_DEFINITIONS['quest-read-book'].hint, /read, listen to, or read along/i);
  assert.match(QUEST_DEFINITIONS['quest-flickerbun-watch'].hint, /stopping partway is allowed/i);
  assert.match(QUEST_DEFINITIONS['quest-relicoon-museum-visit'].hint, /online collection/i);
  assert.match(QUEST_DEFINITIONS['quest-encora-listening-note'].hint, /volume, format, and breaks/i);
});

test('Batch 4 families keep time, reflection, and progress pressure-aware', () => {
  for (const familyId of ['dawnle', 'pagelet', 'bedrotte', 'cheerlet'] as const) {
    const content = companionContentForFamily(familyId);
    assert.equal(content.length, 23);
    assert.equal(new Set(content.filter((item) => item.kind === 'daily_pulse').map((item) => item.prompt)).size, 12);
    assert.equal(content.every((item) => item.options.length >= 4), true);
    assert.equal(content.some((item) => item.options.some((option) => option.id === 'supported')), false);
    assert.ok((companionJourneyByFamilyId.get(familyId)?.version ?? 0) >= 3);
    assert.equal(quickGoalTemplatesForFamily(familyId).length >= 8, true);
  }
  assert.equal(companionContentForFamily('dawnle').some((item) => item.options.some((option) => option.id === 'different-time')), true);
  assert.equal(companionContentForFamily('pagelet').length, 23);
  assert.equal(companionContentForFamily('bedrotte').length, 23);
  assert.equal(companionContentForFamily('cheerlet').some((item) => item.options.some((option) => option.id === 'mixed' || option.id === 'declined')), true);
});

test('Batch 4 quests repeat safely without rewarding early or late wakefulness', () => {
  const ids = [
    'quest-cheerlet-progress-detail',
    'quest-vesperitt-night-detail',
    'quest-dawnle-first-light-photo',
    'quest-dawnle-morning-note',
    'quest-dawnle-prepare-start',
    'quest-dawnle-weekly-review',
    'quest-quietome-one-line',
    'quest-quietome-solo-pause',
    'quest-quietome-returning-question',
    'quest-quietome-weekly-review',
    'quest-late-capture',
    'quest-vesperitt-night-note',
    'quest-vesperitt-next-day-note',
    'quest-vesperitt-weekly-review',
    'quest-cheerlet-name-progress',
    'quest-cheerlet-celebrate-note',
    'quest-cheerlet-mark-chapter',
    'quest-cheerlet-weekly-review',
  ];
  for (const id of ids) {
    const quest = QUEST_DEFINITIONS[id];
    assert.equal(quest.presentationVariants?.length, 3, id);
    assert.equal(new Set(quest.presentationVariants?.map((variant) => variant.title)).size, 3, id);
  }
  assert.match(QUEST_DEFINITIONS['quest-dawnle-first-light-photo'].hint, /do not wake early/i);
  assert.match(QUEST_DEFINITIONS['quest-late-capture'].hint, /do not stay awake or go out/i);
  assert.match(QUEST_DEFINITIONS['quest-quietome-solo-pause'].hint, /stop or seek company/i);
  assert.match(QUEST_DEFINITIONS['quest-cheerlet-celebrate-note'].hint, /celebration is optional/i);
});

test('Batch 5 families support adaptation, recovery, and non-competitive play', () => {
  for (const familyId of ['flexel'] as const) {
    const content = companionContentForFamily(familyId);
    assert.equal(content.length, 23);
    assert.equal(new Set(content.filter((item) => item.kind === 'daily_pulse').map((item) => item.prompt)).size, 12);
    assert.equal(content.every((item) => item.options.length >= 4), true);
    assert.equal(content.some((item) => item.options.some((option) => option.id === 'supported')), false);
    assert.equal(companionJourneyByFamilyId.get(familyId)?.version, 3);
    assert.equal(quickGoalTemplatesForFamily(familyId).length >= 8, true);
    assert.equal(content.some((item) => item.options.some((option) => ['adapted', 'slower', 'run-walk', 'cooperative'].includes(option.id))), true);
    assert.equal(content.some((item) => item.options.some((option) => option.id === 'stopped' || option.id === 'rest')), true);
  }
  assert.ok(QUEST_DEFINITIONS['quest-sprintail-run-detail']);
  assert.ok(QUEST_DEFINITIONS['quest-hooplet-skill-detail']);
  assert.ok(QUEST_DEFINITIONS['quest-serveling-rally-detail']);
});

test('Batch 5 quests match evidence and do not disguise performance demands', () => {
  const ids = [
    'quest-flexel-session-note', 'quest-flexel-training-detail', 'quest-flexel-recovery-note', 'quest-flexel-weekly-review',
    'quest-sprintail-run-day', 'quest-sprintail-run-detail', 'quest-sprintail-recovery', 'quest-sprintail-weekly-review',
    'quest-hooplet-court-note', 'quest-hooplet-skill-detail', 'quest-hooplet-team-moment', 'quest-hooplet-weekly-review',
    'quest-serveling-session-note', 'quest-serveling-rally-detail', 'quest-serveling-reset-note', 'quest-serveling-weekly-review',
  ];
  for (const id of ids) {
    const quest = QUEST_DEFINITIONS[id];
    assert.equal(quest.presentationVariants?.length, 3, id);
    assert.equal(new Set(quest.presentationVariants?.map((variant) => variant.title)).size, 3, id);
  }
  assert.match(QUEST_DEFINITIONS['quest-sprintail-run-day'].hint, /threshold does not prove a run/i);
  assert.equal(QUEST_DEFINITIONS['quest-sprintail-run-day'].criteria[0]?.value, 3000);
  assert.match(QUEST_DEFINITIONS['quest-flexel-training-detail'].hint, /seated, or adapted/i);
  assert.match(QUEST_DEFINITIONS['quest-hooplet-court-note'].hint, /wheelchair or adapted/i);
  assert.match(QUEST_DEFINITIONS['quest-serveling-session-note'].hint, /seated or adapted/i);
});

test('Batch 6 families protect dignity, consent, animal choice, and routes to support', () => {
  for (const familyId of ['snuglet', 'waglet', 'mendle'] as const) {
    const content = companionContentForFamily(familyId);
    assert.equal(content.length, 23);
    assert.equal(new Set(content.filter((item) => item.kind === 'daily_pulse').map((item) => item.prompt)).size, 12);
    assert.equal(content.every((item) => item.options.length >= 4), true);
    assert.equal(content.some((item) => item.options.some((option) => option.id === 'supported')), false);
    assert.equal(companionJourneyByFamilyId.get(familyId)?.version, 3);
    assert.equal(quickGoalTemplatesForFamily(familyId).length >= 8, true);
  }
  assert.equal(companionContentForFamily('snuglet').some((item) => item.options.some((option) => option.id === 'boundary' || option.id === 'delegated')), true);
  assert.equal(companionContentForFamily('waglet').some((item) => item.options.some((option) => option.id === 'dog-stopped')), true);
  assert.ok(QUEST_DEFINITIONS['quest-whiskit-enrichment-detail']);
  assert.equal(companionContentForFamily('mendle').some((item) => item.options.some((option) => option.id === 'urgent' || option.id === 'professional')), true);
  assert.match(companionJourneyByFamilyId.get('waglet')?.introduction ?? '', /cannot diagnose/i);
  assert.match(companionJourneyByFamilyId.get('mendle')?.introduction ?? '', /does not diagnose, provide crisis care/i);
});

test('Batch 6 quests use private, honest evidence and three safe return lenses', () => {
  const ids = [
    'quest-snuglet-care-photo', 'quest-snuglet-care-detail', 'quest-snuglet-caregiver-pause', 'quest-snuglet-weekly-review',
    'quest-waglet-companion-photo', 'quest-waglet-care-detail', 'quest-waglet-routine-note', 'quest-waglet-weekly-review',
    'quest-whiskit-companion-photo', 'quest-whiskit-enrichment-detail', 'quest-whiskit-pattern-note', 'quest-whiskit-weekly-review',
    'quest-mendle-honest-checkin', 'quest-mendle-kind-action', 'quest-mendle-repair-note', 'quest-mendle-weekly-review',
  ];
  for (const id of ids) {
    const quest = QUEST_DEFINITIONS[id];
    assert.equal(quest.presentationVariants?.length, 3, id);
    assert.equal(new Set(quest.presentationVariants?.map((variant) => variant.title)).size, 3, id);
  }
  const privateCare = QUEST_DEFINITIONS['quest-snuglet-care-photo'];
  assert.equal(privateCare.family, 'note');
  assert.equal(privateCare.criteria[0]?.fact, 'evidence.items');
  assert.equal(privateCare.criteria[0]?.op, 'questJournalMatch');
  assert.match(privateCare.hint, /without including another person’s private details/i);
  assert.match(QUEST_DEFINITIONS['quest-waglet-routine-note'].hint, /leave room for uncertainty/i);
  assert.match(QUEST_DEFINITIONS['quest-whiskit-pattern-note'].hint, /leave room for uncertainty/i);
  assert.match(QUEST_DEFINITIONS['quest-mendle-weekly-review'].hint, /human or professional help/i);
});

test('one deterministic invitation is persisted for a companion and local day', () => {
  const input = {
    state: emptyCompanionContentState(),
    companionId: 'companion:mossprout',
    familyId: 'mossprout',
    dayId: '2026-08-02',
    bondLevel: 1 as const,
    content: mossContent,
    hasActiveGoal: true,
    questCompletions: 1,
    reflections: 0,
    eligibleQuestIds: [],
    createdAt: 100,
  };
  const first = selectCompanionDailyInvitation(input);
  const repeated = selectCompanionDailyInvitation(input);
  assert.deepEqual(first, repeated);
  const stored = ensureCompanionInvitation(input.state, first);
  assert.equal(invitationForDay(stored, input.companionId, input.dayId)?.id, first.id);
  assert.equal(stored.invitations.length, 1);
  assert.equal(stored.events.filter((event) => event.kind === 'shown').length, 1);
  assert.equal(ensureCompanionInvitation(stored, first), stored);
});

test('resume work and Focus setup take priority over rotating content', () => {
  const base = {
    state: emptyCompanionContentState(), companionId: 'companion:mossprout', familyId: 'mossprout',
    dayId: '2026-08-02', bondLevel: 3 as const, content: mossContent,
    hasActiveGoal: true, questCompletions: 3, reflections: 0, eligibleQuestIds: [], createdAt: 1,
  };
  assert.equal(selectCompanionDailyInvitation({ ...base, activeQuestId: 'quest-mossprout-return' }).kind, 'resume_quest');
  assert.equal(selectCompanionDailyInvitation({ ...base, activeConversationId: 'conversation-1' }).kind, 'resume_focus');
  assert.equal(selectCompanionDailyInvitation({ ...base, hasActiveGoal: false }).kind, 'focus_setup');
});

test('invitation lifecycle is idempotent and ordinary answers do not enter Long Memory', () => {
  const invitation = selectCompanionDailyInvitation({
    state: emptyCompanionContentState(), companionId: 'companion:mossprout', familyId: 'mossprout',
    dayId: '2026-08-02', bondLevel: 1, content: mossContent, hasActiveGoal: true,
    questCompletions: 0, reflections: 0, eligibleQuestIds: [], createdAt: 1,
  });
  let state = ensureCompanionInvitation(emptyCompanionContentState(), invitation);
  state = updateCompanionInvitation(state, invitation.id, 'opened', 2);
  state = updateCompanionInvitation(state, invitation.id, 'completed', 3);
  state = updateCompanionInvitation(state, invitation.id, 'completed', 4);
  assert.equal(state.invitations[0].status, 'completed');
  assert.equal(state.events.filter((event) => event.kind === 'completed').length, 1);
  assert.deepEqual(state.memoryFacts, []);
  assert.deepEqual(state.memories, []);
});

test('repeatable real-life quests rotate presentation variants and retain evidence identity', () => {
  const definition = QUEST_DEFINITIONS['quest-mossprout-green-photo'];
  assert.equal(definition.presentationVariants?.length, 3);
  const offer = {
    id: definition.id, title: definition.title, hint: definition.hint,
    categoryLabel: 'Photo', estimatedMinutes: 5, lane: 'real_life' as const, minimumBondLevel: 1 as const,
  };
  const first = withDailyQuestPresentationVariant(offer, {
    companionId: 'companion:mossprout', dayId: '2026-08-02', questState: emptyQuestState(),
  });
  const state = {
    ...emptyQuestState(),
    quests: [{
      questId: definition.id, creatureId: 'companion:mossprout', title: first.title, hint: first.hint,
      acceptedAt: 1, acceptedDayId: '2026-08-02', questRunId: 'run-1', presentationVariantId: first.presentationVariantId,
    }],
  };
  const second = withDailyQuestPresentationVariant(offer, {
    companionId: 'companion:mossprout', dayId: '2026-08-04', questState: state,
  });
  assert.equal(second.id, first.id);
  assert.notEqual(second.presentationVariantId, first.presentationVariantId);
});

test('schema v6 removes promoted answers and generic patterns while preserving explicit moments', () => {
  const state = normaliseCompanionContentState({
    schemaVersion: 4,
    invitations: [],
    memoryFacts: [{
      id: 'companion-memory:companion:mossprout:focus:place',
      companionId: 'companion:mossprout',
      familyId: 'mossprout',
      key: 'focus:place',
      value: 'Quiet green spaces',
      sourceId: 'conversation-1',
      firstRecordedAt: 10,
      lastConfirmedAt: 20,
    }],
    memories: [{
      id: 'legacy-focus-answer', scope: 'family', familyId: 'mossprout', kind: 'confirmed_fact',
      key: 'focus:place', summary: 'Quiet green spaces', evidenceRefs: [], confidence: 1,
      status: 'confirmed', sensitivity: 'ordinary', firstRecordedAt: 10,
    }, {
      id: 'generic-recurrence', scope: 'family', familyId: 'mossprout', kind: 'pattern',
      key: 'pattern:mossprout:recurring-days', summary: 'This part of life returned.', evidenceRefs: [], confidence: 0.8,
      status: 'confirmed', sensitivity: 'ordinary', firstRecordedAt: 11,
    }, {
      id: 'saved-moment', scope: 'family', familyId: 'mossprout', kind: 'shared_moment',
      key: 'shared:1', summary: 'A walk I wanted to keep', evidenceRefs: [], confidence: 1,
      status: 'confirmed', sensitivity: 'personal', firstRecordedAt: 12,
    }],
    visitPlans: [{
      id: 'old-memory-plan', familyId: 'mossprout', dayId: '2026-08-09', subject: 'memory_confirmation',
      eyebrow: 'OLD', opening: 'Old question', responses: [], evidenceRefs: [], createdAt: 12,
    }],
    conversationReceipts: [{
      id: 'old-receipt', visitPlanId: 'old-memory-plan', familyId: 'mossprout', dayId: '2026-08-09',
      responseIds: [], affectedMemoryIds: [], completedAt: 13,
    }],
    events: [],
    introductions: [],
    visits: [],
  });
  assert.equal(state.schemaVersion, 7);
  assert.equal(state.memories.length, 1);
  assert.equal(state.memories[0].id, 'saved-moment');
  assert.deepEqual(state.memoryFacts, []);
  assert.deepEqual(state.visitPlans, []);
  assert.deepEqual(state.conversationReceipts, []);
});

test('insights keep one active slot and preserve changed results as history', () => {
  const first = upsertCompanionInsight(emptyCompanionContentState(), {
    familyId: 'baristabbit', insightKey: 'drink-compass', category: 'Drinks', resultId: 'classic',
    title: 'The Reliable Classic', summary: 'A trusted cup clears a small piece of the day.', emblemId: 'classic-cup',
    supportingTraits: ['Coffee', 'Warm'], evidenceRefs: [{ sourceType: 'conversation', sourceId: 'session-1' }],
    sourceDefinitionId: 'baristabbit:insight:drink-compass', sourceSessionId: 'session-1', recordedAt: 100,
  });
  const updated = upsertCompanionInsight(first, {
    familyId: 'baristabbit', insightKey: 'drink-compass', category: 'Drinks', resultId: 'curious',
    title: 'The Curious Menu', summary: 'A drink can be a small adventure.', emblemId: 'curious-cup',
    supportingTraits: ['Seasonal', 'Cold'], evidenceRefs: [{ sourceType: 'conversation', sourceId: 'session-2' }],
    sourceDefinitionId: 'baristabbit:insight:drink-compass', sourceSessionId: 'session-2', recordedAt: 200,
  });
  assert.equal(updated.insights.length, 1);
  assert.equal(updated.insights[0]?.title, 'The Curious Menu');
  assert.equal(updated.insights[0]?.revisions[0]?.title, 'The Reliable Classic');
  assert.equal(upsertCompanionInsight(updated, {
    familyId: 'baristabbit', insightKey: 'drink-compass', category: 'Drinks', resultId: 'curious',
    title: 'The Curious Menu', summary: 'A drink can be a small adventure.', emblemId: 'curious-cup', supportingTraits: [], evidenceRefs: [],
    sourceDefinitionId: 'baristabbit:insight:drink-compass', sourceSessionId: 'session-2', recordedAt: 300,
  }), updated);
});

test('confirming a multi-day journal pattern promotes it to About You without raw journal text', () => {
  const memory = {
    id: 'memory-pattern', scope: 'family' as const, familyId: 'steppling' as const, kind: 'pattern' as const,
    key: 'pattern:v2:steppling:movement-on-foot', summary: 'Walking, running or hiking has returned across several recorded days.',
    evidenceSummary: 'Based on 3 recorded days across 21 days.',
    evidenceRefs: [1, 2, 3].map((day) => ({ sourceType: 'day' as const, sourceId: `day-${day}`, dayId: `2026-07-${day}` })),
    confidence: 0.82, status: 'provisional' as const, sensitivity: 'ordinary' as const, firstRecordedAt: 10,
  };
  const state = upsertCompanionMemory(emptyCompanionContentState(), memory);
  const confirmed = updateCompanionMemoryStatus(state, { memoryId: memory.id, familyId: 'steppling', dayId: '2026-08-10', status: 'confirmed', occurredAt: 100 });
  assert.equal(confirmed.insights.length, 1);
  assert.equal(confirmed.insights[0]?.title, 'The Route That Returns');
  assert.equal(confirmed.insights[0]?.evidenceRefs.length, 3);
});

test('one deterministic Visit plan is persisted and completed idempotently', () => {
  const invitation = selectCompanionDailyInvitation({
    state: emptyCompanionContentState(),
    companionId: 'companion:mossprout',
    familyId: 'mossprout',
    dayId: '2026-08-09',
    bondLevel: 1,
    content: mossContent,
    hasActiveGoal: true,
    questCompletions: 0,
    reflections: 0,
    eligibleQuestIds: [],
    createdAt: 100,
  });
  const plan = buildCompanionVisitPlan({
    familyId: 'mossprout',
    dayId: '2026-08-09',
    invitation,
    contentItem: invitation.contentItemId ? mossContent.find((item) => item.id === invitation.contentItemId) : null,
    homeGreeting: 'I found something green in your day.',
    createdAt: 100,
  });
  const withPlan = ensureCompanionVisitPlan(emptyCompanionContentState(), plan);
  assert.equal(withPlan.visitPlans.length, 1);
  assert.equal(ensureCompanionVisitPlan(withPlan, plan), withPlan);
  const completed = completeCompanionVisit(withPlan, {
    visitPlanId: plan.id,
    familyId: plan.familyId,
    dayId: plan.dayId,
    responseIds: [plan.responses[0].id],
    affectedMemoryIds: [],
    completedAt: 200,
  });
  assert.equal(completed.conversationReceipts.length, 1);
  assert.equal(completeCompanionVisit(completed, {
    visitPlanId: plan.id,
    familyId: plan.familyId,
    dayId: plan.dayId,
    responseIds: ['different'],
    affectedMemoryIds: [],
    completedAt: 300,
  }), completed);
});

test('patterns require specific evidence across three days and two weeks', () => {
  const day = (id: string, park = true): StoredHomeDayRecord => ({
    id,
    isoDate: id,
    confirmedPlaces: park ? [{ id: `park-${id}`, category: 'park', archetype: 'calm', label: 'Park', confirmedAt: `${id}T12:00:00Z` }] : [],
  } as StoredHomeDayRecord);
  assert.deepEqual(deriveCompanionPatternCandidates({
    familyId: 'mossprout',
    days: [day('2026-08-01'), day('2026-08-08')],
    existingMemories: [],
    now: 100,
  }), []);
  assert.deepEqual(deriveCompanionPatternCandidates({
    familyId: 'mossprout',
    days: [day('2026-08-01'), day('2026-08-08'), day('2026-08-15', false)],
    existingMemories: [],
    now: 100,
  }), []);
  const candidates = deriveCompanionPatternCandidates({
    familyId: 'mossprout',
    days: [day('2026-08-01'), day('2026-08-08'), day('2026-08-15')],
    existingMemories: [],
    now: 100,
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].status, 'provisional');
  assert.equal(candidates[0].evidenceRefs.length, 3);
  assert.match(candidates[0].confirmationPrompt ?? '', /parks or green spaces/i);
  assert.match(candidates[0].evidenceSummary ?? '', /3 recorded days across 14 days/i);
  const state = updateCompanionMemoryStatus({
    ...emptyCompanionContentState(),
    memories: candidates,
  }, {
    memoryId: candidates[0].id,
    familyId: 'mossprout',
    dayId: '2026-08-03',
    status: 'confirmed',
    occurredAt: 200,
  });
  assert.equal(state.memories[0].status, 'confirmed');
  assert.equal(state.telemetry[0].kind, 'memory_confirmed');
});

test('the supplied free or Plus history window controls evidence without changing detector quality', () => {
  const day = (id: string): StoredHomeDayRecord => ({
    id,
    isoDate: id,
    studioMoments: [{ id: `book-${id}`, label: 'A book', mediaType: 'book', emoji: 'Book', createdAt: `${id}T12:00:00Z` }],
  } as StoredHomeDayRecord);
  const days = [day('2026-01-01'), day('2026-03-03'), day('2026-05-05'), day('2026-08-08')];
  const free = deriveCompanionPatternCandidates({ familyId: 'pagelet', days: days.slice(-2), existingMemories: [], fullHistory: false, now: 1 });
  const plus = deriveCompanionPatternCandidates({ familyId: 'pagelet', days, existingMemories: [], fullHistory: true, now: 1 });
  assert.deepEqual(free, []);
  assert.equal(plus.length, 1);
  assert.match(plus[0].confirmationPrompt ?? '', /books or reading/i);
});

test('rejected evidence-specific patterns do not return and dev reset preserves Focus state', () => {
  const days = ['2026-07-01', '2026-07-08', '2026-07-15'].map((id) => ({
    id, isoDate: id, moments: [{ id: `social-${id}`, type: 'social' }],
  } as StoredHomeDayRecord));
  const memory = deriveCompanionPatternCandidates({
    familyId: 'gatherglow',
    days,
    existingMemories: [],
    now: 1,
  })[0];
  assert.ok(memory);
  const rejected = { ...memory, status: 'rejected' as const };
  assert.deepEqual(deriveCompanionPatternCandidates({
    familyId: 'gatherglow', days, existingMemories: [rejected], now: 2,
  }), []);
  const state = resetCompanionMemory({
    ...emptyCompanionContentState(),
    memories: [memory],
    introductions: [{
      id: 'intro', companionId: 'companion:gatherglow', familyId: 'gatherglow', status: 'completed', firstSeenAt: 1, completedAt: 1,
    }],
  }, 'gatherglow');
  assert.deepEqual(state.memories, []);
  assert.equal(state.introductions.length, 1);
});
