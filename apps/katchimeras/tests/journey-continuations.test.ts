import assert from 'node:assert/strict';
import test from 'node:test';
import { MOSSPROUT_CHAPTER } from '@/constants/companion-journey-chapters/mossprout';
import { journeyEpisodeRecordId, selectJourneyChapter } from '@/constants/companion-journey-chapters/registry';
import { normalizeContentPack } from '@/features/content-packs/normalize-content-pack';
import type { CompanionJourneyChapterDefinition } from '@/types/companion-journey-chapter';

const continuation: CompanionJourneyChapterDefinition = {
  ...MOSSPROUT_CHAPTER, chapterId: 'mossprout:moonlit-continuation', afterChapterId: MOSSPROUT_CHAPTER.chapterId,
  episodes: [{ id: 'moonlit:hello', title: 'A silver light', flavour: 'adventure', unlock: [], beats: [{ kind: 'end', text: 'Something has changed in the grove.' }] }],
};

test('completed chapters open their continuation without replaying the first meeting', () => {
  const chapters = [continuation, MOSSPROUT_CHAPTER];
  assert.equal(selectJourneyChapter(chapters), MOSSPROUT_CHAPTER);
  const completed = Object.fromEntries(MOSSPROUT_CHAPTER.episodes.map((episode) => [journeyEpisodeRecordId('mossprout', episode.id), { completedAt: 1 }]));
  assert.equal(selectJourneyChapter(chapters, completed), continuation);
  assert.equal(selectJourneyChapter(chapters, completed, MOSSPROUT_CHAPTER.chapterId), MOSSPROUT_CHAPTER, 'an unfinished rest keeps its own chapter');
});

test('continuations are validated as data, with globally unique saved episode IDs', () => {
  const pack = { id: 'moonlit-story', version: 1, contentSchemaVersion: 2, chapters: [continuation] };
  assert.deepEqual(normalizeContentPack(pack).issues, []);
  assert.ok(normalizeContentPack({ ...pack, contentSchemaVersion: 1 }).issues.some((issue) => issue.includes('schema 2')));
  assert.ok(normalizeContentPack({ ...pack, chapters: [{ ...continuation, episodes: MOSSPROUT_CHAPTER.episodes }] }).issues.some((issue) => issue.includes('already exists')));
  assert.ok(normalizeContentPack({ ...pack, chapters: [{ ...continuation, afterChapterId: 'missing' }] }).issues.some((issue) => issue.includes('predecessor')));
});
