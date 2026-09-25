import { islandLevel, type IslandLevelSpec } from '@/constants/island-campaigns/island-levels';
import { FIRST_BATTLE_LINES, LOST_TRAIL_LINES, LOST_TRAIL_STONE_BATTLE_IDS, LOST_TRAIL_VOICE, LOST_TRAIL_VOICE_LINES } from '@/features/onboarding/last-clearing';
import type { SpeechLine } from '@/components/katchadeck/world/friend-speech-bubble';
import type { RescueBattleCopy } from '@/types/hatchable-companion';
import type { EncounterDefinition } from '@/types/encounter';
import type { MergeItemDefinition, MergeWorldState } from '@/types/merge-world';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { missionWindow, type MissionWindow } from '@/features/mission-mechanics/board-window';
import { laneAlive, laneArrived, laneCell, laneFire, laneOf } from '@/features/mission-mechanics/lanes';
import { closestOpeningPair } from '@/features/onboarding/opening-mist';
import type { MissionMechanicState } from '@/types/mission-mechanic';

/**
 * The Last Clearing's first battle (`docs/cozy-4x-ftue-the-last-clearing.md`, beats 3 to 6): "They found us". A Lanes
 * level scripted by its own data, and one that cannot be lost (`forgiving`). The board is a chain, like the Steppling
 * board: most of it asleep under the Mist, woken one piece at a time, each wake opening the Mist beside it.
 * - Five Seeds along the bottom row; above them one Seed asleep under half Mist (the middle of row four), the rest of
 *   that row under full Mist. Bring a Seed to the sleeper: it wakes as a Sprout, shoots at once, and opens its
 *   neighbours to half Mist. Five guided wakes put a shooting Sprout in every column.
 * - Row three hides a Sprout over every column, opened by the Sprout beneath it: bring that Sprout up and it wakes as a
 *   Plant, in the same column, shooting harder. Two Plants sleep in row two, over the second and fourth columns.
 * - New Seeds land only in the bottom two rows (`seeds.area`), under the plants, never up where the wisps come in.
 * - The wisps, in waves across every lane as the plants fill the board: one down the middle ("first light"), a pair
 *   either side of it, a spitter and its partner down the outside lanes, three at once, then all five lanes together.
 * A wave cleared early brings the next straight in. The finger guides every wake.
 */
const BOTTOM_ROWS = [36, 37, 38, 39, 40, 43, 44, 45, 46, 47] as const;
const SPEC: IslandLevelSpec = {
  title: 'They found us', objective: 'Wake what sleeps under the Mist. Bring down every wisp.', difficulty: 'calm',
  pieces: [[43, 1], [44, 1], [45, 1], [46, 1], [47, 1]],
  sleepers: [[37, 1]],
  veiled: [
    [36, 1], [38, 1], [39, 1], [40, 1],
    [29, 2], [30, 2], [31, 2], [32, 2], [33, 2],
    [23, 3], [25, 3],
  ],
  mist: [], wisps: [], seeds: { every: 3, area: BOTTOM_ROWS }, forgiving: true, rows: 5,
  lanes: [
    { id: 'first', column: 3, at: 3, hp: 3, step: 7 },
    { id: 'pair-left', column: 2, at: 9, hp: 3, step: 6.5 },
    { id: 'pair-right', column: 4, at: 9.6, hp: 3, step: 6.5 },
    { id: 'spitter', column: 1, at: 16, hp: 4, step: 6, spit: 3 },
    { id: 'spitter-partner', column: 5, at: 16.6, hp: 4, step: 6 },
    { id: 'three-left', column: 2, at: 24, hp: 5, step: 5.5 },
    { id: 'three-middle', column: 3, at: 24.5, hp: 5, step: 5.5 },
    { id: 'three-right', column: 4, at: 25, hp: 5, step: 5.5 },
    { id: 'last-1', column: 1, at: 33, hp: 5, step: 5 },
    { id: 'last-2', column: 2, at: 33.4, hp: 5, step: 5 },
    { id: 'last-3', column: 3, at: 33.8, hp: 6, step: 5 },
    { id: 'last-4', column: 4, at: 34.2, hp: 5, step: 5 },
    { id: 'last-5', column: 5, at: 34.6, hp: 5, step: 5 },
  ],
};

