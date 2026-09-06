import assert from 'node:assert/strict';
import test from 'node:test';

import registryJson from '@/data/intelligence/memory-qualities.json';
import { SEMANTIC_CATEGORIES, validateSemanticCategories } from '@/utils/intelligence/semantic-categories';
import { buildNoteClassifiedMemory } from '@/utils/intelligence/classification';

test('semantic registry covers every existing memory quality', () => {
  const ids = new Set(SEMANTIC_CATEGORIES.map((category) => category.id));
  for (const quality of registryJson.qualities) assert.ok(ids.has(quality.id), `missing ${quality.id}`);
  assert.equal(validateSemanticCategories().length, 0);
  assert.ok(ids.has('media.show'));
  assert.ok(ids.has('media.other'));
});

test('every category has useful English anchors and note intents', () => {
  for (const category of SEMANTIC_CATEGORIES) {
    assert.ok(category.wordAnchors.length >= 2, `${category.id} word anchors`);
    assert.ok(category.positiveSentences.length >= 4, `${category.id} sentence anchors`);
    assert.ok(category.thresholds.review < category.thresholds.accept, `${category.id} thresholds`);
  }
});

test('park and media categories include ambiguity guards', () => {
  const park = SEMANTIC_CATEGORIES.find((category) => category.id === 'place.park')!;
  const book = SEMANTIC_CATEGORIES.find((category) => category.id === 'media.book')!;
  const film = SEMANTIC_CATEGORIES.find((category) => category.id === 'media.film')!;
  assert.ok(park.wordAnchors.includes('recreation ground'));
  assert.ok(book.negativeSentences.some((sentence) => /booked a table/i.test(sentence)));
  assert.ok(film.negativeSentences.some((sentence) => /television episode/i.test(sentence)));
});

test('confirmed semantic note evidence reaches canonical qualities', () => {
  const memory = buildNoteClassifiedMemory({
    noteId: 'semantic-park', kind: 'text', observedAt: new Date(0).toISOString(),
    text: 'We found a lovely recreation ground', provider: 'manual',
    semanticCategoryId: 'place.park', semanticConfidence: 1,
  });
  assert.equal(memory.dominantDomain, 'place');
  assert.ok(memory.qualities.some((quality) => quality.qualityId === 'place.park' && quality.score >= 0.8));
  assert.ok(memory.assignments.some((assignment) => assignment.seedId === 'park'));
});
