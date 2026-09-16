import Constants from 'expo-constants';

import { CONTENT_SCHEMA_VERSION } from '@/types/content-pack';
import { activeContentPack, primeContentRegistry, registriesBuiltBeforePriming } from './active-pack';
import { applyActiveContentPackArt } from './active-pack-art';
import { loadContentRegistry } from './content-pack-store';
import { appVersionSatisfies } from './pack-window';
import { validateReleaseComposition } from './release';

/**
 * Primes the stored content pack. Imported first of all by the root layout,
 * before anything that builds a registry: registries are module constants,
 * and the pack has to be known when they are. The stored pack was accepted
 * whole when it was activated, so nothing is re-checked here beyond what can
 * change between launches: the app's version, composition and the schema.
 *
 * This module reads native storage and must never be imported by a registry
 * or a test; those use `active-pack.ts` directly.
 */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

const built = registriesBuiltBeforePriming();
if (built.length && __DEV__) console.warn(`[content-packs] primed after these registries were built: ${built.join(', ')}. Import features/content-packs/prime first in app/_layout.tsx.`);

if (!activeContentPack()) {
  const stored = loadContentRegistry();
  // Availability belongs to event instances. Expiry must not make a saved item unknown.
  if (stored.packs.every((record) => record.pack.contentSchemaVersion <= CONTENT_SCHEMA_VERSION
    && appVersionSatisfies(record.pack.minAppVersion, APP_VERSION))
    && !validateReleaseComposition(stored.packs.map((record) => record.pack)).length) {
    primeContentRegistry(stored);
    applyActiveContentPackArt();
  }
}
