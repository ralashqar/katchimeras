import assert from 'node:assert/strict';
import test from 'node:test';

import { applyStrike, createMechanicState, mechanicComplete, mechanicProgress, resolveMechanic, syncMechanicState, wispViews } from '@/features/mission-mechanics/mechanic';
import { WISP_RUSH_PERCHES } from '@/features/mission-mechanics/wisp-rush';
import { OPENING_MERGE_WINDOW_CELLS } from '@/features/onboarding/opening-mist';
import { availableMerges, mergeHeat, startHeat, strikeDamage, tickHeat, HEAT_PERCH_REST_MS, type HeatPiece, type HeatRules, type HeatSpec, type HeatState } from '@/features/time-trial/heat';
import { commandRushBoard, startRushBoard, tickRushBoard } from '@/features/time-trial/heat-board';
import { createRushLive, heatHost, heatMissionStrike } from '@/features/time-trial/heat-mechanic';
import { HEATS_PER_DAY, RUSH_LADDER, heatFor, heatFromRules, heatPars, maxPlausibleScore, medalFor, playHeatWithBot } from '@/features/time-trial/ladder';
import { claimDayChest, dayChestFor, heatGlow, nextHeatIndex, normalizeTimeTrials, recordTimeTrialHeat, timeTrialFor } from '@/features/time-trial/trial-world';
import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import type { MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState, normalizeMergeWorldState } from '@/utils/merge-world/engine';

const RULES: HeatRules = { chains: ['a', 'b'], durationMs: 30_000, up: 2, wispEveryMs: 4_000, hp: 2, hpRampEvery: 100, thickChance: 0, startFill: 10, fill: 18, dealEveryMs: 1_500, dealDelayMs: 450, tierTwoChance: 0.3 };
const spec = (patch: Partial<HeatRules> = {}, id = 'test'): HeatSpec => heatFromRules(id, { ...RULES, ...patch });
const board = (state: HeatState, pieces: (HeatPiece | null)[]): HeatState => ({ ...state, slots: [...pieces, ...Array.from({ length: 20 - pieces.length }, () => null)] });
const p = (chainId: string, tier: number): HeatPiece => ({ chainId, tier });

test('a heat starts with a part-filled board and wisps already over the tile; pieces and wisps keep arriving; the clock ends it', () => {
  const start = startHeat(spec());
  assert.equal(start.slots.filter(Boolean).length, 10);
  assert.ok(availableMerges(start) >= 1, 'something to merge from the first second');
  assert.deepEqual(start.wisps.map((wisp) => [wisp.id, wisp.perch, wisp.bornAt]), [['w0', 0, 0], ['w1', 1, 0]]);
  assert.equal(tickHeat(start, 500).state, start, 'nothing due, nothing changes');

  // Left alone: a piece arrives every so often, up to the dealer's cap and never past it.
  const later = tickHeat(start, 1_500);
  assert.deepEqual(later.events.map((event) => event.type), ['dealt']);
  const full = tickHeat(start, 29_000).state;
  assert.equal(full.slots.filter(Boolean).length, 18, 'the board fills on its own, to the cap');
  assert.equal(full.wisps.length, 2, 'with every perch taken no more appear');

  const end = tickHeat(start, 45_000).state;
  assert.equal(end.finishedMs, 30_000, 'the clock runs out at its time, whenever that is noticed');
  assert.equal(mergeHeat(end, 0, 1, 45_100).reason, 'finished');
});

