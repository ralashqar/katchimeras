import rushTrack from '@/data/content-packs/rush-track.json';
import wanderlingTrail from '@/data/content-packs/wanderling-trail.json';
import type { ContentPack, ContentPackContent } from '@/types/content-pack';

/**
 * Packs that ship inside the app: authored as content packs, played from
 * the first launch with no download. Their art is bundled under the same
 * keys the bundled tables use (a story tile's `alphaBoundsKey` names its
 * bundled hex file, its art sits in `constants/story-tiles/tile-art.ts`),
 * so they carry no `art` map. Every registry reads them before any pack
 * the server or Developer Tools installed; the validator treats what they
 * bring as part of the bundle, so a later pack cannot bring it again.
 */
export const BUNDLED_CONTENT_PACKS: readonly ContentPack[] = [wanderlingTrail as unknown as ContentPack, rushTrack as unknown as ContentPack];

/** The bundled packs' entries of one kind, leaving out one pack (the one being checked against the rest). */
export function bundledPackEntries<K extends keyof ContentPackContent>(kind: K, exceptPackId?: string): readonly NonNullable<ContentPackContent[K]>[number][] {
  return BUNDLED_CONTENT_PACKS.flatMap((pack) => (pack.id === exceptPackId ? [] : (pack[kind] ?? [])) as readonly NonNullable<ContentPackContent[K]>[number][]);
}
