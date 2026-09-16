import assert from 'node:assert/strict';
import test from 'node:test';
import { arcCatalog, compileArcDraft, newArcDraft } from '@/features/content-authoring/arc-builder';
import { normalizeContentRelease } from '@/features/content-packs/normalize-release';
import { selectJourneyChapter, journeyEpisodeRecordId, COMPANION_JOURNEY_CHAPTERS_BUNDLED } from '@/constants/companion-journey-chapters/registry';

test('new arcs compile into loadable continuations for either supported friend', () => {
  for (const predecessor of arcCatalog().predecessors) {
    const draft = { ...newArcDraft(), afterChapterId: predecessor.id };
    const result = compileArcDraft(draft);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(normalizeContentRelease([result.pack]).issues, []);
    const base = COMPANION_JOURNEY_CHAPTERS_BUNDLED.find(c => c.chapterId === predecessor.id)!;
    const chapter = result.pack!.chapters![0];
    assert.equal(chapter.familyId, predecessor.familyId);
    const completed = Object.fromEntries(base.episodes.map(e => [journeyEpisodeRecordId(base.familyId, e.id), { completedAt: 1 }]));
    assert.equal(selectJourneyChapter([base, chapter], completed), chapter);
  }
});
test('order gates follow episode reordering and IDs remain stable', () => {
  const draft = newArcDraft();
  draft.episodes.push({ ...draft.episodes[0], id: 'second' }, { ...draft.episodes[0], id: 'third' });
  draft.episodes[0].itemId = arcCatalog().items[0].id;
  let result = compileArcDraft(draft);
  assert.deepEqual(result.issues, []);
  assert.ok(result.pack!.chapters![0].episodes[1].unlock.some(g => g.kind === 'orders_served'));
  [draft.episodes[0], draft.episodes[1]] = [draft.episodes[1], draft.episodes[0]];
  result = compileArcDraft(draft);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.pack!.chapters![0].episodes[2].unlock, [{ kind: 'episode_complete', episodeId: `${draft.id}:episode-arrival` }, { kind: 'orders_served', orderIds: [`${draft.id}:order-arrival`] }]);
  assert.ok(!result.pack!.chapters![0].episodes[1].unlock.some(g => g.kind === 'orders_served'));
});
test('tiles compile into reveal consequences and registered art keys', () => {
  const draft = newArcDraft();
  draft.tiles.push({ id: 'spring', name: 'Spring', q: 20, r: 20, reveal: 'Water returns.', imageUrl: 'https://assets.example.com/spring.webp', bounds: { left: 1, top: 2, right: 512, bottom: 500 } });
  draft.episodes[0].tileId = 'spring';
  const result = compileArcDraft(draft);
  assert.deepEqual(result.issues, []);
  const tile = result.pack!.storyTiles![0];
  assert.ok(result.pack!.art![`${tile.alphaBoundsKey}:full`]);
  assert.deepEqual(result.pack!.chapters![0].episodes[0].consequences, [{ kind: 'reveal_story_tile', tileId: tile.id }]);
  draft.tiles[0].q = arcCatalog().occupied[0].q; draft.tiles[0].r = arcCatalog().occupied[0].r;
  assert.ok(compileArcDraft(draft).issues.some(s=>s.includes('occupied')));
});
test('invalid and incomplete arcs fail before export', () => {
  const draft = newArcDraft();
  assert.equal(compileArcDraft(null).pack, null);
  for (const episodes of [[], [null], [{ ...draft.episodes[0], hours: -1 }], [{ ...draft.episodes[0], tileId: 'missing' }], [{ ...draft.episodes[0], itemId: arcCatalog().items[0].id }], [draft.episodes[0], draft.episodes[0]]]) assert.equal(compileArcDraft({ ...draft, episodes }).pack, null);
  assert.equal(compileArcDraft({ ...draft, tiles: [null] }).pack, null);
  assert.equal(compileArcDraft({ ...draft, afterChapterId: 'missing' }).pack, null);
  const pack = compileArcDraft(draft).pack!;
  assert.ok(normalizeContentRelease([pack, { ...pack, id: 'another-release' }]).issues.length, 'release collision is refused');
});
