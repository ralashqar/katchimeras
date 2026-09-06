import assert from 'node:assert/strict';
import test from 'node:test';

import type { DayEvidence, HomeDayRecord, ManualJournalSubmission, StoredHomeDayRecord } from '@/types/home';
import {
  validateCompleteCompanionContent,
  validateKatchimeraQuestEvidenceSystem,
} from '@/constants/companion-content';
import { katchimeraRoles } from '@/constants/katchimera-roles';
import { withManualJournalEntry } from '@/game/days/mutations/manual-journal';
import {
  QUEST_DEFINITIONS,
  questDefinition,
  semanticQuestJournalFallbackRoute,
} from '@/utils/quests/definitions';
import { semanticVerificationDecision } from '@/utils/quests/semantic-verification-decision';
import { evaluateCriterion } from '@/utils/signals/facts';
import { themedQuestOffers } from '@/utils/quests/themed';
import {
  defaultQuestCapabilities,
  questCapabilitiesWithFoundation,
} from '@/utils/capabilities/quest-capabilities';
import { evaluateQuestRuntime } from '@/utils/quests/runtime';

const verification = questDefinition('quest-flexel-training-detail')!.semanticVerification!;

test('all note and voice quests use quest-linked journal evidence', () => {
  for (const definition of Object.values(QUEST_DEFINITIONS)) {
    if (definition.family !== 'note' && definition.family !== 'voice') continue;
    assert.equal(definition.evidenceInput?.kind, 'journal', `${definition.id} needs a journal template`);
    assert.ok(definition.semanticVerification, `${definition.id} needs direct note evaluation on supported devices`);
    assert.ok(definition.optionalCapabilities?.includes('appleFoundation'), `${definition.id} needs optional on-device evaluation`);
    assert.equal(
      definition.criteria.some((criterion) => criterion.fact === 'notes.added' || criterion.fact === 'notes.voiceAdded'),
      false,
      `${definition.id} must not be completed by an unrelated note`
    );
  }
});

test('every Katchimera journal quest has valid assisted and manual routes', () => {
  assert.deepEqual(validateKatchimeraQuestEvidenceSystem(), []);

  const roleQuestIds = new Set(katchimeraRoles.flatMap((role) => role.realLifeQuestIds));
  for (const questId of roleQuestIds) {
    const definition = questDefinition(questId)!;
    if (definition.evidenceInput?.kind !== 'journal') continue;
    assert.ok(definition.semanticVerification, `${questId} needs assisted evaluation`);
    assert.ok(definition.semanticVerification?.journalRouteFallbacks?.length, `${questId} needs a manual route`);
    assert.deepEqual(definition.requiresCapabilities, [], `${questId} needs a capability-free text fallback`);
    assert.ok(definition.optionalCapabilities?.includes('appleFoundation'), `${questId} keeps Foundation optional`);
    assert.ok(definition.evidenceInput.template.initialChoiceId, `${questId} opens directly on its guided category`);
  }
});

test('structured Katchimera journal quests use the focused quest composer', () => {
  const expectedRoutes: Record<string, [string, string]> = {
    'quest-coffee-ritual-pause': ['food', 'coffee'],
    'quest-feastle-new-flavour': ['food', 'meal'],
    'quest-flickerbun-watch': ['studio', 'film'],
    'quest-read-book': ['studio', 'book'],
    'quest-relicoon-museum-visit': ['went_somewhere', 'museum'],
    'quest-skylo-local-stop': ['went_somewhere', 'street'],
  };

  for (const [questId, [flowId, choiceId]] of Object.entries(expectedRoutes)) {
    const definition = questDefinition(questId)!;
    assert.equal(definition.evidenceInput?.kind, 'journal');
    if (definition.evidenceInput?.kind !== 'journal') continue;
    assert.equal(definition.evidenceInput.template.flowId, flowId);
    assert.equal(definition.evidenceInput.template.initialChoiceId, choiceId);
    assert.deepEqual(semanticQuestJournalFallbackRoute(questId), {
      flowId,
      categoryId: choiceId,
      contextId: null,
    });

    const questRunId = `run:${questId}`;
    const saved = withManualJournalEntry(
      emptyDay(),
      {
        ...journal(flowId, choiceId),
        sessionId: questRunId,
        journalSource: {
          kind: 'manual',
          sourceId: questRunId,
          origin: {
            kind: 'companion_quest',
            questRunId,
            questId,
            creatureId: `companion:${questId}`,
            acceptedDayId: '2026-07-26',
            journalTemplateId: definition.evidenceInput.template.id,
            inputMode: 'guided',
          },
        },
      },
      new Date('2026-07-26T12:00:00.000Z')
    );
    assert.equal(
      evaluateCriterion(definition.criteria[0], { 'evidence.items': saved.evidence ?? [] }, { questRunId }).done,
      true,
      `${questId} manual entry must complete its accepted quest run`
    );
  }
});

