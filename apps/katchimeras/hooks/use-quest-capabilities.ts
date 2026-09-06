import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  type PermissionResponse,
} from 'expo-audio';

import type { StoredHomeState } from '@/types/home';
import {
  questCapabilitiesFromState,
  questCapabilitiesWithFoundation,
  questCapabilitiesWithMicrophone,
  type QuestCapabilityMap,
} from '@/utils/capabilities/quest-capabilities';
import { isSemanticQuestVerificationAvailable } from '@/utils/quests/foundation-semantic-verification';

export function useQuestCapabilities(
  state: StoredHomeState | null | undefined,
  options: { refreshMicrophoneOnMount?: boolean } = {},
): {
  capabilities: QuestCapabilityMap;
  refreshMicrophonePermission: () => Promise<PermissionResponse | null>;
  requestMicrophonePermission: () => Promise<PermissionResponse | null>;
} {
  const baseCapabilities = useMemo(() => questCapabilitiesFromState(state), [state]);
  const [microphonePermission, setMicrophonePermission] = useState<PermissionResponse | null>(null);
  const [foundationAvailable, setFoundationAvailable] = useState<boolean | null>(null);

  const refreshMicrophonePermission = useCallback(async () => {
    try {
      const permission = await getRecordingPermissionsAsync();
      setMicrophonePermission(permission);
      return permission;
    } catch {
      return null;
    }
  }, []);

  const requestMicrophonePermission = useCallback(async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      setMicrophonePermission(permission);
      return permission;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (options.refreshMicrophoneOnMount !== false) {
      void refreshMicrophonePermission();
    }
  }, [options.refreshMicrophoneOnMount, refreshMicrophonePermission]);

  useEffect(() => {
    const refresh = () => setFoundationAvailable(isSemanticQuestVerificationAvailable());
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, []);

  return {
    capabilities: useMemo(
      () => questCapabilitiesWithMicrophone(
        questCapabilitiesWithFoundation(baseCapabilities, foundationAvailable),
        microphonePermission
      ),
      [baseCapabilities, foundationAvailable, microphonePermission]
    ),
    refreshMicrophonePermission,
    requestMicrophonePermission,
  };
}
