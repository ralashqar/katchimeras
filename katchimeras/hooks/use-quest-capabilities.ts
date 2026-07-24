import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  type PermissionResponse,
} from 'expo-audio';

import type { StoredHomeState } from '@/types/home';
import {
  questCapabilitiesFromState,
  questCapabilitiesWithMicrophone,
  type QuestCapabilityMap,
} from '@/utils/capabilities/quest-capabilities';

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

  return {
    capabilities: useMemo(
      () => questCapabilitiesWithMicrophone(baseCapabilities, microphonePermission),
      [baseCapabilities, microphonePermission]
    ),
    refreshMicrophonePermission,
    requestMicrophonePermission,
  };
}
