import assert from 'node:assert/strict';
import test from 'node:test';

import { commitJournalRecord } from '@/game/days/mutations/manual-journal';
import type { JournalCommitCommand, StoredHomeDayRecord } from '@/types/home';
import { commandToJournalRecord } from '@/utils/journal-domain';
import { createJournalSession, journalDraftIsDirty, journalSessionReducer } from '@/utils/journal-session';
import { journalRouteForAlias, journalRouteNeedsConfirmation, rankJournalRoutes } from '@/utils/journal-routing';
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

test('journal commit stays below the foreground mutation budget', () => {
  const command: JournalCommitCommand = {
    idempotencyKey: 'manual:perf',
    draft: { sessionId: 'perf', source: { kind: 'manual', sourceId: 'perf' }, flowId: 'general', categoryId: 'highlight', fields: { specific: 'A good moment' }, feeling: null, note: null, attachments: [], confirmedFacets: [] },
  };
  const started = performance.now();
  commitJournalRecord(baseDay(), command, now);
  assert.ok(performance.now() - started < 100);
});
