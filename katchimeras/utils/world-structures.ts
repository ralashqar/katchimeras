import * as worldStructureLayout from '@/data/world-structure-layout.json';
import type { HomeDayRecord } from '@/types/home';
import type { PatchCell, PatchCellType, WorldObject, WorldObjectCategory } from '@/types/world';
import { editorScaleToAppScale, normalisedBaseToCell } from '@/utils/world-base-projection';

export const WORLD_STRUCTURE_CELLS: { type: PatchCellType; col: number; row: number }[] = [
  { type: 'memory', col: 0, row: 0 },
  { type: 'journey', col: 3, row: 0 },
  { type: 'places', col: 2, row: 0 },
  { type: 'reflection', col: 3, row: 2 },
];

export const WORLD_STRUCTURE_POSITIONS: Partial<Record<WorldObjectCategory, { col: number; row: number }>> = {
  memory: { col: 0, row: 0 },
  notes: { col: 1, row: 0 },
  photos: { col: 0, row: 1 },
  featured: { col: 1, row: 1 },
  places: { col: 2, row: 0 },
  journey: { col: 3, row: 0 },
  sleep: { col: 3, row: 1 },
  reflection: { col: 3, row: 2 },
  mood: { col: 1, row: 3 },
  food: { col: 2, row: 3 },
  studio: { col: 0, row: 2 },
  chronicle: { col: 3, row: 3 },
  quests: { col: 0, row: 3 },
};

type StructureState = {
  assetKey: string;
  label: string;
  sourceLabel: string;
  badge?: number;
  badgeIcon?: string;
  sizeScale?: number;
};

type StructureDefinition = {
  category: WorldObjectCategory;
  kind?: WorldObject['kind'];
  defaultScale?: number;
  resolve: (day: HomeDayRecord, cells: PatchCell[]) => StructureState | null;
};

const LEVEL_SCALE: Record<number, number> = { 0: 0.72, 1: 0.78, 2: 0.92, 3: 1.05, 4: 1.2 };
const CELL_BUILDING_SCALE: Record<PatchCellType, number> = {
  memory: 1.6,
  journey: 0.95,
  places: 1.7,
  reflection: 1.95,
};

const SLEEP_ASSET: Record<string, string> = {
  good: 'sleep_nook_good',
  normal: 'sleep_nook_normal',
  low: 'sleep_nook_low',
};

type MoodMonumentState = 'empty' | 'radiant' | 'light' | 'meh' | 'heavy' | 'stormy';
const MOOD_MONUMENT_ASSET: Record<MoodMonumentState, string> = {
  empty: 'mood_monument_empty',
  radiant: 'mood_monument_radiant',
  light: 'mood_monument_light',
  meh: 'mood_monument_meh',
  heavy: 'mood_monument_heavy',
  stormy: 'mood_monument_stormy',
};
const MOOD_MONUMENT_LABEL: Record<MoodMonumentState, string> = {
  empty: 'Mood Monument',
  radiant: 'Radiant',
  light: 'Light',
  meh: 'Meh',
  heavy: 'Heavy',
  stormy: 'Stormy',
};

const FAMILY_SCALE_FALLBACK_ASSET: Partial<Record<WorldObjectCategory, string>> = {
  memory: 'memory_vault_empty',
  places: 'observatory_empty',
  journey: 'steps_path_1',
  reflection: 'sanctuary_empty',
  sleep: 'sleep_nook_empty',
  mood: 'mood_monument_empty',
  food: 'food_pavilion',
  studio: 'study',
  chronicle: 'home',
  quests: 'quest_board',
  notes: 'notes_stack',
  photos: 'photos_stack',
  featured: 'featured_board',
};

type LayoutPosition = { col?: unknown; row?: unknown; nx?: unknown; ny?: unknown };
type WorldStructureLayout = {
  bounds?: { mode?: unknown };
  positions?: Partial<Record<WorldObjectCategory, LayoutPosition>>;
  scaleByCategory?: Partial<Record<WorldObjectCategory, unknown>>;
  scaleByAssetKey?: Record<string, unknown>;
};

const STRUCTURE_LAYOUT = worldStructureLayout as WorldStructureLayout;

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function resolveStructurePosition(category: WorldObjectCategory): { col: number; row: number } | null {
  const configured = STRUCTURE_LAYOUT.positions?.[category];
  if (configured && finiteNumber(configured.nx) && finiteNumber(configured.ny)) {
    return normalisedBaseToCell(configured.nx, configured.ny);
  }
  if (configured && finiteNumber(configured.col) && finiteNumber(configured.row)) {
    return { col: configured.col, row: configured.row };
  }
  return WORLD_STRUCTURE_POSITIONS[category] ?? null;
}

