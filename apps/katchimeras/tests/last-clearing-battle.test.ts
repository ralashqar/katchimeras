import assert from 'node:assert/strict';
import test from 'node:test';

import { FIRST_BATTLE, firstBattleGuide } from '@/constants/last-clearing-battle';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { createLanesState, laneCell, type LanesMechanic } from '@/features/mission-mechanics/lanes';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import type { MergeWorldState } from '@/types/merge-world';

const mechanic = FIRST_BATTLE.mechanic as LanesMechanic;
const window = encounterWindow(FIRST_BATTLE);

/** The first battle's board with only the pieces given, by column and row. */
function boardWith(pieces: readonly [column: number, row: number, definitionId: string][]): MergeWorldState {
  const board = createEncounterState(FIRST_BATTLE, 'mossprout', 1);
  const cells = [...board.board];
  for (const cell of window.cellIndices) cells[cell] = { ...cells[cell]!, occupant: null, mist: undefined, locked: false };
  pieces.forEach(([column, row, definitionId], index) => {
    const cell = laneCell(window, column, row)!;
    cells[cell] = { ...cells[cell]!, occupant: { kind: 'item', instanceId: `test:${index}`, definitionId } };
  });
  return { ...board, board: cells };
}

/** The first wisp here (column 3, high over the board), nothing else yet. */
const firstWispHere = () => ({ ...createLanesState(mechanic), clock: 2_000 });

test('the first battle points a piece shooting an empty lane to the lane a wisp is coming down', () => {
  const column = mechanic.wisps[0]!.column;
  const guide = firstBattleGuide(boardWith([[0, 3, 'nature:garden:2']]), firstWispHere());
  assert.equal(guide?.kind, 'move');
  assert.equal(guide?.from, laneCell(window, 0, 3));
  assert.equal(guide?.to, laneCell(window, column, window.rows - 1), 'to the lowest free cell under the wisp');
});

test('a piece already under the wisp is left alone; the finger shows the next merge instead', () => {
  const column = mechanic.wisps[0]!.column;
  const guide = firstBattleGuide(boardWith([[column, 3, 'nature:garden:2'], [0, 0, 'nature:garden:1'], [1, 0, 'nature:garden:1']]), firstWispHere());
  assert.deepEqual(guide, { kind: 'merge', from: laneCell(window, 0, 0), to: laneCell(window, 1, 0) });
});

test('no wisp over the board: no move is suggested, only merges; Seeds do not count as shooting', () => {
  const quiet = createLanesState(mechanic);
  assert.equal(firstBattleGuide(boardWith([[0, 3, 'nature:garden:2']]), quiet), null);
  assert.equal(firstBattleGuide(boardWith([[0, 3, 'nature:garden:1']]), firstWispHere()), null, 'a lone Seed fires nothing, so there is nothing to move');
});

test('the Mist lift frames Mossprout the way a tap on him does, not the old Egg close-up', () => {
  const camera = mossproutFtueStep('world.mist_lift')?.camera;
  assert.equal(camera?.kind === 'focus_target' ? camera.target.kind : null, 'haven_resident');
  assert.ok(camera?.kind === 'focus_target' && (camera.zoom ?? 0) < 2.5, 'no 3x Egg close-up');
});
