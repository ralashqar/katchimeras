import type { HomeDayRecord } from '@/types/home';
import {
  capabilityBlocksQuest,
  type QuestCapabilityId,
  type QuestCapabilityMap,
} from '@/utils/capabilities/quest-capabilities';
import type { Facts } from '@/utils/signals/facts';
import { evaluateCriterion } from '@/utils/signals/facts';

import { questDefinition, type QuestDefinition } from './definitions';

export type QuestRuntimeState =
  | 'complete'
  | 'in_progress'
  | 'blocked_permission'
  | 'unavailable'
  | 'impossible_today';

export type QuestNextAction =
  | 'take_photo'
  | 'enable_photos'
  | 'enable_camera'
  | 'enable_location'
  | 'enable_travel_memory'
  | 'record_voice'
  | 'add_note'
  | 'open_health'
  | 'confirm_place'
  | 'none';

export type QuestRuntimeCriterion = {
  label: string;
  done: boolean;
  evidenceIds: string[];
  confidence: number | null;
  reason: string | null;
  current?: number | null;
  target?: number | null;
  unit?: string | null;
  progressRatio?: number | null;
  progressLabel?: string | null;
};

export type QuestRuntimeStatus = {
  questId: string;
  state: QuestRuntimeState;
  complete: boolean;
  progress: QuestRuntimeCriterion[];
  matchedEvidenceIds: string[];
  confidence: number | null;
  missingCapabilities: QuestCapabilityId[];
  nextAction: QuestNextAction;
  userMessage: string;
  debugReason: string;
};

type EvaluateQuestRuntimeInput = {
  questId: string;
  day?: HomeDayRecord | null;
  facts: Partial<Facts>;
  capabilities?: QuestCapabilityMap | null;
};

export function evaluateQuestRuntime(input: EvaluateQuestRuntimeInput): QuestRuntimeStatus {
  const def = questDefinition(input.questId);
  if (!def) {
    return unknownQuest(input.questId);
  }

  const capabilityStatus = evaluateCapabilities(def, input);
  if (capabilityStatus) {
    return {
      questId: def.id,
      state: capabilityStatus.state,
      complete: false,
      progress: [],
      matchedEvidenceIds: [],
      confidence: null,
      missingCapabilities: capabilityStatus.missing,
      nextAction: capabilityStatus.action,
      userMessage: capabilityStatus.message,
      debugReason: capabilityStatus.debugReason,
    };
  }

  const progress = def.criteria.map<QuestRuntimeCriterion>((criterion) => {
    const result = evaluateCriterion(criterion, input.facts);
    const progress = progressForCriterion(criterion, input.facts);
    return {
      label: criterion.label,
      done: result.done,
      evidenceIds: result.evidenceIds,
      confidence: result.confidence,
      reason: result.done ? result.reason : progress?.progressLabel ?? result.reason,
      ...progress,
    };
  });

  const complete = progress.length > 0 && progress.every((criterion) => criterion.done);
  const matchedEvidenceIds = Array.from(new Set(progress.flatMap((criterion) => criterion.evidenceIds)));
  const confidences = progress.map((criterion) => criterion.confidence).filter((value): value is number => value != null);
  const confidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null;
  const missing = progress.find((criterion) => !criterion.done);

  return {
    questId: def.id,
    state: complete ? 'complete' : impossibleToday(def, input.day) ? 'impossible_today' : 'in_progress',
    complete,
    progress,
    matchedEvidenceIds,
    confidence,
    missingCapabilities: [],
    nextAction: complete ? 'none' : nextActionForQuest(def, input),
    userMessage: complete
      ? matchedEvidenceIds.length > 0
        ? 'Matched by today\'s evidence.'
        : 'Quest complete.'
      : missing?.reason ?? def.hint,
    debugReason: complete
      ? `All ${progress.length} criteria passed.`
      : missing?.reason ?? 'At least one criterion is incomplete.',
  };
}

export function isQuestRuntimeComplete(questId: string, facts: Partial<Facts>, capabilities?: QuestCapabilityMap | null): boolean {
  return evaluateQuestRuntime({ questId, facts, capabilities }).complete;
}

function evaluateCapabilities(def: QuestDefinition, input: EvaluateQuestRuntimeInput) {
  const capabilities = input.capabilities ?? null;
  if (!capabilities) return null;
  const required = requiredCapabilitiesForQuest(def);
  for (const id of required) {
    if (id === 'health.steps' && hasUsableStepSignal(def, input)) {
      continue;
    }
    const cap = capabilities[id];
    if (!cap) continue;
    if (cap.status === 'unavailable') {
      return {
        state: 'unavailable' as const,
        missing: [id],
        action: 'none' as const,
        message: cap.unavailableMessage,
        debugReason: `${id} is unavailable.`,
      };
    }
    if (cap.status === 'denied' || cap.status === 'unknown') {
      return {
        state: capabilityBlocksQuest(cap) ? 'blocked_permission' as const : 'blocked_permission' as const,
        missing: [id],
        action: capabilityAction(cap.promptAction),
        message: cap.blockedMessage,
        debugReason: `${id} status is ${cap.status}.`,
      };
    }
  }
  return null;
}

