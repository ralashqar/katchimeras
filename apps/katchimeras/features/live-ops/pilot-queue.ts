import type { ReplayBatch, ReplayCheckpoint, VerifiedBoardAction } from './replay';

type Pending = { batch: ReplayBatch; phase: 'draft' | 'submitted'; previewTime: number };
export type PilotDocument = {
  version: 2; accountId: string; deviceId: string; checkpoint: ReplayCheckpoint | null;
  pending: Pending | null; recovery: number | null; archived: Pending[];
  queued: Pending[];
  reconciliation: { reason: string; preview: ReplayCheckpoint['state'] } | null;
  clock?: { serverNow: number; deviceNow: number };
};
export type PilotReply = { ok: boolean; reason?: string; epoch?: number; checkpoint?: ReplayCheckpoint; acceptedThrough?: number; serverNow?: number };
export class PilotError extends Error {
  constructor(public reply: PilotReply) {
    super(reply.reason === 'action_time_outside_window'
      ? 'Queued time is outside the server window. Moves are preserved; check the device clock and retry when server time catches up.'
      : reply.reason ?? 'Invalid pilot response');
  }
}
type Dependencies = {
  read: () => string | null; write: (value: string) => void;
  begin: () => Promise<PilotReply>; submit: (batch: ReplayBatch) => Promise<PilotReply>;
  transfer: (epoch: number) => Promise<PilotReply>; rulesetId: string;
  predict: (checkpoint: ReplayCheckpoint, batch: ReplayBatch, now: number) => { state: ReplayCheckpoint['state'] };
  supportsRuleset?: (id: string) => boolean;
  supportsTiming?: (id: string) => boolean;
  now?: () => number;
};
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function checkpoint(value: ReplayCheckpoint | undefined): asserts value is ReplayCheckpoint {
  if (!value || !Number.isSafeInteger(value.sequence) || value.sequence < 0 || !Number.isSafeInteger(value.epoch)
    || value.epoch < 1 || !value.deviceId || !value.rulesetId || !value.seed || !Array.isArray(value.state?.board)
    || !Array.isArray(value.state.storage) || !Number.isSafeInteger(value.state.updatedAt)) throw new Error('Invalid checkpoint');
}

