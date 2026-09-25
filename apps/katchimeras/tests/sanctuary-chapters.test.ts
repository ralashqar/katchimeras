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
  assert.equal(state.goal?.id, 'dew-spring', 'first, the Dew Spring');
  assert.equal(state.goal?.action.kind, 'building', 'a tap opens the building');
  world = built(world, 'dew-spring');
  state = sanctuaryChapterState(world)!;
  assert.equal(state.goal?.id, 'baristabbit-home', 'then the lit window: Baristabbit');
  assert.deepEqual(state.goal?.action, { kind: 'world_offer', offerId: 'mist:baristabbit-home' }, 'a tap opens his tile');
  world = { ...world, companionDiscovery: { ...world.companionDiscovery, records: [...world.companionDiscovery.records, { characterId: 'baristabbit' }] } } as unknown as MergeWorldState;
  state = sanctuaryChapterState(world)!;
  assert.equal(state.goal?.id, 'supply-run', 'then his Café: Meals and Timber');
  assert.equal(state.goal?.action.kind, 'supply_run');
  assert.equal(state.done, 2);
  world = { ...world, supplyRun: { slots: [3, 4], served: 3 } };
  assert.equal(sanctuaryChapterState(world)!.goal?.id, 'dew-spring-2', 'then the Timber spent: the Dew Spring grows');
  world = { ...world, heartwoodBuildings: { ...world.heartwoodBuildings, 'dew-spring': { level: 2 } } } as MergeWorldState;
  state = sanctuaryChapterState(world)!;
  assert.equal(state.complete, true, 'every goal done: the chapter is ready to be claimed');
  assert.equal(state.goal, null);
});

test('a chapter pays once, then the next one opens: the Signal points at Petalimp', () => {
  let world = { ...createInitialMergeWorldState(1_000), heartwoodBuildings: { 'dew-spring': { level: 2 } }, supplyRun: { slots: [3, 4] as const, served: 3 } } as MergeWorldState;
  const coins = world.coins;
  const reward = SANCTUARY_CHAPTERS[0]!.reward.glow;
  const claimed = reduceMergeWorld(world, { type: 'claimChapterReward', chapterId: 'home-for-two', glow: reward, now: 2_000 });
  assert.equal(claimed.state.coins, coins + reward);
  assert.equal(reduceMergeWorld(claimed.state, { type: 'claimChapterReward', chapterId: 'home-for-two', glow: reward, now: 3_000 }).changed, false, 'paid once');
  world = normalizeMergeWorldState(JSON.parse(JSON.stringify(claimed.state)), 3_000);
  const lodge = sanctuaryChapterState(world)!;
  assert.equal(lodge.chapter.id, 'explorers-lodge', 'the claim survives a reload, and the Lodge chapter follows');
  assert.deepEqual(lodge.goal?.action, { kind: 'hero_building', id: 'explorers-lodge' }, 'a tap opens the Lodge');
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
  assert.equal(next.goal?.action.kind, 'kingdom_next', 'a tap follows the way to the next friend');
  world = { ...world, haven: { ...world.haven, mossproutNatureIslands: { ...world.haven.mossproutNatureIslands, 'bloom-garden': 1 } } };
  assert.deepEqual(sanctuaryChapterState(world)?.goal?.action, { kind: 'hero', characterId: 'mossprout' }, 'then train a hero: the tap opens Mossprout’s panel');
  world = { ...world, katchimeraProgress: { ...world.katchimeraProgress, mossprout: { level: 2, xp: 0, upgradedAt: 4_000 } } };
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
    assert.deepEqual(chapter.goals.map((goal) => goal.action.kind).filter((kind) => kind !== 'hero_building'), ['heart_tree', 'hero', 'kingdom_next', 'kingdom_next']);
    const campaign = islandCampaignForIsland(entry.islandId)!;
    const home = { ...createInitialMergeWorldState(1_000), islandCampaigns: { [campaign.campaignId]: { cardEarnedAt: 5 } } } as never;
    assert.equal(chapter.goals.at(-1)!.done(home), true, 'the last goal is the friend home');
  }
});
