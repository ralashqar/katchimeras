import { useSyncExternalStore } from 'react';

import { createClientId } from '@/utils/client-id';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { dispatchFtueActionToContentFlow, dispatchFtueEventToContentFlow } from '@/features/content-flow/ftue-content-flow-runtime';
import { completeDayOneLesson } from '@/game/katchimeras/action-runtime';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';

import { MOSSPROUT_FTUE_SCRIPT, mossproutFtueAction, mossproutFtueStep } from './mossprout-ftue-script';
import { ftueNeedsV28QuestionnaireRestart, ftueV28QuestionnaireLoopRecoveryStep } from './ftue-migration-policy';
import { activeFtueNavigationPolicy } from './ftue-navigation-policy';
import type {
  FtueAnswer,
  FtueCommitReceipt,
  FtueEvent,
  FtueEventMatcher,
  FtueNavigationDirective,
  FtueRunState,
  FtueStepDefinition,
  FtueSurface,
  FtueSurfaceViewModel,
} from './ftue-types';

const STORAGE_KEY = 'katchimeras.ftue-run.v4';
const LEGACY_STORAGE_KEY = 'katchimeras.first-session.v3';
const listeners = new Set<() => void>();
let snapshot: FtueRunState | null | undefined;
let migrationNotificationQueued = false;
let durableAdvanceQueue: Promise<unknown> = Promise.resolve();

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

export async function flushFtuePersistence() {
  // FTUE checkpoints use expo-sqlite's synchronous localStorage adapter, so
  // there is no second writer to flush. Keep this boundary async for callers
  // that atomically pair it with domain repositories and Content Flow.
  await Promise.resolve();
}

function publish(next: FtueRunState | null) {
  // `expo-sqlite/localStorage` is synchronous. Write through before publishing
  // the new snapshot so a process kill immediately after a CTA can never
  // restore the destination route with the previous FTUE node. The async
  // Content Flow is journaled separately by the durable route-boundary API.
  setStoredJson(STORAGE_KEY, next);
  snapshot = next;
  listeners.forEach((listener) => listener());
  return next;
}

function scheduleReceiptSync() {
  void import('./ftue-sync').then(({ scheduleFtueReceiptSync }) => scheduleFtueReceiptSync()).catch(() => {});
}