test('a merge shoots the wisp nearest its column, harder for higher pieces and on a combo; a fallen wisp scores and its perch rests', () => {
  assert.deepEqual([strikeDamage(2, 1), strikeDamage(3, 1), strikeDamage(4, 2), strikeDamage(2, 3)], [1, 2, 3, 2]);
  const left = (WISP_RUSH_PERCHES[0] as { fx: number }).fx;
  const right = (WISP_RUSH_PERCHES[1] as { fx: number }).fx;
  assert.ok(left < 0.5 && right > 0.5, 'two perches, one each side of the tile');

  let state = board(startHeat(spec()), [p('a', 1), p('a', 1), null, p('b', 1), p('b', 1), p('a', 2), p('a', 2)]);
  // Slots 3 and 4 are on the right of the board: made in column 4, the merge goes at the right-hand wisp.
  let merged = mergeHeat(state, 3, 4, 1_000);
  assert.deepEqual(merged.strike, { wispId: 'w1', wisp: 1, damage: 1, fell: false, wasted: false });
  // Made in column 0, it goes left.
  merged = mergeHeat(merged.state, 1, 0, 3_000);
  assert.deepEqual(merged.strike, { wispId: 'w0', wisp: 0, damage: 1, fell: false, wasted: false });
  assert.equal(merged.state.combo, 1, 'two seconds apart is not a combo');
  // A tier three made in column 0 (slot 5) finishes the left wisp.
  merged = mergeHeat(merged.state, 6, 5, 3_500);
  assert.deepEqual([merged.strike?.wispId, merged.strike?.damage, merged.strike?.fell], ['w0', 2, true]);
  state = merged.state;
  assert.equal(state.cleared, 1);
  assert.deepEqual(state.wisps.map((wisp) => wisp.id), ['w1']);
  assert.deepEqual(state.roster.map((wisp) => wisp.id), ['w0', 'w1'], 'the roster keeps every wisp that appeared');

  // Its perch rests while the last flight lands and the fall plays; then the next wisp takes it.
  assert.equal(tickHeat(state, 4_000).state.wisps.length, 1, 'the wisp clock ticks, but the perch is resting');
  const next = tickHeat(state, 3_500 + HEAT_PERCH_REST_MS + 4_000).state;
  assert.deepEqual(next.wisps.map((wisp) => [wisp.id, wisp.perch]), [['w1', 1], ['w2', 0]]);
  assert.ok(next.roster[2]!.bornAt > 0);
});

test('the tile is never left empty for long, wisps toughen as they come, and the first is always a plain one', () => {
  let state = startHeat(spec({ up: 1, hp: 1, hpRampEvery: 2, thickChance: 1, wispEveryMs: 60_000 }));
  assert.deepEqual(state.wisps.map((wisp) => wisp.hp), [1], 'plain, whatever the chance of a Thick one');
  state = board(state, [p('a', 1), p('a', 1), p('b', 1), p('b', 1)]);
  state = mergeHeat(state, 0, 1, 1_000).state;
  assert.equal(state.wisps.length, 0);
  state = tickHeat(state, 1_000 + HEAT_PERCH_REST_MS).state;
  assert.deepEqual(state.wisps.map((wisp) => [wisp.id, wisp.hp]), [['w1', 2]], 'a new one as soon as the perch has rested, not on the slow wisp clock; Thick is half as much again');
  state = tickHeat(mergeHeat(mergeHeat(board(state, [p('a', 2), p('a', 2), p('b', 2), p('b', 2)]), 0, 1, 3_000).state, 2, 3, 3_200).state, 3_200 + HEAT_PERCH_REST_MS).state;
  assert.deepEqual(state.wisps.map((wisp) => [wisp.id, wisp.hp]), [['w2', 3]], 'one more hit point every second wisp, then Thick on top');
});

test('the dealer never leaves the board stuck: through a whole heat a steady hand always has a merge to make', () => {
  for (let seed = 0; seed < 12; seed++) {
    const played = playHeatWithBot(spec({ chains: ['a', 'b', 'c'], tierTwoChance: 0.2 }, `stuck-${seed}`));
    assert.equal(played.idleTaps, 0, `seed ${seed}: never a tap with nothing to merge`);
    assert.ok(played.score > 0);
    assert.deepEqual(playHeatWithBot(spec({ chains: ['a', 'b', 'c'], tierTwoChance: 0.2 }, `stuck-${seed}`)).score, played.score, 'a heat replays exactly');
  }
});

test('thirty days of ladders: every heat keeps a steady hand busy, a faster hand scores more, medals are ordered, and the ladder climbs', () => {
  const start = Date.UTC(2026, 8, 21);
  let first = 0;
  let last = 0;
  for (let day = 0; day < 30; day++) {
    const dayId = new Date(start + day * 86_400_000).toISOString().slice(0, 10);
    for (let index = 0; index < HEATS_PER_DAY; index++) {
      const heat = heatFor(dayId, index);
      const steady = playHeatWithBot(heat);
      const pars = heatPars(heat);
      assert.equal(steady.idleTaps, 0, `${heat.id}: always something to merge`);
      assert.ok(pars.bronze >= 1 && pars.bronze < pars.silver && pars.silver < pars.gold, `${heat.id}: medals are ordered`);
      assert.ok(playHeatWithBot(heat, 800).score >= pars.gold, `${heat.id}: Gold is there for a fast hand`);
      assert.ok(pars.gold <= maxPlausibleScore(heat));
      if (index === 0) first += steady.score;
      if (index === HEATS_PER_DAY - 1) last += steady.score;
    }
  }
  assert.ok(last < first * 0.7, `the same hand clears far fewer wisps at the top of the ladder (${first} against ${last})`);
  const pars = heatPars(heatFor('2026-09-21', 0));
  assert.deepEqual([medalFor(pars.gold, pars), medalFor(pars.gold - 1, pars), medalFor(pars.bronze, pars), medalFor(pars.bronze - 1, pars)], ['gold', 'silver', 'bronze', null]);
  assert.equal(RUSH_LADDER.length, HEATS_PER_DAY);
  assert.deepEqual(heatFor('2026-09-21', 4), heatFor('2026-09-21', 4), 'a date and a heat number are all a heat needs');
  const total = RUSH_LADDER.reduce((sum, rung) => sum + rung.durationMs, 0) / 60_000;
  assert.ok(total >= 8 && total <= 10, `a day's ladder is about nine minutes of clock (${total})`);
});

