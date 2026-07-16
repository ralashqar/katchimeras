import assert from 'node:assert/strict';
import test from 'node:test';

import { commitJournalRecord } from '@/game/days/mutations/manual-journal';
import type { JournalCommitCommand, StoredHomeDayRecord } from '@/types/home';
import { commandToJournalRecord } from '@/utils/journal-domain';
import { JOURNAL_CLASSIFICATION_CATALOG } from '@/utils/journal-classification-catalog';
import { MANUAL_JOURNAL_FLOWS } from '@/utils/manual-journal-registry';
import { createJournalSession, journalDraftIsDirty, journalSessionReducer } from '@/utils/journal-session';
import { classificationForResolvedRoute, foundationAtomicNeedsRetry, foundationAtomicRoutes, foundationNoteRoute, journalRouteForAlias, journalRouteForIds, journalRouteNeedsConfirmation, parseFoundationJournalClassification, rankJournalRoutes, registryJournalRoutes, resolveFoundationRouteEvidence } from '@/utils/journal-routing';
import { validateJournalProjections } from '@/utils/journal-selectors';

const now = new Date('2026-07-13T12:00:00.000Z');
function baseDay(): StoredHomeDayRecord {
  return { id: 'day', isoDate: '2026-07-13', state: 'forming', moments: [], locations: [], promptAnswers: [], evidence: [], classifiedMemories: [], manualJournalEntries: [], journalRecords: [], notes: [], foodMoments: [], studioMoments: [], bigMoments: [] } as unknown as StoredHomeDayRecord;
}

test('journal session reducer handles deep links and reversible navigation', () => {
  const initial = createJournalSession({ sessionId: 's1', source: { kind: 'manual', sourceId: 's1' }, flowId: 'food' });
  assert.equal(initial.stage, 'category');
  const details = journalSessionReducer(initial, { type: 'select_category', categoryId: 'meal' });
  assert.equal(details.stage, 'details');
  assert.equal(details.draft.categoryId, 'meal');
  assert.equal(journalSessionReducer(details, { type: 'back' }).stage, 'category');
  assert.equal(journalDraftIsDirty(details.draft), true);
});

test('changing a journal category preserves its submitted source note', () => {
  const initial = createJournalSession({ sessionId: 's-note', source: { kind: 'voice_note', sourceId: 'voice-1', audioUri: 'voice.m4a', durationMs: 4200 }, flowId: 'food' });
  const withNote = journalSessionReducer(
    journalSessionReducer(initial, { type: 'set_note', value: 'Had ramen after the walk' }),
    { type: 'set_attachments', value: [{ id: 'voice-1', kind: 'voice', text: 'Had ramen after the walk', uri: 'voice.m4a', durationMs: 4200 }] }
  );
  const changed = journalSessionReducer(withNote, { type: 'select_category', categoryId: 'meal' });
  assert.equal(changed.draft.note, 'Had ramen after the walk');
  assert.equal(changed.draft.attachments[0]?.uri, 'voice.m4a');
});

test('Foundation journal output is canonicalized and invalid pairs are rejected', () => {
  assert.deepEqual(parseFoundationJournalClassification({
    classificationKind: 'categorized', flowId: 'food', categoryId: 'meal', specific: 'Ramen', context: 'not-valid', journalFeeling: 'treat',
  }), {
    kind: 'categorized', flowId: 'food', categoryId: 'meal', fields: { specific: 'Ramen', context: null }, feeling: 'treat', provider: 'appleFoundation',
  });
  assert.equal(parseFoundationJournalClassification({ classificationKind: 'categorized', flowId: 'food', categoryId: 'film' })?.flowId, 'studio');
  assert.deepEqual(parseFoundationJournalClassification({ classificationKind: 'generic', flowId: 'studio', categoryId: 'film', specific: 'A passing thought' }), {
    kind: 'generic', flowId: 'general', categoryId: 'other', fields: { specific: 'A passing thought', context: null }, feeling: null, provider: 'appleFoundation',
  });
  assert.equal(parseFoundationJournalClassification({ classificationKind: 'categorized', flowId: 'food', categoryId: 'meal', specific: 'x'.repeat(121) })?.fields.specific, null);
});

test('I watched the movie obsession routes to the Film journal with new or legacy Foundation output', () => {
  const structured = parseFoundationJournalClassification({
    classificationKind: 'categorized', flowId: 'media', categoryId: 'movie', specific: 'Obsession',
  });
  assert.equal(structured?.flowId, 'studio');
  assert.equal(structured?.categoryId, 'film');
  assert.equal(foundationNoteRoute({ classification: structured })?.id, 'studio.film');
  assert.equal(foundationNoteRoute({ provider: 'appleFoundation', llmClassified: true, mediaType: 'film' })?.id, 'studio.film');
  assert.equal(foundationNoteRoute({ provider: 'deterministic', llmClassified: true, mediaType: 'film' }), null);
});

