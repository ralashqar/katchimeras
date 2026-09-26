import assert from 'node:assert/strict';
import test from 'node:test';

import { SANCTUARY_CHAPTERS, sanctuaryChapterState } from '@/constants/sanctuary-chapters';
import { PETALIMP_ISLAND_CAMPAIGN_ID } from '@/constants/island-campaigns/petalimp-bloom';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldState } from '@/types/merge-world';

const built = (world: MergeWorldState, id: string): MergeWorldState => ({ ...world, heartwoodBuildings: { ...world.heartwoodBuildings, [id]: { level: 1 } } } as MergeWorldState);

test('the Sanctuary always has one next thing: its chapter goals are read off the world, in order', () => {
  let world = createInitialMergeWorldState(1_000);
  let state = sanctuaryChapterState(world)!;
  assert.equal(state.chapter.id, 'home-for-two');
  assert.equal(state.goal?.id, 'baristabbit-home', 'first, the lit window: a rescue battle, no ticket');
  assert.deepEqual(state.goal?.action, { kind: 'world_offer', offerId: 'mist:baristabbit-home' }, 'a tap opens his tile');
  assert.deepEqual(state.goal?.beacon, { tileId: 'baristabbit-home', color: '#FFB547' }, 'the window glows while it is the goal');
  assert.equal(state.chapter.opening?.tileId, 'baristabbit-home', 'FTUE v2: the chapter opens on the light in the Mist');
  world = { ...world, companionDiscovery: { ...world.companionDiscovery, records: [...world.companionDiscovery.records, { characterId: 'baristabbit' }] } } as unknown as MergeWorldState;
  state = sanctuaryChapterState(world)!;
  assert.equal(state.goal?.id, 'supply-run', 'then his Café: Meals, a little Timber and Glow');
  assert.equal(state.goal?.action.kind, 'supply_run');
  world = { ...world, supplyRun: { slots: [3, 4], served: 3 } };
  state = sanctuaryChapterState(world)!;
  assert.equal(state.goal?.id, 'train-mossprout', 'then the first Meals train Mossprout');
  assert.deepEqual(state.goal?.action, { kind: 'hero', characterId: 'mossprout' }, 'a tap opens his hero panel');
  assert.equal(state.done, 2);
  world = { ...world, katchimeraProgress: { ...world.katchimeraProgress, mossprout: { level: 2, xp: 45, upgradedAt: 2_000 } } };
  state = sanctuaryChapterState(world)!;
  assert.equal(state.complete, true, 'every goal done: the chapter is ready to be claimed');
  assert.equal(state.goal, null);
});

test('a chapter pays once, then the next one opens: the Signal points at Petalimp', () => {
  let world = { ...createInitialMergeWorldState(1_000), katchimeraProgress: { mossprout: { level: 2, xp: 45, upgradedAt: 1_000 } }, supplyRun: { slots: [3, 4] as const, served: 3 } } as MergeWorldState;
  world = { ...world, companionDiscovery: { ...world.companionDiscovery, records: [...world.companionDiscovery.records, { characterId: 'baristabbit' }] } } as unknown as MergeWorldState;
  const coins = world.coins;
  const reward = SANCTUARY_CHAPTERS[0]!.reward.glow;
  const claimed = reduceMergeWorld(world, { type: 'claimChapterReward', chapterId: 'home-for-two', glow: reward, now: 2_000 });
  assert.equal(claimed.state.coins, coins + reward);
  assert.equal(reduceMergeWorld(claimed.state, { type: 'claimChapterReward', chapterId: 'home-for-two', glow: reward, now: 3_000 }).changed, false, 'paid once');
  world = normalizeMergeWorldState(JSON.parse(JSON.stringify(claimed.state)), 3_000);
  const lodge = sanctuaryChapterState(world)!;
  assert.equal(lodge.chapter.id, 'explorers-lodge', 'the claim survives a reload, and the Lodge chapter follows');
  // Chapter 2 is Push It Back (FTUE v2): its opening points at the Frontier's first tile, and the first goal is that battle.
  assert.equal(lodge.chapter.opening?.tileId, 'frontier-1');
  assert.deepEqual(lodge.goal?.action, { kind: 'frontier' }, 'a tap takes back the edge of the Mist');
  const reclaim = (state: MergeWorldState, tileIds: readonly string[]) => ({ ...state, encounters: { ...state.encounters, clears: { ...state.encounters?.clears, ...Object.fromEntries(tileIds.map((id) => [`frontier:${id}`, { firstClearedAt: 1, clears: 1, bestGrade: 'bright', lastKatchimeraId: 'mossprout' }])) } } }) as MergeWorldState;
  world = reclaim(world, ['frontier-1']);
  assert.deepEqual(sanctuaryChapterState(world)?.goal?.action, { kind: 'hero_building', id: 'explorers-lodge' }, 'then a tap opens the Lodge');
  world = reclaim(world, ['frontier-2', 'frontier-3']);
  world = { ...world, heroBuildings: { 'explorers-lodge': { level: 2, builtAt: 3_000 }, 'baristabbit-cafe': { level: 1, builtAt: 3_000 } }, supplyRun: { slots: [3, 3], served: 5, crates: 1 }, heartTree: { receiptId: 'test:tree', restoredAt: 1_000, level: 2 } };
  assert.equal(sanctuaryChapterState(world)?.complete, true);
  world = reduceMergeWorld(world, { type: 'claimChapterReward', chapterId: 'explorers-lodge', glow: 40, now: 3_200 }).state;
  const next = sanctuaryChapterState(world)!;
  assert.equal(next.chapter.id, 'the-signal', 'then the Signal');
  assert.equal(next.openingPending, true, 'the Signal opens with its scene: the flare over the Bloom Garden');
  assert.equal(next.chapter.opening?.islandId, 'bloom-garden');
  const opened = reduceMergeWorld(world, { type: 'markChapterOpened', chapterId: 'the-signal', now: 3_500 });
  assert.equal(sanctuaryChapterState(opened.state)?.openingPending, false, 'played once');
  assert.equal(reduceMergeWorld(opened.state, { type: 'markChapterOpened', chapterId: 'the-signal', now: 3_600 }).changed, false);
  world = opened.state;
  assert.equal(next.goal?.id, 'bloom-mist', 'first: clear the Mist over the Bloom Garden');
  assert.deepEqual(next.goal?.action, { kind: 'world_offer', offerId: 'nature:bloom-garden' }, 'a tap opens the Bloom Garden’s levels');
  world = { ...world, haven: { ...world.haven, mossproutNatureIslands: { ...world.haven.mossproutNatureIslands, 'bloom-garden': 1 } } };
  assert.deepEqual(sanctuaryChapterState(world)?.goal?.action, { kind: 'hero', characterId: 'mossprout' }, 'then train a hero: the tap opens Mossprout’s panel');
  world = { ...world, katchimeraProgress: { ...world.katchimeraProgress, mossprout: { level: 3, xp: 100, upgradedAt: 4_000 } } };
  assert.equal(sanctuaryChapterState(world)?.goal?.id, 'petalimp-home');
  const home = { ...world, islandCampaigns: { ...world.islandCampaigns, [PETALIMP_ISLAND_CAMPAIGN_ID]: { ...(world.islandCampaigns?.[PETALIMP_ISLAND_CAMPAIGN_ID] ?? {}), cardEarnedAt: 4_000 } } } as MergeWorldState;
  assert.equal(sanctuaryChapterState(home)?.complete, true, 'Petalimp home completes the Signal');
});

