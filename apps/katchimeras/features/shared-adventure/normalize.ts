import type { SharedAdventureProgress } from './types';

/** A corrupt adventure uses the repository backup rather than silently dropping reward receipts. */
export function normalizeAdventure(value: SharedAdventureProgress | undefined): SharedAdventureProgress | undefined {
  if (value == null) return undefined;
  if (value.gardenBedsVersion != null && value.gardenBedsVersion !== 1 && value.gardenBedsVersion !== 2) throw new Error('Invalid Heartwood bed layout');
  const supply = value.gardenSupply;
  if (supply && (supply.version !== 1 || !Number.isFinite(supply.clock) || !Number.isFinite(supply.startedAt)
    || !Number.isInteger(supply.stored) || supply.stored < 0 || supply.stored > 2
    || !Number.isInteger(supply.nextParcel) || supply.nextParcel < 1)) throw new Error('Invalid Garden supply state');
  if (value.version !== 1 || !Number.isFinite(value.clock) || !Number.isInteger(value.nextRun) || value.nextRun < 1
    || !value.acknowledged || !value.routeFirsts || !value.rewardDays || !Array.isArray(value.activity)
    || Object.values(value.acknowledged).some(time => !Number.isFinite(time))
    || (value.presentations != null && (typeof value.presentations !== 'object' || Array.isArray(value.presentations)
      || Object.values(value.presentations).some(time => !Number.isFinite(time))))
    || Object.values(value.routeFirsts).some(time => !Number.isFinite(time))
    || Object.values(value.rewardDays).some(day => typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day))
    || (value.run && (!value.run.id || !value.run.routeId || !Array.isArray(value.run.board?.board) || value.run.board.board.length !== 63 || !Number.isInteger(value.run.merges)))) {
    throw new Error('Invalid saved shared adventure');
  }
  return value;
}
