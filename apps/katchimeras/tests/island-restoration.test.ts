import assert from 'node:assert/strict';
import test from 'node:test';
import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { activeIslandRestoration, islandCampaignChapterOrder } from '@/constants/island-campaigns/helpers';
import { FERNIP_WILDGROWTH_CAMPAIGN } from '@/constants/island-campaigns/fernip-wildgrowth';
import { PETALIMP_BLOOM_CAMPAIGN } from '@/constants/island-campaigns/petalimp-bloom';
import type { IslandCampaignDefinition, RestorationBoardDefinition } from '@/constants/island-campaigns/types';
import { MERGE_GENERATORS_BY_ID, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { generatorChainOpen } from '@/utils/merge-world/generator-branches';
import { openOrderChains } from '@/utils/merge-world/order-requirements';
import { buildPlayerProfileFixtures } from '@/utils/player-profile-fixtures';
import {
  createRestorationState, deliveriesToPlace, restorationBoardStep, restorationCheckpointReached, restorationComplete,
  restorationDeliveryCells, restorationEchoes, restorationNextMove, restorationProgress, restorationRunId, restorationWindowCells, restoreRestorationEchoes,
} from '@/features/island-restoration/island-restoration';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import type { MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { greetIslandFriend, revealIsland } from './helpers/island-campaign';
import { prioritizedVisibleMergeOrders } from '@/utils/merge-world/order-presentation';
import { readFileSync } from './helpers/content-fs';

const NOW = Date.UTC(2026, 8, 10, 12);
const petalimp = PETALIMP_BLOOM_CAMPAIGN;
const boardOf = (level: 1 | 2 | 3 | 4): RestorationBoardDefinition => petalimp.chapters.find((chapter) => chapter.level === level)!.restoration!;

function play(state: MergeWorldState, moves: [number, number][], start = NOW) {
  let merges = 0;
  for (const [from, to] of moves) {
    const result = reduceMergeWorld(state, { type: 'move', from, to, now: start + merges });
    assert.equal(result.changed, true, `${from}→${to}: ${result.message}`);
    assert.ok(result.mergedCell != null, `${from}→${to} counts`);
    state = result.state;
    merges += 1;
  }
  return { state, merges };
}

test('a cell half-hidden in mist holds an item; matching it sets it free and counts like a merge', () => {
  const definition = boardOf(1);
  const fresh = createRestorationState(definition, NOW);
  assert.deepEqual(restorationEchoes(fresh, restorationWindowCells(3)), [{ id: 'petalimp-1-plant', cell: 24, definitionId: 'nature:garden:3' }]);
  assert.equal(fresh.board[24].locked, true);
  const wrong = reduceMergeWorld(fresh, { type: 'move', from: 16, to: 24, now: NOW });
  assert.equal(wrong.changed, false, 'a Seed is not what the mist holds');
  assert.equal(wrong.failureReason, 'wrong_echo_match');
  const { state, merges } = play(fresh, [[16, 18], [22, 26], [18, 26]]);
  assert.equal(merges, 3);
  const freed = reduceMergeWorld(state, { type: 'move', from: 26, to: 24, now: NOW + 5 });
  assert.equal(freed.changed, true, freed.message);
  assert.equal(freed.mergedCell, 24);
  assert.equal(freed.dreamEchoClearedId, 'petalimp-1-plant');
  assert.equal(freed.state.board[24].locked, false, 'the cell is free');
  assert.equal(freed.state.board[24].mist, null);
  assert.equal((freed.state.board[24].occupant as { definitionId: string }).definitionId, 'nature:garden:4', 'and holds the next tier');
  assert.deepEqual(restorationProgress(definition, 4), { current: 4, total: 5 });
  assert.equal(restorationCheckpointReached(definition, freed.state, 4), true, 'the patch is spent one merge short');
  assert.equal(restorationComplete(definition, 4), false);
  const reloaded = normalizeMergeWorldState(JSON.parse(JSON.stringify(fresh)), NOW + 2);
  assert.equal(reloaded.board[24].mist?.kind, 'echo', 'a misted cell survives a relaunch');
  // A board saved before echoes had an owner comes back as plain mist; the authored echo is put back, a matched one is left alone.
  const stale = JSON.parse(JSON.stringify(fresh));
  stale.board[24].mist.ownerCharacterId = null;
  const lost = normalizeMergeWorldState(stale, NOW + 2);
  assert.equal(lost.board[24].mist?.kind, 'dormant', 'the normaliser drops an ownerless echo');
  const repaired = restoreRestorationEchoes(definition, lost);
  assert.equal(repaired.board[24].mist?.kind, 'echo', 'the authored echo is restored');
  assert.equal(repaired.board[24].mist?.kind === 'echo' ? repaired.board[24].mist.definitionId : null, 'nature:garden:3');
  assert.equal(restoreRestorationEchoes(definition, freed.state).board[24].mist, null, 'a matched cell stays free');
  const board = [...freed.state.board];
  board[17] = { ...board[17], occupant: { kind: 'item', instanceId: 'delivery', definitionId: 'nature:garden:4' } };
  const done = reduceMergeWorld({ ...freed.state, board }, { type: 'move', from: 17, to: 24, now: NOW + 6 });
  assert.equal(done.changed, true, done.message);
  assert.equal(restorationComplete(definition, 5), true);
  assert.equal(restorationCheckpointReached(definition, done.state, 5), false);
});

test('the restoration board is sealed outside its window and every authored id, cell and delivery slot is sound', () => {
  for (const level of [1, 2, 3, 4] as const) {
    const definition = boardOf(level);
    const state = createRestorationState(definition, NOW);
    const window = new Set(restorationWindowCells(definition.rows));
    state.board.forEach((cell, index) => {
      if (!window.has(index)) assert.ok(cell.locked && cell.occupant == null, `cell ${index} outside the ${definition.rows}-row window is sealed`);
    });
    assert.ok(definition.merges > 0);
    for (const echo of definition.echoes) {
      assert.ok(window.has(echo.cell), `misted cell ${echo.cell} sits in the window`);
      assert.ok(MERGE_ITEMS_BY_ID.get(echo.definitionId)?.nextItemId, `${echo.definitionId} can grow when matched`);
    }
    for (const item of definition.items) assert.ok(window.has(item.cell) && MERGE_ITEMS_BY_ID.has(item.definitionId));
    for (const cell of definition.deliveryCells) assert.ok(window.has(cell) && !definition.echoes.some((echo) => echo.cell === cell), `delivery cell ${cell} is a free window cell`);
    assert.equal(restorationCheckpointReached(definition, state, 0), false, 'a fresh board always has a local move');
  }
  const first = createRestorationState(boardOf(1), NOW);
  const opening = restorationNextMove(first, restorationWindowCells(3))!;
  assert.equal(opening.kind, 'merge', 'nothing matches the mist yet, so the closest twins');
  assert.equal((first.board[opening.from].occupant as { definitionId: string }).definitionId, 'nature:garden:1');
  assert.equal((first.board[opening.to].occupant as { definitionId: string }).definitionId, 'nature:garden:1');
  assert.deepEqual(restorationDeliveryCells(boardOf(1), first, 2), [17, 31], 'deliveries land on the authored cells first');
  assert.deepEqual(deliveriesToPlace({ startedAt: NOW, paidCoins: 0, progress: { current: 0, total: 5 }, deliveryRequestedAt: null, delivered: [{ definitionId: 'a', deliveredAt: NOW }, { definitionId: 'b', deliveredAt: NOW }], completedAt: null }, 1), ['b']);
});

/** Every order of local moves runs out before the bar is full, and every one of them fills it after the delivery. */
function proveBoard(campaign: IslandCampaignDefinition, level: 1 | 2 | 3 | 4) {
  const chapter = campaign.chapters.find((candidate) => candidate.level === level)!;
  const definition = chapter.restoration!;
  const cells = restorationWindowCells(definition.rows);
  const order = islandCampaignChapterOrder(campaign, level, chapter.choices[0]!.id, NOW)!;
  const delivery = order.requirements.flatMap((requirement) => Array.from({ length: requirement.quantity }, () => requirement.definitionId));
  const key = (state: MergeWorldState, merges: number, delivered: boolean) => JSON.stringify([
    delivered, merges,
    cells.flatMap((index) => { const cell = state.board[index]; return !cell.locked && cell.occupant?.kind === 'item' ? [cell.occupant.definitionId] : []; }).sort(),
    restorationEchoes(state, cells).map((echo) => `${echo.id}:${echo.definitionId}`),
  ]);
  const moves = (state: MergeWorldState) => {
    const items = cells.filter((index) => !state.board[index].locked && state.board[index]?.occupant?.kind === 'item');
    const echoes = restorationEchoes(state, cells);
    const out: { from: number; to: number }[] = [];
    for (const from of items) {
      const definitionId = (state.board[from].occupant as { definitionId: string }).definitionId;
      if (!MERGE_ITEMS_BY_ID.get(definitionId)?.nextItemId) continue;
      for (const to of items) if (to !== from && (state.board[to].occupant as { definitionId: string }).definitionId === definitionId) out.push({ from, to });
      for (const echo of echoes) if (echo.definitionId === definitionId) out.push({ from, to: echo.cell });
    }
    return out;
  };
  const seen = new Set<string>();
  const queue: { state: MergeWorldState; merges: number; delivered: boolean }[] = [{ state: createRestorationState(definition, NOW), merges: 0, delivered: false }];
  let checkpoints = 0;
  let completions = 0;
  while (queue.length) {
    const { state, merges, delivered } = queue.pop()!;
    const signature = key(state, merges, delivered);
    if (seen.has(signature)) continue;
    seen.add(signature);
    assert.ok(seen.size < 20_000, `${campaign.campaignId} level ${level}: the search blew up`);
    if (restorationComplete(definition, merges)) { completions += 1; continue; }
    const options = moves(state);
    if (!options.length) {
      assert.equal(restorationCheckpointReached(definition, state, merges), true, `${campaign.campaignId} level ${level}: stuck without a checkpoint at ${merges}`);
      assert.equal(delivered, false, `${campaign.campaignId} level ${level}: a dead end after the delivery at ${merges} of ${definition.merges} ${signature}`);
      checkpoints += 1;
      const landing = restorationDeliveryCells(definition, state, delivery.length);
      assert.equal(landing.length, delivery.length, `${campaign.campaignId} level ${level}: room for the delivery`);
      const board = [...state.board];
      landing.forEach((cell, index) => { board[cell] = { ...board[cell], occupant: { kind: 'item', instanceId: `delivery-${index}`, definitionId: delivery[index]! } }; });
      queue.push({ state: { ...state, board }, merges, delivered: true });
      continue;
    }
    for (const move of options) {
      const result = reduceMergeWorld(state, { type: 'move', from: move.from, to: move.to, now: NOW });
      assert.equal(result.changed, true, `${campaign.campaignId} level ${level}: ${result.message}`);
      assert.ok(result.mergedCell != null);
      queue.push({ state: result.state, merges: merges + 1, delivered });
    }
  }
  assert.ok(checkpoints > 0, `${campaign.campaignId} level ${level}: the Main Board is always needed`);
  assert.ok(completions > 0, `${campaign.campaignId} level ${level}: the bar can be filled`);
}

test('every authored restoration board needs its delivery on every path and fills its bar on every path after it', () => {
  for (const campaign of ISLAND_CAMPAIGNS) {
    for (const chapter of campaign.chapters) {
      if (!chapter.restoration) continue;
      // A board that reads its request off its own pieces has no fixed delivery to prove; it asks again whenever it is stuck.
      // Nor has a chapter played against the clock: it lays out no pieces and asks the Main Board for nothing (tests/time-trial.test.ts proves those).
      if (chapter.restoration.request || chapter.restoration.rush) continue;
      // Every answer's request carries the same items, so the proof below holds whichever the player chose.
      const items = (requirements: readonly { definitionId: string; quantity: number }[]) => requirements.flatMap((requirement) => Array.from({ length: requirement.quantity }, () => requirement.definitionId)).sort().join(',');
      const expected = items(chapter.fallbackOrder.requirements);
      for (const choice of chapter.choices) assert.equal(items(choice.order.requirements), expected, `${campaign.campaignId} level ${chapter.level} ${choice.id}: the delivery is the same whichever answer`);
      proveBoard(campaign, chapter.level);
    }
  }
  assert.equal(petalimp.chapters.every((chapter) => chapter.restoration), true, 'Petalimp plays every chapter on the board');
});

test('every request a board sends to the Main Board can be made there, and the engine’s chain repair leaves it exactly as authored', () => {
  // The world right before each friend: the friends home by then decide which generator branches are open
  // (the Garden Basket's waterside waits for Shellio, the Journey Locker's travel branch for a later friend).
  const fixtures = buildPlayerProfileFixtures(NOW);
  const worldBefore: Record<string, string> = { [petalimp.campaignId]: 'fixture:kingdom-before-petalimp', [FERNIP_WILDGROWTH_CAMPAIGN.campaignId]: 'fixture:kingdom-before-fernip', 'island-campaign:wanderling-trail': 'fixture:kingdom-before-petalimp', 'island-campaign:rush-track': 'fixture:kingdom-before-petalimp' };
  for (const campaign of ISLAND_CAMPAIGNS) {
  if (!campaign.chapters.some((chapter) => chapter.restoration)) continue;
  const fixtureId = worldBefore[campaign.campaignId];
  assert.ok(fixtureId, `${campaign.campaignId} plays on the board: name the fixture of the world right before it`);
  const world = fixtures.find((fixture) => fixture.id === fixtureId)!.domains.mergeWorld.state;
  const ownedChains = new Set(Object.keys(world.generators).flatMap((generatorId) => MERGE_GENERATORS_BY_ID.get(generatorId)?.chainIds ?? []));
  for (const chapter of campaign.chapters) {
    const orders = [chapter.fallbackOrder, ...chapter.choices.map((choice) => choice.order)];
    for (const order of orders) {
      for (const requirement of order.requirements) {
        const definition = MERGE_ITEMS_BY_ID.get(requirement.definitionId);
        assert.ok(definition, `${order.title}: ${requirement.definitionId} exists`);
        assert.notEqual(definition!.branchId, 'hybrid', `${order.title} asks for ${definition!.name}, a hybrid the Nursery makes weeks later`);
        assert.ok(ownedChains.has(definition!.chainId), `${order.title} asks for ${definition!.name}, whose basket the player does not own yet`);
        assert.ok(generatorChainOpen(world, definition!.chainId), `${order.title} asks for ${definition!.name} (${definition!.chainId}), a branch no friend has opened yet`);
        assert.ok(definition!.tier <= 6, `${order.title}: ${definition!.name} is within reach`);
      }
    }
    // The saved order is repaired onto open chains on every load; the board's misted cells are not. They must agree.
    for (const choice of chapter.choices) {
      const authored = islandCampaignChapterOrder(campaign, chapter.level, choice.id, NOW)!;
      assert.deepEqual(openOrderChains(world, authored).requirements, authored.requirements, `${campaign.campaignId} level ${chapter.level} ${choice.id}: the repair would change the request`);
    }
    // What the request brings must be wanted: each delivered item merges with a twin on the spent board or frees a misted cell.
    // A board that reads its request off its own pieces asks for exactly that.
    if (chapter.restoration!.request || chapter.restoration!.rush) continue;
    const wanted = new Set(chapter.restoration!.echoes.map((echo) => echo.definitionId));
    for (const requirement of chapter.fallbackOrder.requirements) {
      const definition = MERGE_ITEMS_BY_ID.get(requirement.definitionId)!;
      const twinFromBoard = chapter.restoration!.echoes.some((echo) => MERGE_ITEMS_BY_ID.get(echo.definitionId)?.nextItemId === requirement.definitionId);
      assert.ok(wanted.has(requirement.definitionId) || twinFromBoard, `${campaign.campaignId} level ${chapter.level}: the delivered ${definition.name} has nowhere to go on the board`);
    }
  }
  }
});

test('a saved board belongs to one start of one authoring: a restarted stage or a re-authored board begins fresh', () => {
  const chapter = petalimp.chapters[2]!;
  const definition = chapter.restoration!;
  const run = restorationRunId(petalimp.campaignId, 3, NOW, definition);
  assert.equal(run, restorationRunId(petalimp.campaignId, 3, NOW, { ...definition, items: [...definition.items] }), 'the same authoring, the same run');
  assert.notEqual(run, restorationRunId(petalimp.campaignId, 3, NOW + 1, definition), 'a new start is a new run');
  assert.notEqual(run, restorationRunId(petalimp.campaignId, 3, NOW, { ...definition, echoes: [{ id: 'petalimp-3-shell', cell: 38, definitionId: 'nature:waterside:2' }] }), 'a re-authored board is a new run');
  assert.notEqual(run, restorationRunId(petalimp.campaignId, 3, NOW, { ...definition, merges: definition.merges + 1 }), 'so is a new bar');
  // The store keeps a board only for its own run: the old play is not loaded, and a fresh board with zero merges is created.
  const store = readFileSync('features/onboarding/use-opening-mission-board.ts', 'utf8');
  assert.match(store, /if \(!stored \|\| stored\.runId !== runId\) return null;/);
});

test('a friend’s board carries no tutorial: free from the first move, locked only once the bar is full', () => {
  const definition = boardOf(1);
  let state = createRestorationState(definition, NOW);
  const first = restorationBoardStep(petalimp, 1, state, 0)!;
  assert.equal(first.id.endsWith('.free'), true);
  assert.equal(first.cue, undefined);
  assert.equal(first.spotlight, undefined);
  assert.equal(first.interaction?.mode, 'none');
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'move', from: 16, to: 18, now: NOW }), true);
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'move', from: 22, to: 26, now: NOW }), true, 'any move, from the start');
  state = play(state, [[16, 18], [22, 26], [18, 26], [26, 24]]).state;
  assert.equal(restorationCheckpointReached(definition, state, 4), true);
  assert.equal(restorationBoardStep(petalimp, 1, state, 4)!.id.endsWith('.free'), true, 'the checkpoint shows on the tray, not as a guide');
  assert.equal(restorationBoardStep(petalimp, 1, state, 5)!.interaction?.mode, 'blocked', 'the full bar locks the board while the last item flies');
  assert.equal(restorationBoardStep(petalimp, 1, null, 0), null);
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.doesNotMatch(screen, /cue=\{restorationStep\?\.cue/, 'no finger or spotlight overlay for a friend’s board');
});