test('I went to the national history museum routes to Places and days out, Museum', () => {
  const classification = parseFoundationJournalClassification({
    classificationKind: 'clear', flowId: 'places', categoryId: 'national history museum', specific: 'National History Museum',
  });
  assert.equal(classification?.flowId, 'went_somewhere');
  assert.equal(classification?.categoryId, 'museum');
  assert.equal(classification?.fields.specific, 'National History Museum');
  assert.equal(foundationNoteRoute({ classification })?.id, 'went_somewhere.museum');
});

test('registry-wide evidence corrects generic birthday output without misrouting birthday food', () => {
  const birthday = resolveFoundationRouteEvidence('It’s my birthday', { routeKey: 'general.other', routeConfidence: 0.9 }, { routeKey: 'big_event.birthday', routeConfidence: 0.91 });
  assert.equal(birthday.selected?.id, 'big_event.birthday');
  assert.equal(registryJournalRoutes('It’s my birthday')[0]?.id, 'big_event.birthday');
  assert.equal(registryJournalRoutes("I baked my son's birthday cake")[0]?.id, 'food.cooking');
});

test('every manual journal category accepts canonical IDs, labels, and missing kind inference', () => {
  for (const flow of MANUAL_JOURNAL_FLOWS) {
    for (const choice of flow.choices) {
      assert.equal(journalRouteForIds(flow.id, choice.id)?.id, `${flow.id}.${choice.id}`);
      assert.equal(journalRouteForIds(flow.id, choice.label)?.id, `${flow.id}.${choice.id}`);
      const parsed = parseFoundationJournalClassification({ flowId: flow.id, categoryId: choice.id, specific: 'Test detail' });
      assert.equal(parsed?.flowId, flow.id, `${flow.id}.${choice.id} flow`);
      assert.equal(parsed?.categoryId, choice.id, `${flow.id}.${choice.id} category`);
      const contexts = choice.contextChoices ?? flow.contextChoices ?? [];
      const feelings = choice.feelings ?? flow.feelings;
      if (contexts[0]) {
        const withContext = parseFoundationJournalClassification({ flowId: flow.id, categoryId: choice.id, context: contexts[0].label });
        assert.equal(withContext?.fields.context, contexts[0].id, `${flow.id}.${choice.id} context`);
      }
      if (feelings[0]) {
        const withFeeling = parseFoundationJournalClassification({ flowId: flow.id, categoryId: choice.id, journalFeeling: feelings[0].label });
        assert.equal(withFeeling?.feeling, feelings[0].id, `${flow.id}.${choice.id} feeling`);
      }
    }
  }
});

test('classification catalog covers every category and every representative example', () => {
  const registryKeys = MANUAL_JOURNAL_FLOWS.flatMap((flow) => flow.choices.map((choice) => `${flow.id}.${choice.id}`)).sort();
  assert.deepEqual(JOURNAL_CLASSIFICATION_CATALOG.map((entry) => entry.routeKey).sort(), registryKeys);
  for (const entry of JOURNAL_CLASSIFICATION_CATALOG) {
    assert.ok(entry.definition.length > 8, `${entry.routeKey} definition`);
    assert.ok(entry.examples.length > 0, `${entry.routeKey} examples`);
    assert.equal(registryJournalRoutes(entry.examples[0])[0]?.id, entry.routeKey, `${entry.routeKey} representative example`);
    const atomic = foundationAtomicRoutes({ routeKey: entry.routeKey, routeConfidence: '0.93', specific: 'Test' });
    assert.equal(atomic[0]?.id, entry.routeKey, `${entry.routeKey} atomic route`);
    assert.equal(classificationForResolvedRoute(atomic[0]!, { specific: 'Test' }, 'foundation')?.categoryId, entry.categoryId, `${entry.routeKey} classification`);
  }
});