const NOW = Date.UTC(2026, 8, 21, 9);
const DAY = '2026-09-21';
const record = (world: MergeWorldState, index: number, score: number, dayId = DAY, today = dayId) => recordTimeTrialHeat(world, { dayId, index, score }, today, NOW);

test('a heat is cleared at Bronze and paid once a day; a better score only improves things; nothing implausible or out of order is kept', () => {
  const fresh = { ...createInitialMergeWorldState(NOW), coins: 0 };
  const pars = heatPars(heatFor(DAY, 0));
  assert.throws(() => record(fresh, 1, 5), /Clear the heat before it first/);
  assert.throws(() => record(fresh, 0, 5_000), /could not be recorded/, 'no hand is that fast');
  assert.throws(() => record(fresh, 0, 5, '2026-09-20', DAY), /ladder has closed/);
  assert.throws(() => record(fresh, 10, 5), /Unknown heat/);

  const short = record(fresh, 0, pars.bronze - 2);
  assert.equal(short.state, fresh, 'a run that falls short changes nothing');
  assert.deepEqual([short.outcome.cleared, short.outcome.short], [false, 2]);
  assert.equal(nextHeatIndex(timeTrialFor(short.state).days[DAY]), 0);

  const first = record(fresh, 0, pars.bronze);
  assert.deepEqual(first.outcome, { cleared: true, short: 0, firstClear: true, glow: heatGlow(0), medal: 'bronze', improvedBy: null, newRecord: true, dayComplete: false });
  assert.equal(first.state.coins, heatGlow(0));
  assert.equal(nextHeatIndex(timeTrialFor(first.state).days[DAY]), 1);

  const better = record(first.state, 0, pars.gold);
  assert.deepEqual(better.outcome, { cleared: true, short: 0, firstClear: false, glow: 0, medal: 'gold', improvedBy: pars.gold - pars.bronze, newRecord: true, dayComplete: false });
  assert.equal(better.state.coins, heatGlow(0), 'a rematch pays no Glow');
  const worse = record(better.state, 0, pars.silver);
  const kept = timeTrialFor(worse.state).days[DAY]!.heats[0]!;
  assert.deepEqual([kept.best, kept.medal, kept.attempts], [pars.gold, 'gold', 3], 'a lower score changes nothing but the count');
  assert.equal(timeTrialFor(worse.state).records.golds, 1);
  assert.equal(timeTrialFor(worse.state).records.bestHeat[0], pars.gold);
  assert.deepEqual(normalizeMergeWorldState(JSON.parse(JSON.stringify(worse.state)), NOW).timeTrials, worse.state.timeTrials, 'results survive a save');
  assert.equal(normalizeTimeTrials({ 'wisp-rush': { days: { nonsense: {}, [DAY]: { heats: { 44: { best: 5 }, 0: { best: -1 } }, chestClaimedAt: null } } } })!['wisp-rush']!.days[DAY]!.heats[0], undefined);
});