test('Katchimera photo quests remain on the photo evidence path', () => {
  const roleQuestIds = new Set(katchimeraRoles.flatMap((role) => role.realLifeQuestIds));
  const photoQuests = [...roleQuestIds]
    .map((questId) => questDefinition(questId)!)
    .filter((definition) => definition.family === 'photo');
  assert.ok(photoQuests.length > 0);
  for (const definition of photoQuests) {
    assert.equal(definition.evidenceInput?.kind, 'photo', `${definition.id} must keep photo capture`);
  }
});

function emptyDay(): StoredHomeDayRecord {
  return {
    id: 'day-1',
    isoDate: '2026-07-26',
    moments: [],
    locations: [],
    promptAnswers: [],
    notes: [],
    foodMoments: [],
    studioMoments: [],
    bigMoments: [],
    evidence: [],
    classifiedMemories: [],
  } as unknown as StoredHomeDayRecord;
}

function journal(flowId: string, categoryId: string, context?: string): ManualJournalSubmission {
  return {
    flowId,
    path: [flowId, categoryId],
    categoryId,
    canonicalQualityIds: [],
    fields: { specific: null, context: context ?? null },
    feeling: null,
    note: null,
  };
}

test('semantic quests keep Foundation optional and always expose a structured journal path', () => {
  for (const questId of [
    'quest-flexel-training-detail',
    'quest-sprintail-run-detail',
    'quest-hooplet-skill-detail',
    'quest-serveling-rally-detail',
    'quest-snuglet-care-detail',
    'quest-waglet-care-detail',
    'quest-whiskit-enrichment-detail',
    'quest-rest-restored-detail',
    'quest-steppling-walk-detail',
    'quest-mossprout-living-detail',
    'quest-skylo-city-detail',
    'quest-feastle-meal-detail',
    'quest-tasklet-progress-detail',
    'quest-cheerlet-progress-detail',
    'quest-vesperitt-night-detail',
    'quest-shellio-water-detail',
  ]) {
    const definition = questDefinition(questId)!;
    assert.equal(definition.requiresCapabilities?.includes('appleFoundation') ?? false, false);
    assert.ok(definition.optionalCapabilities?.includes('appleFoundation'));
    assert.equal(definition.offerVisibility, 'default');
    assert.equal(definition.evidenceInput?.kind, 'journal');
    assert.deepEqual(definition.semanticVerification?.modalities, ['text', 'voice']);
  }
  assert.deepEqual(validateCompleteCompanionContent(), []);
});

test('every semantic journal quest remains actionable without Foundation', () => {
  const capabilities = questCapabilitiesWithFoundation(defaultQuestCapabilities(), false);
  const fallbackRuntime = evaluateQuestRuntime({
    questId: 'quest-steppling-walk-detail',
    facts: { 'evidence.items': [] },
    capabilities,
  });
  assert.equal(fallbackRuntime.state, 'in_progress');
  assert.equal(fallbackRuntime.nextAction, 'add_note');
  assert.deepEqual(
    semanticQuestJournalFallbackRoute('quest-steppling-walk-detail'),
    { flowId: 'movement', categoryId: 'walk', contextId: null }
  );

  const previouslyModelOnlyRuntime = evaluateQuestRuntime({
    questId: 'quest-vesperitt-night-detail',
    facts: { 'evidence.items': [] },
    capabilities,
  });
  assert.equal(previouslyModelOnlyRuntime.state, 'in_progress');
  assert.equal(previouslyModelOnlyRuntime.nextAction, 'add_note');
  assert.equal(questDefinition('quest-vesperitt-night-detail')?.evidenceInput?.kind, 'journal');
  assert.deepEqual(
    semanticQuestJournalFallbackRoute('quest-vesperitt-night-detail'),
    { flowId: 'general', categoryId: 'rest', contextId: null }
  );
});

