import type { ActiveContentPack, ContentPack, ContentPackContent, ContentRegistrySnapshot } from '@/types/content-pack';

/**
 * The pack the app is playing, primed once before any registry is built.
 * Registries are module constants evaluated on import, so the pack has to be
 * known first: `features/content-packs/prime.ts` reads the stored pack and
 * primes it as the root layout's very first import. A pack activated later is
 * saved and applied on the next launch (the app reloads itself to get there).
 *
 * Pure: no native modules, so the registries and their tests can import it,
 * and a test can prime a pack before importing a registry.
 */
let snapshot: ContentRegistrySnapshot = { version: 2, revision: 0, packs: [] };
const builtRegistries: string[] = [];
let primed = false;

export function primeActiveContentPack(next: ActiveContentPack | null): void {
  primeContentRegistry({ version: 2, revision: 0, packs: next ? [next] : [] });
}

export function primeContentRegistry(next: ContentRegistrySnapshot): void { snapshot = next; primed = true; }
export function contentRegistrySnapshot(): ContentRegistrySnapshot { return snapshot; }

export function activeContentPack(): ActiveContentPack | null {
  return snapshot.packs.at(-1) ?? null;
}

/** The pack's entries of one kind, or none: what every registry spreads after its bundled entries. */
export function packEntries<K extends keyof ContentPackContent>(kind: K): readonly NonNullable<ContentPackContent[K]>[number][] {
  return snapshot.packs.flatMap((record) => (record.pack[kind] ?? []) as readonly NonNullable<ContentPackContent[K]>[number][]);
}

/**
 * A registry notes that it has been built. Priming after that is too late for
 * it: `prime` warns in development so an import-order regression is seen, not
 * silently played without the pack.
 */
export function markRegistryBuilt(name: string): void {
  if (!primed) builtRegistries.push(name);
}

export function registriesBuiltBeforePriming(): readonly string[] {
  return builtRegistries;
}

/** The pack's id and version as one label, for diagnostics and storage. */
export function contentPackLabel(pack: ContentPack): string {
  return `${pack.id}@${pack.version}`;
}
