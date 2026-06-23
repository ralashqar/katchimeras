import {
  ARCHETYPE_ANCHORS,
  ARCHETYPE_PROP_BIAS,
  ARCHETYPE_THEME,
  MEMORY_NODE_ASSET,
  PATCH_TEMPLATE,
  PROP_POOL,
} from '@/constants/world';
import type { HomeDayRecord } from '@/types/home';
import type {
  MemoryNode,
  MemoryNodeKind,
  WorldObject,
  WorldPatch,
  WorldTile,
} from '@/types/world';
import { deriveArchetypes, type ArchetypeSignals } from '@/utils/world-archetype';

// The pure inputs a patch is generated from — all sourced from an already-hatched
// day. Decoupled from HomeDayRecord so the generator is trivially testable and
// never reaches into RN-only modules.
export type PatchInput = {
  dayId: string;
  isoDate: string;
  nonce: string;
  signals: ArchetypeSignals;
  creatureId: string | null;
  creatureVisualKey: string | null;
  creatureName: string | null;
  rarity: ArchetypeSignals['rarity'];
  heroPhotoThumb: string | null;
  heroMeaningLabel: string | null;
  primaryPlaceLabel: string | null;
  newPlaceCount: number;
  stepsCount: number;
  socialCount: number;
  isMeaningful: boolean;
  timeLabel: string | null;
};

type Cell = { col: number; row: number };

type ParsedTemplate = {
  anchor: { col: number; row: number; footprint: number };
  creature: Cell;
  memory: Cell;
  props: Cell[];
};

// Locate the slots in the template grid. Anchor footprint = the run of 'A's.
function parseTemplate(rows: string[]): ParsedTemplate {
  let anchor: ParsedTemplate['anchor'] | null = null;
  let creature: Cell | null = null;
  let memory: Cell | null = null;
  const props: Cell[] = [];
  rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col += 1) {
      const ch = line[col];
      if (ch === 'A') {
        if (!anchor) {
          let footprint = 0;
          while (line[col + footprint] === 'A') footprint += 1;
          anchor = { col, row, footprint };
        }
      } else if (ch === 'K') {
        creature = { col, row };
      } else if (ch === 'M') {
        memory = { col, row };
      } else if (ch === 'P') {
        props.push({ col, row });
      }
    }
  });
  if (!anchor || !creature || !memory) {
    throw new Error('world template missing a required slot (A/K/M)');
  }
  return { anchor, creature, memory, props };
}

function pickOne<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const ARCHETYPE_SOURCE_LABEL: Record<string, string> = {
  calm: '🌿 Calm',
  active: '🚶 Active',
  social: '🧑‍🤝‍🧑 People',
  exploration: '🧭 Exploration',
  focus: '☕ Focus',
  meaningful: '✨ Meaningful',
};

type EarnedMemory = {
  kind: MemoryNodeKind;
  payload: Omit<MemoryNode, 'id' | 'kind' | 'assetKey' | 'label' | 'col' | 'row'>;
};

// Which memory nodes the day earns, richest first. Each carries its retrieval
// payload so tapping the node in-world surfaces the real moment.
function deriveMemoryNodes(input: PatchInput): EarnedMemory[] {
  const out: EarnedMemory[] = [];
  if (input.heroPhotoThumb) {
    out.push({
      kind: 'photo_bloom',
      payload: {
        photoThumbnailUri: input.heroPhotoThumb,
        meaningLabel: input.heroMeaningLabel,
        locationLabel: input.primaryPlaceLabel,
        timeLabel: input.timeLabel,
      },
    });
  }
  if (input.newPlaceCount > 0) {
    out.push({
      kind: 'landmark_stone',
      payload: { locationLabel: input.primaryPlaceLabel, timeLabel: input.timeLabel },
    });
  }
  if (input.stepsCount >= 10000) {
    out.push({
      kind: 'monument',
      payload: { meaningLabel: `${input.stepsCount.toLocaleString()} steps`, timeLabel: input.timeLabel },
    });
  }
  if (input.isMeaningful) {
    out.push({
      kind: 'memory_crystal',
      payload: { meaningLabel: input.heroMeaningLabel, timeLabel: input.timeLabel },
    });
  }
  if (input.socialCount >= 2) {
    out.push({
      kind: 'lantern_shrine',
      payload: { meaningLabel: 'People I love', timeLabel: input.timeLabel },
    });
  }
  return out;
}

function pickName(theme: { adjectives: string[]; nouns: string[] }, rng: () => number): string {
  return `${pickOne(theme.adjectives, rng)} ${pickOne(theme.nouns, rng)}`;
}

