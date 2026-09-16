import assert from 'node:assert/strict';
import test from 'node:test';
import { MOSSPROUT_CHAPTER, resolutionEpisodeId } from '@/constants/companion-journey-chapters/mossprout';
import { OLD_GROVE_MISSION } from '@/constants/mossprout-arc-one-copy';
import { COMPANION_JOURNEY_CHAPTERS, journeyChapterFor, journeyEpisodeById } from '@/constants/companion-journey-chapters/registry';
import { journeyConsequenceFlow, journeyMissionOf } from '@/constants/companion-journey-chapters/consequence-flow';
import { storyTileById } from '@/constants/story-tiles/registry';
import { hatchableByTile } from '@/constants/hatchable-companions/registry';
import { ISLAND_WAKE_ORDER } from '@/constants/island-campaigns/wake-order';
import { MERGE_GENERATORS_BY_ID, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { createMissionState, missionBoardStep } from '@/features/onboarding/steppling-mission';
import { OPENING_MERGE_WINDOW_CELLS } from '@/features/onboarding/opening-mist';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { journeyChapterState, nextBondReward } from '@/features/companion/journey-triggers';
import { journeyLineContext, resolveJourneyConversation } from '@/utils/companion-journey-personalisation';
import { emptyRelationshipProgressState } from '@/game/katchimeras/relationship-progression';
import { emptyCompanionBondState } from '@/utils/companion-bond';
import { emptyCompanionContentState } from '@/utils/companion-content';
import type { MergeWorldState } from '@/types/merge-world';
import type { RelationshipProgressState } from '@/types/relationship-progression';

const NOW = Date.UTC(2026, 8, 16, 9);

const ARC = ['tiny-beginnings', 'wrong-with-the-mist', 'petalimp', 'old-garden', 'grove-kept', 'wisp-in-the-grove', 'growing-again'];

test('Growing Again’s seven episodes sit inside Mossprout’s one chapter, every unlock and consequence on a real thing', () => {
  assert.equal(journeyChapterFor('mossprout'), MOSSPROUT_CHAPTER);
  assert.ok(COMPANION_JOURNEY_CHAPTERS.includes(MOSSPROUT_CHAPTER));
  assert.deepEqual(MOSSPROUT_CHAPTER.episodes.filter((episode) => ARC.includes(episode.id)).map((episode) => episode.id), ARC, 'in arc order');
  assert.equal(MOSSPROUT_CHAPTER.episodes[0]!.dayOne, true);
  for (const episode of MOSSPROUT_CHAPTER.episodes.filter((item) => ARC.includes(item.id))) {
    for (const condition of episode.unlock) {
      if (condition.kind === 'friend_home') assert.ok(ISLAND_WAKE_ORDER.some((entry) => entry.residentSkinId === condition.residentSkinId), `${episode.id}: ${condition.residentSkinId} is an island friend`);
      if (condition.kind === 'mist_cleared') assert.ok(hatchableByTile(condition.tileId) || storyTileById(condition.tileId), `${episode.id}: ${condition.tileId} is a tile`);
    }
    const consequence = episode.consequence;
    if (consequence?.kind === 'reveal_story_tile' || consequence?.kind === 'mist_mission') assert.ok(storyTileById(consequence.tileId), `${episode.id} reveals a registered story tile`);
    if (consequence?.kind === 'grant') assert.ok(MERGE_GENERATORS_BY_ID.has(consequence.generatorId), `${episode.id} grants a known generator's parcel`);
    const flow = journeyConsequenceFlow(MOSSPROUT_CHAPTER, episode);
    if (consequence) assert.deepEqual(validateContentFlowDefinition(flow!), [], `${episode.id}'s consequence compiles`);
    else assert.equal(flow, null);
    assert.ok(episode.beats!.some((beat) => beat.kind === 'ask'), `${episode.id} asks the player something`);
  }
  assert.deepEqual(ARC.map((id) => MOSSPROUT_CHAPTER.episodes.find((episode) => episode.id === id)!.consequence?.kind ?? null), [null, null, null, 'reveal_story_tile', 'grant', 'mist_mission', null]);
});

test('the dark wisp’s board can be played out: no move strands it, and after the first merge there is one thing to do', () => {
  const mission = journeyMissionOf(MOSSPROUT_CHAPTER.episodes.find((episode) => episode.id === 'wisp-in-the-grove')!)!.mission;
  assert.equal(mission.id, OLD_GROVE_MISSION.id);
  for (const { definitionId } of [...mission.seed.items, ...mission.seed.echoes, ...mission.seed.veiled]) assert.ok(MERGE_ITEMS_BY_ID.has(definitionId), `${definitionId} is a Garden thing`);
  const start = createMissionState(mission.seed, 'mossprout', NOW);
  for (const { cell } of [...mission.seed.items, ...mission.seed.echoes, ...mission.seed.veiled]) assert.ok(OPENING_MERGE_WINDOW_CELLS.includes(cell), `cell ${cell} is in the window`);
  assert.equal(missionBoardStep(mission, start, 0)?.id, 'mission.mossprout-old-grove.first_merge');
  const key = (state: MergeWorldState) => JSON.stringify(state.board.map((cell) => [cell.occupant?.kind === 'item' ? cell.occupant.definitionId : null, cell.mist?.kind ?? null, cell.mist?.kind === 'echo' ? cell.mist.id : null]));
  const seen = new Set<string>();
  const walk = (state: MergeWorldState, strikes: number) => {
    const signature = `${key(state)}:${strikes}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    if (strikes >= mission.required) return;
    const items = OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item');
    const targets = OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item' || state.board[index]?.mist?.kind === 'echo');
    // What the board holds, not where: the same merge landing on either of its two cells is one outcome.
    const holding = (next: MergeWorldState) => JSON.stringify(next.board.map((cell) => [cell.occupant?.kind === 'item' ? cell.occupant.definitionId : null, cell.mist?.kind ?? null, cell.mist?.kind === 'echo' ? cell.mist.definitionId : null]).filter((entry) => entry[0] != null || entry[1] === 'echo' || entry[1] === 'veiled').sort());
    const outcomes = new Map<string, MergeWorldState>();
    for (const from of items) for (const to of targets) {
      if (from === to) continue;
      const result = reduceMergeWorld(state, { type: 'move', from, to, now: NOW });
      if (!result.changed || result.mergedCell == null) continue;
      outcomes.set(holding(result.state), result.state);
    }
    assert.ok(outcomes.size > 0, `a dead end after ${strikes} strikes`);
    assert.equal(outcomes.size, 1, `strike ${strikes + 1} offers ${outcomes.size} outcomes, not one`);
    assert.ok(missionBoardStep(mission, state, strikes)?.cue, `the finger has somewhere to point at strike ${strikes + 1}`);
    for (const next of outcomes.values()) walk(next, strikes + 1);
  };
  walk(start, 0);
});

function withEpisodes(ids: readonly string[], at = NOW - 10 * 60 * 60 * 1000, answers: Record<string, Record<string, string>> = {}): RelationshipProgressState {
  return { ...emptyRelationshipProgressState(), journeyEpisodes: Object.fromEntries(ids.map((id, index) => [`mossprout:${id}`, { familyId: 'mossprout' as const, episodeId: id, completedAt: at + index, answers: answers[id] ?? {}, facts: {} }])) };
}

test('episodes are said to this player: today’s weather, an earlier answer, the theory of them; and answers establish facts', () => {
  const tiny = journeyEpisodeById('mossprout', 'tiny-beginnings')!.compiled!;
  const plain = resolveJourneyConversation(tiny.definition, journeyLineContext('mossprout', [], emptyRelationshipProgressState(), null));
  const withToday = resolveJourneyConversation(tiny.definition, journeyLineContext('mossprout', [], emptyRelationshipProgressState(), 'Full sun'));
  const opening = (definition: typeof tiny.definition) => definition.nodes[0]!.kind === 'choice' ? definition.nodes[0]!.prompt : '';
  assert.doesNotMatch(opening(plain), /weather/);
  assert.match(opening(withToday), /called the weather “Full sun”/);
  assert.deepEqual(tiny.facts['tiny.pace:rush'], { key: 'pace', value: 'all at once' });
  const kept = journeyEpisodeById('mossprout', 'grove-kept')!.compiled!;
  const remembered = resolveJourneyConversation(kept.definition, journeyLineContext('mossprout', [], withEpisodes(['old-garden'], NOW, { 'old-garden': { 'grove.back': 'grove.back:no' } }), null));
  const second = remembered.nodes[1]!;
  assert.ok(second.kind === 'choice' && /forward is enough/.test(second.prompt), 'the grove remembers what the player said about looking back');
  const said = resolveJourneyConversation(kept.definition, journeyLineContext('mossprout', [], withEpisodes(['old-garden']), null)).nodes[1]!;
  assert.ok(said.kind === 'choice' && /You said you would look back/.test(said.prompt));
});

test('the Bond ladder says what is next, and a Bond-locked episode says how far', () => {
  assert.equal(nextBondReward(MOSSPROUT_CHAPTER, 1)?.label, 'Petalimp');
  assert.equal(nextBondReward(MOSSPROUT_CHAPTER, 3)?.label, 'Growing Again');
  assert.equal(nextBondReward(MOSSPROUT_CHAPTER, 4), null);
  assert.equal(nextBondReward(null, 1), null);
  // Every beat through the Lantern Bank done: The Old Garden waits on Bond, and its hint says how far.
  const beats = MOSSPROUT_CHAPTER.episodes.slice(0, MOSSPROUT_CHAPTER.episodes.findIndex((episode) => episode.id === 'old-garden')).map((episode) => episode.id);
  const facts = { familyId: 'mossprout', now: NOW, world: createInitialMergeWorldState(NOW), relationships: withEpisodes(beats), bond: emptyCompanionBondState(), content: emptyCompanionContentState(), dayOneComplete: true };
  const state = journeyChapterState(MOSSPROUT_CHAPTER, facts);
  assert.equal(state.episodes.find((item) => item.episode.id === 'old-garden')?.status, 'locked');
  assert.match(state.episodes.find((item) => item.episode.id === 'old-garden')?.hint ?? '', /150 Bond to go\.$/);
  assert.equal(state.next?.episode.id, 'heartwood:mirror-for-rain', 'the beat that has opened comes first');
  const fresh = journeyChapterState(MOSSPROUT_CHAPTER, { ...facts, relationships: withEpisodes(['quiet-patch:first-flower'], NOW - 60 * 60 * 1000) });
  assert.equal(fresh.next?.episode.id, 'tiny-beginnings');
  assert.equal(fresh.next?.hint, MOSSPROUT_CHAPTER.lines.hints!.since_previous, 'four hours after the first session, not before');
  const later = journeyChapterState(MOSSPROUT_CHAPTER, { ...facts, relationships: withEpisodes(['quiet-patch:first-flower']) });
  assert.equal(later.next?.status, 'available');
  void resolutionEpisodeId;
});