function requiredCapabilitiesForQuest(def: QuestDefinition): QuestCapabilityId[] {
  if (def.requiresCapabilities) return def.requiresCapabilities;
  const family = familyForQuest(def);
  if (family === 'photo' || def.criteria.some((criterion) => criterion.sourceTypes?.includes('photo'))) {
    return ['camera.capture'];
  }
  if (family === 'place' || def.criteria.some((criterion) => criterion.fact === 'places.categories')) {
    return ['location.foreground'];
  }
  if (family === 'movement' || def.criteria.some((criterion) => criterion.fact === 'steps.count')) {
    return ['health.steps'];
  }
  if (family === 'voice') return ['microphone'];
  if (family === 'sleep') return ['health.sleep'];
  return [];
}

function nextActionForQuest(def: QuestDefinition, input: EvaluateQuestRuntimeInput): QuestNextAction {
  const family = familyForQuest(def);
  if (def.suggestedActions?.includes('take_photo') || family === 'photo') return 'take_photo';
  if (family === 'place') return 'confirm_place';
  if (family === 'voice') return 'record_voice';
  if (family === 'note') return 'add_note';
  if (family === 'movement' && hasUsableStepSignal(def, input)) return 'none';
  if (family === 'movement' || family === 'sleep') return 'open_health';
  return 'none';
}

function hasUsableStepSignal(def: QuestDefinition, input: EvaluateQuestRuntimeInput): boolean {
  const stepCriterion = def.criteria.find((criterion) => criterion.fact === 'steps.count');
  if (!stepCriterion) {
    return false;
  }

  const steps = input.facts['steps.count'];
  if (typeof steps !== 'number') {
    return false;
  }

  const target = typeof stepCriterion.value === 'number' ? stepCriterion.value : Number(stepCriterion.value ?? 0);
  return (
    steps > 0 ||
    (target > 0 && steps >= target) ||
    Boolean(input.day?.stepsUpdatedAt) ||
    Boolean(input.day && input.day.stepsCountDayId === input.day.isoDate)
  );
}

function progressForCriterion(
  criterion: QuestDefinition['criteria'][number],
  facts: Partial<Facts>
): Pick<QuestRuntimeCriterion, 'current' | 'target' | 'unit' | 'progressRatio' | 'progressLabel'> | null {
  if (criterion.fact !== 'steps.count' || criterion.op !== 'gte') {
    return null;
  }

  const current = facts['steps.count'];
  const target = typeof criterion.value === 'number' ? criterion.value : Number(criterion.value ?? 0);
  if (typeof current !== 'number' || !Number.isFinite(target) || target <= 0) {
    return null;
  }

  return {
    current,
    target,
    unit: 'steps',
    progressRatio: Math.max(0, Math.min(1, current / target)),
    progressLabel: `${current.toLocaleString()} / ${target.toLocaleString()} steps today`,
  };
}

function familyForQuest(def: QuestDefinition): NonNullable<QuestDefinition['family']> | null {
  if (def.family) return def.family;
  if (def.id.startsWith('quest-photo-')) return 'photo';
  if (def.id.includes('park') || def.id.includes('beach') || def.id.includes('forest') || def.id.includes('garden') || def.id.includes('museum')) {
    return 'place';
  }
  if (def.id.includes('walk')) return 'movement';
  if (def.id.includes('note')) return def.id.includes('celebrate') ? 'voice' : 'note';
  if (def.id.includes('sleep') || def.id.includes('night')) return 'sleep';
  if (def.id.includes('weather')) return 'weather';
  if (def.id.includes('cuisine')) return 'food';
  if (def.id.includes('book') || def.id.includes('film') || def.id.includes('inspiration')) return 'studio';
  return null;
}

function capabilityAction(action: string): QuestNextAction {
  switch (action) {
    case 'enable_photos':
      return 'enable_photos';
    case 'enable_camera':
      return 'enable_camera';
    case 'enable_location':
      return 'enable_location';
    case 'enable_travel_memory':
      return 'enable_travel_memory';
    case 'enable_health':
      return 'open_health';
    case 'enable_microphone':
      return 'record_voice';
    default:
      return 'none';
  }
}

function impossibleToday(def: QuestDefinition, day?: HomeDayRecord | null): boolean {
  if (!day) return false;
  if (day.state === 'hatched') return true;
  if (def.criteria.some((criterion) => criterion.fact === 'capture.earliestHour' && criterion.op === 'lt')) {
    return new Date().getHours() >= Number(def.criteria.find((criterion) => criterion.fact === 'capture.earliestHour')?.value ?? 8);
  }
  return false;
}

function unknownQuest(questId: string): QuestRuntimeStatus {
  return {
    questId,
    state: 'unavailable',
    complete: false,
    progress: [],
    matchedEvidenceIds: [],
    confidence: null,
    missingCapabilities: [],
    nextAction: 'none',
    userMessage: 'This quest is not trackable yet.',
    debugReason: 'Missing quest definition.',
  };
}
