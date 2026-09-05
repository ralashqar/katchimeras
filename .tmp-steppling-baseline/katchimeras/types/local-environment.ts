import type { IconSymbolName } from '@/components/ui/icon-symbol';

export type LocalEnvironmentId = 'coffee_cafe' | 'feastle_hearth';

export type LocalEnvironmentDomain = 'coffee' | 'food';

export type LocalEnvironmentStationId = string;

export type LocalEnvironmentStationKind = 'stats' | 'memories' | 'quest' | 'milestones';

export type EnvironmentPoint = { x: number; y: number };

export type EnvironmentHitbox = { x: number; y: number; w: number; h: number };

export type EnvironmentRevealMask =
  | { type: 'rect'; rect?: EnvironmentHitbox; padding?: number }
  | { type: 'polygon'; points: readonly EnvironmentPoint[]; bounds?: EnvironmentHitbox };

export type LocalEnvironmentShadowMode = 'none' | 'baked';

export type LocalEnvironmentStationArt = {
  assetPrefix: string;
  width: number;
  height: number;
  anchorOffset: EnvironmentPoint;
  levels: readonly [string, string, string];
  visibleWhenLevel?: 0 | 1;
  shadowMode?: LocalEnvironmentShadowMode;
};

export type LocalEnvironmentStationDefinition = {
  id: LocalEnvironmentStationId;
  label: string;
  shortLabel: string;
  kind: LocalEnvironmentStationKind;
  icon: IconSymbolName;
  anchor: EnvironmentPoint;
  hitbox: EnvironmentHitbox;
  revealMask?: EnvironmentRevealMask;
  revealObjectAssetKey?: string;
  revealRenderMode?: 'mask' | 'object';
  zIndex: number;
  thresholds: readonly [number, number, number];
  art: LocalEnvironmentStationArt;
};

export type LocalEnvironmentDefinition = {
  id: LocalEnvironmentId;
  domain: LocalEnvironmentDomain;
  title: string;
  subtitle: string;
  ownerSeedIds: readonly string[];
  ownerCreatureIds: readonly string[];
  ownerVisualKeys: readonly string[];
  plate: {
    assetKey: string;
    revealBaseAssetKey?: string;
    fullSceneAssetKey?: string;
    foregroundAssetKey?: string;
    guideAssetKey?: string;
    revealMode?: 'propLayers' | 'fullSceneMasks';
    width: number;
    height: number;
    safeViewport: EnvironmentHitbox;
  };
  creature?: {
    anchor: EnvironmentPoint;
    width: number;
    height: number;
  };
  stations: readonly LocalEnvironmentStationDefinition[];
};

export type LocalEnvironmentStationRuntime = LocalEnvironmentStationDefinition & {
  level: 0 | 1 | 2 | 3;
  value: number;
  valueLabel: string;
  detail: string;
  progressLabel: string;
  entries: { id: string; title: string; subtitle: string; thumbnailUri?: string | null }[];
};

export type LocalEnvironmentRuntime = {
  definition: LocalEnvironmentDefinition;
  stations: LocalEnvironmentStationRuntime[];
};