test('the chapter record follows the board: paid at activation, the delivery on serve, the free upgrade only once the bar is full', () => {
  let state = greetIslandFriend(revealIsland({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 200 }, petalimp, NOW), petalimp, NOW + 1);
  const order = islandCampaignChapterOrder(petalimp, 1, petalimp.chapters[0]!.choices[0]!.id, NOW + 2)!;
  const activate = { type: 'activateIslandCampaignChapter' as const, campaignId: petalimp.campaignId, islandId: petalimp.islandId, residentSkinId: petalimp.residentSkinId, level: 1 as const, selectedOptionId: petalimp.chapters[0]!.choices[0]!.id, orders: [order], now: NOW + 2 };
  state = reduceMergeWorld(state, activate).state;
  const record = () => state.islandCampaigns![petalimp.campaignId]!.chapters['1']!;
  assert.deepEqual(record().restoration, { startedAt: NOW + 2, paidCoins: 0, progress: { current: 0, total: 5 }, deliveryRequestedAt: null, delivered: [], completedAt: null });
  assert.deepEqual(record().orderIds, [order.id], 'the request id is fixed by the answer at activation');
  assert.equal(state.activeOrders.some((candidate) => candidate.id === order.id), false, 'but it is not on the Main Board yet');
  assert.equal(reduceMergeWorld(state, { type: 'recordIslandRestorationProgress', campaignId: petalimp.campaignId, level: 1, current: 9, total: 5, now: NOW + 3 }).state.islandCampaigns![petalimp.campaignId]!.chapters['1']!.restoration!.progress.current, 5, 'progress is clamped');
  assert.equal(reduceMergeWorld(state, { type: 'completeIslandRestoration', campaignId: petalimp.campaignId, level: 1, now: NOW + 3 }).changed, false, 'not until the bar is full');
  assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: petalimp.islandId, level: 1, economyMode: 'free', receiptId: 'early', now: NOW + 3 }).changed, false, 'no upgrade before the board');
  // Whatever the caller passes, the engine publishes the chapter's own authored order for the saved answer.
  const stray = islandCampaignChapterOrder(petalimp, 1, petalimp.chapters[0]!.choices[2]!.id, NOW + 4)!;
  state = reduceMergeWorld(state, { type: 'requestIslandCampaignDelivery', campaignId: petalimp.campaignId, level: 1, orders: [stray], now: NOW + 4 }).state;
  assert.deepEqual(record().orderIds, [order.id]);
  assert.deepEqual(state.activeOrders.filter((candidate) => candidate.storyArcId === petalimp.campaignId).map((candidate) => [candidate.id, candidate.title]), [[order.id, order.title]], 'one order, the authored one');
  assert.equal(reduceMergeWorld(state, { type: 'requestIslandCampaignDelivery', campaignId: petalimp.campaignId, level: 1, orders: [stray], now: NOW + 5 }).changed, false, 'asked once, never re-derived');
  const relaunched = normalizeMergeWorldState(JSON.parse(JSON.stringify(state)), NOW + 6);
  assert.deepEqual(relaunched.activeOrders.filter((candidate) => candidate.storyArcId === petalimp.campaignId).map((candidate) => candidate.id), [order.id], 'and the same order after a relaunch');
  // The Merge page shows one request per companion; the island request is its own companion, never hidden behind Mossprout's own.
  const daily = { ...order, id: 'mossprout:daily:1', title: 'A garden morning', storyArcId: 'companion:daily-garden', storyTargetLevel: undefined, chapterId: undefined, recipientSkinId: 'mossprout' as const };
  const journey = { ...order, id: 'mossprout:journey:1', title: 'The day’s request', storyArcId: 'mossprout:dry-pond', storyTargetLevel: undefined, chapterId: undefined, recipientSkinId: 'mossprout' as const };
  const crowded = { ...relaunched, activeOrders: [journey, daily, ...relaunched.activeOrders] };
  const visible = prioritizedVisibleMergeOrders(crowded, { characterId: 'mossprout', journeyOrderIds: new Set([journey.id]) });
  assert.ok(visible.some((candidate) => candidate.id === order.id), 'Petalimp’s request stays on the rail beside Mossprout’s');
  assert.ok(visible.some((candidate) => candidate.id === journey.id));
  const board = [...state.board];
  let cursor = 0;
  for (const requirement of order.requirements) for (let count = 0; count < requirement.quantity; count += 1) {
    while (board[cursor]?.locked || board[cursor]?.occupant) cursor += 1;
    board[cursor] = { ...board[cursor]!, occupant: { kind: 'item', instanceId: `serve:${cursor}`, definitionId: requirement.definitionId } };
    cursor += 1;
  }
  state = reduceMergeWorld({ ...state, board }, { type: 'serveOrder', orderId: order.id, now: NOW + 5 }).state;
  assert.deepEqual(record().restoration!.delivered.map((entry) => entry.definitionId), ['nature:garden:4']);
  assert.deepEqual(record().servedOrderIds, [order.id]);
  state = reduceMergeWorld(state, { type: 'recordIslandRestorationProgress', campaignId: petalimp.campaignId, level: 1, current: 5, total: 5, now: NOW + 6 }).state;
  state = reduceMergeWorld(state, { type: 'completeIslandRestoration', campaignId: petalimp.campaignId, level: 1, now: NOW + 7 }).state;
  assert.equal(record().restoration!.completedAt, NOW + 7);
  const reloaded = normalizeMergeWorldState(JSON.parse(JSON.stringify(state)), NOW + 8);
  assert.deepEqual(reloaded.islandCampaigns![petalimp.campaignId]!.chapters['1']!.restoration, record().restoration, 'the record survives a relaunch');
  // The upgrade flow is authored per level with a normal economy; a paid board stage still grows for nothing.
  const grown = reduceMergeWorld({ ...state, coins: 0 }, { type: 'upgradeMossproutNatureIsland', islandId: petalimp.islandId, level: 1, receiptId: 'paid', now: NOW + 9 });
  assert.equal(grown.state.coins, 0, 'never charged at the upgrade');
  assert.equal(grown.storyWorldMutationReceipt?.coinCost, 0);
  assert.equal(grown.storyWorldMutationReceipt?.economyMode, 'free');
  assert.equal(grown.changed, true, grown.message);
  assert.equal(grown.state.haven.mossproutNatureIslands[petalimp.islandId], 1);
});