function migrateCurrentScript(run: FtueRunState): FtueRunState {
  // The life-companion pivot intentionally restarts unfinished prototype FTUE
  // runs at the Haven. This resets only the guided run; saved life captures and
  // source photos remain untouched in their existing repositories.
  if (run.status === 'active' && run.scriptVersion < 32) {
    return freshRun(new Date(run.startedAt));
  }
  const replayDreamMistChapter = run.scriptVersion < 10;
  const restartingLegacyMerge = run.status === 'active'
    && run.scriptVersion < 7
    && run.stepId.startsWith('merge.');
  const mistakenParallelOpeningStep = run.status === 'active' ? ({
    'egg.companion_goal': 'egg.opening',
    'egg.support_need': 'egg.context',
    'egg.notice_focus': 'egg.mind',
  } as const)[run.stepId as 'egg.companion_goal' | 'egg.support_need' | 'egg.notice_focus'] ?? null : null;
  const questionnaireLoopRecoveryStep = ftueV28QuestionnaireLoopRecoveryStep(run);
  const rewrittenEggQuestionnaireNeedsRestart = ftueNeedsV28QuestionnaireRestart(run);
  const replacementOpeningStep = mistakenParallelOpeningStep
    ?? questionnaireLoopRecoveryStep
    ?? (rewrittenEggQuestionnaireNeedsRestart ? MOSSPROUT_FTUE_SCRIPT.entryStepId : null);
  const needsHavenFocus = run.status === 'active'
    && run.scriptVersion < 15
    && run.stepId === 'haven.mossprout.restore';
  const hasHavenRevealReceipt = run.receipts.some((receipt) => receipt.actionId === 'haven.reveal_world');
  const needsV33FirstBloomBridge = run.status === 'active'
    && run.scriptVersion === 32
    && run.stepId === 'haven.reveal'
    && !hasHavenRevealReceipt;
  const needsResidentParcelConfirmation = run.status === 'active'
    && run.scriptVersion < 21
    && run.stepId === 'merge.resident_parcel';
  if (run.schemaVersion === 6 && run.scriptVersion === MOSSPROUT_FTUE_SCRIPT.version && !replacementOpeningStep) return run;
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
  const replacedDiscoverySteps = new Set(['discovery.steppling.seed', 'discovery.steppling.sprout', 'discovery.steppling.plant']);
  const replacedWorldEntrySteps = new Set([
    'haven.home_notice',
    'haven.mossprout_focus',
    'haven.mossprout_reveal',
  ]);
  const removedEggInspectSteps = new Set(['grove.egg_inspect']);
  const replacedWorldCompletionSteps = new Set(['haven.reveal', 'haven.mossprout.focus', 'haven.mossprout.restore']);
  const migratedStepId = needsV33FirstBloomBridge
    ? 'companion.resident_parcel_ready'
    : needsResidentParcelConfirmation
    ? 'companion.resident_parcel_ready'
    : needsHavenFocus
    ? 'companion.meditating'
    : run.status === 'active' && run.stepId === 'chapter.complete'
      ? 'merge.return_note'
      : run.status === 'active' && run.stepId === 'world.complete'
        ? 'companion.meditating'
        : run.stepId;
  const removedFrictionSteps = new Set(['haven.first_bloom']);
  return {
    ...run,
    schemaVersion: 6,
    scriptVersion: MOSSPROUT_FTUE_SCRIPT.version,
    stepId: replacementOpeningStep
      ? replacementOpeningStep
      : restartingLegacyMerge
        ? 'companion.order_preview'
        : replacedDiscoverySteps.has(migratedStepId)
          ? 'discovery.steppling.parcel'
          : replacedWorldEntrySteps.has(migratedStepId)
            ? 'world.egg_intro'
            : removedEggInspectSteps.has(migratedStepId)
              ? 'egg.opening'
            : replacedWorldCompletionSteps.has(migratedStepId)
              ? 'companion.meditating'
              : removedFrictionSteps.has(migratedStepId)
                ? 'companion.resident_parcel_ready'
                : removedMergeSteps.has(migratedStepId) ? 'merge.seed_drag' : migratedStepId,
    updatedAt: now,
    objectiveProgress: restartingLegacyMerge ? {} : run.objectiveProgress ?? {},
    mergeInstalled: restartingLegacyMerge ? false : run.mergeInstalled,
  };
}