function resolveStructureScale(category: WorldObjectCategory, assetKey: string, fallback: number): number {
  const usesBackplateScale = STRUCTURE_LAYOUT.bounds?.mode === 'backplate';
  const assetScale = STRUCTURE_LAYOUT.scaleByAssetKey?.[assetKey];
  if (finiteNumber(assetScale) && assetScale > 0) return usesBackplateScale ? editorScaleToAppScale(assetScale) : assetScale;
  const familyFallbackAssetKey = FAMILY_SCALE_FALLBACK_ASSET[category];
  const familyAssetScale =
    familyFallbackAssetKey && familyFallbackAssetKey !== assetKey ? STRUCTURE_LAYOUT.scaleByAssetKey?.[familyFallbackAssetKey] : null;
  if (finiteNumber(familyAssetScale) && familyAssetScale > 0) {
    return usesBackplateScale ? editorScaleToAppScale(familyAssetScale) : familyAssetScale;
  }
  const categoryScale = STRUCTURE_LAYOUT.scaleByCategory?.[category];
  if (finiteNumber(categoryScale) && categoryScale > 0) return usesBackplateScale ? editorScaleToAppScale(categoryScale) : categoryScale;
  return fallback;
}

function cell(cells: PatchCell[], type: PatchCellType): PatchCell {
  const found = cells.find((item) => item.type === type);
  if (!found) {
    const pos = WORLD_STRUCTURE_CELLS.find((item) => item.type === type) ?? WORLD_STRUCTURE_CELLS[0];
    return { ...pos, level: 0, assetKey: null, summaryLabel: '', sourceLabel: type, count: 0 };
  }
  return found;
}

function moodMonumentState(day: HomeDayRecord): MoodMonumentState {
  const latestFeeling = [...(day.promptAnswers ?? [])]
    .reverse()
    .find((answer) => !answer.dismissed && answer.kind === 'feeling' && answer.choiceIds.length > 0);
  const choice = latestFeeling?.choiceIds[0];
  switch (choice) {
    case 'energized':
      return 'radiant';
    case 'good':
    case 'calm':
    case 'loved':
      return 'light';
    case 'meh':
      return 'meh';
    case 'drained':
    case 'low':
      return 'heavy';
    case 'stressed':
      return 'stormy';
    default:
      return 'empty';
  }
}

