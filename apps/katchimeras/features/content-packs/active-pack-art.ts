import { registerArtSources } from '@/utils/art-source';
import { registerAlphaBounds, type AlphaBounds } from '@/utils/hex-alpha-bounds';
import { contentRegistrySnapshot } from './active-pack';

/**
 * The active pack's art, made resolvable: every downloaded file under its art
 * key, and every tile's bounds under its art key and its tile key (the
 * `tile:<id>` a story tile names as its `alphaBoundsKey`, the `island:<id>`
 * an island's art is looked up by). Pure, so a test can apply a primed pack.
 */
export function applyActiveContentPackArt(): void {
  const bounds: Record<string, AlphaBounds> = {};
  for (const active of contentRegistrySnapshot().packs) {
    registerArtSources(active.artUris);
    for (const [key, entry] of Object.entries(active.pack.art ?? {})) {
    if (!entry.alphaBounds) continue;
    bounds[key] = entry.alphaBounds;
    bounds[key.replace(/:(full|medium|thumb)$/, '')] = entry.alphaBounds;
    }
  }
  registerAlphaBounds(bounds);
}
