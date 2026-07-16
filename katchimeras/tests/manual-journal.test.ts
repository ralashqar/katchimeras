import assert from 'node:assert/strict';
import test from 'node:test';

import type { HomeDayRecord, ManualJournalSubmission, StoredHomeDayRecord } from '@/types/home';
import { withManualJournalEntry } from '@/game/days/mutations/manual-journal';
import { MANUAL_JOURNAL_FLOWS, validateManualJournalRegistry } from '@/utils/manual-journal-registry';
import { buildMomentTimeline } from '@/utils/moment-timeline';
import { shouldAutoRouteVoice } from '@/utils/manual-journal-voice-routing';

function day(): StoredHomeDayRecord {
  return { id: 'day-1', isoDate: '2026-07-12', moments: [], locations: [], promptAnswers: [], notes: [], foodMoments: [], studioMoments: [], bigMoments: [], evidence: [], classifiedMemories: [] } as unknown as StoredHomeDayRecord;
}
function submission(flowId: string, categoryId: string, qualityIds: string[], specific?: string, feeling?: string): ManualJournalSubmission {
  return { flowId, path: [flowId, categoryId], categoryId, canonicalQualityIds: qualityIds, fields: { specific: specific ?? null }, feeling: feeling ?? null, note: null };
}

test('registry exposes the eight human event branches', () => {
  assert.equal(validateManualJournalRegistry().length, 0);
  assert.deepEqual(MANUAL_JOURNAL_FLOWS.map((flow) => flow.id), ['went_somewhere', 'food', 'studio', 'movement', 'people', 'work', 'big_event', 'general']);
  assert.ok(MANUAL_JOURNAL_FLOWS.every((flow) => flow.choices.length >= 7));
  assert.ok(MANUAL_JOURNAL_FLOWS.every((flow) => flow.shortTitle && flow.description && flow.section));
  assert.deepEqual(new Set(MANUAL_JOURNAL_FLOWS.map((flow) => flow.section)), new Set(['everyday', 'culture', 'milestone', 'other']));
});

test('voice routing opens review only for one clearly dominant route', () => {
  const route = (id: string, confidence: number) => ({
    id, flowId: 'food', choiceId: 'meal', label: id, confidence, reasons: [], confirmedFacets: [],
  });
  assert.equal(shouldAutoRouteVoice(route('clear', 0.9), route('other', 0.7)), true);
  assert.equal(shouldAutoRouteVoice(route('too-low', 0.8)), false);
  assert.equal(shouldAutoRouteVoice(route('close-a', 0.88), route('close-b', 0.8)), false);
});

test('category-only park creates canonical quality and assignment without coordinates', () => {
  const result = withManualJournalEntry(day(), submission('went_somewhere', 'park', ['place.park']), new Date('2026-07-12T12:00:00Z'));
  assert.equal(result.manualJournalEntries?.[0].categoryId, 'park');
  assert.equal(result.locations.length, 0);
  assert.ok(result.classifiedMemories?.[0].qualities.some((quality) => quality.qualityId === 'place.park'));
  assert.ok(result.classifiedMemories?.[0].assignments.some((assignment) => assignment.seedId === 'park'));
});

test('a place journal owns one specific Moments row while retaining its place projection', () => {
  const result = withManualJournalEntry(
    day(),
    { ...submission('went_somewhere', 'museum', ['place.museum'], 'London'), note: 'I went to the Natural History Museum in London' },
    new Date('2026-07-12T18:18:00Z')
  );
  assert.equal(result.confirmedPlaces?.[0]?.category, 'museum');
  const timeline = buildMomentTimeline(result as unknown as HomeDayRecord);
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0]?.category, 'Museum or gallery');
  assert.equal(timeline[0]?.label, 'London');
  assert.equal(timeline[0]?.noteText, 'I went to the Natural History Museum in London');
});

test('film title saves to Studio while rating remains genuinely absent', () => {
  const result = withManualJournalEntry(day(), submission('studio', 'film', ['media.film'], 'Dune: Part Two'), new Date('2026-07-12T13:00:00Z'));
  assert.equal(result.studioMoments?.[0].label, 'Dune: Part Two');
  assert.equal(result.studioMoments?.[0].rating, null);
  assert.equal(buildMomentTimeline(result as unknown as HomeDayRecord).filter((entry) => /Dune/.test(entry.label)).length, 1);
});

test('food can save without fabricated meaning', () => {
  const result = withManualJournalEntry(day(), submission('food', 'meal', ['subject.food'], 'Ramen'), new Date('2026-07-12T14:00:00Z'));
  assert.equal(result.foodMoments?.[0].label, 'Ramen');
  assert.equal(result.foodMoments?.[0].meaning, null);
});

test('explicit My child choice creates confirmed parenting assignment', () => {
  const result = withManualJournalEntry(day(), submission('people', 'my_child', ['subject.child']), new Date('2026-07-12T15:00:00Z'));
  const memory = result.classifiedMemories?.[0];
  assert.ok(memory?.facets.some((facet) => facet.key === 'relationship' && facet.value === 'my_child' && facet.confirmed));
  assert.ok(memory?.assignments.some((assignment) => assignment.seedId === 'parenting_care' && assignment.confirmed));
});

test('people choices expose category-specific contexts and reactions', () => {
  const people = MANUAL_JOURNAL_FLOWS.find((flow) => flow.id === 'people');
  const child = people?.choices.find((choice) => choice.id === 'my_child');
  const solo = people?.choices.find((choice) => choice.id === 'solo');
  assert.equal(child?.contextTitle, 'What was happening?');
  assert.ok(child?.contextChoices?.some((item) => item.id === 'playtime'));
  assert.ok(child?.feelings?.some((item) => item.id === 'proud'));
  assert.equal(child?.contextChoices?.some((item) => item.id === 'conversation'), false);
  assert.ok(solo?.feelings?.some((item) => item.id === 'restored'));
});

test('big event uses the entered name and keeps one timeline entry', () => {
  const result = withManualJournalEntry(day(), submission('big_event', 'wedding', ['life.celebration'], 'Maya and Jo’s wedding', 'loved'), new Date('2026-07-12T16:00:00Z'));
  assert.equal(result.bigMoments?.[0].label, 'Maya and Jo’s wedding');
  assert.equal(buildMomentTimeline(result as unknown as HomeDayRecord).filter((entry) => /Maya and Jo/.test(entry.label)).length, 1);
});