/** The first battle's wisps by beat (indices into its lanes). */
const beat = (...ids: string[]) => ids.map((id) => SPEC.lanes!.findIndex((lane) => lane.id === id));
const [FIRST_LIGHT] = beat('first');
const [SPITTER] = beat('spitter');
const MIDDLE_WAVES = beat('pair-left', 'pair-right', 'spitter-partner', 'three-left', 'three-middle', 'three-right');
const LAST_STAND = beat('last-1', 'last-2', 'last-3', 'last-4', 'last-5');
/** Mossprout keeps urging wakes while this few have been made and some Mist still sleeps. */
const WAKE_LINE_MERGES = 3;

export const FIRST_BATTLE: EncounterDefinition = islandLevel('last-clearing', 'first-battle', SPEC).encounter;

/** A line stays up this long after a wisp was pushed back. */
const PUSHED_LINE_MS = 4_000;

/**
 * What Mossprout says over the first battle, from how it stands: the rule before the first merge, the aim while the
 * first wisp comes down, relief when it falls, the spitter's Mist, the last stand, and a steadying word whenever a
 * wisp had to be pushed back.
 */
export function firstBattleLine(input: { mechanicState: MissionMechanicState; merges: number; board: MergeWorldState }): string | null {
  const lanes = input.mechanicState.kind === 'lanes' ? input.mechanicState : null;
  if (!lanes) return null;
  const mechanic = FIRST_BATTLE.mechanic?.kind === 'lanes' ? FIRST_BATTLE.mechanic : null;
  if (!mechanic) return null;
  const advance = lanes.advance ?? 0;
  const arrived = (index: number) => lanes.clock >= (mechanic.wisps[index]?.at ?? 0) - advance;
  const alive = (index: number) => (lanes.wisps[index]?.damage ?? 0) < (mechanic.wisps[index]?.hp ?? 0);
  if (lanes.lastPushAt != null && lanes.clock - lanes.lastPushAt < PUSHED_LINE_MS) return FIRST_BATTLE_LINES.pushed;
  if (input.merges === 0) return FIRST_BATTLE_LINES.found;
  const sleeping = input.board.board.some((cell) => cell?.mist?.kind === 'echo' || cell?.mist?.kind === 'veiled');
  if (input.merges < WAKE_LINE_MERGES && sleeping) return FIRST_BATTLE_LINES.wake;
  if (alive(FIRST_LIGHT) && !MIDDLE_WAVES.some(arrived)) return FIRST_BATTLE_LINES.aim;
  if (LAST_STAND.some(arrived) && LAST_STAND.some(alive)) return FIRST_BATTLE_LINES.lastStand;
  if (arrived(SPITTER) && alive(SPITTER)) {
    const misted = input.board.board.some((cell) => cell?.mist?.kind === 'encounter' && cell.mist.type === 'light');
    if (misted) return FIRST_BATTLE_LINES.spitting;
  }
  if (MIDDLE_WAVES.some(arrived) && MIDDLE_WAVES.some(alive)) return FIRST_BATTLE_LINES.another;
  if (!alive(FIRST_LIGHT) && !MIDDLE_WAVES.some(arrived)) return FIRST_BATTLE_LINES.works;
  return null;
}

/** What the finger shows on the first battle: a wake, a merge, or a move from a wasted lane to a wisp's lane. */
export type FirstBattleGuide = { kind: 'wake' | 'merge' | 'move'; from: number; to: number };

/**
 * The first battle's finger (`docs/cozy-4x-ftue-the-last-clearing.md`, beats 3 to 6), from how the board stands:
 * - a wake first, all through the chain: a piece asleep under half Mist whose twin is loose on the board. The lowest
 *   sleeper first (so every column gets a Sprout before any climbs), its twin from its own column when there is one,
 *   else the nearest;
 * - then a move, only when it matters: a piece that fires is shooting up a lane with no wisp in it while a wisp comes
 *   down a lane nothing covers. The finger drags it to the lowest free cell under that wisp (the most time before the
 *   wisp reaches it). A piece already under a wisp is never pulled away;
 * - otherwise the closest pair to merge;
 * - otherwise nothing.
 */
