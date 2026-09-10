import assert from 'node:assert/strict';
import test from 'node:test';
import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { islandCampaignChapterOrder } from '@/constants/island-campaigns/helpers';
import { PETALIMP_BLOOM_CAMPAIGN } from '@/constants/island-campaigns/petalimp-bloom';
import type { IslandCampaignDefinition, RestorationBoardDefinition } from '@/constants/island-campaigns/types';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import {
  createRestorationState, deliveriesToPlace, restorationBoardStep, restorationCheckpointReached, restorationComplete,
  restorationDeliveryCells, restorationEchoes, restorationNextMove, restorationProgress, restorationWindowCells, restoreRestorationEchoes,
} from '@/features/island-restoration/island-restoration';
import { mergeFtueAllowsCommand } from '@/features/onboarding/merge-ftue';
import type { MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { greetIslandFriend, revealIsland } from './helpers/island-campaign';
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
      // Every answer's request carries the same items, so the proof below holds whichever the player chose.
      const items = (requirements: readonly { definitionId: string; quantity: number }[]) => requirements.flatMap((requirement) => Array.from({ length: requirement.quantity }, () => requirement.definitionId)).sort().join(',');
      const expected = items(chapter.fallbackOrder.requirements);
      for (const choice of chapter.choices) assert.equal(items(choice.order.requirements), expected, `${campaign.campaignId} level ${chapter.level} ${choice.id}: the delivery is the same whichever answer`);
      proveBoard(campaign, chapter.level);
    }
  }
  assert.equal(petalimp.chapters.every((chapter) => chapter.restoration), true, 'Petalimp plays every chapter on the board');
});

test('the board’s guidance: a spotlit first move with nothing else allowed, a finger on the second, then free; the checkpoint points at Merge', () => {
  const definition = boardOf(1);
  let state = createRestorationState(definition, NOW);
  const first = restorationBoardStep(petalimp, 1, state, 0)!;
  assert.equal(first.id.endsWith('.first'), true);
  assert.ok(first.spotlight && first.cue?.kind === 'drag');
  const pointed = restorationNextMove(state, restorationWindowCells(3))!;
  const other = [16, 18, 22, 26].filter((cell) => cell !== pointed.from && cell !== pointed.to);
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'move', from: pointed.from, to: pointed.to, now: NOW }), true);
  assert.equal(mergeFtueAllowsCommand(first, state, { type: 'move', from: other[0]!, to: other[1]!, now: NOW }), false, 'only the pointed-at move');
  state = play(state, [[16, 18]]).state;
  const second = restorationBoardStep(petalimp, 1, state, 1)!;
  assert.equal(second.id.endsWith('.second'), true);
  assert.equal(second.spotlight, undefined);
  assert.equal(second.cue?.kind, 'drag');
  assert.equal(mergeFtueAllowsCommand(second, state, { type: 'move', from: 26, to: 22, now: NOW }), true, 'any move now');
  state = play(state, [[22, 26], [18, 26]], NOW + 1).state;
  assert.equal(restorationBoardStep(petalimp, 1, state, 3)!.id.endsWith('.free'), true);
  const freed = play(state, [[26, 24]], NOW + 3).state;
  assert.equal(restorationCheckpointReached(definition, freed, 4), true);
  const checkpoint = restorationBoardStep(petalimp, 1, freed, 4)!;
  assert.equal(checkpoint.id.endsWith('.delivery'), true);
  assert.equal(checkpoint.cue, undefined);
  assert.equal(checkpoint.guide.eyebrow, 'Requested in Merge');
  const board = [...freed.board];
  board[17] = { ...board[17], occupant: { kind: 'item', instanceId: 'delivery', definitionId: 'nature:garden:4' } };
  const delivered = restorationBoardStep(petalimp, 1, { ...freed, board }, 4, { afterDelivery: true, selectedOptionId: petalimp.chapters[0]!.choices[0]!.id })!;
  assert.equal(delivered.guide.title, petalimp.chapters[0]!.choices[0]!.returnLine, 'the friend’s return line greets the delivery');
  assert.deepEqual(delivered.cue, { kind: 'drag', from: { kind: 'board_cell', cell: 17 }, to: { kind: 'board_cell', cell: 24 } });
  assert.equal(restorationBoardStep(petalimp, 1, freed, 5)!.interaction?.mode, 'blocked');
  assert.equal(restorationBoardStep(petalimp, 1, null, 0), null);
});