export function loadFtueRun(): FtueRunState | null {
  if (snapshot === undefined) {
    const stored = getStoredJson<FtueRunState | null>(STORAGE_KEY, null);
    snapshot = stored ?? migrateLegacy();
    if (!stored && snapshot) {
      setStoredJson(STORAGE_KEY, snapshot);
    }
  }
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

/**
 * Releases every FTUE-owned surface through one idempotent terminal write.
 *
 * A completion acknowledgement may already have a committed receipt after a
 * process interruption or script migration. Replaying that action is then a
 * no-op, so terminal UI must not rely on the receipt alone to release routing.
 */
export function completeFtueRun() {
  const current = loadFtueRun();
  if (!current) return null;
  if (current.status === 'complete' && current.stepId === MOSSPROUT_FTUE_SCRIPT.terminalStepId) return current;
  const completedAt = new Date().toISOString();
  return publish({
    ...current,
    stepId: MOSSPROUT_FTUE_SCRIPT.terminalStepId,
    status: 'complete',
    completedAt,
    updatedAt: completedAt,
  });
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
  const complete = targetStepId === MOSSPROUT_FTUE_SCRIPT.terminalStepId;
  return publish({
    ...current,
    stepId: targetStepId,
    status: complete ? 'complete' : current.status,
    completedAt: complete ? new Date().toISOString() : current.completedAt,
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
  /** Reserved for the durable route-boundary wrapper. */
  skipContentFlowDispatch?: boolean;
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
  if (input.actionId === 'companion.complete_day_one_action') {
    relationshipProgressionRepository.update((relationships) => completeDayOneLesson(relationships, {
      completedAt: Date.parse(now),
      flowRunId: current.runId,
    }));
  }
  if (!input.skipContentFlowDispatch) {
    void dispatchFtueActionToContentFlow(current, input.actionId, next?.stepId ?? nextStepId);
  }
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
  if (matcher.type === 'arrival_claimed' && event.type === 'arrival_claimed') {
    return (matcher.arrivalId == null || matcher.arrivalId === event.arrivalId)
      && (!matcher.residentDiscovery || event.residentDiscoveryId != null);
  }
  if (matcher.type === 'companion_discovery_advanced' && event.type === 'companion_discovery_advanced') {
    return (matcher.discoveryId == null || matcher.discoveryId === event.discoveryId)
      && (matcher.stage == null || matcher.stage === event.stage)
      && (matcher.completedCharacterId == null || matcher.completedCharacterId === event.completedCharacterId);
  }
  if (matcher.type === 'resident_card_revealed' && event.type === 'resident_card_revealed') {
    return (matcher.discoveryId == null || matcher.discoveryId === event.discoveryId)
      && (matcher.residentId == null || matcher.residentId === event.residentId);
  }
  if (matcher.type === 'resident_dialogue_acknowledged' && event.type === 'resident_dialogue_acknowledged') return matcher.discoveryId == null || matcher.discoveryId === event.discoveryId;
  if (matcher.type === 'resident_card_reveal_acknowledged' && event.type === 'resident_card_reveal_acknowledged') return matcher.discoveryId == null || matcher.discoveryId === event.discoveryId;
  if (matcher.type === 'ui_target_pressed' && event.type === 'ui_target_pressed') {
    return matcher.target == null || JSON.stringify(matcher.target) === JSON.stringify(event.target);
  }
  if (matcher.type === 'haven_upgrade_completed' && event.type === 'haven_upgrade_completed') {
    return (matcher.characterId == null || matcher.characterId === event.characterId)
      && (matcher.stage == null || matcher.stage === event.stage);
  }
  return matcher.type === 'order_served'
    && event.type === 'order_served'
    && (matcher.orderId == null || matcher.orderId === event.orderId)
    && (!matcher.residentDiscovery || event.residentDiscoveryId != null);
}

export type DurableFtueAdvanceResult = {
  advanced: boolean;
  run: FtueRunState | null;
  step: FtueStepDefinition | null;
  resume: FtueNavigationDirective['resume'] | null;
};

/**
 * The only supported boundary for an FTUE action that changes routes.
 *
 * The legacy snapshot is written through synchronously, its queued native
 * write is flushed, and the Content Flow journal is confirmed before the
 * caller receives a navigation intent. Repeated taps return the current run
 * without advancing a second time.
 */
export function advanceFtueActionDurably(input: {
  expectedStepId: string;
  actionId: string;
  optionId?: string | null;
  optionLabel?: string | null;
  private?: boolean;
  evidenceRef?: string | null;
  nextStepId?: string;
}): Promise<DurableFtueAdvanceResult> {
  const operation = durableAdvanceQueue.then(async () => {
    const before = loadFtueRun();
    if (!before || before.status !== 'active') {
      return { advanced: false, run: before, step: null, resume: null };
    }
    if (before.stepId !== input.expectedStepId) {
      const step = mossproutFtueStep(before.stepId) ?? null;
      return { advanced: false, run: before, step, resume: activeFtueNavigationPolicy(before)?.resume ?? null };
    }
    const next = commitFtueAction({ ...input, skipContentFlowDispatch: true });
    await flushFtuePersistence();
    if (next) await dispatchFtueActionToContentFlow(before, input.actionId, next.stepId);
    const persisted = loadFtueRun();
    const step = persisted?.status === 'active' ? mossproutFtueStep(persisted.stepId) ?? null : null;
    return {
      advanced: Boolean(persisted && persisted.stepId !== before.stepId),
      run: persisted,
      step,
      resume: activeFtueNavigationPolicy(persisted)?.resume ?? null,
    };
  });
  durableAdvanceQueue = operation.then(() => undefined, () => undefined);
  return operation;
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
    const pending = publish({ ...current, objectiveProgress, updatedAt: now });
    void dispatchFtueEventToContentFlow(current, event, pending?.stepId ?? current.stepId);
    return pending;
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
  void dispatchFtueEventToContentFlow(current, event, next?.stepId ?? nextStepId);
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
  const companionGoal = run?.answers['egg.day_texture'] ?? run?.answers['egg.support_style'] ?? run?.answers['egg.desired_feeling'] ?? run?.answers['egg.companion_goal'];
  const context = run?.answers['egg.context.activity'];
  const opening = Object.values(run?.answers ?? {}).find((answer) => answer.actionId.startsWith('egg.') && !answer.private);
  const id = companionGoal?.optionId ?? context?.optionId ?? opening?.optionId;
  const lines: Record<string, string> = {
    trying_to_start: 'I felt that in there—like a little root pushing against hard soil.',
    too_much_at_once: 'I felt the rain drumming on my shell. We can hold one small piece at a time.',
    pretty_good: 'I felt that warm patch of sunlight. I think it helped me hatch.',
    mostly_drifting: 'I felt the breeze carrying us. Drifting can still bring you somewhere new.',
    more_calm: 'You wanted more calm. We can grow it one small piece at a time.',
    more_energy: 'You wanted more energy. This garden definitely does too.',
    something_new: 'You wanted something new. Well… this is pretty new.',
    more_confidence: 'You wanted more confidence. I can cheer for every brave little step.',
    more_fun: 'You wanted more fun. Gardens are very good at tiny surprises.',
    more_connection: 'You wanted more connection. I am glad we found each other.',
    calm: 'You wanted a little calm. We can grow it one small piece at a time.',
    encouragement: 'You wanted a little push. I can cheer for the small steps.',
    fun: 'You wanted more fun. Gardens are very good at tiny surprises.',
    company: 'You wanted someone to share with. I am glad I found you.',
    discovery: 'You like small discoveries. I think we will get along.',
    outside: 'You were outside today? I think we are going to get along.', family: 'You spent time with your people today? I like that.',
    tired: 'Sounds like today took a bit out of you. We can start small.', rough: 'That sounds like a hard day. We can start gently.',
    friends: 'Friends were part of today? That sounds like good growing weather.', relaxing: 'A quiet day can still grow into something lovely.',
    work: 'You have already been working today. Let us make something small together.', home: 'Home sounds like a good place for us to begin.',
  };
  return id && lines[id] ? lines[id] : 'I felt those little pieces of your day. I think this is a good place to begin.';
}

export function ftuePersonalizationKey(run = loadFtueRun()) {
  const companionGoal = run?.answers['egg.day_texture'] ?? run?.answers['egg.support_style'] ?? run?.answers['egg.desired_feeling'] ?? run?.answers['egg.companion_goal'];
  const context = run?.answers['egg.context.activity'];
  const opening = Object.values(run?.answers ?? {}).find((answer) => answer.actionId.startsWith('egg.') && !answer.private);
  const id = companionGoal?.optionId ?? context?.optionId ?? opening?.optionId ?? 'default';
  return ['trying_to_start', 'too_much_at_once', 'pretty_good', 'mostly_drifting', 'more_energy', 'more_calm', 'something_new', 'more_confidence', 'more_fun', 'more_connection', 'calm', 'encouragement', 'fun', 'company', 'discovery', 'outside', 'family', 'friends', 'relaxing', 'work', 'tired', 'rough', 'home'].includes(id)
    ? id
    : 'default';
}

export function ftueWispForRun(run = loadFtueRun()) {
  const answer = run?.answers['egg.day_texture'] ?? run?.answers['egg.support_style'] ?? run?.answers['egg.desired_feeling'] ?? run?.answers['egg.context.activity'] ?? Object.values(run?.answers ?? {}).find((item) => !item.private);
  if (answer?.optionId === 'more_connection' || answer?.optionId === 'family' || answer?.optionId === 'friends' || answer?.optionId === 'people') return 'heartlet';
  if (answer?.optionId === 'more_calm' || answer?.optionId === 'relaxing' || answer?.optionId === 'rest') return 'moonlit';
  return 'sprout';
}