export function firstBattleGuide(board: MergeWorldState, mechanicState: MissionMechanicState, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): FirstBattleGuide | null {
  return scriptedBattleGuide(FIRST_BATTLE, board, mechanicState, items);
}

/**
 * The same finger for any scripted Lanes battle of the Last Clearing (the first battle, the Lost Trail's three). On a
 * rescue, while the trapped cell is still under Mist, a merge landing nearest it comes before any move or other merge.
 */
export function scriptedBattleGuide(encounter: EncounterDefinition, board: MergeWorldState, mechanicState: MissionMechanicState, items: ReadonlyMap<string, MergeItemDefinition> = MERGE_ITEMS_BY_ID): FirstBattleGuide | null {
  const lanes = mechanicState.kind === 'lanes' ? mechanicState : null;
  const mechanic = encounter.mechanic?.kind === 'lanes' ? encounter.mechanic : null;
  if (!lanes || !mechanic || lanes.breached != null) return null;
  const window = missionWindow(encounter.rows ?? 4);
  const loose = (cell: number) => {
    const entry = board.board[cell];
    return entry && !entry.locked && !entry.mist && entry.occupant?.kind === 'item' ? entry.occupant : null;
  };
  const free = (cell: number) => { const entry = board.board[cell]; return Boolean(entry && !entry.locked && !entry.mist && !entry.occupant); };
  // Wisps here and standing, by column, with the cell each is on (a piece cannot be dropped there).
  const wispColumns = new Set<number>();
  const wispCells = new Set<number>();
  mechanic.wisps.forEach((spec, index) => {
    if (!laneArrived(mechanic, lanes, index) || !laneAlive(mechanic, lanes, index)) return;
    wispColumns.add(spec.column);
    const row = Math.floor((lanes.wisps[index]?.row ?? -1) + 0.5);
    const cell = row >= 0 ? laneCell(window, spec.column, row) : null;
    if (cell != null) wispCells.add(cell);
  });
  const shooters = window.cellIndices.flatMap((cell) => {
    const item = loose(cell);
    const tier = item ? items.get(item.definitionId)?.tier ?? 1 : 0;
    const lane = laneOf(window, cell);
    return item && lane && laneFire(tier) ? [{ cell, column: lane.column, tier }] : [];
  });
  const covered = new Set(shooters.map((shooter) => shooter.column));
  const uncovered = [...wispColumns].filter((column) => !covered.has(column)).sort((a, b) => a - b);
  const wasted = shooters.filter((shooter) => !wispColumns.has(shooter.column)).sort((a, b) => b.tier - a.tier);
  // First (the user, Sept 25 2026): a plant shooting up an empty lane goes under a wisp nothing covers, before any wake
  // or merge. A wisp coming down an open lane is the one thing that cannot wait.
  if (uncovered.length && wasted.length) {
    const piece = wasted[0]!;
    for (const column of uncovered) {
      for (let row = window.rows - 1; row >= 0; row -= 1) {
        const cell = laneCell(window, column, row);
        if (cell != null && free(cell) && !wispCells.has(cell)) return { kind: 'move', from: piece.cell, to: cell };
      }
    }
  }
  const wake = firstBattleWake(board, window, loose);
  if (wake) return wake;
  const rescue = encounter.objective.kind === 'rescue' && board.board[encounter.objective.cell]?.mist ? encounter.objective.cell : null;
  if (rescue != null) {
    const toward = rescueMerge(board, window, loose, rescue);
    if (toward) return toward;
  }
  const pair = closestOpeningPair(board, window.cellIndices);
  return pair ? { kind: 'merge', from: pair.from, to: pair.to } : null;
}

const GUIDE_URGENCY: Readonly<Record<FirstBattleGuide['kind'], number>> = { move: 3, wake: 2, merge: 1 };

/**
 * The finger holds still: the hint already shown stays while it is still a move the board allows, so a Seed landing
 * (which changes the nearest pair) never restarts it. It gives way only when it can no longer be played, or to
 * something more urgent (a wisp over an open lane).
 */
