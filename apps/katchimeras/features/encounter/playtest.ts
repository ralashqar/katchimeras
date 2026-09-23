import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { createMechanicState, resolveMechanic, wispViews } from '@/features/mission-mechanics/mechanic';
import type { EncounterDefinition, EncounterLoadout } from '@/types/encounter';
import type { MergeItemDefinition, MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import type { MissionMechanicState } from '@/types/mission-mechanic';
import { reduceMergeWorld, reduceMissionMove } from '@/utils/merge-world/engine';
import { encounterMechanicHost } from './adapt';
import { canOpenCache, openCache } from './cache';
import { createEncounterState, encounterWindow } from './create-state';
import { createEncounterRun, encounterStatus, lossReason, type EncounterLossReason, type EncounterRunState } from './encounter-run';
import { encounterMistLeft } from './mist';
import { windowArea, windowDistance } from './pulse';
import { settleAction, tapSeed } from './settle';

/**
 * Two players who check that a territory battle is fair
 * (`docs/encounter-territory.md`): a careful one who reads the wisps'
 * intents, chooses where each merge lands (sliding a piece beside a nest
 * first), keeps the Mist's hold low and room on the board, and taps the Seed
 * Pod only to build options; and a careless one who knows only the first rule
 * (merge next to a wisp to strike it): it takes any merge that strikes, else
 * the first pair where it sits, and taps the Pod whenever it can. A level is
 * fair when the careful player wins on nearly every seed. They play through
 * the same settling the store uses. Pure.
 */
export type PlaytestStyle = 'careful' | 'careless';
export type PlaytestResult = { won: boolean; mist: number; peak: number; overrun: number; turns: number; taps: number; reason: EncounterLossReason | null };

type Node = { state: MergeWorldState; run: EncounterRunState; mechanicState: MissionMechanicState };
const NOW = Date.UTC(2026, 0, 1);

/** One step of a played level, for reading a game back (tuning, explaining a level). A slide before a merge is its own step. */
export type PlaytestStep = { kind: 'tap' | 'merge' | 'move' | 'cache'; command?: MergeWorldCommand; before: Node; after: Node };

type Option = { commands: MergeWorldCommand[]; steps: Node[]; next: Node; resultTier: number };

export function playtest(encounter: EncounterDefinition, input: { style: PlaytestStyle; attempt?: number; loadout?: EncounterLoadout | null; maxSteps?: number; items?: ReadonlyMap<string, MergeItemDefinition>; onStep?: (step: PlaytestStep) => void }): PlaytestResult {
  const items = input.items ?? MERGE_ITEMS_BY_ID;
  const host = encounterMechanicHost(encounter);
  const mechanic = resolveMechanic(host);
  const window = encounterWindow(encounter);
  const binding = { encounter, host, window, items };
  let node: Node = {
    state: createEncounterState(encounter, 'mossprout', NOW),
    run: createEncounterRun(encounter, { loadout: input.loadout ?? null, attempt: input.attempt ?? 1 }),
    mechanicState: createMechanicState(mechanic),
  };
  let taps = 0;
  const isFree = (state: MergeWorldState, index: number) => { const cell = state.board[index]; return Boolean(cell) && !cell.locked && !cell.mist && !cell.occupant; };
  const free = (state: MergeWorldState) => window.cellIndices.filter((index) => isFree(state, index)).length;
  const defAt = (state: MergeWorldState, index: number) => { const cell = state.board[index]; return cell?.occupant?.kind === 'item' ? cell.occupant.definitionId : cell?.mist?.kind === 'echo' ? cell.mist.definitionId : null; };
  const settle = (from: Node, command: MergeWorldCommand): { node: Node; mergedCell: number | null } | null => {
    if (command.type !== 'move') return null;
    const result = reduceMissionMove(from.state, command.from, command.to, NOW, items);
    if (!result.changed) return null;
    const settled = settleAction(binding, from, command, result);
    if (settled.refused) return null;
    return { node: { state: settled.state, run: settled.run, mechanicState: settled.mechanicState }, mergedCell: result.mergedCell ?? null };
  };
  const tierAt = (state: MergeWorldState, cell: number) => { const made = state.board[cell]?.occupant; return made?.kind === 'item' ? items.get(made.definitionId)?.tier ?? 1 : 1; };
  const merges = (from: Node): Option[] => {
    const cells = window.cellIndices;
    const out: Option[] = [];
    // Where a merge could usefully land away from its pair: free cells within two steps of the Mist (the careless
    // player only thinks of the cells right beside a wisp).
    const misted = cells.filter((index) => from.state.board[index]?.mist?.kind === 'encounter');
    const nests = wispViews(mechanic, host, from.mechanicState).flatMap((wisp) => (wisp.alive && wisp.placement.kind === 'cell' ? [wisp.placement.cell] : []));
    const landings = cells.filter((index) => isFree(from.state, index) && (input.style === 'careless'
      ? nests.some((nest) => windowDistance(nest, index, window) === 1)
      : misted.some((mist) => windowDistance(mist, index, window) <= 2)));
    for (const a of cells) {
      if (from.state.board[a]?.occupant?.kind !== 'item') continue;
      const id = defAt(from.state, a);
      for (const b of cells) {
        if (a === b || defAt(from.state, b) !== id) continue;
        const command: MergeWorldCommand = { type: 'move', from: a, to: b, now: NOW };
        const merged = settle(from, command);
        if (merged?.mergedCell != null) out.push({ commands: [command], steps: [merged.node], next: merged.node, resultTier: tierAt(merged.node.state, merged.mergedCell) });
        // Slide a onto a free cell first, then bring b onto it: the result lands there.
        if (from.state.board[b]?.occupant?.kind !== 'item' || b < a) continue;
        for (const landing of landings) {
          const slide: MergeWorldCommand = { type: 'move', from: a, to: landing, now: NOW };
          const slid = settle(from, slide);
          if (!slid) continue;
          const join: MergeWorldCommand = { type: 'move', from: b, to: landing, now: NOW };
          const joined = settle(slid.node, join);
          if (joined?.mergedCell == null) continue;
          out.push({ commands: [slide, join], steps: [slid.node, joined.node], next: joined.node, resultTier: tierAt(joined.node.state, joined.mergedCell) });
        }
      }
    }
    return out;
  };
  // Which spawner to tap: the careless player takes the first; the careful one the Spring while there is Mist to wash
  // or a wisp weak to Water standing, the Pod otherwise (the Pod first when the Spring is not wanted).
  const spawnerOrder = (from: Node): number[] => {
    const cells = window.cellIndices.filter((index) => from.state.board[index]?.occupant?.kind === 'generator' && (from.state.generators[(from.state.board[index]!.occupant as { generatorId: string }).generatorId]?.charges ?? 0) > 0);
    if (input.style === 'careless' || cells.length < 2) return cells;
    const views = wispViews(mechanic, host, from.mechanicState);
    const washable = window.cellIndices.some((index) => { const mist = from.state.board[index]?.mist; return mist?.kind === 'encounter' && mist.type !== 'root' && mist.type !== 'wisp-bound'; });
    const wantsWater = washable || views.some((wisp) => wisp.alive && wisp.weakTo === 'water');
    const isSpring = (index: number) => (from.state.board[index]!.occupant as { generatorId: string }).generatorId === 'mist-spring';
    return [...cells].sort((a, b) => Number(isSpring(b) === wantsWater) - Number(isSpring(a) === wantsWater));
  };
  const tap = (from: Node): Node | null => {
    for (const index of spawnerOrder(from)) {
      const occupant = from.state.board[index]?.occupant;
      if (occupant?.kind !== 'generator') continue;
      const command = { type: 'tapGenerator' as const, generatorId: occupant.generatorId, now: NOW, seed: tapSeed(from.run), spendEnergy: false as const, enforceCharges: true as const };
      const result = reduceMergeWorld(from.state, command);
      if (!result.changed || result.spawnedCell == null) continue;
      const settled = settleAction(binding, from, command, result);
      if (settled.refused) continue;
      // A tap is not a turn: keep the tap count apart so a seed's next drop differs.
      return { state: settled.state, run: { ...settled.run, actions: settled.run.actions + 1 }, mechanicState: settled.mechanicState };
    }
    return null;
  };
  const SPREADS = new Set(['surge', 'snuff', 'gather', 'shroud', 'root', 'spores', 'call']);
  // How good a position is to the careful player: the Mist's hold kept low above all, then the wisps worn down, the
  // spreading ones struck before they act, their nests opened up to be reached, and room kept to merge.
  const value = (after: Node, resultTier: number): number => {
    const status = encounterStatus(encounter, host, after.mechanicState, after.run, after.state, window);
    if (status === 'failed') return -10_000;
    const views = wispViews(mechanic, host, after.mechanicState);
    const hpLeft = views.reduce((sum, wisp) => sum + (wisp.alive ? wisp.hp - wisp.damage : 0), 0);
    const urgent = views.reduce((sum, wisp) => sum + (wisp.alive && wisp.intent && SPREADS.has(wisp.intent.kind) && wisp.intent.countdown <= 1 ? wisp.intent.amount ?? 1 : 0), 0);
    const mist = encounterMistLeft(after.state, window);
    const margin = (after.run.territory?.overrun ?? Number.POSITIVE_INFINITY) - mist;
    const exposed = views.reduce((sum, wisp) => {
      if (!wisp.alive || wisp.placement.kind !== 'cell') return sum;
      const open = windowArea(wisp.placement.cell, window, 'cross').filter((cell) => !after.state.board[cell]?.mist).length;
      return sum + Math.min(open, 2);
    }, 0);
    const room = free(after.state);
    const staggering = views.reduce((sum, wisp) => sum + (wisp.alive && wisp.intent?.kind === 'gather' ? Math.min(wisp.intent.gathered ?? 0, wisp.intent.stagger ?? 3) : 0), 0);
    const warded = views.reduce((sum, wisp) => sum + (wisp.alive ? wisp.intent?.ward ?? 0 : 0), 0);
    return -mist * 9 - (margin <= 2 ? (3 - margin) * 25 : 0) - hpLeft * 6 - urgent * 10 + exposed * 4 + staggering * 8 - warded * 2
      + Math.min(room, 4) * 3 - (room === 0 ? 40 : 0) + resultTier;
  };
  const maxSteps = input.maxSteps ?? 160;
  for (let step = 0; step < maxSteps; step += 1) {
    const status = encounterStatus(encounter, host, node.mechanicState, node.run, node.state, window);
    if (status === 'cleared' || status === 'failed') break;
    if (canOpenCache(status, node.run)) {
      const cache = openCache(encounter, node.state, window, node.run, items);
      const opened = { ...node, state: cache.board, run: cache.run };
      input.onStep?.({ kind: 'cache', before: node, after: opened });
      node = opened;
      continue;
    }
    const options = merges(node);
    const room = free(node.state);
    const wantsTap = input.style === 'careless' ? room > 0 : !options.length || (room >= 3 && options.length < 2);
    if (wantsTap) {
      const tapped = tap(node);
      if (tapped) { input.onStep?.({ kind: 'tap', before: node, after: tapped }); node = tapped; taps += 1; continue; }
    }
    if (!options.length) break;
    const won = options.find((option) => encounterStatus(encounter, host, option.next.mechanicState, option.next.run, option.next.state, window) === 'cleared');
    const hpLeft = (at: Node) => wispViews(mechanic, host, at.mechanicState).reduce((sum, wisp) => sum + (wisp.alive ? wisp.hp - wisp.damage : 0), 0);
    const chosen = input.style === 'careless'
      ? options.find((option) => hpLeft(option.next) < hpLeft(node)) ?? options[0]!
      : won ?? options.reduce((best, option) => (value(option.next, option.resultTier) > value(best.next, best.resultTier) ? option : best));
    let before = node;
    chosen.commands.forEach((command, index) => {
      const after = chosen.steps[index]!;
      input.onStep?.({ kind: index === chosen.commands.length - 1 ? 'merge' : 'move', command, before, after });
      before = after;
    });
    node = chosen.next;
  }
  const status = encounterStatus(encounter, host, node.mechanicState, node.run, node.state, window);
  return {
    won: status === 'cleared',
    mist: encounterMistLeft(node.state, window),
    peak: node.run.territory?.peak ?? 0,
    overrun: node.run.territory?.overrun ?? 0,
    turns: node.run.merges,
    taps,
    reason: status === 'cleared' ? null : lossReason(encounter, host, node.mechanicState, node.run, node.state, window) ?? 'spent',
  };
}

/** A level's record over several seeds: wins, and the most Mist a win ever let the board hold. */
export function fairness(encounter: EncounterDefinition, style: PlaytestStyle, seeds = 10): { wins: number; seeds: number; worstPeak: number; turns: number; losses: Partial<Record<EncounterLossReason, number>> } {
  let wins = 0;
  let worstPeak = 0;
  let turns = 0;
  const losses: Partial<Record<EncounterLossReason, number>> = {};
  for (let attempt = 1; attempt <= seeds; attempt += 1) {
    const result = playtest(encounter, { style, attempt });
    turns += result.turns;
    if (result.won) { wins += 1; worstPeak = Math.max(worstPeak, result.peak); }
    else if (result.reason) losses[result.reason] = (losses[result.reason] ?? 0) + 1;
  }
  return { wins, seeds, worstPeak, turns: Math.round(turns / Math.max(1, seeds)), losses };
}