test('Mossprout journal quests remain actionable after the day is finalized', () => {
  const finalizedDay = { ...emptyDay(), state: 'hatched' as const } as unknown as HomeDayRecord;
  const journalRuntime = evaluateQuestRuntime({
    questId: 'quest-mossprout-living-detail',
    day: finalizedDay,
    facts: { 'evidence.items': [] },
    capabilities: defaultQuestCapabilities(),
    questRunId: 'run:mossprout:late',
  });
  assert.equal(journalRuntime.state, 'in_progress');
  assert.equal(journalRuntime.nextAction, 'add_note');

  const weeklyReview = questDefinition('quest-mossprout-weekly-review')!;
  assert.equal(weeklyReview.evidenceInput?.kind, 'journal');
  assert.ok(weeklyReview.semanticVerification);
  assert.ok(weeklyReview.optionalCapabilities?.includes('appleFoundation'));

  const photoRuntime = evaluateQuestRuntime({
    questId: 'quest-new-park',
    day: finalizedDay,
    facts: { 'evidence.items': [], 'memory.qualities': [] },
    capabilities: defaultQuestCapabilities(),
  });
  assert.equal(photoRuntime.state, 'impossible_today');
});

test('Gatherglow journal quests expose focused manual templates', () => {
  const reachOut = questDefinition('quest-gatherglow-reach-out')!;
  const review = questDefinition('quest-gatherglow-weekly-review')!;
  assert.equal(reachOut.evidenceInput?.kind, 'journal');
  assert.equal(review.evidenceInput?.kind, 'journal');
  if (reachOut.evidenceInput?.kind !== 'journal' || review.evidenceInput?.kind !== 'journal') return;
  assert.equal(reachOut.evidenceInput.template.flowId, 'people');
  assert.equal(reachOut.evidenceInput.template.initialChoiceId, 'someone_else');
  assert.equal(reachOut.evidenceInput.template.contextTitle, 'How did you reach out?');
  assert.ok(reachOut.evidenceInput.template.contextOptions?.some((item) => item.id === 'message'));
  assert.equal(review.evidenceInput.template.contextTitle, 'What do you want to tend?');
});

test('assisted notes cannot pass a semantic quest from their journal route alone', () => {
  const questId = 'quest-steppling-walk-detail';
  const questRunId = 'run:steppling:assisted';
  const day = withManualJournalEntry(
    emptyDay(),
    {
      ...journal('movement', 'walk'),
      sessionId: questRunId,
      note: 'I stayed home and watched television.',
      linkedNote: { kind: 'text', text: 'I stayed home and watched television.' },
      journalSource: {
        kind: 'text_note',
        sourceId: questRunId,
        origin: {
          kind: 'companion_quest',
          questRunId,
          questId,
          creatureId: 'companion:steppling',
          acceptedDayId: '2026-07-26',
          journalTemplateId: 'steppling.walk-detail.journal.v1',
          inputMode: 'note',
        },
      },
    },
    new Date('2026-07-26T12:00:00.000Z')
  );
  const criterion = questDefinition(questId)!.criteria[0];
  assert.equal(evaluateCriterion(criterion, { 'evidence.items': day.evidence ?? [] }, { questRunId }).done, false);
});

test('a quest-linked journal entry only satisfies its accepted quest run', () => {
  const questId = 'quest-gatherglow-reach-out';
  const questRunId = 'run:gatherglow:one';
  const day = withManualJournalEntry(
    emptyDay(),
    {
      ...journal('people', 'friends', 'message'),
      sessionId: questRunId,
      journalSource: {
        kind: 'manual',
        sourceId: questRunId,
        origin: {
          kind: 'companion_quest',
          questRunId,
          questId,
          creatureId: 'companion:gatherglow',
          acceptedDayId: '2026-07-26',
          journalTemplateId: 'gatherglow.reach-out.v1',
        },
      },
    },
    new Date('2026-07-26T12:00:00.000Z')
  );
  const criterion = questDefinition(questId)!.criteria[0];
  assert.equal(evaluateCriterion(criterion, { 'evidence.items': day.evidence ?? [] }, { questRunId }).done, true);
  assert.equal(evaluateCriterion(criterion, { 'evidence.items': day.evidence ?? [] }, { questRunId: 'run:gatherglow:other' }).done, false);
});

test('owned companion pools expose a low-bond semantic quest when Foundation is available', () => {
  for (const [creatureKey, questId, subtype, archetype] of [
    ['bedrotte', 'quest-rest-restored-detail', 'good_sleep', 'night'],
    ['steppling', 'quest-steppling-walk-detail', 'park', 'journey'],
    ['mossprout', 'quest-mossprout-living-detail', 'garden', 'places'],
    ['skylo', 'quest-skylo-city-detail', 'city', 'places'],
    ['feastle', 'quest-feastle-meal-detail', 'food', 'food'],
    ['tasklet', 'quest-tasklet-progress-detail', 'errand', 'craft'],
    ['cheerlet', 'quest-cheerlet-progress-detail', 'celebrate', 'celebrate'],
    ['vesperitt', 'quest-vesperitt-night-detail', 'small_hours', 'night'],
    ['shellio', 'quest-shellio-water-detail', 'beach', 'places'],
  ] as const) {
    const offer = themedQuestOffers(subtype, archetype, creatureKey)
      .find((candidate) => candidate.id === questId);
    assert.ok(offer, `${creatureKey} should expose ${questId}`);
    assert.equal(offer.minimumBondLevel, 1);
    assert.equal(offer.weight, 12);
  }
});