test('every friend after Petalimp has a chapter: a signal, the Heart Tree, a hero trained, the first battle, home', async () => {
  const { SANCTUARY_CHAPTERS } = await import('@/constants/sanctuary-chapters');
  const { ISLAND_WAKE_ORDER } = await import('@/constants/island-campaigns/wake-order');
  const { islandCampaignForIsland } = await import('@/constants/island-campaigns/registry');
  assert.deepEqual(SANCTUARY_CHAPTERS.map((chapter) => chapter.number), SANCTUARY_CHAPTERS.map((_, index) => index + 1));
  for (const entry of ISLAND_WAKE_ORDER.slice(1)) {
    const chapter = SANCTUARY_CHAPTERS.find((candidate) => candidate.opening?.islandId === entry.islandId);
    assert.ok(chapter, `a chapter for ${entry.residentSkinId}`);
    assert.equal(chapter.goals.find((goal) => goal.action.kind === 'heart_tree')!.title, `Grow the Heart Tree to level ${entry.heartTree}`, 'the chapter asks for the level its island needs');
    assert.deepEqual(chapter.goals.map((goal) => goal.action.kind).filter((kind) => kind !== 'hero_building'), ['heart_tree', 'frontier', 'hero', 'world_offer', 'world_offer']);
    assert.ok(chapter.goals.slice(-2).every((goal) => goal.action.kind === 'world_offer' && goal.action.offerId === `nature:${entry.islandId}`), 'the island’s goals open its levels');
    const campaign = islandCampaignForIsland(entry.islandId)!;
    const home = { ...createInitialMergeWorldState(1_000), islandCampaigns: { [campaign.campaignId]: { cardEarnedAt: 5 } } } as never;
    assert.equal(chapter.goals.at(-1)!.done(home), true, 'the last goal is the friend home');
  }
});

test('the main quest hands off with a scene: the goals that end away from the next one say why, then go on', async () => {
  const { chapterGoalById, SANCTUARY_CHAPTERS } = await import('@/constants/sanctuary-chapters');
  for (const id of ['supply-run', 'frontier-1', 'lodge-built', 'frontier-3', 'cafe-built', 'lodge-2', 'tree-2', 'bloom-mist', 'train-mossprout-3', 'kitchen-built', 'kitchen-feasts']) {
    assert.ok((chapterGoalById(id)?.outro?.length ?? 0) >= 1, `${id} ends on a scene`);
  }
  for (const chapter of SANCTUARY_CHAPTERS.slice(4)) {
    for (const suffix of ['tree', 'frontier', 'train', 'mist']) assert.ok(chapter.goals.find((goal) => goal.id === `${chapter.id}:${suffix}`)?.outro?.length, `${chapter.id}:${suffix} ends on a scene`);
  }
});
