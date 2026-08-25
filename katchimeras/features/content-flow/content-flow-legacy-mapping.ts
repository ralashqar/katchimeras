import { MOSSPROUT_JOURNEY_CAMPAIGN } from '@/constants/mossprout-journey-campaign';
import { journeyDayById } from '@/game/katchimeras/journey-campaign';
import { MOSSPROUT_FTUE_SCRIPT } from '@/features/onboarding/mossprout-ftue-script';
import type { FtueRunState } from '@/features/onboarding/ftue-types';
import type { JourneyDayRecord } from '@/types/relationship-progression';
import type { ContentFlowDefinition, ContentFlowRun } from '@/types/content-flow';

import { compileFtueFlow } from './ftue-flow-adapter';
import { createContentFlowRun, stabilizeContentFlow } from './content-flow-interpreter';
import { compileJourneyDayFlow } from './journey-flow-compiler';

function phaseForNode(definition: ContentFlowDefinition, nodeId: string): ContentFlowRun['phase'] {
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return 'failed_recoverable';
  switch (node.kind) {
    case 'scene': return 'awaiting_input';
    case 'task': return 'awaiting_event';
    case 'effect': return 'awaiting_effect';
    case 'presentation': return 'awaiting_presentation';
    case 'route': return 'awaiting_navigation';
    case 'branch': return 'entering';
    case 'complete': return 'completed';
  }
}

export function migrateFtueRunToContentFlow(legacy: FtueRunState, now = Date.now()): ContentFlowRun {
  const definition = compileFtueFlow(MOSSPROUT_FTUE_SCRIPT);
  const nodeId = definition.nodes.some((node) => node.id === legacy.stepId) ? legacy.stepId : definition.entryNodeId;
  const completed = legacy.status === 'complete' || nodeId === MOSSPROUT_FTUE_SCRIPT.terminalStepId;
  return {
    ...createContentFlowRun(definition, { runId: `flow:${legacy.runId}`, now: Date.parse(legacy.startedAt) || now }),
    executionMode: 'shadow',
    nodeId,
    phase: completed ? 'completed' : phaseForNode(definition, nodeId),
    status: completed ? 'completed' : 'active',
    variables: Object.fromEntries(Object.entries(legacy.answers).flatMap(([key, answer]) => answer.private ? [] : [[key, answer.optionId ?? answer.label]])),
    objectiveProgress: { ...legacy.objectiveProgress },
    updatedAt: Date.parse(legacy.updatedAt) || now,
    completedAt: completed ? Date.parse(legacy.completedAt ?? '') || now : null,
  };
}

function firstStep(record: JourneyDayRecord, kind: 'conversation' | 'questionnaire' | 'merge_orders' | 'resident_discovery' | 'optional_action' | 'complete') {
  const day = journeyDayById(MOSSPROUT_JOURNEY_CAMPAIGN, record.beatId);
  return day?.steps.find((step) => step.kind === kind)?.id ?? null;
}

export function journeyNodeForLegacyRecord(record: JourneyDayRecord): string | null {
  if (record.status === 'complete') return firstStep(record, 'complete');
  if (record.status === 'opening') return firstStep(record, 'conversation');
  if (record.status === 'profile_available') return firstStep(record, 'questionnaire');
  const resident = firstStep(record, 'resident_discovery');
  if (record.status === 'resident_discovery') return resident;
  if (record.status === 'resident_orders') return resident ? `${resident}:orders` : null;
  if (record.status === 'card_reward') return resident ? `${resident}:card-reward` : null;
  const merge = firstStep(record, 'merge_orders');
  if (record.status === 'activity_available' || record.status === 'activity_in_progress') {
    const required = record.activity?.mergeOrderIds ?? (record.activity ? [record.activity.mergeOrderId] : []);
    const served = new Set(record.activity?.servedOrderIds ?? []);
    if (required.length && required.every((id) => served.has(id))) return record.returnConversationId
      ? MOSSPROUT_JOURNEY_CAMPAIGN.days.find((day) => day.id === record.beatId)?.steps.find((step) => step.kind === 'conversation' && step.role === 'resolution')?.id ?? merge
      : merge;
    return merge;
  }
  if (record.status === 'return_available' || record.status === 'resolution_ready' || record.status === 'living') {
    return MOSSPROUT_JOURNEY_CAMPAIGN.days.find((day) => day.id === record.beatId)?.steps.find((step) => step.kind === 'conversation' && step.role === 'resolution')?.id
      ?? firstStep(record, 'optional_action')
      ?? firstStep(record, 'complete');
  }
  return null;
}

export function migrateJourneyRecordToContentFlow(record: JourneyDayRecord, now = Date.now()): ContentFlowRun | null {
  const day = journeyDayById(MOSSPROUT_JOURNEY_CAMPAIGN, record.beatId);
  if (!day) return null;
  const definition = compileJourneyDayFlow(MOSSPROUT_JOURNEY_CAMPAIGN, day);
  const nodeId = journeyNodeForLegacyRecord(record) ?? definition.entryNodeId;
  const completed = record.status === 'complete';
  const run = createContentFlowRun(definition, {
    runId: `flow:${record.id}`,
    variables: { legacyJourneyId: record.id, dayId: record.dayId, matchedCardId: record.matchedCardId },
    now: record.startedAt,
  });
  const objectiveProgress = { ...run.objectiveProgress };
  const mergeNode = definition.nodes.find((node) => node.kind === 'task' && node.taskId === record.activity?.objectiveId);
  if (mergeNode?.kind === 'task') {
    for (const orderId of record.activity?.servedOrderIds ?? []) objectiveProgress[`${mergeNode.id}:${orderId}`] = 1;
  }
  const migrated = {
    ...run,
    executionMode: 'shadow' as const,
    nodeId,
    phase: completed ? 'completed' as const : phaseForNode(definition, nodeId),
    status: completed ? 'completed' as const : 'active' as const,
    objectiveProgress,
    updatedAt: record.completedAt ?? now,
    completedAt: record.completedAt,
  };
  return completed ? migrated : stabilizeContentFlow(definition, migrated, now).run;
}
