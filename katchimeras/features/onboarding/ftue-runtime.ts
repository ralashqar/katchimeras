import { useSyncExternalStore } from 'react';

import { createClientId } from '@/utils/client-id';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';

import { MOSSPROUT_FTUE_SCRIPT, mossproutFtueAction, mossproutFtueStep } from './mossprout-ftue-script';
import type { FtueAnswer, FtueCommitReceipt, FtueEvent, FtueEventMatcher, FtueRunState, FtueSurface, FtueSurfaceViewModel } from './ftue-types';

const STORAGE_KEY = 'katchimeras.ftue-run.v4';
const LEGACY_STORAGE_KEY = 'katchimeras.first-session.v3';
const listeners = new Set<() => void>();
let snapshot: FtueRunState | null | undefined;
let migrationNotificationQueued = false;

type LegacyFirstSession = { stage?: 'today' | 'merge' | 'journal_for_energy' | 'complete'; startedAt?: string; mergeInstalled?: boolean };

function freshRun(now = new Date()): FtueRunState {
  return {
    schemaVersion: 5,
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

function publish(next: FtueRunState | null) {
  snapshot = next;
  setStoredJson(STORAGE_KEY, next);
  listeners.forEach((listener) => listener());
  return next;
}

function migrateCurrentScript(run: FtueRunState): FtueRunState {
  const needsThirdEggAnswer = run.status === 'active'
    && run.stepId === 'egg.ready'
    && run.answers['egg.mind.focus'] == null;
  if (run.schemaVersion === 5 && run.scriptVersion === MOSSPROUT_FTUE_SCRIPT.version && !needsThirdEggAnswer) return run;
  const now = new Date().toISOString();
  const removedMergeSteps = new Set(['merge.first', 'merge.flower', 'energy.capture', 'energy.awarded', 'merge.flower_return', 'merge.final']);
  return {
    ...run,
    schemaVersion: 5,
    scriptVersion: MOSSPROUT_FTUE_SCRIPT.version,
    stepId: needsThirdEggAnswer ? 'egg.mind' : removedMergeSteps.has(run.stepId) ? 'merge.seed_drag' : run.stepId,
    updatedAt: now,
    objectiveProgress: run.objectiveProgress ?? {},
  };
}

export function loadFtueRun(): FtueRunState | null {
  if (snapshot === undefined) snapshot = getStoredJson<FtueRunState | null>(STORAGE_KEY, null) ?? migrateLegacy();
  if (snapshot) {
    const migrated = migrateCurrentScript(snapshot);
    if (migrated !== snapshot) {
      snapshot = migrated;
      setStoredJson(STORAGE_KEY, migrated);
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
  void import('./ftue-sync').then(({ flushFtueReceipts }) => flushFtueReceipts()).catch(() => {});
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
  const progressed = publish({
    ...current,
    objectiveProgress: { ...current.objectiveProgress, [progressKey]: Math.min(nextCount, requiredCount) },
    updatedAt: new Date().toISOString(),
  });
  if (nextCount < requiredCount) return progressed;
  return commitFtueAction({
    actionId: edge.commitActionId,
    evidenceRef: evidenceRef ?? `merge-revision:${event.revision}`,
    nextStepId: edge.nextStepId,
  });
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
