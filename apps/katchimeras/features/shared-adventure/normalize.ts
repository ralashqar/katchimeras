import type { SharedAdventureProgress } from './types';

/** A corrupt adventure uses the repository backup rather than silently dropping reward receipts. */
export function normalizeAdventure(value: SharedAdventureProgress | undefined): SharedAdventureProgress | undefined {
  if (value == null) return undefined;
  if (value.version !== 1 || !Number.isFinite(value.clock) || !Number.isInteger(value.nextRun) || value.nextRun < 1
    || !value.acknowledged || !value.routeFirsts || !value.rewardDays || !Array.isArray(value.activity)
    || Object.values(value.acknowledged).some(time => !Number.isFinite(time))
    || Object.values(value.routeFirsts).some(time => !Number.isFinite(time))
    || Object.values(value.rewardDays).some(day => typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day))
    || (value.run && (!value.run.id || !value.run.routeId || !Array.isArray(value.run.board?.board) || value.run.board.board.length !== 63 || !Number.isInteger(value.run.merges)))) {
    throw new Error('Invalid saved shared adventure');
  }
  return value;
}
