import { File } from 'expo-file-system';
import type { ImageSourcePropType } from 'react-native';

import { encounterLiveCast, type EncounterCastEntry } from '@/constants/encounter-cast';
import { homeCreatureVisuals } from '@/constants/home-mvp';
import type { HomeVisualKey } from '@/types/home';
import type { KingdomCreature } from '@/types/kingdom';
import { measureImageAlphaBounds } from '@/utils/image-alpha-bounds';
import {
  generateAssetVariants,
  keepCell,
  referenceForSource,
  type AssetLabIteration,
  type AssetLabMode,
  type AssetLabModel,
} from '@/utils/asset-lab';
import {
  KINGDOM_HEX_BASE_TILE_VARIANTS,
  type KingdomHexTileAlphaBounds,
  type KingdomHexTileVariant,
} from '@/utils/world-visuals';

export type KatchimeraTileCandidate = {
  creatureId: string | null;
  name: string;
  visualKey: HomeVisualKey;
  themeLabel: string;
  themePrompt: string;
  source: ImageSourcePropType;
};

const CAST_BY_VISUAL_KEY = new Map<HomeVisualKey, EncounterCastEntry>(
  encounterLiveCast.map((entry) => [entry.visualKey, entry])
);

function assetKeyForTile(visualKey: HomeVisualKey, creatureId?: string | null) {
  return creatureId ? `katchimera-hex-tile-${visualKey}-${creatureId}` : `katchimera-hex-tile-${visualKey}`;
}

export function tileCandidateFromCreature(creature: KingdomCreature): KatchimeraTileCandidate {
  const cast = CAST_BY_VISUAL_KEY.get(creature.visualKey);
  return {
    creatureId: creature.creatureId,
    name: creature.name,
    visualKey: creature.visualKey,
    themeLabel: cast?.categoryLabel ?? creature.name,
    themePrompt: [cast?.categoryLabel, cast?.voice, cast?.seedId].filter(Boolean).join('; '),
    source: homeCreatureVisuals[creature.visualKey].source,
  };
}

export function tileCandidatesFromCast(): KatchimeraTileCandidate[] {
  return encounterLiveCast
    .filter((entry) => homeCreatureVisuals[entry.visualKey])
    .map((entry) => ({
      creatureId: null,
      name: entry.visualKey,
      visualKey: entry.visualKey,
      themeLabel: entry.categoryLabel,
      themePrompt: [entry.categoryLabel, entry.voice, entry.seedId].filter(Boolean).join('; '),
      source: homeCreatureVisuals[entry.visualKey].source,
    }));
}

export function defaultKatchimeraTilePrompt(candidate: KatchimeraTileCandidate): string {
  return [
    `Create a custom resident hex tile for ${candidate.name} (${candidate.visualKey}).`,
    `Theme: ${candidate.themePrompt || candidate.themeLabel}.`,
    'Use the first image as the exact base hex tile geometry, camera angle, depth, edge shape, lighting, and material reference.',
    'Use the second image only as the katchimera identity and style reference; do not draw the katchimera itself.',
    'The tile must align exactly to the base tile footprint and remain a single 1024x1024 square render on a perfectly flat black background.',
    'Design the environment as a themed little habitat with props, trees, ground details, and one small open-roof structure if useful.',
    'If a building exists, place it around the back perimeter of the hex tile with visible low walls and no roof blocking the interior.',
    'Keep the center/front area readable and open so the live katchimera sprite can stand there later.',
    'No text, no numbers, no labels, no UI, no extra character, no separate floating object sheet, no crop outside the hex tile.',
  ].join(' ');
}

export async function generateKatchimeraHexTile(options: {
  candidate: KatchimeraTileCandidate;
  baseTile?: KingdomHexTileVariant;
  prompt?: string;
  mode?: AssetLabMode;
  model?: AssetLabModel;
}): Promise<AssetLabIteration> {
  const base = options.baseTile ?? KINGDOM_HEX_BASE_TILE_VARIANTS[0];
  const reference = await referenceForSource(base.tile.source);
  const guide = await referenceForSource(options.candidate.source);
  return generateAssetVariants({
    assetKey: assetKeyForTile(options.candidate.visualKey, options.candidate.creatureId),
    prompt: options.prompt?.trim() || defaultKatchimeraTilePrompt(options.candidate),
    mode: options.mode ?? '2x2',
    model: options.model ?? 'nano',
    reference,
    guide,
  });
}

export async function keepKatchimeraHexTileCell(options: {
  candidate: KatchimeraTileCandidate;
  cellUrl: string;
  matte: boolean;
}): Promise<{ uri: string; alphaBounds: KingdomHexTileAlphaBounds }> {
  const uri = await keepCell({
    assetKey: assetKeyForTile(options.candidate.visualKey, options.candidate.creatureId),
    cellUrl: options.cellUrl,
    matte: options.matte,
  });
  const alphaBounds = await measureImageAlphaBounds(uri);
  if (!alphaBounds) {
    throw new Error('Could not measure visible bounds for the kept tile.');
  }
  return { uri, alphaBounds };
}

export async function fileExists(uri: string): Promise<boolean> {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}
