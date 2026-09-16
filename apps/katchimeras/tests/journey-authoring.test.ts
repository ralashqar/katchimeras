import assert from 'node:assert/strict';
import test from 'node:test';
import { journeyAuthoringSource, materializeJourneyDraft, parseJourneyPreview, previewJourneyEpisode, validateJourneyDraft } from '@/features/content-authoring/journey-draft';

test('draft edits round trip without mutating the shipped arc or its links', () => {
  const { draft, source, fields } = journeyAuthoringSource();
  const quantity = fields.find((field) => field.label === 'quantity')!;
  assert.ok(quantity);
  draft.edits = { 'chapter/title': 'Designer test', [quantity.path]: 3 };
  const model = materializeJourneyDraft(draft);
  assert.equal(model.chapter.title, 'Designer test');
  assert.equal(journeyAuthoringSource().source.chapter.title, source.chapter.title);
  assert.deepEqual(model.chapter.episodes.map((e) => e.id), source.chapter.episodes.map((e) => e.id));
  assert.deepEqual(model.chapter.episodes.map((e) => e.unlock), source.chapter.episodes.map((e) => e.unlock));
  assert.equal(validateJourneyDraft(draft).issues.length, 0);
  for (const episode of source.chapter.episodes) if (episode.conversationId) assert.ok(source.conversations.some((c) => c.id === episode.conversationId));
});

test('compiled dialogue uses authored copy and catalog conversation edits', () => {
  const { draft, source, fields } = journeyAuthoringSource();
  const index = source.chapter.episodes.findIndex((e) => e.beats);
  const text = fields.find((f) => f.path.startsWith(`chapter/episodes/${index}/beats/`) && f.label === 'text')!;
  draft.edits[text.path] = 'A designer changed this line.';
  assert.match(JSON.stringify(previewJourneyEpisode(draft, index).conversation), /A designer changed this line/);
  const linked = source.chapter.episodes.findIndex((e) => e.conversationId);
  const conversationIndex = source.conversations.findIndex((c) => c.id === source.chapter.episodes[linked].conversationId);
  const linkedText = fields.find((f) => f.path.startsWith(`conversations/${conversationIndex}/`) && ['prompt', 'message'].includes(f.label))!;
  assert.ok(linkedText);
  draft.edits[linkedText.path] = 'Edited catalog dialogue.';
  assert.match(JSON.stringify(previewJourneyEpisode(draft, linked).conversation), /Edited catalog dialogue/);
});

test('invalid references, graph edits, fractional quantities and stale drafts cannot preview', () => {
  const { draft, fields } = journeyAuthoringSource();
  const quantity = fields.find((f) => f.label === 'quantity')!;
  const item = fields.find((f) => f.options)!;
  for (const edits of [{ '__proto__/polluted': 'yes' }, { 'chapter/episodes/0/id': 'changed' }, { [quantity.path]: 1.5 }, { [quantity.path]: -1 }, { [item.path]: 'unknown-item' }, { 'chapter/title': '' }]) {
    assert.equal(validateJourneyDraft({ ...draft, edits }).draft, null);
    assert.throws(() => materializeJourneyDraft({ ...draft, edits }));
  }
  assert.equal(validateJourneyDraft({ ...draft, sourceRevision: 'old' }).draft, null);
  assert.throws(() => previewJourneyEpisode(draft, -1));
});

test('offline preview accepts embedded art and rejects unsafe or oversized image payloads', () => {
  const { draft } = journeyAuthoringSource();
  const preview = { kind: 'journey-preview', version: 1, draft, image: 'data:image/png;base64,aGVsbG8=' };
  assert.deepEqual(parseJourneyPreview(JSON.parse(JSON.stringify(preview))), preview);
  for (const image of ['https://example.com/tile.png', 'data:image/svg+xml;base64,AAAA', 'data:image/png;base64,' + 'A'.repeat(2800000)]) assert.throws(() => parseJourneyPreview({ ...preview, image }));
  assert.throws(() => parseJourneyPreview({ ...preview, draft: { ...draft, sourceRevision: 'old' } }));
});
