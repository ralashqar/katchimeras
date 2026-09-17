import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyRelationshipProgressState } from '../game/katchimeras/relationship-progression';
import { createJourneyCycle, installJourneyCycle } from '../game/katchimeras/companion-journey-cycle';
import { createInitialMergeWorldState } from '../utils/merge-world/engine';
import { emptyCompanionBondState, recordCompanionBondEvent } from '../utils/companion-bond';
import { emptyCompanionContentState } from '../utils/companion-content';
import { STEPPLING_CHAPTER } from '../constants/companion-journey-chapters/steppling';
import { COMPANION_JOURNEY_CHAPTERS, JOURNEY_EPISODE_CONVERSATIONS, journeyEpisodeForConversation } from '../constants/companion-journey-chapters/registry';
import { journeyChapterState, journeyConditionHolds, type JourneyTriggerFacts } from '../features/companion/journey-triggers';
import { validateConversationDefinitions } from '../utils/companion-conversation';
import { companionConversationDefinitionById } from '../constants/companion-conversations-v2';
import type { CompanionJourneyChapterDefinition, JourneyUnlockCondition } from '../types/companion-journey-chapter';

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-09-16T12:00:00').getTime();

function facts(overrides: Partial<JourneyTriggerFacts> = {}): JourneyTriggerFacts {
  return { familyId: 'steppling', now, world: createInitialMergeWorldState(now - 10 * HOUR), relationships: emptyRelationshipProgressState(),
    bond: emptyCompanionBondState(), content: emptyCompanionContentState(), dayOneComplete: true, ...overrides };
}
function completed(episodeIds: readonly string[], at = now - 5 * HOUR) {
  const relationships = emptyRelationshipProgressState();
  return { ...relationships, journeyEpisodes: Object.fromEntries(episodeIds.map((id, index) => [`steppling:${id}`, { familyId: 'steppling' as const, episodeId: id, completedAt: at + index, answers: {}, facts: {} }])) };
}
const holds = (condition: JourneyUnlockCondition, input: JourneyTriggerFacts, chapter: CompanionJourneyChapterDefinition = STEPPLING_CHAPTER, index = 2) => journeyConditionHolds(condition, chapter, index, input);

test('every unlock kind reads a durable fact', () => {
  assert.equal(holds({ kind: 'day_one_complete' }, facts({ dayOneComplete: false })), false);
  assert.equal(holds({ kind: 'day_one_complete' }, facts()), true);
  assert.equal(holds({ kind: 'episode_complete', episodeId: 'day-2' }, facts()), false);
  assert.equal(holds({ kind: 'episode_complete', episodeId: 'day-2' }, facts({ relationships: completed(['day-1', 'day-2']) })), true);
  assert.equal(holds({ kind: 'since_previous', ms: HOUR }, facts()), true, 'nothing before it: no wait');
  assert.equal(holds({ kind: 'since_previous', ms: 6 * HOUR }, facts({ relationships: completed(['day-1', 'day-2']) })), false);
  assert.equal(holds({ kind: 'since_previous', ms: 4 * HOUR }, facts({ relationships: completed(['day-1', 'day-2']) })), true);
  let bond = emptyCompanionBondState();
  for (let index = 0; index < 3; index += 1) bond = recordCompanionBondEvent(bond, { id: `evt:${index}`, creatureId: 'companion:steppling', kind: 'conversation_completed', points: 20, occurredAt: now - HOUR + index }).state;
  assert.equal(holds({ kind: 'bond_level', level: 2 }, facts({ bond })), true, '60 points is Familiar');
  assert.equal(holds({ kind: 'bond_level', level: 3 }, facts({ bond })), false);
  assert.equal(holds({ kind: 'interactions', count: 3 }, facts({ bond, relationships: completed(['day-1', 'day-2']) })), true, 'three moments since the previous episode');
  assert.equal(holds({ kind: 'interactions', count: 4 }, facts({ bond, relationships: completed(['day-1', 'day-2']) })), false);
  assert.equal(holds({ kind: 'interactions', count: 1 }, facts({ bond, relationships: completed(['day-1', 'day-2'], now) })), false, 'moments before the previous episode do not count');
  assert.equal(holds({ kind: 'evidence', count: 1 }, facts()), false);
  assert.equal(holds({ kind: 'friend_home', residentSkinId: 'petalimp' }, facts()), false);
  assert.equal(holds({ kind: 'mist_cleared', tileId: 'steppling-home' }, facts()), false);
  assert.equal(holds({ kind: 'friend_hatched', companion: 'baristabbit' }, facts()), false);
  assert.equal(holds({ kind: 'places_restored', count: 1 }, facts({ world: null })), false, 'no world yet: nothing restored');
  assert.equal(holds({ kind: 'story_tile_revealed', tileId: 'mossprout-old-grove' }, facts()), false);
});

