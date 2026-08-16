import { useSyncExternalStore } from 'react';

import { createClientId } from '@/utils/client-id';
import { getStoredJson, setStoredJsonAsync } from '@/utils/app-storage';

import { MOSSPROUT_FTUE_SCRIPT, mossproutFtueAction, mossproutFtueStep } from './mossprout-ftue-script';
import type { FtueAnswer, FtueCommitReceipt, FtueEvent, FtueEventMatcher, FtueRunState, FtueSurface, FtueSurfaceViewModel } from './ftue-types';

const STORAGE_KEY = 'katchimeras.ftue-run.v4';
const LEGACY_STORAGE_KEY = 'katchimeras.first-session.v3';
const listeners = new Set<() => void>();
let snapshot: FtueRunState | null | undefined;
let migrationNotificationQueued = false;
let pendingPersistence: FtueRunState | null | undefined;
let persistenceWorker: Promise<void> | null = null;

type LegacyFirstSession = { stage?: 'today' | 'merge' | 'journal_for_energy' | 'complete'; startedAt?: string; mergeInstalled?: boolean };

function freshRun(now = new Date()): FtueRunState {
  return {
    schemaVersion: 6,
    runId: createClientId('ftue'),
    scriptId: MOSSPROUT_FTUE_SCRIPT.id,
    scriptVersion: MOSSPROUT_FTUE_SCRIPT.version,
    stepId: MOSSPROUT_FTUE_SCRIPT.entryStepId,
    status: 'active',
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: null,
    answers: {},
    receipts: [],
    mergeInstalled: false,
    awardedMergeEnergy: null,
    objectiveProgress: {},
  };
}

function migrateLegacy(): FtueRunState | null {
  const legacy = getStoredJson<LegacyFirstSession | null>(LEGACY_STORAGE_KEY, null);
  if (!legacy) return null;
  const run = freshRun(new Date(legacy.startedAt ?? Date.now()));
  run.mergeInstalled = Boolean(legacy.mergeInstalled);
  if (legacy.stage === 'merge') run.stepId = 'merge.seed_drag';
  if (legacy.stage === 'journal_for_energy') run.stepId = 'merge.seed_drag';
  if (legacy.stage === 'complete') {
    run.stepId = 'complete';
    run.status = 'complete';
    run.completedAt = new Date().toISOString();
  }
  return run;
}

function enqueuePersistence(next: FtueRunState | null) {
  pendingPersistence = next;
  if (persistenceWorker) return;
  persistenceWorker = (async () => {
    while (pendingPersistence !== undefined) {
      const value = pendingPersistence;
      pendingPersistence = undefined;
      await setStoredJsonAsync(STORAGE_KEY, value);
    }
  })().catch(() => {
    // The in-memory run remains authoritative for this session. Merge-domain
    // recovery reconstructs missed observed events after an interrupted write.
  }).finally(() => {
    persistenceWorker = null;
    if (pendingPersistence !== undefined) enqueuePersistence(pendingPersistence);
  });
}

export async function flushFtuePersistence() {
  while (persistenceWorker || pendingPersistence !== undefined) {
    if (!persistenceWorker && pendingPersistence !== undefined) enqueuePersistence(pendingPersistence);
    await persistenceWorker;
  }
}

function publish(next: FtueRunState | null) {
  snapshot = next;
  enqueuePersistence(next);
  listeners.forEach((listener) => listener());
  return next;
}

function scheduleReceiptSync() {
  void import('./ftue-sync').then(({ scheduleFtueReceiptSync }) => scheduleFtueReceiptSync()).catch(() => {});
}

function migrateCurrentScript(run: FtueRunState): FtueRunState {
  const replayDreamMistChapter = run.scriptVersion < 10;
  const restartingLegacyMerge = run.status === 'active'
    && run.scriptVersion < 7
    && run.stepId.startsWith('merge.');
  const needsThirdEggAnswer = run.status === 'active'
    && run.stepId === 'egg.ready'
    && run.answers['egg.mind.focus'] == null;
  if (run.schemaVersion === 6 && run.scriptVersion === MOSSPROUT_FTUE_SCRIPT.version && !needsThirdEggAnswer) return run;
  const now = new Date().toISOString();
  if (replayDreamMistChapter) return {
    ...run,
    schemaVersion: 6,
    runId: createClientId('ftue'),
    scriptVersion: MOSSPROUT_FTUE_SCRIPT.version,
    stepId: 'companion.order_preview',
    status: 'active',
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    receipts: [],
    mergeInstalled: false,
    awardedMergeEnergy: null,
    objectiveProgress: {},
  };
  const removedMergeSteps = new Set(['merge.first', 'merge.flower', 'energy.capture', 'energy.awarded', 'merge.flower_return', 'merge.final']);
  const migratedStepId = run.status === 'active' && run.stepId === 'chapter.complete'
    ? 'merge.return_note'
    : run.stepId;
  return {
    ...run,
    schemaVersion: 6,
    scriptVersion: MOSSPROUT_FTUE_SCRIPT.version,
    stepId: needsThirdEggAnswer
      ? 'egg.mind'
      : restartingLegacyMerge
        ? 'companion.order_preview'
        : removedMergeSteps.has(migratedStepId) ? 'merge.seed_drag' : migratedStepId,
    updatedAt: now,
    objectiveProgress: restartingLegacyMerge ? {} : run.objectiveProgress ?? {},
    mergeInstalled: restartingLegacyMerge ? false : run.mergeInstalled,
  };
}