export function stickyBattleGuide(shown: FirstBattleGuide | null, next: FirstBattleGuide | null, board: MergeWorldState): FirstBattleGuide | null {
  if (!shown || !next) return next;
  // A move to an empty lane is only right while that lane has no shooter: it is never held, only re-read.
  if (shown.kind === 'move' || next.kind === 'move') return next;
  if (GUIDE_URGENCY[next.kind] > GUIDE_URGENCY[shown.kind]) return next;
  const cell = (index: number) => board.board[index];
  const piece = cell(shown.from);
  const item = piece && !piece.locked && !piece.mist && piece.occupant?.kind === 'item' ? piece.occupant : null;
  if (!item) return next;
  const target = cell(shown.to);
  const still = shown.kind === 'merge'
    ? Boolean(target && !target.mist && target.occupant?.kind === 'item' && target.occupant.definitionId === item.definitionId)
    : shown.kind === 'wake'
      ? Boolean(target?.mist?.kind === 'echo' && target.mist.definitionId === item.definitionId)
      : Boolean(target && !target.locked && !target.mist && !target.occupant);
  return still ? shown : next;
}

/** The next wake on the chain: the lowest sleeper with a loose twin, its twin from the same column first, else the nearest. */
function firstBattleWake(board: MergeWorldState, window: MissionWindow, loose: (cell: number) => { definitionId: string } | null): FirstBattleGuide | null {
  const cells = window.cellIndices;
  let best: { guide: FirstBattleGuide; score: number } | null = null;
  for (const to of cells) {
    const mist = board.board[to]?.mist;
    if (mist?.kind !== 'echo') continue;
    const sleeper = laneOf(window, to);
    if (!sleeper) continue;
    for (const from of cells) {
      if (loose(from)?.definitionId !== mist.definitionId) continue;
      const piece = laneOf(window, from);
      if (!piece) continue;
      const distance = Math.hypot(piece.column - sleeper.column, piece.row - sleeper.row);
      // Lower rows first, then a twin in the same column, then the nearest, then left to right.
      const score = (window.rows - sleeper.row) * 1_000 + (piece.column === sleeper.column ? 0 : 100) + distance * 10 + sleeper.column;
      if (!best || score < best.score) best = { guide: { kind: 'wake', from, to }, score };
    }
  }
  return best?.guide ?? null;
}

/**
 * A merge that lands as near the trapped cell as a pair allows, so its pulse wears the Mist around it and then the
 * thick Mist itself: onto whichever of the pair sits nearer, the other dragged to it.
 */
function rescueMerge(board: MergeWorldState, window: MissionWindow, loose: (cell: number) => { definitionId: string } | null, rescue: number): FirstBattleGuide | null {
  const target = laneOf(window, rescue);
  if (!target) return null;
  const pieces = window.cellIndices.flatMap((cell) => { const item = loose(cell); const lane = laneOf(window, cell); return item && lane ? [{ cell, lane, definitionId: item.definitionId }] : []; });
  const away = (lane: { column: number; row: number }) => Math.abs(lane.column - target.column) + Math.abs(lane.row - target.row);
  let best: { guide: FirstBattleGuide; score: number } | null = null;
  for (const a of pieces) {
    for (const b of pieces) {
      if (a.cell === b.cell || a.definitionId !== b.definitionId || !MERGE_ITEMS_BY_ID.get(a.definitionId)?.nextItemId) continue;
      // a is where the merge lands: the nearer of the two to the trapped cell.
      if (away(a.lane) > away(b.lane)) continue;
      const score = away(a.lane) * 100 + away(b.lane);
      if (!best || score < best.score) best = { guide: { kind: 'merge', from: b.cell, to: a.cell }, score };
    }
  }
  return best?.guide ?? null;
}

const TRAIL_BOTTOM_ROWS = [36, 37, 38, 39, 40, 43, 44, 45, 46, 47] as const;

/**
 * The Lost Trail's battle (`docs/cozy-4x-ftue-v2-wayfinders-road.md`, Act I), docked under Steppling's misted
 * trailhead, and not losable in the first session: Steppling trapped under thick Mist at the top of the middle lane,
 * ringed by light Mist. On the way, one quick wisp and one that spits. Won with every wisp down and that cell cleared
 * (`rescue`).
 */
