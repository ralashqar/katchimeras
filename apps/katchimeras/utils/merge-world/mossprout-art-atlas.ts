import type { ImageSourcePropType } from 'react-native';

import manifest from '@incubator/art-merge-world/generated/mossprout-merge-atlas.json';

const PAGE_SOURCES = {
  core: require('@incubator/art-merge-world/generated/mossprout-merge-core-atlas.webp'),
  progression: require('@incubator/art-merge-world/generated/mossprout-merge-progression-atlas.webp'),
} as const;

type AtlasPageId = keyof typeof PAGE_SOURCES;
type RuntimeEntry = { height: number; page: string; width: number; x: number; y: number };

export type MossproutMergeAtlasDescriptor = {
  atlasSize: number;
  contentSize: number;
  frame: { height: number; width: number; x: number; y: number };
  key: string;
  page: AtlasPageId;
  source: ImageSourcePropType;
};

const entries = manifest.entries as Record<string, RuntimeEntry>;

function descriptor(key: string): MossproutMergeAtlasDescriptor | null {
  const entry = entries[key];
  if (!entry || !(entry.page in PAGE_SOURCES)) return null;
  const page = entry.page as AtlasPageId;
  return {
    atlasSize: manifest.atlasSize,
    contentSize: manifest.contentSize,
    frame: { height: entry.height, width: entry.width, x: entry.x, y: entry.y },
    key,
    page,
    source: PAGE_SOURCES[page],
  };
}

export function mossproutItemAtlasDescriptor(definitionId: string) {
  return descriptor(`item:${definitionId}`);
}

export function mossproutGeneratorAtlasDescriptor(generatorId: string, level: number, mossproutOnboarding: boolean) {
  if (generatorId === 'wild-garden') return descriptor(`generator:wild-garden:${mossproutOnboarding ? 'ftue' : Math.max(1, Math.min(3, level))}`);
  if (generatorId === 'memory-nursery') return descriptor(`generator:memory-nursery:${Math.max(1, Math.min(3, level))}`);
  return null;
}

export function mossproutAtlasPageCacheKey(page: AtlasPageId) {
  return `mossprout-merge-atlas:${page}:v${manifest.version}`;
}

export function mossproutAtlasPagesForArt(itemDefinitionIds: readonly string[], generatorIds: readonly string[]) {
  const pages = new Map<string, ImageSourcePropType>();
  itemDefinitionIds.forEach((id) => {
    const entry = mossproutItemAtlasDescriptor(id);
    if (entry) pages.set(mossproutAtlasPageCacheKey(entry.page), entry.source);
  });
  generatorIds.forEach((id) => {
    const entry = mossproutGeneratorAtlasDescriptor(id, 1, false);
    if (entry) pages.set(mossproutAtlasPageCacheKey(entry.page), entry.source);
  });
  return pages;
}