test('the chapter record follows the board: paid at activation, the delivery on serve, the free upgrade only once the bar is full', () => {
  let state = greetIslandFriend(revealIsland({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 200 }, petalimp, NOW), petalimp, NOW + 1);
  const order = islandCampaignChapterOrder(petalimp, 1, petalimp.chapters[0]!.choices[0]!.id, NOW + 2)!;
  const activate = { type: 'activateIslandCampaignChapter' as const, campaignId: petalimp.campaignId, islandId: petalimp.islandId, residentSkinId: petalimp.residentSkinId, level: 1 as const, selectedOptionId: petalimp.chapters[0]!.choices[0]!.id, orders: [order], now: NOW + 2 };
  state = reduceMergeWorld(state, activate).state;
  const record = () => state.islandCampaigns![petalimp.campaignId]!.chapters['1']!;
  assert.deepEqual(record().restoration, { startedAt: NOW + 2, paidCoins: 0, progress: { current: 0, total: 5 }, deliveryRequestedAt: null, delivered: [], completedAt: null });
  assert.deepEqual(record().orderIds, []);
  assert.equal(reduceMergeWorld(state, { type: 'recordIslandRestorationProgress', campaignId: petalimp.campaignId, level: 1, current: 9, total: 5, now: NOW + 3 }).state.islandCampaigns![petalimp.campaignId]!.chapters['1']!.restoration!.progress.current, 5, 'progress is clamped');
  assert.equal(reduceMergeWorld(state, { type: 'completeIslandRestoration', campaignId: petalimp.campaignId, level: 1, now: NOW + 3 }).changed, false, 'not until the bar is full');
  assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: petalimp.islandId, level: 1, economyMode: 'free', receiptId: 'early', now: NOW + 3 }).changed, false, 'no upgrade before the board');
  state = reduceMergeWorld(state, { type: 'requestIslandCampaignDelivery', campaignId: petalimp.campaignId, level: 1, orders: [order], now: NOW + 4 }).state;
  assert.deepEqual(record().orderIds, [order.id]);
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