const STRUCTURES: StructureDefinition[] = [
  {
    category: 'memory',
    resolve: (_day, cells) => {
      const item = cell(cells, 'memory');
      return {
        assetKey: item.assetKey ?? 'memory_vault_empty',
        label: 'Memory Vault',
        sourceLabel: item.summaryLabel || 'A quiet vault, so far',
        badge: item.count,
        sizeScale: item.level === 0 ? 1.16 : (LEVEL_SCALE[item.level] ?? 1) * CELL_BUILDING_SCALE.memory,
      };
    },
  },
  {
    category: 'places',
    resolve: (_day, cells) => {
      const item = cell(cells, 'places');
      return {
        assetKey: item.assetKey ?? 'observatory_empty',
        label: 'Observatory',
        sourceLabel: item.summaryLabel || 'No places yet',
        badge: item.count,
        sizeScale: item.level === 0 ? 1.18 : (LEVEL_SCALE[item.level] ?? 1) * CELL_BUILDING_SCALE.places,
      };
    },
  },
  {
    category: 'journey',
    resolve: (_day, cells) => {
      const item = cell(cells, 'journey');
      const idle = item.level === 0;
      return {
        assetKey: item.assetKey ?? 'steps_path_1',
        label: 'Journey',
        sourceLabel: item.summaryLabel || 'A restful day',
        badge: item.count,
        sizeScale: idle ? 0.72 : (LEVEL_SCALE[item.level] ?? 1) * CELL_BUILDING_SCALE.journey,
      };
    },
  },
  {
    category: 'reflection',
    resolve: (_day, cells) => {
      const item = cell(cells, 'reflection');
      return {
        assetKey: item.assetKey ?? 'sanctuary_empty',
        label: 'Sanctuary',
        sourceLabel: item.summaryLabel || 'Yet to reflect',
        badge: item.count,
        sizeScale: item.level === 0 ? 1.25 : (LEVEL_SCALE[item.level] ?? 1) * CELL_BUILDING_SCALE.reflection,
      };
    },
  },
  {
    category: 'notes',
    defaultScale: 0.95,
    resolve: (day) => {
      const notes = day.notes ?? [];
      if (notes.length === 0) return null;
      return {
        assetKey: 'notes_stack',
        label: 'Notes',
        sourceLabel: `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`,
        badge: notes.length,
        badgeIcon: 'square.and.pencil',
      };
    },
  },
  {
    category: 'photos',
    defaultScale: 0.95,
    resolve: (day) => {
      const photoCount = (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0);
      if (photoCount === 0) return null;
      return {
        assetKey: 'photos_stack',
        label: 'Photos',
        sourceLabel: `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`,
        badge: photoCount,
      };
    },
  },
  {
    category: 'featured',
    defaultScale: 1.25,
    resolve: (day) => {
      const photoCount = (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0);
      if (photoCount === 0 && !day.featuredMemory) return null;
      return {
        assetKey: 'featured_board',
        label: 'Featured',
        sourceLabel: 'Featured memory',
      };
    },
  },
  {
    category: 'sleep',
    defaultScale: 1,
    resolve: (day) => ({
      assetKey: day.sleep ? SLEEP_ASSET[day.sleep.quality] ?? 'sleep_nook_empty' : 'sleep_nook_empty',
      label: 'Sleep',
      sourceLabel: day.sleep ? 'Sleep' : 'Sleep not set yet',
    }),
  },
  {
    category: 'mood',
    defaultScale: 1.16,
    resolve: (day) => {
      const state = moodMonumentState(day);
      return {
        assetKey: MOOD_MONUMENT_ASSET[state],
        label: state === 'empty' ? 'Mood Monument' : `${MOOD_MONUMENT_LABEL[state]} mood`,
        sourceLabel: state === 'empty' ? 'Overall mood' : `Overall mood: ${MOOD_MONUMENT_LABEL[state]}`,
      };
    },
  },
  {
    category: 'food',
    defaultScale: 1.6,
    resolve: (day) => {
      const foods = day.foodMoments ?? [];
      if (foods.length === 0) return null;
      return {
        assetKey: 'food_pavilion',
        label: 'Food Pavilion',
        sourceLabel: `${foods.length} food ${foods.length === 1 ? 'memory' : 'memories'}`,
        badge: foods.length,
      };
    },
  },
  {
    category: 'studio',
    defaultScale: 1.6,
    resolve: (day) => {
      const items = day.studioMoments ?? [];
      if (items.length === 0) return null;
      return {
        assetKey: 'study',
        label: 'Study',
        sourceLabel: `${items.length} ${items.length === 1 ? 'inspiration' : 'inspirations'}`,
        badge: items.length,
      };
    },
  },
  {
    category: 'chronicle',
    defaultScale: 2.1,
    resolve: () => ({
      assetKey: 'home',
      label: 'Home',
      sourceLabel: "The day's story",
    }),
  },
  {
    category: 'quests',
    resolve: () => ({
      assetKey: 'quest_board',
      label: 'Quest Board',
      sourceLabel: 'Ways to grow today',
    }),
  },
];

export function deriveWorldStructureObjects(
  day: HomeDayRecord,
  cells: PatchCell[],
  options: { includeQuestBoard?: boolean } = {}
): WorldObject[] {
  return STRUCTURES.flatMap((definition) => {
    if (definition.category === 'quests' && !options.includeQuestBoard) return [];
    const pos = resolveStructurePosition(definition.category);
    if (!pos) return [];
    const state = definition.resolve(day, cells);
    if (!state) return [];
    const fallbackScale = state.sizeScale ?? definition.defaultScale ?? 1;
    return [
      {
        id: `${day.id}-structure-${definition.category}-${state.assetKey}`,
        kind: definition.kind ?? 'prop',
        assetKey: state.assetKey,
        label: state.label,
        col: pos.col,
        row: pos.row,
        footprint: 1,
        sourceLabel: state.sourceLabel,
        category: definition.category,
        badge: state.badge,
        badgeIcon: state.badgeIcon,
        sizeScale: resolveStructureScale(definition.category, state.assetKey, fallbackScale),
      },
    ];
  });
}