export function loadFtueRun(): FtueRunState | null {
  if (snapshot === undefined) snapshot = getStoredJson<FtueRunState | null>(STORAGE_KEY, null) ?? migrateLegacy();
  if (snapshot) {
    const migrated = migrateCurrentScript(snapshot);
    if (migrated !== snapshot) {
      snapshot = migrated;
      enqueuePersistence(migrated);
      if (!migrationNotificationQueued) {
        migrationNotificationQueued = true;
        queueMicrotask(() => {
          migrationNotificationQueued = false;
          listeners.forEach((listener) => listener());
        });
      }
    }
  }
  return snapshot;
}

export function beginFtueRun(options: { restart?: boolean } = {}) {
  const current = loadFtueRun();
  if (current && !options.restart) return current;
  return publish(freshRun())!;
}

export function updateFtueRun(patch: Partial<Pick<FtueRunState, 'stepId' | 'status' | 'completedAt' | 'mergeInstalled' | 'awardedMergeEnergy'>>) {
  const current = loadFtueRun();
  if (!current) return null;
  return publish({ ...current, ...patch, updatedAt: new Date().toISOString() });
}

/**
 * Records the amount of matching board evidence that already existed when an
 * observed FTUE node became active. Recovery may only count evidence created
 * after this point. This prevents an item carried between tutorial beats from
 * satisfying the next beat merely because the Merge screen remounted.
 */
export function registerFtueObjectiveBaseline(stepId: string, actionId: string, value: number) {
  const current = loadFtueRun();
  if (!current || current.status !== 'active' || current.stepId !== stepId) return current;
  const key = `baseline:${stepId}:${actionId}`;
  if (current.objectiveProgress[key] != null) return current;
  return publish({
    ...current,
    objectiveProgress: { ...current.objectiveProgress, [key]: Math.max(0, Math.floor(value)) },
    updatedAt: new Date().toISOString(),
  });
}

/** Rewinds a known-invalid authored transition while preserving the run. */
export function repairFtueStep(expectedStepId: string, targetStepId: string) {
  const current = loadFtueRun();
  if (!current || current.status !== 'active' || current.stepId !== expectedStepId || !mossproutFtueStep(targetStepId)) return current;
  const receipts = current.receipts.filter((receipt) => receipt.stepId !== targetStepId);
  const objectiveProgress = Object.fromEntries(Object.entries(current.objectiveProgress)
    .filter(([key]) => !key.includes(`${targetStepId}:`)));
  return publish({
    ...current,
    stepId: targetStepId,
    receipts,
    objectiveProgress,
    updatedAt: new Date().toISOString(),
  });
}

export function beginFtueAction(actionId: string): FtueCommitReceipt | null {
  const current = loadFtueRun();
  if (!current || current.status === 'complete') return null;
  const action = mossproutFtueAction(current.stepId, actionId);
  const step = mossproutFtueStep(current.stepId);
  if (!action || !step) return null;
  const existing = current.receipts.find((receipt) => receipt.actionId === actionId && receipt.stepId === current.stepId);
  if (existing) return existing;
  const receipt: FtueCommitReceipt = {
    clientEventId: `${current.runId}:${actionId}`,
    actionId,
    stepId: current.stepId,
    scriptId: current.scriptId,
    scriptVersion: current.scriptVersion,
    surface: step.surface,
    status: 'pending',
    startedAt: new Date().toISOString(),
    committedAt: null,
    presentedAt: null,
    evidenceRef: null,
    syncAttempts: 0,
    syncedAt: null,
  };
  publish({ ...current, receipts: [...current.receipts, receipt], updatedAt: receipt.startedAt });
  return receipt;
}