test('two friends mid-restoration: the board is the one the player is dealing with, never simply the first in campaign order', () => {
  // The wake order allows one restoration at a time, but a pack's island wakes on its own condition (the Wander
  // Trail on Steppling's hatch). Clearing its mist once docked Petalimp's unfinished board instead of its own.
  const restoration = (startedAt: number) => ({ startedAt, paidCoins: 0, progress: { current: 0, total: 5 }, deliveryRequestedAt: null, delivered: [], completedAt: null });
  const chapter = (level: number, startedAt: number) => ({ [String(level)]: { level, completedAt: null, orderIds: [], restoration: restoration(startedAt) } });
  const [first, second] = ISLAND_CAMPAIGNS.filter((campaign) => campaign.chapters.some((entry) => entry.level === 1 && entry.restoration));
  assert.ok(first && second, 'at least two friends restore on a board');
  const world = { ...createInitialMergeWorldState(NOW, ['mossprout']), islandCampaigns: {
    [first.campaignId]: { chapters: chapter(1, NOW) },
    [second.campaignId]: { chapters: chapter(1, NOW + 500) },
  } } as unknown as MergeWorldState;
  assert.equal(activeIslandRestoration(world)?.campaign.campaignId, second.campaignId, 'with no one in particular, the board started most recently');
  assert.equal(activeIslandRestoration(world, first.campaignId)?.campaign.campaignId, first.campaignId, 'the friend being dealt with wins');
  assert.equal(activeIslandRestoration(world, second.campaignId)?.campaign.campaignId, second.campaignId);
  // A named friend never resolves to another friend. It once fell back to the most recent board, which is how finishing
  // a section of Petalimp's board docked Wanderling's.
  assert.equal(activeIslandRestoration(world, 'no-such-campaign'), null, 'a friend with no board has no board: never someone else’s');
  const firstDone = JSON.parse(JSON.stringify(world)) as typeof world;
  for (const entry of Object.values(firstDone.islandCampaigns![first.campaignId]!.chapters)) if (entry.restoration) entry.restoration.completedAt = 1;
  assert.equal(activeIslandRestoration(firstDone, first.campaignId), null, 'their section finished: the player is done with boards, not moved to the other friend');
  assert.equal(activeIslandRestoration(firstDone, second.campaignId)?.campaign.campaignId, second.campaignId, 'the other friend’s board is still theirs when asked for by name');
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.match(screen, /const story = restorationFocusCampaignId\s*\? stories\.find\(\(candidate\) => candidate\.campaign\.campaignId === restorationFocusCampaignId\)\s*: stories\.length === 1 \? stories\[0\] : undefined;/, 'only the friend in focus continues on its own');
  assert.doesNotMatch(screen, /for \(const story of ordered\) if \(advance\(story\)\) return;/, 'never "the friend in focus, then everyone else"');
  assert.match(screen, /setRestorationFocusCampaignId\(campaign\.campaignId\);\s*setRestorationOpen\(true\);\s*requestResidentInteractionExit\(\);/, 'the answer that opens a board docks that board');
  assert.match(screen, /if \(offerCampaignId\) setRestorationFocusCampaignId\(offerCampaignId\);\s*if \(offerCampaignId && activeIslandRestoration\(mergeWorldRef\.current, offerCampaignId\)\) \{\s*setRestorationOpen\(true\);/, 'a friend’s marker makes them the friend in focus, and opens their own board if they have one');
});
