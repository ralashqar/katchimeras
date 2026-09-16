import { initialVerifiedWorld, parseReplayBatch, replayVerifiedBatch, replayTiming, type ReplayCheckpoint } from './replay';

export type ReplayRuntime = {
  rulesetId: string; replayTiming?: string;
  initialVerifiedWorld: typeof initialVerifiedWorld;
  replayVerifiedBatch: typeof replayVerifiedBatch;
};

type Dependencies = {
  rulesetId: string;
  authenticate: (authorization: string) => Promise<string | null>;
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  now?: () => number;
  randomSeed?: () => string;
  rulesets?: readonly ReplayRuntime[];
};
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const device = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function boundedJson(request: Request) {
  if (!request.body) throw new Error('Missing body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) { await reader.cancel(); throw new Error('Body too large'); }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(body));
}

/** Authentication and transport are injected so tests exercise the real request handler. */
export function createReplayHandler(deps: Dependencies) {
  const runtimes = deps.rulesets ?? [{ rulesetId: deps.rulesetId, initialVerifiedWorld, replayVerifiedBatch, replayTiming }];
  const runtimeFor = (id: string) => runtimes.find((runtime) => runtime.rulesetId === id);
  const current = runtimeFor(deps.rulesetId);
  if (!current) throw new Error('Current replay ruleset unavailable');
  const reply = (data: Record<string, unknown>, status = data.ok ? 200 : 409) => json({ ...data, serverNow: (deps.now ?? Date.now)() }, status);
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ ok: false, reason: 'json_required' }, 415);
    const authorization = request.headers.get('authorization');
    if (!authorization) return json({ ok: false, reason: 'authentication_required' }, 401);
    let user: string | null;
    try { user = await deps.authenticate(authorization); } catch { return json({ ok: false, reason: 'authentication_unavailable' }, 503); }
    if (!user) return json({ ok: false, reason: 'authentication_required' }, 401);
    let body: unknown;
    try { body = await boundedJson(request); } catch { return json({ ok: false, reason: 'invalid_request' }, 400); }
    if (!object(body)) return json({ ok: false, reason: 'invalid_request' }, 400);
    const call = async (name: string, args: Record<string, unknown>) => {
      const result = await deps.rpc(name, { ...args, target_user: user });
      if (result.error || !object(result.data)) throw new Error('Checkpoint operation failed');
      return result.data;
    };
    try {
      if (body.operation === 'begin') {
        if (Object.keys(body).some((key) => !['operation', 'deviceId'].includes(key)) || !device(body.deviceId)) return json({ ok: false, reason: 'invalid_request' }, 400);
        const now = (deps.now ?? Date.now)();
        // Existing checkpoints are pinned. A mismatch has no side effects in the RPC;
        // try only server-installed archives, never a client-selected code path or save.
        let data: Record<string, unknown> = { ok: false, reason: 'ruleset_unavailable' };
        for (const runtime of [current, ...runtimes.filter((item) => item !== current)]) {
          data = await call('begin_verified_merge_v1', { device_id: body.deviceId, ruleset_id: runtime.rulesetId,
            initial_state: runtime.initialVerifiedWorld(now), random_seed: (deps.randomSeed ?? (() => crypto.randomUUID()))() });
          if (data.reason !== 'ruleset_unavailable') break;
        }
        return reply(data);
      }
      if (body.operation !== 'submit' || Object.keys(body).some((key) => !['operation','batch'].includes(key))) return json({ ok: false, reason: 'invalid_request' }, 400);
      let batch;
      try { batch = parseReplayBatch(body.batch); } catch { return json({ ok: false, reason: 'invalid_commands' }, 400); }
      if (!device(batch.deviceId)) return json({ ok: false, reason: 'invalid_device' }, 400);
      const loaded = await call('load_verified_merge_v1', { device_id: batch.deviceId, requested_batch: batch });
      if (!loaded.ok) return json(loaded, 409);
      if (loaded.duplicate === true) return reply(loaded);
      const checkpoint = loaded.checkpoint as ReplayCheckpoint;
      const runtime = runtimeFor(checkpoint.rulesetId);
      if (!runtime) return json({ ok: false, reason: 'ruleset_unavailable' }, 409);
      let replayed;
      try { replayed = runtime.replayVerifiedBatch(checkpoint, batch, loaded.serverNow as number); }
      catch (error) { return json({ ok: false, reason: object(error) && error.code === 'action_time_outside_window' ? error.code : 'replay_rejected' }, 409); }
      const committed = await call('commit_verified_merge_v1', { batch, next_state: replayed.state, verified_events: replayed.events });
      return reply(committed);
    } catch { return json({ ok: false, reason: 'checkpoint_conflict_or_unavailable' }, 409); }
  };
}