test('the Kingdom docks the board under the island, sends the order at the checkpoint, lands deliveries, and grows the island on the last merge’s impact', () => {
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const dock = readFileSync('components/katchadeck/world/island-restoration-dock.tsx', 'utf8');
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  const marker = readFileSync('components/katchadeck/world/world-upgrade-marker.tsx', 'utf8');
  const panel = readFileSync('components/katchadeck/world/world-upgrade-panel.tsx', 'utf8');
  const store = readFileSync('features/onboarding/use-opening-mission-board.ts', 'utf8');
  const engine = readFileSync('utils/merge-world/engine.ts', 'utf8');
  const boardFile = readFileSync('components/katchadeck/games/feastle-persistent-merge-board.tsx', 'utf8');
  assert.match(screen, /const islandRestoration = useMemo\(\(\) => activeIslandRestoration\(mergeWorld\), \[mergeWorld\]\);/);
  assert.match(screen, /useMissionBoard\(islandRestoration \? restorationStorageKey\(islandRestoration\.campaign\.campaignId, islandRestoration\.level\) : 'katchimeras\.mist-mission\.none\.v1', restorationRunId, createRestorationBoard, repairRestorationBoard\)/, 'its own store per chapter, repaired on load');
  assert.match(screen, /target: \{ kind: 'haven_nature_island' as const, islandId: restorationIslandId \},\s*zoom: MISSION_CAMERA_ZOOM, anchorY: MISSION_CAMERA_ANCHOR_Y/, 'the board framing on the island');
  assert.match(screen, /const soloOfferId = stepplingBoardBusy \? 'mist:steppling-home' : null;/, 'no marker percentage while the board is up');
  // The request lives on the dock's tray: open on the Main Board it leads there; served, its items fly into the cells.
  assert.match(screen, /requestIslandRestorationOpen\(islandRestoration\.campaign\.campaignId\);\s*openGarden\(restorationOrder\.id, 'mossprout'\);/, 'the tray opens the Merge page and Back returns to the board');
  assert.match(screen, /if \(!islandRestoration \|\| !restorationDefinition \|\| !restorationStore\.state \|\| restorationBoardVisible\) return;/, 'quiet placement only while the board is put away');
  assert.match(screen, /order=\{restorationOrder\} orderServed=\{restorationOrderServed\} pendingDeliveries=\{restorationPendingDeliveries\} onOpenOrder=\{openRestorationOrder\} onPlaceDelivery=\{placeRestorationDelivery\}/);
  assert.match(dock, /<MergeParcelFlightOverlay flight=\{flight\} opening=\{false\} onFinish=\{finishFlight\} onItemArrive=\{handleItemArrive\} \/>/, 'the delivery flies like a parcel, without the crate');
  assert.match(dock, /const entry = flightRef\.current\?\.entries\.get\(instanceId\);\s*if \(entry\) onPlaceDelivery\(entry\);/, 'each item lands on the board as its copy arrives');
  assert.match(dock, /destinationSize: metrics\.geometry\.cellSize - 4, to: \{ x: metrics\.x - rootX \+ center\.x, y: metrics\.y - rootY \+ center\.y \}/, 'position and scale interpolate to the exact cell');
  const parcel = readFileSync('components/katchadeck/games/merge-parcel-overlay.tsx', 'utf8');
  assert.match(parcel, /\{opening \? <ParcelOpening from=\{flight\.from\} rootMatch=\{Boolean\(flight\.rootMatch\)\} \/> : null\}/);
  assert.match(screen, /: null, \[restorationIslandId, restorationOpen, screenFocused\]\);/, 'the camera directive only changes with the island and whether the board is open, never per merge');
  assert.match(screen, /if \(!restorationCheckpointReached\(restorationDefinition, restorationStore\.state, restorationStore\.merges\)\) return;[\s\S]*?requestStoredIslandCampaignDelivery\(islandRestoration\.campaign\.campaignId, islandRestoration\.level, \[order\]\)/, 'the checkpoint publishes the chapter’s order');
  assert.match(screen, /const pending = deliveriesToPlace\(islandRestoration\.progress, restorationStore\.placedDeliveries\);[\s\S]*?restorationPlace\(entries\)/, 'deliveries land on the board');
  assert.match(screen, /if \(restorationDone && restorationFinaleIdRef\.current != null && openingGlow\.finaleLandedId === restorationFinaleIdRef\.current\) finishIslandRestoration\(\);/, 'the last merge’s impact finishes the board');
  assert.match(screen, /if \(restorationDefinition && restorationComplete\(restorationDefinition, restorationStore\.merges\)\) finishIslandRestoration\(\);/, 'a board saved full finishes on arrival');
  assert.match(screen, /if \(status === 'restoration_ready' && chapter\.restoration\) \{[\s\S]*?const key = `restore-board:\$\{campaign\.campaignId\}:\$\{status\}`;[\s\S]*?purchaseWorldUpgrade\(offer, \{ beforeValidation: flushMergeWorld \}\)/, 'the finished board grows the island for free');
  assert.match(screen, /if \(chapter\.restoration\) \{[\s\S]*?requestResidentInteractionExit\(\);\s*return;\s*\}\s*if \(!campaignProgress\?\.orderIds\[0\]\)/, 'the answer opens the board, not the Garden');
  assert.match(screen, /if \(progress\.action === 'continue_restoring'\) \{[\s\S]*?setSelectedUpgrade\(null\);/);
  assert.match(screen, /<IslandRestorationDock[\s\S]*?merges=\{restorationStore\.merges\} mergesRef=\{restorationStore\.mergesRef\}[\s\S]*?onFinale=\{launchRestorationFinale\}/);
  assert.match(screen, /\|\| restorationBoardVisible\}/, 'the camera holds while the board is up');
  // The board is optional: opened on purpose, put away freely, never forced.
  assert.match(screen, /const restorationBoardVisible = Boolean\(islandRestoration && restorationStore\.state\) && restorationOpen && screenFocused/, 'the board shows only when opened');
  assert.match(screen, /restorationIslandId && restorationOpen && screenFocused \? \{/, 'the camera only frames the island while the board is open');
  assert.match(screen, /if \(progress\.action === 'continue_restoring'\) \{[\s\S]*?setRestorationOpen\(true\);/, 'the marker reopens it');
  assert.match(screen, /setRestorationOpen\(true\);\s*requestResidentInteractionExit\(\);/, 'the answer opens it');
  assert.match(screen, /if \(!restorationBoardVisible\) return;\s*const subscription = BackHandler\.addEventListener\('hardwareBackPress', \(\) => \{ closeRestoration\(\); return true; \}\);/, 'hardware Back puts it away');
  assert.match(screen, /restorationBoardVisible \? closeRestoration : interactionCreatureId \? requestResidentInteractionExit : onBackToHavenSelector/, 'the HUD Back puts it away instead of leaving the Kingdom');
  assert.match(dock, /onClose=\{onClose\} closeLabel="Later"/, 'and the dock has its own Later button');
  // The Merge page's "Meet me at …" note lands on the board, and the marker opens it mid-stage.
  const mergeScreen = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');
  assert.match(mergeScreen, /requestIslandRestorationOpen\(campaign\.campaignId\);\s*transitionTo\(\{/, 'the return note leaves the intent before it navigates');
  assert.match(screen, /if \(screenFocused && restorationCampaignId && consumeIslandRestorationOpen\(restorationCampaignId\)\) setRestorationOpen\(true\);/, 'the Kingdom opens the board on arrival');
  assert.match(screen, /if \(restorationCampaignId && islandCampaignForOffer\(offer\.id\)\?\.campaignId === restorationCampaignId\) \{\s*setRestorationOpen\(true\);\s*return;\s*\}/, 'the marker is the board while a stage is open');
  assert.match(dock, /if \(\(mergesRef\.current \?\? 0\) >= required\) \{[\s\S]*?setHiddenItemIds[\s\S]*?onFinale\?\.\(from, made\);\s*\} else \{\s*onMerge\?\.\(from, made\);/, 'every merge sends the thing it made into the tile; the last one leaves the board');
  assert.match(dock, /barTitle=\{`Restore \$\{islandName\}`\}/, 'the bar names the island, not the mist');
  assert.match(screen, /<IslandRestorationDock[\s\S]*?onMerge=\{openingGlow\.launchItem\}/, 'items, not Glow, fly into an island being restored');
  const glowDock = readFileSync('components/katchadeck/world/kingdom-opening-merge-dock.tsx', 'utf8');
  assert.match(glowDock, /const launchItem = useCallback\(\(from: RewardFlightPoint, definitionId: string\) => \{[\s\S]*?\{ id, index: 0, count: 1, from, to, art, size: 44 \}/, 'one item flight per merge');
  assert.match(canvas, /if \(target\.kind === 'haven_nature_island'\) \{[\s\S]*?`nature:mossprout:\$\{target\.islandId\}`[\s\S]*?focusTutorialResident\(/, 'the island is a camera target');
  assert.match(canvas, /ref=\{natureIslandTargetRefs\.get\(islandId\)\}/, 'and a flight target');
  assert.match(canvas, /const natureIslandTargetRefs = useMemo\(\(\) => \{[\s\S]*?\}, \[onNatureIslandTargetChange\]\);/, 'one stable ref per island: an inline arrow ref re-fires on every render and loops the Kingdom');
  assert.doesNotMatch(canvas, /ref=\{onNatureIslandTargetChange \?/);
  assert.match(marker, /offer\.restorationProgress \? offer\.restorationProgress\.current/, 'the marker’s bar is the board while it is open');
  assert.match(panel, /disabled=\{busy \|\| closing \|\| Boolean\(campaignState\.actionCost && world\.coins < campaignState\.actionCost\)\}/, 'the stage waits for its Glow');
  assert.match(store, /const place = useCallback\(\(entries: readonly \{ cell: number; definitionId: string \}\[\]\) => \{[\s\S]*?saveMission\(storageKey, activeRunId, next, mergesRef\.current, placed\);/, 'placed deliveries are saved with the board');
  assert.doesNotMatch(engine, /'rooted'/, 'no bed mechanic remains in the engine');
  assert.doesNotMatch(boardFile, /rooted|bedRing/, 'nor in the board renderer');
});
