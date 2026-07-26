import assert from 'node:assert/strict';
import test from 'node:test';

import type { DayEvidence, ManualJournalSubmission, StoredHomeDayRecord } from '@/types/home';
import { validateCompleteCompanionContent } from '@/constants/companion-content';
import { withManualJournalEntry } from '@/game/days/mutations/manual-journal';
import {
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

test('semantic quests use Foundation when available and expose only authored journal fallbacks', () => {
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
    const journalFallback = semanticQuestJournalFallbackRoute(questId);
    if (journalFallback) {
      assert.equal(definition.requiresCapabilities?.includes('appleFoundation') ?? false, false);
      assert.ok(definition.optionalCapabilities?.includes('appleFoundation'));
      assert.equal(definition.offerVisibility, 'default');
    } else {
      assert.ok(definition.requiresCapabilities?.includes('appleFoundation'));
      assert.equal(definition.offerVisibility, 'hide_when_unavailable');
    }
    assert.deepEqual(definition.semanticVerification?.modalities, ['text', 'voice']);
  }
  assert.deepEqual(validateCompleteCompanionContent(), []);
});

test('a fallback quest remains actionable without Foundation and resolves its direct journal route', () => {
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

  const modelOnlyRuntime = evaluateQuestRuntime({
    questId: 'quest-vesperitt-night-detail',
    facts: { 'evidence.items': [] },
    capabilities,
  });
  assert.equal(modelOnlyRuntime.state, 'unavailable');
  assert.equal(semanticQuestJournalFallbackRoute('quest-vesperitt-night-detail'), null);
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

test('related categories do not bypass nuanced quests without an authored route', () => {
  const rested = withManualJournalEntry(
    emptyDay(),
    journal('general', 'rest'),
    new Date('2026-07-26T12:00:00.000Z')
  );
  const vesperitt = questDefinition('quest-vesperitt-night-detail')!;
  assert.deepEqual(vesperitt.semanticVerification?.journalRouteFallbacks, []);
  assert.equal(
    evaluateCriterion(vesperitt.criteria[0], { 'evidence.items': rested.evidence ?? [] }).done,
    false
  );
});

test('structured verification downgrades non-high matches and fails closed', () => {
  const match = semanticVerificationDecision(
    { verdict: 'match', confidence: 'high', reasonCode: 'clear_match' },
    verification.retryPrompt
  );
  assert.equal(match.passed, true);
  assert.equal(match.verdict, 'match');

  const uncertain = semanticVerificationDecision(
    { verdict: 'match', confidence: 'medium', reasonCode: 'missing_detail' },
    verification.retryPrompt
  );
  assert.equal(uncertain.passed, false);
  assert.equal(uncertain.verdict, 'uncertain');

  const failed = semanticVerificationDecision({}, verification.retryPrompt);
  assert.equal(failed.passed, false);
  assert.equal(failed.verdict, 'error');
});
