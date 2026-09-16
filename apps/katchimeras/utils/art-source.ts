/**
 * Art by key, from wherever it is. Bundled art is a `require()` Metro
 * resolved at build time; art a content pack brought is a file the app
 * downloaded, named by the same key. Every table of bundled art asks here
 * first, so a pack can add or replace a tile, a cut-out, an item, a wisp or
 * a creature without a build. Pure: no native modules, so the registries and
 * their tests can import it.
 *
 * Keys: `tile:<tileId>:full|medium|thumb`, `island:<islandId>[:level:<n>]:full|medium|thumb`,
 * `cutout:<companion>`, `creature:<visualKey>`, `item:<definitionId>`, `wisp:<wispId>[:thumb]`,
 * and any world asset key `worldAssetSource` is asked for.
 */

/** A source both React Native's and expo-image's `Image` accept: a bundled module id or a file/URL. */
export type ArtSource = number | { uri: string };

export type ArtSourceSet = { full: ArtSource; medium: ArtSource; thumb: ArtSource };

const registered = new Map<string, ArtSource>();

/** Registers art by key; a string is a file or URL. Later registrations replace earlier ones. */
export function registerArtSources(entries: Readonly<Record<string, string | ArtSource>>): void {
  for (const [key, value] of Object.entries(entries)) registered.set(key, typeof value === 'string' ? { uri: value } : value);
}

export function unregisterArtSources(keys: readonly string[]): void {
  for (const key of keys) registered.delete(key);
}

export function clearArtSources(): void {
  registered.clear();
}

/** Registered art by key, or null: the caller falls back to its bundled table. */
export function artSource(key: string): ArtSource | null {
  return registered.get(key) ?? null;
}

export function hasArtSource(key: string): boolean {
  return registered.has(key);
}

/** A tile's three sizes under one prefix; `full` is required, the smaller sizes fall back to it. */
export function artSourceSet(prefix: string): ArtSourceSet | null {
  const full = registered.get(`${prefix}:full`);
  if (!full) return null;
  return { full, medium: registered.get(`${prefix}:medium`) ?? full, thumb: registered.get(`${prefix}:thumb`) ?? full };
}

export const artKeys = {
  tile: (tileId: string, lod: 'full' | 'medium' | 'thumb') => `tile:${tileId}:${lod}`,
  island: (islandId: string, level: number | null, lod: 'full' | 'medium' | 'thumb') => (level ? `island:${islandId}:level:${level}:${lod}` : `island:${islandId}:${lod}`),
  cutout: (companion: string) => `cutout:${companion}`,
  creature: (visualKey: string) => `creature:${visualKey}`,
  item: (definitionId: string) => `item:${definitionId}`,
  wisp: (wispId: string, thumbnail: boolean) => (thumbnail ? `wisp:${wispId}:thumb` : `wisp:${wispId}`),
} as const;