test('the chapter state opens the next episode in order, hints at what blocks it, and reflects while the friend rests', () => {
  const fresh = journeyChapterState(STEPPLING_CHAPTER, facts({ dayOneComplete: false }));
  assert.equal(fresh.next?.episode.id, 'day-1');
  assert.equal(fresh.next?.status, 'locked');
  const afterDayOne = journeyChapterState(STEPPLING_CHAPTER, facts({ relationships: completed(['day-1'], now - 5 * HOUR) }));
  assert.equal(afterDayOne.next?.episode.id, 'day-2');
  assert.equal(afterDayOne.next?.status, 'available');
  const tooSoon = journeyChapterState(STEPPLING_CHAPTER, facts({ relationships: completed(['day-1'], now - HOUR) }));
  assert.equal(tooSoon.next?.status, 'locked');
  assert.equal(tooSoon.next?.hint, STEPPLING_CHAPTER.lines.hints!.since_previous);
  assert.equal(tooSoon.next?.opensAt, now - HOUR + 4 * HOUR, 'only time holds it: the card can count down to the moment it opens');
  assert.equal(tooSoon.next?.opensFrom, now - HOUR);
  assert.equal(afterDayOne.next?.opensAt, null);
  const cycle = createJourneyCycle({ id: 'journey-cycle:steppling:day-1', familyId: 'steppling', episodeId: 'day-1', number: 1, chapterId: 'steppling-chapter-1', title: 'A little way together', nextTitle: 'A reason to go', completedAt: now - HOUR, finale: false });
  // The unlock holds (day one was five hours ago) but the friend is still reflecting on a rest that began an hour ago.
  const resting = journeyChapterState(STEPPLING_CHAPTER, facts({ relationships: installJourneyCycle(completed(['day-1'], now - 5 * HOUR), cycle, 4 * HOUR) }));
  assert.equal(resting.reflecting, true);
  assert.equal(resting.next?.status, 'reflecting');
  const rested = journeyChapterState(STEPPLING_CHAPTER, facts({ now: now + 4 * HOUR, relationships: installJourneyCycle(completed(['day-1'], now - 5 * HOUR), cycle, 4 * HOUR) }));
  assert.equal(rested.returnReady, true);
  const done = journeyChapterState(STEPPLING_CHAPTER, facts({ relationships: completed(STEPPLING_CHAPTER.episodes.map((episode) => episode.id)) }));
  assert.equal(done.complete, true);
  assert.equal(done.next, null);
});

test('every chapter’s episodes compile to conversations that end, unlock on ids that exist, and vary in flavour', () => {
  assert.deepEqual(validateConversationDefinitions(JOURNEY_EPISODE_CONVERSATIONS), []);
  for (const chapter of COMPANION_JOURNEY_CHAPTERS) {
    const ids = new Set(chapter.episodes.map((episode) => episode.id));
    assert.equal(ids.size, chapter.episodes.length, `${chapter.chapterId}: episode ids unique`);
    assert.equal(chapter.episodes.filter((episode) => episode.dayOne).length, chapter.afterChapterId ? 0 : 1, `${chapter.chapterId}: exactly one day-one episode in a first chapter, none in a continuation`);
    for (const episode of chapter.episodes) {
      for (const condition of episode.unlock) if (condition.kind === 'episode_complete') assert.ok(ids.has(condition.episodeId), `${episode.id} unlocks on ${condition.episodeId}`);
      if (episode.dayOne) { assert.equal(episode.beats, undefined); continue; }
      const definition = companionConversationDefinitionById.get(episode.conversationId ?? `${chapter.familyId}:journey:${episode.id}`)!;
      assert.ok(definition, `${episode.id} has a conversation`);
      assert.ok(definition.nodes.some((node) => node.kind === 'end'), `${episode.id} ends`);
      assert.equal(journeyEpisodeForConversation(definition.id)?.episode.id, episode.id);
    }
    assert.ok(new Set(chapter.episodes.map((episode) => episode.flavour)).size >= (chapter.afterChapterId ? 2 : 3), `${chapter.chapterId}: an arc mixes its flavours`);
  }
});