// Generate a day's patch. `rng` is injected (seeded from the day's nonce by the
// caller) so the result is reproducible yet differs day to day — mirrors the
// hatch engine's contract. Grid placement is assigned later (world-placement).
export function generatePatch(input: PatchInput, rng: () => number): WorldPatch {
  const { primary, secondary } = deriveArchetypes(input.signals);
  const template = parseTemplate(PATCH_TEMPLATE);
  const theme = ARCHETYPE_THEME[primary];

  const objects: WorldObject[] = [];

  // Anchor — the patch's identity. Always exactly one.
  const anchor = pickOne(ARCHETYPE_ANCHORS[primary], rng);
  objects.push({
    id: `${input.dayId}-anchor`,
    kind: 'anchor',
    assetKey: anchor.key,
    label: anchor.label,
    col: template.anchor.col,
    row: template.anchor.row,
    footprint: template.anchor.footprint,
    sourceLabel: ARCHETYPE_SOURCE_LABEL[primary],
  });

  // Memory nodes — the day's real moments, placed at the M slot (and one spare
  // prop cell if a second memory was earned).
  const earnedMemories = deriveMemoryNodes(input);
  const memoryCells: Cell[] = [template.memory];
  const memoryNodes: MemoryNode[] = [];
  earnedMemories.slice(0, 2).forEach((memory, index) => {
    const cell = memoryCells[index] ?? template.props[index] ?? template.memory;
    const asset = MEMORY_NODE_ASSET[memory.kind];
    memoryNodes.push({
      id: `${input.dayId}-memory-${index}`,
      kind: memory.kind,
      assetKey: asset.key,
      label: asset.label,
      col: cell.col,
      row: cell.row,
      ...memory.payload,
    });
  });
  const usedCells = new Set(memoryNodes.map((node) => `${node.col},${node.row}`));

  // Props — richness around the anchor, biased toward the day's archetypes.
  const biased = [
    ...ARCHETYPE_PROP_BIAS[primary],
    ...(secondary ? ARCHETYPE_PROP_BIAS[secondary] : []),
  ];
  const orderedKeys = [
    ...biased,
    ...shuffle(
      PROP_POOL.map((prop) => prop.key).filter((key) => !biased.includes(key)),
      rng
    ),
  ];
  const propCells = shuffle(
    template.props.filter((cell) => !usedCells.has(`${cell.col},${cell.row}`)),
    rng
  ).slice(0, 3);
  propCells.forEach((cell, index) => {
    const key = orderedKeys[index % orderedKeys.length];
    const def = PROP_POOL.find((prop) => prop.key === key) ?? PROP_POOL[0];
    objects.push({
      id: `${input.dayId}-prop-${index}`,
      kind: 'prop',
      assetKey: def.key,
      label: def.label,
      col: cell.col,
      row: cell.row,
      footprint: 1,
    });
    usedCells.add(`${cell.col},${cell.row}`);
  });

  // Creature — settles into the patch as the day's memory anchor.
  if (input.creatureVisualKey) {
    objects.push({
      id: `${input.dayId}-creature`,
      kind: 'creature',
      assetKey: `creature:${input.creatureVisualKey}`,
      label: input.creatureName ?? 'Creature',
      col: template.creature.col,
      row: template.creature.row,
      footprint: 1,
    });
  }

  // Tiles — logical grid + flat decals scattered on free ground cells.
  const tiles: WorldTile[] = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const occupied = usedCells.has(`${col},${row}`);
      const decal =
        !occupied && rng() < 0.35 ? theme.decals[Math.floor(rng() * theme.decals.length)] : null;
      tiles.push({ col, row, kind: 'ground', decal });
    }
  }

  return {
    id: `patch-${input.dayId}`,
    dayId: input.dayId,
    isoDate: input.isoDate,
    name: pickName(theme, rng),
    primaryArchetype: primary,
    secondaryArchetype: secondary,
    size: 4,
    tiles,
    objects,
    memoryNodes,
    creatureId: input.creatureId,
    creatureVisualKey: (input.creatureVisualKey as WorldPatch['creatureVisualKey']) ?? null,
    creatureName: input.creatureName,
    rarity: input.rarity,
    gridCol: 0,
    gridRow: 0,
    connectorSides: [],
  };
}

// Map a hydrated day to the generator's pure input. Reads only fields that exist
// on a hatched HomeDayRecord.
export function buildPatchInputFromDay(day: HomeDayRecord): PatchInput {
  const creature = day.creature;
  const meaningfulCaptured = (day.capturedMeanings ?? []).filter(
    (meaning) => meaning.archetype === 'meaningful'
  ).length;
  const meaningfulPrompts = (day.promptAnswers ?? []).filter(
    (answer) => answer.kind === 'meaning' || answer.kind === 'meaningful_photo'
  ).length;
  const meaningfulCount = meaningfulCaptured + meaningfulPrompts;
  const socialMoments = (day.moments ?? []).filter((moment) => moment.type === 'social').length;
  const peoplePrompts = (day.promptAnswers ?? []).filter((answer) => answer.kind === 'people').length;
  const primaryPlace =
    day.dayMap?.nodes?.[0]?.type && day.dayMap.nodes[0].type !== 'unknown'
      ? day.dayMap.nodes[0].type
      : day.locations?.find((loc) => loc.type !== 'unknown')?.type ?? null;

  return {
    dayId: day.id,
    isoDate: day.isoDate,
    nonce: day.storedNonce ?? day.id,
    signals: {
      scores: day.scores,
      rarity: creature?.rarity ?? null,
      livingFactorCount: creature?.livingFactors?.length ?? 0,
      meaningfulCount,
    },
    creatureId: creature?.id ?? null,
    creatureVisualKey: (creature?.visualKey as string) ?? null,
    creatureName: creature?.name ?? null,
    rarity: creature?.rarity ?? null,
    heroPhotoThumb: day.heroPhoto?.thumbnailUri ?? day.capturedMeanings?.[0]?.thumbnailUri ?? null,
    heroMeaningLabel:
      day.heroPhoto?.meaningLabels?.[0] ?? day.capturedMeanings?.[0]?.label ?? null,
    primaryPlaceLabel: primaryPlace ? primaryPlace[0].toUpperCase() + primaryPlace.slice(1) : null,
    newPlaceCount: day.newPlaceCount ?? 0,
    stepsCount: day.stepsCount ?? 0,
    socialCount: socialMoments + peoplePrompts,
    isMeaningful: meaningfulCount > 0,
    timeLabel: day.dateLabel ?? null,
  };
}