test('atomic routing retries generic, ambiguous, low-margin, and registry-conflicting reads', () => {
  assert.equal(foundationAtomicNeedsRetry('A thought', { routeKey: 'general.other', routeConfidence: 0.95 }), true);
  assert.equal(foundationAtomicNeedsRetry('A thought', { routeKey: 'ambiguous', routeConfidence: 0.8 }), true);
  assert.equal(foundationAtomicNeedsRetry('I watched a movie', { routeKey: 'studio.film', routeConfidence: 0.8 }), true);
  assert.equal(foundationAtomicNeedsRetry('It’s my birthday', { routeKey: 'people.solo', routeConfidence: 0.95 }), true);
  assert.equal(foundationAtomicNeedsRetry('I watched a movie', { routeKey: 'studio.film', routeConfidence: 0.95, alternativeRouteKey: 'studio.show', alternativeRouteConfidence: 0.5 }), false);
});

test('conflicting evidence remains editable suggestions instead of forcing a route', () => {
  const decision = resolveFoundationRouteEvidence(
    'I travelled to a new city',
    { routeKey: 'went_somewhere.city', routeConfidence: 0.9, alternativeRouteKey: 'movement.travel', alternativeRouteConfidence: 0.82 },
    { routeKey: 'movement.travel', routeConfidence: 0.88, alternativeRouteKey: 'went_somewhere.city', alternativeRouteConfidence: 0.84 }
  );
  assert.ok(decision.routes.length >= 2);
  assert.equal(decision.selected, null);
});

test('shared route resolver uses registry aliases and confidence boundaries', () => {
  const meal = journalRouteForAlias('meal', 0.9, 'test');
  const book = journalRouteForAlias('book', 0.8, 'test');
  const routes = rankJournalRoutes([meal, book]);
  assert.equal(routes[0]?.id, 'food.meal');
  assert.equal(journalRouteNeedsConfirmation(routes), true);
  assert.equal(journalRouteNeedsConfirmation([meal!]), false);
});

test('canonical commit is idempotent and creates compatibility projections', () => {
  const command: JournalCommitCommand = {
    idempotencyKey: 'photo:file:///meal.jpg',
    draft: {
      sessionId: 'capture-1', source: { kind: 'photo', sourceId: 'file:///meal.jpg', thumbnailUri: 'thumb.jpg' },
      flowId: 'food', categoryId: 'meal', fields: { specific: 'Ramen', context: 'japanese' }, feeling: 'treat', note: null,
      attachments: [{ id: 'photo-1', kind: 'photo', uri: 'thumb.jpg' }], confirmedFacets: [{ key: 'food_item', value: 'Ramen' }],
    },
  };
  assert.equal(commandToJournalRecord(command, now)?.source.kind, 'photo');
  const first = commitJournalRecord(baseDay(), command, now);
  const repeated = commitJournalRecord(first, command, new Date(now.getTime() + 1000));
  assert.equal(first.journalRecords?.length, 1);
  assert.equal(first.foodMoments?.[0]?.label, 'Ramen');
  assert.equal(repeated, first);
  assert.deepEqual(validateJournalProjections(first), []);
});

test('a categorized voice submission atomically preserves journal, note, and audio', () => {
  const command: JournalCommitCommand = {
    idempotencyKey: 'voice_note:voice-atomic',
    draft: {
      sessionId: 'voice-atomic', source: { kind: 'voice_note', sourceId: 'voice-atomic', audioUri: 'voice.m4a', durationMs: 7300 },
      flowId: 'general', categoryId: 'other', fields: { specific: 'A passing thought', context: null }, feeling: null,
      note: 'A passing thought I wanted to keep',
      attachments: [{ id: 'voice-attachment', kind: 'voice', text: 'A passing thought I wanted to keep', uri: 'voice.m4a', durationMs: 7300 }],
      confirmedFacets: [],
    },
  };
  const result = commitJournalRecord(baseDay(), command, now);
  assert.equal(result.journalRecords?.[0]?.flowId, 'general');
  assert.equal(result.journalRecords?.[0]?.categoryId, 'other');
  assert.equal(result.notes?.[0]?.id, 'voice-atomic');
  assert.equal(result.notes?.[0]?.audioUri, 'voice.m4a');
  assert.equal(result.notes?.[0]?.durationMs, 7300);
  assert.equal(result.classifiedMemories?.[0]?.sourceId, 'voice-atomic');
});

test('journal commit stays below the foreground mutation budget', () => {
  const command: JournalCommitCommand = {
    idempotencyKey: 'manual:perf',
    draft: { sessionId: 'perf', source: { kind: 'manual', sourceId: 'perf' }, flowId: 'general', categoryId: 'highlight', fields: { specific: 'A good moment' }, feeling: null, note: null, attachments: [], confirmedFacets: [] },
  };
  const started = performance.now();
  commitJournalRecord(baseDay(), command, now);
  assert.ok(performance.now() - started < 100);
});