/** One atomic envelope per account. Persist before sending; never rebase uncertain work. */
export function createPilotQueue(accountId: string, deviceId: string, deps: Dependencies) {
  const now = deps.now ?? Date.now;
  const supports = deps.supportsRuleset ?? ((id: string) => id === deps.rulesetId);
  const raw = deps.read();
  const loaded = raw === null ? null : JSON.parse(raw);
  if (raw !== null && (!loaded || typeof loaded !== 'object' || Array.isArray(loaded))) throw new Error('Invalid saved pilot queue; recovery required');
  // Upgrade in memory first; the next atomic write persists v2 without changing submitted bytes.
  let document: PilotDocument = loaded === null
    ? { version: 2, accountId, deviceId, checkpoint: null, pending: null, recovery: null, archived: [], queued: [], reconciliation: null }
    : loaded.version === 1 ? { ...loaded, version: 2, queued: [], reconciliation: null }
    : loaded;
  if (document.version !== 2 || document.accountId !== accountId || document.deviceId !== deviceId
    || !Array.isArray(document.archived) || !Array.isArray(document.queued) || !('reconciliation' in document)
    || !('checkpoint' in document) || !('pending' in document) || !('recovery' in document)) throw new Error('Invalid saved pilot queue; recovery required');
  if (document.checkpoint !== null) checkpoint(document.checkpoint);
  if (document.checkpoint && !supports(document.checkpoint.rulesetId)) throw new Error('Saved pilot needs its original ruleset; queue preserved');
  if (document.clock && (!Number.isSafeInteger(document.clock.serverNow) || !Number.isSafeInteger(document.clock.deviceNow))) throw new Error('Invalid saved clock anchor');
  if (document.recovery !== null && (!Number.isSafeInteger(document.recovery) || document.recovery < 1)) throw new Error('Invalid saved recovery');
  const projections = new WeakMap<PilotDocument, ReplayCheckpoint | null>();
  function batches(value = document) { return value.pending ? [value.pending, ...value.queued] : []; }
  function project(value = document) {
    if (projections.has(value)) return projections.get(value)!;
    let cp = value.checkpoint;
    for (const p of batches(value)) {
      if (!cp) throw new Error('Missing base checkpoint');
      const result = deps.predict(cp, p.batch, Math.max(cp.state.updatedAt, p.previewTime));
      cp = { ...cp, sequence: cp.sequence + p.batch.actions.length, state: result.state };
    }
    projections.set(value, cp);
    return cp;
  }
  if (!document.pending && document.queued.length) throw new Error('Missing queue head');
  for (const [index, p] of batches().entries()) {
    if (!document.checkpoint || !['draft', 'submitted'].includes(p.phase) || !Number.isSafeInteger(p.previewTime)
      || (index > 0 && p.phase !== 'draft')) throw new Error('Invalid pending pilot batch');
  }
  if (document.reconciliation) {
    if (!document.pending || typeof document.reconciliation.reason !== 'string' || !Array.isArray(document.reconciliation.preview?.board)) throw new Error('Invalid saved reconciliation');
  } else project();
  let busy = false;
  function save(next: PilotDocument) {
    deps.write(JSON.stringify(next));
    document = clone(next);
    if (projections.has(next)) projections.set(document, projections.get(next)!);
  }
  function own(reply: PilotReply) {
    if (!reply || typeof reply.ok !== 'boolean') throw new Error('Invalid pilot response');
    if (!reply.ok) throw new PilotError(reply);
    checkpoint(reply.checkpoint);
    const cp = reply.checkpoint;
    if (cp.deviceId !== deviceId || !supports(cp.rulesetId)) throw new Error('Device or ruleset mismatch');
    if (document.checkpoint && (cp.sequence < document.checkpoint.sequence || cp.epoch < document.checkpoint.epoch)) throw new Error('Checkpoint moved backwards');
    return cp;
  }
  function clockFor(reply: PilotReply, cp: ReplayCheckpoint) {
    return { serverNow: Number.isSafeInteger(reply.serverNow) ? Math.max(cp.state.updatedAt, reply.serverNow!) : cp.state.updatedAt, deviceNow: now() };
  }
  async function exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (busy) throw new Error('Pilot operation already running');
    busy = true;
    try { return await work(); } finally { busy = false; }
  }
  async function submitHead() {
    if (document.recovery !== null || document.reconciliation) throw new Error('Resolve recovery or reconciliation first');
    if (!document.pending) return;
    save({ ...document, pending: { ...document.pending, phase: 'submitted' } });
    const batch = clone(document.pending!.batch);
    const reply = await deps.submit(batch);
    const cp = own(reply);
    const through = batch.fromSequence + batch.actions.length;
    if (reply.acceptedThrough !== through || cp.sequence < through || cp.epoch !== batch.epoch
      || (document.queued.length > 0 && cp.sequence !== through)) throw new Error('Invalid batch receipt');
    // Read the latest envelope: the player may have appended more work during the request.
    const next: PilotDocument = { ...document, clock: clockFor(reply, cp), checkpoint: cp, pending: document.queued[0] ?? null, queued: document.queued.slice(1) };
    try { project(next); }
    catch {
      next.reconciliation = { reason: 'Server state differs from the local prediction. Later commands are preserved for review.', preview: project()!.state };
    }
    save(next);
  }
  return {
    snapshot: () => clone(document),
    preview: () => clone(document.reconciliation?.preview ?? project()?.state ?? null),
    enqueue(action: VerifiedBoardAction) {
      if (document.recovery !== null || document.reconciliation) throw new Error('Resolve recovery or reconciliation first');
      const cp = document.checkpoint;
      if (!cp || !supports(cp.rulesetId)) throw new Error('Connect a compatible checkpoint first');
      const all = clone(batches());
      const tail = all[all.length - 1];
      const projected = project()!;
      const timed = deps.supportsTiming?.(cp.rulesetId) ?? false;
      const append = tail?.phase === 'draft' && tail.batch.actions.length < 100 && Boolean(tail.batch.actionTimes) === timed;
      const anchor = document.clock ?? { serverNow: cp.state.updatedAt, deviceNow: now() };
      // Advisory schedule within server-observed elapsed time, not proof of event eligibility.
      const actionNow = timed ? Math.max(projected.state.updatedAt, anchor.serverNow + Math.max(0, now() - anchor.deviceNow)) : Math.max(now(), projected.state.updatedAt);
      const pending: Pending = append ? tail : { phase: 'draft', previewTime: actionNow,
        batch: { rulesetId: cp.rulesetId, epoch: cp.epoch, deviceId, fromSequence: projected.sequence, actions: [], ...(timed ? { actionTimes: [] } : {}) } };
      pending.batch.actions.push(clone(action));
      if (timed) { pending.batch.actionTimes!.push(actionNow); pending.previewTime = actionNow; }
      if (!append) all.push(pending);
      const next = { ...document, pending: all[0], queued: all.slice(1) };
      // Apply just this command to the cached prediction. Long offline sessions must
      // not replay their entire history on every tap. Reload/ack still verify the chain.
      const result = deps.predict(projected, { ...pending.batch, fromSequence: projected.sequence, actions: [clone(action)], ...(timed ? { actionTimes: [actionNow] } : {}) },
        Math.max(projected.state.updatedAt, pending.previewTime));
      projections.set(next, { ...projected, sequence: projected.sequence + 1, state: result.state });
      save(next);
    },
    connect: () => exclusive(async () => {
      const reply = await deps.begin();
      const cp = own(reply);
      if (document.pending && cp.epoch !== document.pending.batch.epoch) throw new PilotError({ ok: false, reason: 'device_conflict', epoch: cp.epoch });
      // A lost response can make the server newer than our base. Only the exact receipt may clear it.
      if (document.recovery === null) save({ ...document, clock: clockFor(reply, cp), ...(!document.pending ? { checkpoint: cp } : {}) });
    }),
    submit: () => exclusive(submitHead),
    // Bounded drain: newly appended batches wait for the next sync, avoiding an endless request loop.
    sync: () => exclusive(async () => {
      const count = batches().length;
      for (let index = 0; index < count; index++) await submitHead();
    }),
    recover: (expectedEpoch: number) => exclusive(async () => {
      if (!Number.isSafeInteger(expectedEpoch) || expectedEpoch < 1) throw new Error('Invalid recovery epoch');
      if (document.pending && expectedEpoch <= document.pending.batch.epoch) throw new Error('Retry the submission first; its ownership has not been fenced');
      if (document.recovery !== null && document.recovery !== expectedEpoch) throw new Error('Finish existing recovery first');
      const resuming = document.recovery !== null;
      save({ ...document, recovery: expectedEpoch });
      // A transfer may have succeeded before its response was lost. Confirm ownership before retrying.
      let reply = resuming ? await deps.begin() : null;
      if (!reply?.ok) reply = await deps.transfer(expectedEpoch);
      const cp = own(reply);
      if (cp.epoch < expectedEpoch) throw new Error('Recovery ownership is stale');
      save({ ...document, clock: clockFor(reply, cp), checkpoint: cp, recovery: null, pending: null, queued: [], reconciliation: null,
        archived: [...document.archived, ...batches()] });
    }),
  };
}
export type PilotQueue = ReturnType<typeof createPilotQueue>;