test('only a high-confidence semantic match satisfies the quest criterion', () => {
  const criterion = questDefinition('quest-flexel-training-detail')!.criteria[0];
  const evidence = (verdict: 'match' | 'uncertain', confidence: 'high' | 'medium'): DayEvidence => ({
    id: 'note:one',
    sourceType: 'text_note',
    sourceId: 'one',
    observedAt: '2026-07-26T12:00:00.000Z',
    provider: 'appleFoundation',
    confidence: 0.95,
    signals: [],
    semanticQuestEvaluations: [{
      id: 'semantic-one',
      questId: 'quest-flexel-training-detail',
      verificationId: verification.id,
      verificationVersion: 1,
      verdict,
      confidence,
      reasonCode: 'test',
      evaluatedAt: '2026-07-26T12:00:01.000Z',
      provider: 'appleFoundation',
    }],
  });

  assert.equal(evaluateCriterion(criterion, { 'evidence.items': [evidence('match', 'high')] }).done, true);
  assert.equal(evaluateCriterion(criterion, { 'evidence.items': [evidence('match', 'medium')] }).done, false);
  assert.equal(evaluateCriterion(criterion, { 'evidence.items': [evidence('uncertain', 'high')] }).done, false);
});

test('an explicitly matching journal subcategory deterministically satisfies an authored fallback', () => {
  const walked = withManualJournalEntry(
    emptyDay(),
    journal('movement', 'walk'),
    new Date('2026-07-26T12:00:00.000Z')
  );
  const steppling = questDefinition('quest-steppling-walk-detail')!;
  const result = evaluateCriterion(steppling.criteria[0], {
    'evidence.items': walked.evidence ?? [],
  });
  assert.equal(result.done, true);
  assert.equal(result.confidence, 1);
  assert.equal(result.evidenceIds.length, 1);
  assert.deepEqual(
    steppling.semanticVerification?.journalRouteFallbacks,
    ['journal.route:movement.walk']
  );
});

test('context-specific fallbacks distinguish basketball from other sports', () => {
  const basketball = withManualJournalEntry(
    emptyDay(),
    journal('movement', 'sport', 'basketball'),
    new Date('2026-07-26T12:00:00.000Z')
  );
  const football = withManualJournalEntry(
    emptyDay(),
    journal('movement', 'sport', 'football'),
    new Date('2026-07-26T12:00:00.000Z')
  );
  const criterion = questDefinition('quest-hooplet-skill-detail')!.criteria[0];
  assert.equal(evaluateCriterion(criterion, { 'evidence.items': basketball.evidence ?? [] }).done, true);
  assert.equal(evaluateCriterion(criterion, { 'evidence.items': football.evidence ?? [] }).done, false);
});

test('a synthesized family route keeps formerly model-only quests usable offline', () => {
  const rested = withManualJournalEntry(
    emptyDay(),
    journal('general', 'rest'),
    new Date('2026-07-26T12:00:00.000Z')
  );
  const vesperitt = questDefinition('quest-vesperitt-night-detail')!;
  assert.deepEqual(vesperitt.semanticVerification?.journalRouteFallbacks, ['journal.route:general.rest']);
  assert.equal(
    evaluateCriterion(vesperitt.criteria[0], { 'evidence.items': rested.evidence ?? [] }).done,
    true
  );
});

test('structured verification accepts a reasonable medium-confidence answer and fails closed', () => {
  const match = semanticVerificationDecision(
    { verdict: 'match', confidence: 'high', reasonCode: 'clear_match' },
    verification.retryPrompt
  );
  assert.equal(match.passed, true);
  assert.equal(match.verdict, 'match');

  const reasonable = semanticVerificationDecision(
    { verdict: 'match', confidence: 'medium', reasonCode: 'missing_detail' },
    verification.retryPrompt
  );
  assert.equal(reasonable.passed, true);
  assert.equal(reasonable.verdict, 'match');

  const failed = semanticVerificationDecision({}, verification.retryPrompt);
  assert.equal(failed.passed, false);
  assert.equal(failed.verdict, 'error');
});