export function commitFtueAction(input: {
  actionId: string;
  optionId?: string | null;
  optionLabel?: string | null;
  private?: boolean;
  evidenceRef?: string | null;
  nextStepId?: string;
}) {
  const started = beginFtueAction(input.actionId);
  const current = loadFtueRun();
  if (!started || !current) return current;
  if (started.status !== 'pending') return current;
  const action = mossproutFtueAction(started.stepId, input.actionId);
  if (!action) return current;
  const now = new Date().toISOString();
  const isPrivate = Boolean(input.private);
  const answer: FtueAnswer | null = input.optionId !== undefined || isPrivate ? {
    actionId: input.actionId,
    optionId: isPrivate ? null : input.optionId ?? null,
    label: isPrivate ? null : input.optionLabel ?? null,
    private: isPrivate,
    committedAt: now,
  } : null;
  const receipts = current.receipts.map((receipt) => receipt.clientEventId === started.clientEventId ? {
    ...receipt,
    status: 'committed' as const,
    committedAt: now,
    evidenceRef: input.evidenceRef ?? null,
  } : receipt);
  const nextStepId = input.nextStepId ?? action.nextStepId ?? current.stepId;
  const complete = nextStepId === MOSSPROUT_FTUE_SCRIPT.terminalStepId;
  const next = publish({
    ...current,
    stepId: nextStepId,
    status: complete ? 'complete' : current.status,
    completedAt: complete ? now : current.completedAt,
    answers: answer ? { ...current.answers, [input.actionId]: answer } : current.answers,
    receipts,
    updatedAt: now,
  });
  scheduleReceiptSync();
  return next;
}

function ftueEventMatches(matcher: FtueEventMatcher, event: FtueEvent) {
  if (matcher.type !== event.type) return false;
  if (matcher.type === 'merge_completed' && event.type === 'merge_completed') {
    return (matcher.fromInstanceId == null || matcher.fromInstanceId === event.fromInstanceId)
      && (matcher.targetInstanceId == null || matcher.targetInstanceId === event.targetInstanceId)
      && (matcher.resultDefinitionId == null || matcher.resultDefinitionId === event.resultDefinitionId);
  }
  if (matcher.type === 'item_spawned' && event.type === 'item_spawned') {
    return (matcher.generatorId == null || matcher.generatorId === event.generatorId)
      && (matcher.definitionId == null || matcher.definitionId === event.definitionId);
  }
  if (matcher.type === 'dream_echo_cleared' && event.type === 'dream_echo_cleared') {
    return (matcher.echoId == null || matcher.echoId === event.echoId)
      && (matcher.resultDefinitionId == null || matcher.resultDefinitionId === event.resultDefinitionId);
  }
  if (matcher.type === 'chat_note_opened' && event.type === 'chat_note_opened') {
    return matcher.noteId == null || matcher.noteId === event.noteId;
  }
  return matcher.type === 'order_served'
    && event.type === 'order_served'
    && (matcher.orderId == null || matcher.orderId === event.orderId);
}

export function dispatchFtueEvent(event: FtueEvent, evidenceRef?: string) {
  const current = loadFtueRun();
  if (!current || current.status !== 'active') return current;
  const step = mossproutFtueStep(current.stepId);
  const edge = step?.edges?.find((candidate) => ftueEventMatches(candidate.event, event));
  if (!edge) return current;
  const progressKey = `${current.stepId}:${edge.commitActionId}`;
  const nextCount = (current.objectiveProgress[progressKey] ?? 0) + 1;
  const requiredCount = Math.max(1, edge.requiredCount ?? 1);
  const now = new Date().toISOString();
  const objectiveProgress = {
    ...current.objectiveProgress,
    [progressKey]: Math.min(nextCount, requiredCount),
  };
  if (nextCount < requiredCount) {
    return publish({ ...current, objectiveProgress, updatedAt: now });
  }

  const action = mossproutFtueAction(current.stepId, edge.commitActionId);
  if (!action) return current;
  const existing = current.receipts.find((receipt) => (
    receipt.actionId === edge.commitActionId && receipt.stepId === current.stepId
  ));
  if (existing) return current;
  const receipt: FtueCommitReceipt = {
    clientEventId: `${current.runId}:${edge.commitActionId}`,
    actionId: edge.commitActionId,
    stepId: current.stepId,
    scriptId: current.scriptId,
    scriptVersion: current.scriptVersion,
    surface: step!.surface,
    status: 'committed',
    startedAt: now,
    committedAt: now,
    presentedAt: null,
    evidenceRef: evidenceRef ?? `merge-revision:${event.revision}`,
    syncAttempts: 0,
    syncedAt: null,
  };
  const nextStepId = edge.nextStepId ?? action.nextStepId ?? current.stepId;
  const complete = nextStepId === MOSSPROUT_FTUE_SCRIPT.terminalStepId;
  const next = publish({
    ...current,
    stepId: nextStepId,
    status: complete ? 'complete' : current.status,
    completedAt: complete ? now : current.completedAt,
    objectiveProgress,
    receipts: [...current.receipts, receipt],
    updatedAt: now,
  });
  scheduleReceiptSync();
  return next;
}