test('ten clears finish the day: records, a streak, and one chest that is better with five Golds', () => {
  const play = (world: MergeWorldState, dayId: string, gold: number) => {
    let state = world;
    for (let index = 0; index < HEATS_PER_DAY; index++) {
      const pars = heatPars(heatFor(dayId, index));
      state = recordTimeTrialHeat(state, { dayId, index, score: index < gold ? pars.gold : pars.silver }, dayId, NOW).state;
    }
    return state;
  };
  const start = { ...createInitialMergeWorldState(NOW), coins: 0 };
  assert.equal(dayChestFor(start, DAY), null);
  const dayOne = play(start, DAY, 4);
  assert.equal(dayOne.coins, Array.from({ length: HEATS_PER_DAY }, (_, index) => heatGlow(index)).reduce((sum, glow) => sum + glow, 0));
  assert.deepEqual(dayChestFor(dayOne, DAY), { receiptId: `friend:steppling:rush:${DAY}`, familyId: 'steppling', kind: 'gift' });
  const records = timeTrialFor(dayOne).records;
  assert.deepEqual([records.daysCompleted, records.streak, records.lastCompletedDayId, records.golds], [1, 1, DAY, 4]);
  assert.equal(records.bestDay, Object.values(timeTrialFor(dayOne).days[DAY]!.heats).reduce((sum, heat) => sum + heat.best, 0), 'the day\'s total is every heat\'s best');

  const claimed = claimDayChest(dayOne, DAY, NOW + 1);
  assert.equal(dayChestFor(claimed, DAY), null, 'one chest a day');
  assert.equal(claimDayChest(claimed, DAY, NOW + 2), claimed);

  const dayTwo = play(claimed, '2026-09-22', 6);
  assert.equal(dayChestFor(dayTwo, '2026-09-22')?.kind, 'gift-rare', 'five or more Golds make it the better pack');
  assert.deepEqual([timeTrialFor(dayTwo).records.streak, timeTrialFor(dayTwo).records.daysCompleted], [2, 2]);
  assert.equal(timeTrialFor(play(dayTwo, '2026-09-25', 0)).records.streak, 1, 'a missed day starts the streak again');
  const again = recordTimeTrialHeat(dayTwo, { dayId: '2026-09-22', index: 3, score: heatPars(heatFor('2026-09-22', 3)).gold }, '2026-09-22', NOW).state;
  assert.equal(timeTrialFor(again).records.daysCompleted, 2, 'a rematch on a finished day never completes it twice');
  let long = start;
  for (let day = 1; day <= 9; day++) long = play(long, `2026-10-0${day}`, 0);
  assert.equal(Object.keys(timeTrialFor(long).days).length, 7, 'old days fall out of the save');
  assert.equal(timeTrialFor(long).records.daysCompleted, 9, 'the records stay');
});

test('a heat on the real mini board: the Merge engine moves the pieces, the heat rules do the rest, and the two never drift', () => {
  const heat = heatFor(DAY, 0);
  let rush = startRushBoard(heat, NOW);
  const cells = OPENING_MERGE_WINDOW_CELLS;
  assert.equal(cells.filter((cell) => rush.world.board[cell]!.occupant?.kind === 'item').length, 10);
  assert.deepEqual(rush.world.activeOrders, [], 'no orders');
  assert.deepEqual(rush.world.generators, {}, 'no item maker');
  assert.equal(rush.world.board.filter((cell, index) => !cells.includes(index) && !cell.locked).length, 0, 'nothing outside the window is in play');
  const inStep = () => assert.deepEqual(
    cells.map((cell) => (rush.world.board[cell]!.occupant as { definitionId?: string } | null)?.definitionId ?? null),
    rush.heat.slots.map((piece) => piece ? `${piece.chainId}:${piece.tier}` : null), 'board and rules agree on every cell');
  inStep();

  let at = 0;
  let strikes = 0;
  let arrivals = 0;
  while (rush.heat.finishedMs == null && at < 120_000) {
    at += 1_000;
    const ticked = tickRushBoard(rush, at);
    arrivals += ticked.events.filter((event) => event.type === 'dealt').length;
    rush = ticked.board;
    inStep();
    if (rush.heat.finishedMs != null) break;
    let pair: [number, number] | null = null;
    for (let a = 0; a < cells.length && !pair; a++) for (let b = a + 1; b < cells.length && !pair; b++) {
      const [x, y] = [rush.world.board[cells[a]!]!.occupant, rush.world.board[cells[b]!]!.occupant];
      if (x?.kind === 'item' && y?.kind === 'item' && x.definitionId === y.definitionId && !x.definitionId.endsWith(':6')) pair = [cells[a]!, cells[b]!];
    }
    if (!pair) continue;
    const moved = commandRushBoard(rush, { type: 'move', from: pair[0], to: pair[1], now: NOW + at }, at);
    assert.equal(moved.result.changed, true);
    assert.ok(moved.result.mergedCell != null, 'the real engine made the merge');
    if (moved.strike && !moved.strike.wasted) strikes += 1;
    rush = moved.board;
    inStep();
  }
  assert.equal(rush.heat.finishedMs, heat.durationMs, 'the clock ends the heat on the real board');
  assert.ok(strikes > 10 && arrivals > 10 && rush.heat.cleared > 0);
  assert.equal(commandRushBoard(rush, { type: 'move', from: cells[0]!, to: cells[1]!, now: NOW + at }, at + 10).result.changed, false, 'a finished heat takes no more moves');
});

