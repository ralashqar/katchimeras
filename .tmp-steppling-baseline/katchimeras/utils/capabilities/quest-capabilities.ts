import type { StoredHomeState } from '@/types/home';

export type QuestCapabilityId =
  | 'photos.read'
  | 'camera.capture'
  | 'location.foreground'
  | 'location.background'
  | 'health.steps'
  | 'health.routes'
  | 'health.sleep'
  | 'microphone'
  | 'speech.transcription'
  | 'calendar.read'
  | 'appleVision'
  | 'appleFoundation'
  | 'remoteLlm';

export type QuestCapabilityStatus = 'available' | 'granted' | 'denied' | 'unavailable' | 'unknown';

export type QuestCapability = {
  id: QuestCapabilityId;
  status: QuestCapabilityStatus;
  promptAction:
    | 'enable_photos'
    | 'enable_camera'
    | 'enable_location'
    | 'enable_travel_memory'
    | 'enable_health'
    | 'enable_microphone'
    | 'enable_calendar'
    | 'none';
  blockedMessage: string;
  unavailableMessage: string;
};

export type QuestCapabilityMap = Record<QuestCapabilityId, QuestCapability>;
export type RecordingPermissionSnapshot = {
  granted?: boolean;
  status?: string | null;
  canAskAgain?: boolean;
} | null | undefined;

export const QUEST_CAPABILITY_IDS: QuestCapabilityId[] = [
  'photos.read',
  'camera.capture',
  'location.foreground',
  'location.background',
  'health.steps',
  'health.routes',
  'health.sleep',
  'microphone',
  'speech.transcription',
  'calendar.read',
  'appleVision',
  'appleFoundation',
  'remoteLlm',
];

export function defaultQuestCapabilities(): QuestCapabilityMap {
  return {
    'photos.read': capability('photos.read', 'unknown', 'enable_photos', 'Photo access can help check this quest.'),
    'camera.capture': capability('camera.capture', 'available', 'enable_camera', 'Camera access can help complete this quest.'),
    'location.foreground': capability('location.foreground', 'unknown', 'enable_location', 'Location access can help check places.'),
    'location.background': capability('location.background', 'unknown', 'enable_travel_memory', 'Travel Memory can catch places in the background.'),
    'health.steps': capability('health.steps', 'unknown', 'enable_health', 'Health or motion access can help check movement.'),
    'health.routes': capability('health.routes', 'unknown', 'enable_health', 'Health route access can import workout paths.'),
    'health.sleep': capability('health.sleep', 'unknown', 'enable_health', 'Health sleep access can check sleep quests.'),
    microphone: capability('microphone', 'unknown', 'enable_microphone', 'Microphone access is needed for voice quests.'),
    'speech.transcription': capability('speech.transcription', 'unknown', 'enable_microphone', 'Speech transcription can read voice notes.'),
    'calendar.read': capability('calendar.read', 'unknown', 'enable_calendar', 'Calendar access can contextualize quests.'),
    appleVision: capability('appleVision', 'unknown', 'none', 'On-device photo analysis is not available in this build.'),
    appleFoundation: capability('appleFoundation', 'unknown', 'none', 'On-device language intelligence is not available here.'),
    remoteLlm: capability('remoteLlm', 'available', 'none', 'Cloud intelligence is not enabled for this quest.'),
  };
}

export function questCapabilitiesFromState(state: StoredHomeState | null | undefined): QuestCapabilityMap {
  const caps = defaultQuestCapabilities();
  if (!state) return caps;

  caps['location.foreground'] = {
    ...caps['location.foreground'],
    status: state.locationPermission === 'granted' ? 'granted' : state.locationPermission,
  };
  caps['health.steps'] = {
    ...caps['health.steps'],
    status: state.activityPermission === 'granted' ? 'granted' : state.activityPermission,
  };
  caps['health.routes'] = {
    ...caps['health.routes'],
    status: state.healthPermission === 'granted' ? 'granted' : state.healthPermission,
  };
  caps['health.sleep'] = {
    ...caps['health.sleep'],
    status: state.healthPermission === 'granted' ? 'granted' : state.healthPermission,
  };
  return caps;
}

export function questCapabilitiesWithMicrophone(
  capabilities: QuestCapabilityMap,
  permission: RecordingPermissionSnapshot
): QuestCapabilityMap {
  if (!permission) return capabilities;
  const status = microphoneStatusFromPermission(permission);
  return {
    ...capabilities,
    microphone: {
      ...capabilities.microphone,
      status,
    },
    'speech.transcription': {
      ...capabilities['speech.transcription'],
      status: status === 'granted' ? 'available' : status,
    },
  };
}

export function questCapabilitiesWithFoundation(
  capabilities: QuestCapabilityMap,
  available: boolean | null
): QuestCapabilityMap {
  return {
    ...capabilities,
    appleFoundation: {
      ...capabilities.appleFoundation,
      status: available == null ? 'unknown' : available ? 'available' : 'unavailable',
    },
  };
}

export function capabilityBlocksQuest(capability: QuestCapability): boolean {
  return capability.status === 'denied' || capability.status === 'unavailable';
}

export function capabilityCanBePrompted(capability: QuestCapability): boolean {
  return capability.status === 'unknown' || capability.status === 'available';
}

function capability(
  id: QuestCapabilityId,
  status: QuestCapabilityStatus,
  promptAction: QuestCapability['promptAction'],
  blockedMessage: string
): QuestCapability {
  return {
    id,
    status,
    promptAction,
    blockedMessage,
    unavailableMessage: blockedMessage.replace('can help', 'is unavailable and cannot help'),
  };
}

function microphoneStatusFromPermission(permission: NonNullable<RecordingPermissionSnapshot>): QuestCapabilityStatus {
  if (permission.granted) return 'granted';
  if (permission.status === 'granted') return 'granted';
  if (permission.status === 'denied' && permission.canAskAgain === false) return 'denied';
  if (permission.status === 'denied') return 'unknown';
  if (permission.status === 'undetermined') return 'unknown';
  return 'unknown';
}
