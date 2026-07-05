import EXPANSION from '@/data/world-expansion.json';

// Territory expansion (docs/world-objects-expansion-design.md §10): the
// Kingdom grows one tile at a time when authored requirements AND the
// planting-pressure gate are met. All dials live in data/world-expansion.json;
// this module only evaluates and describes them.

export type ExpansionSide = 'ne' | 'se' | 'sw' | 'nw';

export type KingdomExpansion = {
  index: number; // tile number (centre island = 1)
  side: ExpansionSide;
  ring: number; // 1 = edge-adjacent to the centre, 2 = one tile further out…
  unlockedDayId: string;
  ceremonyShown?: boolean;
};

export type ExpansionStats = {
  daysLived: number;
  propsPlanted: number;
  discoveries: number;
  epicDiscoveries: number;
};

export type ExpansionRequires = {
  daysLived?: number;
  propsPlanted?: number;
  discoveries?: number;
  epicDiscoveries?: number;
};

export type ExpansionTarget = { index: number; side: ExpansionSide; ring: number; requires: ExpansionRequires };

const SIDE_CYCLE: ExpansionSide[] = ['ne', 'sw', 'se', 'nw'];

// The next tile after `unlockedCount` expansions (centre excluded from count).
export function nextExpansionTarget(unlockedCount: number): ExpansionTarget {
  const index = unlockedCount + 2; // tile 1 is the centre island
  const side = SIDE_CYCLE[(index - 2) % SIDE_CYCLE.length];
  const ring = 1 + Math.floor((index - 2) / SIDE_CYCLE.length);
  const authored = EXPANSION.tiles.find((tile) => tile.index === index);
  if (authored) {
    return { index, side: authored.side as ExpansionSide, ring, requires: authored.requires };
  }
  // Formula land: linear ramp beyond the authored list.
  const last = EXPANSION.tiles[EXPANSION.tiles.length - 1];
  const extra = index - last.index;
  return {
    index,
    side,
    ring,
    requires: {
      daysLived: (last.requires.daysLived ?? 0) + EXPANSION.formula.daysPerTile * extra,
      propsPlanted: (last.requires.propsPlanted ?? 0) + EXPANSION.formula.propsPerTile * extra,
    },
  };
}

export type RequirementLine = { label: string; have: number; need: number };

export type ExpansionProgress = {
  target: ExpansionTarget;
  lines: RequirementLine[];
  // Pressure gate: planted props vs current total capacity.
  pressure: RequirementLine;
  met: boolean; // requirements AND pressure
  overall: number; // 0..1 min across all lines (for the foreshadow chip)
};

const REQUIRE_LABELS: Record<keyof ExpansionRequires, string> = {
  daysLived: 'days lived',
  propsPlanted: 'props planted',
  discoveries: 'discoveries',
  epicDiscoveries: 'epic discoveries',
};

export function expansionProgress(stats: ExpansionStats, unlockedCount: number): ExpansionProgress {
  const target = nextExpansionTarget(unlockedCount);
  const lines: RequirementLine[] = (Object.keys(target.requires) as (keyof ExpansionRequires)[])
    .filter((key) => (target.requires[key] ?? 0) > 0)
    .map((key) => ({ label: REQUIRE_LABELS[key], have: stats[key], need: target.requires[key] as number }));
  const currentCapacity = (1 + unlockedCount) * EXPANSION.capacityPerTile;
  const pressure: RequirementLine = {
    label: 'land planted',
    have: stats.propsPlanted,
    need: Math.ceil(currentCapacity * EXPANSION.pressureGate),
  };
  const all = [...lines, pressure];
  const met = all.every((line) => line.have >= line.need);
  const overall = Math.min(...all.map((line) => Math.min(1, line.have / Math.max(1, line.need))));
  return { target, lines, pressure, met, overall };
}

// Screen offset of an expansion tile relative to the centre island, in units
// of "one neighbor step" (the world-tile-layout side magnitudes × span).
export function expansionOffsetSteps(expansion: { side: ExpansionSide; ring: number }): { sx: number; sy: number; steps: number } {
  const signs: Record<ExpansionSide, { sx: 1 | -1; sy: 1 | -1 }> = {
    ne: { sx: 1, sy: -1 },
    se: { sx: 1, sy: 1 },
    sw: { sx: -1, sy: 1 },
    nw: { sx: -1, sy: -1 },
  };
  return { ...signs[expansion.side], steps: expansion.ring };
}