export function markFtueReceiptPresented(actionId: string) {
  const current = loadFtueRun();
  if (!current) return null;
  const now = new Date().toISOString();
  const receipts = current.receipts.map((receipt) => receipt.actionId === actionId && receipt.status === 'committed'
    ? { ...receipt, status: 'presented' as const, presentedAt: now }
    : receipt);
  return publish({ ...current, receipts, updatedAt: now });
}

export function markFtueReceiptSynced(clientEventId: string, attempts: number) {
  const current = loadFtueRun();
  if (!current) return null;
  const now = new Date().toISOString();
  const receipts = current.receipts.map((receipt) => receipt.clientEventId === clientEventId
    ? { ...receipt, syncAttempts: attempts, syncedAt: now }
    : receipt);
  return publish({ ...current, receipts, updatedAt: now });
}

export function noteFtueSyncAttempt(clientEventId: string) {
  const current = loadFtueRun();
  if (!current) return null;
  const receipts = current.receipts.map((receipt) => receipt.clientEventId === clientEventId
    ? { ...receipt, syncAttempts: receipt.syncAttempts + 1 }
    : receipt);
  return publish({ ...current, receipts, updatedAt: new Date().toISOString() });
}

export function jumpFtueToStep(stepId: string) {
  if (!mossproutFtueStep(stepId)) return loadFtueRun();
  return updateFtueRun({ stepId, status: stepId === 'complete' ? 'complete' : 'active', completedAt: stepId === 'complete' ? new Date().toISOString() : null });
}

export function useFtueRun() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, loadFtueRun, loadFtueRun);
}

export function ftueSurfaceView(surface: FtueSurface): FtueSurfaceViewModel {
  const run = loadFtueRun();
  const step = run?.status === 'active' ? mossproutFtueStep(run.stepId) : null;
  const active = Boolean(run && step && step.surface === surface);
  return { active, run, step: active ? step : null, guide: active ? step!.guide : null, actions: active ? step!.actions : [], blockingBeat: active ? step!.blockingBeat ?? null : null };
}

export function useFtueSurface(surface: FtueSurface) {
  useFtueRun();
  return ftueSurfaceView(surface);
}

export function ftuePersonalizedLine(run = loadFtueRun()) {
  const context = run?.answers['egg.context.activity'];
  const opening = Object.values(run?.answers ?? {}).find((answer) => answer.actionId.startsWith('egg.') && !answer.private);
  const id = context?.optionId ?? opening?.optionId;
  const lines: Record<string, string> = {
    outside: 'You were outside today? I think we are going to get along.', family: 'You spent time with your people today? I like that.',
    tired: 'Sounds like today took a bit out of you. We can start small.', rough: 'That sounds like a hard day. We can start gently.',
    friends: 'Friends were part of today? That sounds like good growing weather.', relaxing: 'A quiet day can still grow into something lovely.',
    work: 'You have already been working today. Let us make something small together.', home: 'Home sounds like a good place for us to begin.',
  };
  return id && lines[id] ? lines[id] : 'I felt those little pieces of your day. I think this is a good place to begin.';
}

export function ftuePersonalizationKey(run = loadFtueRun()) {
  const context = run?.answers['egg.context.activity'];
  const opening = Object.values(run?.answers ?? {}).find((answer) => answer.actionId.startsWith('egg.') && !answer.private);
  const id = context?.optionId ?? opening?.optionId ?? 'default';
  return ['outside', 'family', 'friends', 'relaxing', 'work', 'tired', 'rough', 'home'].includes(id)
    ? id
    : 'default';
}

export function ftueWispForRun(run = loadFtueRun()) {
  const answer = run?.answers['egg.context.activity'] ?? Object.values(run?.answers ?? {}).find((item) => !item.private);
  if (answer?.optionId === 'family' || answer?.optionId === 'friends' || answer?.optionId === 'people') return 'heartlet';
  if (answer?.optionId === 'relaxing' || answer?.optionId === 'rest') return 'moonlit';
  return 'sprout';
}