test('the heat through the one door every docked board uses: real wisps over the tile that keep appearing, struck as each flight lands', () => {
  const heat = spec();
  const host = heatHost(heat, 5);
  const mechanic = resolveMechanic(host);
  assert.equal(mechanic.kind, 'wisp-rush');
  let shown = createMechanicState(mechanic);
  assert.deepEqual(wispViews(mechanic, host, shown), [], 'nothing over the tile until the heat says so');

  // The dock publishes the heat; the layer's copy takes each new wisp and keeps its own damage.
  const live = createRushLive();
  let heard = 0;
  const stop = live.subscribe(() => { heard += 1; });
  let state = board(startHeat(heat), [p('a', 2), p('a', 2), p('b', 1), p('b', 1)]);
  live.publish(state);
  live.publish(state);
  assert.equal(heard, 1, 'only a new wisp is news');
  shown = syncMechanicState(mechanic, shown, live.get());
  assert.equal(syncMechanicState(mechanic, shown, live.get()), shown, 'the same object back when nothing is new');
  let views = wispViews(mechanic, host, shown);
  assert.deepEqual(views.map((view) => [view.id, view.alive, view.placement]), [['w0', true, WISP_RUSH_PERCHES[0]], ['w1', true, WISP_RUSH_PERCHES[1]]]);
  assert.ok(views.every((view) => view.placement.kind === 'tile'), 'they hang over the tile, like every other board\'s');

  const merged = mergeHeat(state, 1, 0, 1_000);
  const strike = heatMissionStrike(merged.strike!, 16, 'a:3');
  assert.deepEqual(strike, { fromCell: 16, resultDefinitionId: 'a:3', hits: [{ wisp: 0, damage: 2 }], target: 0, finale: false, wasted: false });
  state = merged.state;
  assert.equal(state.cleared, 1, 'the rules have it down at once');
  assert.equal(wispViews(mechanic, host, shown)[0]!.alive, true, 'the player still sees it standing while the Glow is in the air');
  shown = applyStrike(mechanic, shown, strike);
  assert.equal(wispViews(mechanic, host, shown)[0]!.alive, false, 'and sees it fall when the Glow lands');
  assert.deepEqual(mechanicProgress(mechanic, host, shown), { current: 1, total: 5 });
  assert.equal(mechanicComplete(mechanic, host, shown), false, 'only the clock ends a rush');

  // The next wisp appears on the rested perch and reaches the layer as a new view, arriving at once; the fallen one keeps its number.
  state = tickHeat(state, 1_000 + HEAT_PERCH_REST_MS + 4_000).state;
  live.publish(state);
  shown = syncMechanicState(mechanic, shown, live.get());
  views = wispViews(mechanic, host, shown);
  assert.deepEqual(views.map((view) => [view.id, view.alive]), [['w0', false], ['w1', true], ['w2', true]]);
  assert.deepEqual([views[2]!.placement, views[2]!.enterDelayMs], [WISP_RUSH_PERCHES[0], 0]);
  assert.equal(heatMissionStrike({ wispId: null, wisp: -1, damage: 0, fell: false, wasted: true }, 16, 'a:2').target, null);
  stop();
});

test('Dashkit\'s story is played against the clock: every chapter is a rush, with a goal a steady hand makes and nothing asked of the Main Board', () => {
  const campaign = ISLAND_CAMPAIGNS.find((candidate) => candidate.campaignId === 'island-campaign:rush-track')!;
  assert.ok(campaign);
  let previous = 0;
  for (const chapter of campaign.chapters) {
    const restoration = chapter.restoration!;
    assert.ok(restoration.rush, `chapter ${chapter.level} is a rush`);
    const { goal, ...rules } = restoration.rush!;
    assert.equal(restoration.merges, goal, 'the bar is the goal');
    assert.deepEqual([restoration.items.length, restoration.echoes.length, restoration.deliveryCells.length, restoration.request, restoration.mechanic], [0, 0, 0, undefined, undefined], 'no puzzle board, no delivery');
    assert.ok(goal > previous, 'each chapter asks for more');
    previous = goal;
    for (let attempt = 0; attempt < 6; attempt++) {
      const played = playHeatWithBot(heatFromRules(`${campaign.campaignId}:${chapter.level}:${attempt}`, rules));
      assert.equal(played.idleTaps, 0);
      assert.ok(played.score >= Math.ceil(goal * 1.3), `chapter ${chapter.level}, attempt ${attempt}: a steady hand makes ${goal} with room to spare (${played.score})`);
    }
  }
});
