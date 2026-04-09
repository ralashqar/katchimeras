import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { createClientId } from '@/utils/client-id';

const LOCAL_TEST_PLAYER_KEY = 'katchadeck.local-test-player';

type LocalTestPlayerProfile = {
  playerId: string;
  createdAt: string;
};

function createPlayerProfile(): LocalTestPlayerProfile {
  return {
    playerId: createClientId('player'),
    createdAt: new Date().toISOString(),
  };
}

export function getOrCreateLocalTestPlayerProfile() {
  const stored = getStoredJson<LocalTestPlayerProfile | null>(LOCAL_TEST_PLAYER_KEY, null);

  if (stored?.playerId) {
    return stored;
  }

  const nextProfile = createPlayerProfile();
  setStoredJson(LOCAL_TEST_PLAYER_KEY, nextProfile);
  return nextProfile;
}

export function getOrCreateLocalTestPlayerId() {
  return getOrCreateLocalTestPlayerProfile().playerId;
}
