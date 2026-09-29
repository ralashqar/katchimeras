import assert from 'node:assert/strict';
import test from 'node:test';
import { combatLessonMission } from '@/constants/combat-campaign';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { createLanesState, lanesTick, normalizeLanesState, type LanesMechanic } from '@/features/mission-mechanics/lanes';

function setup(weapon: 'bullet' | 'zap' | 'skirmisher') {
  const encounter = combatLessonMission(3).encounter;
  const window = encounterWindow(encounter);
  const board = createEncounterState(encounter, 'mossprout', 1);
  board.board = board.board.map(c => ({ ...c, occupant: null, mist: null, locked: false }));
  board.board[31]!.occupant = { kind: 'item', instanceId: 'target', definitionId: 'nature:dew:4' };
  const mechanic: LanesMechanic = { kind: 'lanes', rulesVersion: 2, wisps: [{ id: 'enemy', column: 2, hp: 100, at: 0, stepMs: 10000, weapon }] };
  const state = createLanesState(mechanic);
  state.wisps[0]!.row = 1;
  return { mechanic, window, board, state };
}

for (const weapon of ['bullet', 'zap'] as const) test(`${weapon} stops in range, fires visibly on cooldown, and resumes when the lane clears`, () => {
  const { mechanic, window, board, state } = setup(weapon);
  const aim = lanesTick(mechanic, state, board, 100, window);
  assert.equal(aim.state.wisps[0]!.row, 1);
  assert.equal(aim.state.wisps[0]!.engagedCell, 31);
  assert.equal(aim.spat.length, 0, 'wind-up before first attack');
  const saved = normalizeLanesState(mechanic, JSON.parse(JSON.stringify(aim.state)), 0)!;
  const fire = lanesTick(mechanic, saved, aim.board, 600, window);
  assert.equal(fire.spat.length, 1);
  assert.equal(fire.spat[0]!.weapon, weapon);
  const impact = lanesTick(mechanic, fire.state, fire.board, 400, window);
  assert.equal(impact.state.combat!.plants.target!.hearts, 3);
  assert.equal(impact.spat.length, 0, 'no repeated contact damage or rapid duplicate shots');
  const empty = { ...impact.board, board: impact.board.board.map((c, i) => i === 31 ? { ...c, occupant: null } : c) };
  const resume = lanesTick(mechanic, impact.state, empty, 100, window);
  assert.ok(resume.state.wisps[0]!.row > 1);
  assert.equal(resume.state.wisps[0]!.engagedCell, undefined);
});

test('skirmisher fires farther away while moving, but never at plants behind it', () => {
  const { mechanic, window, board, state } = setup('skirmisher');
  state.wisps[0]!.row = -1;
  const aim = lanesTick(mechanic, state, board, 100, window);
  const fire = lanesTick(mechanic, aim.state, aim.board, 600, window);
  assert.ok(fire.state.wisps[0]!.row > aim.state.wisps[0]!.row);
  assert.equal(fire.spat[0]!.weapon, 'bullet');
  const passed = { ...fire.state, wisps: [{ ...fire.state.wisps[0]!, row: 3, strikeAt: 0 }] };
  assert.equal(lanesTick(mechanic, passed, fire.board, 100, window).spat.length, 0);
  state.wisps[0]!.row = -3;
  state.wisps[0]!.strikeAt = 0;
  assert.equal(lanesTick(mechanic, state, board, 100, window).spat.length, 0, 'range is finite');
});

test('moving a plant out of a projectile destination dodges its damage', () => {
  const { mechanic, window, board, state } = setup('bullet');
  state.wisps[0]!.strikeAt = 0;
  const fire = lanesTick(mechanic, state, board, 100, window);
  const moved = { ...fire.board, board: [...fire.board.board] };
  moved.board[32] = { ...moved.board[32]!, occupant: moved.board[31]!.occupant };
  moved.board[31] = { ...moved.board[31]!, occupant: null };
  const impact = lanesTick(mechanic, fire.state, moved, 400, window);
  assert.equal(impact.state.combat!.plants.target!.hearts, 4);
});