const TRAIL_SPECS: readonly IslandLevelSpec[] = [
  {
    title: 'Someone\u2019s in There', objective: 'Bring down every wisp, and burn the thick Mist off the one trapped under it.', difficulty: 'calm',
    pieces: [[43, 1], [44, 2], [45, 2], [46, 2], [47, 1], [37, 1], [38, 2], [39, 1], [31, 2]],
    mist: [16, 18, 24].map((cell) => ({ cell, type: 'light' as const })),
    rescue: { cell: 17 },
    wisps: [], seeds: { every: 3, area: TRAIL_BOTTOM_ROWS }, forgiving: true, rows: 5,
    lanes: [
      { id: 'guard-1', column: 2, at: 2, hp: 4, step: 6 },
      { id: 'guard-2', column: 4, at: 2.6, hp: 4, step: 6 },
      { id: 'quick', column: 1, at: 9, hp: 4, step: 2.6, look: 'snuffer' },
      { id: 'spitter', column: 5, at: 10.6, hp: 5, step: 5, spit: 6 },
      { id: 'keeper', column: 3, at: 18, hp: 8, step: 5, look: 'warden' },
      { id: 'last-1', column: 2, at: 24, hp: 5, step: 4.5 },
      { id: 'last-2', column: 4, at: 24.6, hp: 5, step: 4.5 },
    ],
  },
];

export const LOST_TRAIL_BATTLES: readonly EncounterDefinition[] = TRAIL_SPECS.map((spec) => islandLevel('last-clearing', 'lost-trail-rescue', spec).encounter);
/** The trapped cell of the Lost Trail's rescue. */
export const LOST_TRAIL_RESCUE_CELL = 17;
export const lostTrailBattleIndex = (battleId: string) => (LOST_TRAIL_STONE_BATTLE_IDS as readonly string[]).indexOf(battleId);

/** A line over the Lost Trail's battle: the voice from the thick Mist, and Mossprout's steer toward it. */
export function lostTrailLine(index: number, input: { mechanicState: MissionMechanicState; merges: number; board: MergeWorldState }): SpeechLine | null {
  const encounter = LOST_TRAIL_BATTLES[index];
  return encounter ? rescueBattleLine(encounter, input, LOST_TRAIL_RESCUE_COPY) : null;
}

const LOST_TRAIL_RESCUE_COPY: RescueBattleCopy = { voice: LOST_TRAIL_VOICE, ...LOST_TRAIL_VOICE_LINES, steer: LOST_TRAIL_LINES.rescue };

/**
 * A line over any rescue battle (the Lost Trail's last stone, a friend's lit window), from how it stands: the voice from
 * the thick Mist first (not yet a name), then the lead's word about the place; the voice again once some wisps are down
 * and the biggest has not come; "almost" once every wisp is down with the Mist still on them; the steer otherwise.
 */
export function rescueBattleLine(encounter: EncounterDefinition, input: { mechanicState: MissionMechanicState; merges: number; board: MergeWorldState }, copy: RescueBattleCopy): SpeechLine | null {
  const lanes = input.mechanicState.kind === 'lanes' ? input.mechanicState : null;
  const mechanic = encounter.mechanic?.kind === 'lanes' ? encounter.mechanic : null;
  if (!lanes || !mechanic || encounter.objective.kind !== 'rescue') return null;
  if (lanes.lastPushAt != null && lanes.clock - lanes.lastPushAt < PUSHED_LINE_MS) return LOST_TRAIL_LINES.pushed;
  if (!input.board.board[encounter.objective.cell]?.mist) return null;
  const alive = (at: number) => (lanes.wisps[at]?.damage ?? 0) < (mechanic.wisps[at]?.hp ?? 0);
  const arrived = (at: number) => lanes.clock >= (mechanic.wisps[at]?.at ?? 0) - (lanes.advance ?? 0);
  const voice = (text: string): SpeechLine => ({ text, speaker: copy.voice, muffled: true });
  if (lanes.clock < 4_000) return voice(copy.hello);
  if (copy.guard && lanes.clock < 8_000) return copy.guard;
  const down = mechanic.wisps.filter((_, at) => !alive(at)).length;
  if (down === mechanic.wisps.length) return voice(copy.almost);
  const biggest = mechanic.wisps.reduce((best, wisp, at) => (wisp.hp > (mechanic.wisps[best]?.hp ?? 0) ? at : best), 0);
  if (down >= 2 && !arrived(biggest)) return voice(copy.light);
  return copy.steer;
}
