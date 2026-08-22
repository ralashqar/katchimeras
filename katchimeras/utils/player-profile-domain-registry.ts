import { getStoredKeys, getStoredRaw, removeStoredValue, setStoredRaw } from '@/utils/app-storage';

const EXACT_PROFILE_KEYS = new Set([
  'katchadeck.onboarding-profile',
  'katchadeck.home-v1',
  'katchadeck.home-v1:active-v1',
  'katchadeck.home-v1:archive-v1',
  'katchadeck.today-patch-v1',
  'katchimeras.ftue-run.v4',
  'katchimeras.first-session.v3',
  'katchimeras.onboarding.recap.v1',
  'katchimeras.relationship-progression-v1',
  'katchimera.wisps.v2',
  'katchimera.wisps.v1',
  'katchimera.scenes.v1',
  'katchimera.essence.v1',
  'katchimera.streak.v1',
  'katchimera.discoveries.v1',
  'katchimera.cosmetics.v1',
  'katchimera.egg-avatar.v3',
  'katchimera.egg-avatar.v2',
  'katchimera.egg-avatar.v1',
  'katchimeras.wardrobe.v1',
  'katchimeras.world-identity.v1',
  'katchadeck.world-v1',
  'katchadeck.world-props-v1',
  'katchadeck.world-decor-v1',
  'katchadeck.kingdom-decor-v1',
  'katchadeck.kingdom-witnessed-v1',
  'katchadeck.kingdom-arrival-pending-v1',
  'katchadeck.residents-witnessed-v1',
  'katchadeck.block-blast-v2',
]);

const PROFILE_KEY_PREFIXES = [
  'katchadeck.companion-',
  'katchadeck.quest-capture-session-',
] as const;

export function isPlayerProfileStorageKey(key: string): boolean {
  return EXACT_PROFILE_KEYS.has(key) || PROFILE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function captureKeyValueProfileDomain(): Record<string, string> {
  return Object.fromEntries(getStoredKeys()
    .filter(isPlayerProfileStorageKey)
    .flatMap((key) => {
      const value = getStoredRaw(key);
      return value == null ? [] : [[key, value]];
    }));
}

export function validateKeyValueProfileDomain(values: Record<string, string>): string[] {
  const errors: string[] = [];
  for (const [key, raw] of Object.entries(values)) {
    if (!isPlayerProfileStorageKey(key)) {
      errors.push(`Unsupported player-profile key: ${key}`);
      continue;
    }
    try {
      JSON.parse(raw);
    } catch {
      errors.push(`Invalid JSON in player-profile key: ${key}`);
    }
  }
  return errors;
}

export function replaceKeyValueProfileDomain(values: Record<string, string>): void {
  getStoredKeys().filter(isPlayerProfileStorageKey).forEach(removeStoredValue);
  Object.entries(values).forEach(([key, value]) => setStoredRaw(key, value));
}

export const PLAYER_PROFILE_STORAGE_KEYS = [...EXACT_PROFILE_KEYS] as readonly string[];

/** Versioned extension point for future player-owned save domains. */
export const PLAYER_PROFILE_DOMAIN_REGISTRY = [
  { id: 'keyValue', schemaVersion: 1, description: 'Player-owned local key/value stores' },
  { id: 'mergeWorld', schemaVersion: 1, description: 'Transactional Merge World SQLite snapshot' },
] as const;
