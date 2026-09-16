# Verified merge pilot

This is a separate server-owned Chapter Zero board. It never imports, replaces,
or resets the player's existing local world. The endpoint is disabled unless
`VERIFIED_MERGE_PILOT_ENABLED=true`. Do not enable it for production yet.

Build and test from the repository root:

```
npm run test:verified-replay --workspace=katchimeras
```

This builds `generated/replay.mjs` from the real game reducer, generates its
SHA-256 ruleset identity, then exercises the request handler against isolated
PostgreSQL. Generated files are ignored and must be built before deployment.
Deploy migrations through `20260916144019_verified_merge_checkpoints.sql` before
deploying this function. Keep gateway JWT verification enabled. The handler also
resolves the current user with Auth; it never accepts a target account from JSON.

POST requests use the normal user's Authorization header and JSON:

- Begin/reconnect: `{ "operation": "begin", "deviceId": "<device UUID>" }`.
  The server creates initial state and its random seed only if no checkpoint
  exists. Reconnecting the active device renews its 24-hour lease without resetting
  state. Another device receives `device_conflict` and the current epoch.
- Submit: `{ "operation": "submit", "batch": { "rulesetId": "<returned ID>",
  "epoch": 1, "deviceId": "<device UUID>", "fromSequence": 0,
  "actions": [{ "type": "move", "from": 29, "to": 30 }] } }`.
  Persist the entire batch before sending. Retry exactly the same batch after an
  uncertain result. A successful response includes the current checkpoint and
  `acceptedThrough`; an old duplicate returns the latest checkpoint, not the
  older state from that receipt.
- Explicit device recovery uses authenticated RPC `transfer_verified_merge_v1`
  with `new_device_id` and `expected_epoch`. It increments the ownership epoch,
  preserves the last accepted world, and fences all outstanding old-device work.
  A native recovery UI must explain that unsent old-device actions are not moved.
  Never call this automatically merely because another device was detected.

Protocol 1 accepts only Mossprout board move, generator tap, order serve, item
store/restore/sell. It rejects arbitrary save state, privileged story commands,
custom RNG seeds, timestamps inside commands, other boards, and extra command fields.
There are at most 100 actions and 64 KiB per request. Generator randomness is
derived from the server checkpoint seed and global command sequence.

Checkpoints remain pinned to their original bundled ruleset. The build retains
hash-checked native snapshots under `features/live-ops/generated/rulesets` and
generates an explicit worker/native runtime registry. Commit those snapshots and
the native registry; build the worker before deploying. Never delete a deployed
archive while checkpoints still reference it. Unknown IDs fail closed. Begin
reconnects using a matching installed archive; submit dispatches from the loaded
server checkpoint, never from client-supplied code. Existing saves do not switch
rulesets implicitly. Downloaded content packs remain unsupported by this pilot.

New rulesets advertise `replayTiming: 'bounded-action-times-v1'`. These accept an
optional `actionTimes` array alongside `actions`, with one integer timestamp per
action. Values must be nondecreasing and fall between the checkpoint state's
`updatedAt` and the server's current time. Replay uses these times for game state;
event timestamps always use server acceptance time. This bounds the elapsed time
available to a client but does not attest the exact historical moment of play.
A modified client can choose a schedule within that elapsed window; systems
requiring exact timing or stronger competitive guarantees need online authority.

The native queue anchors its elapsed-time estimate to `serverNow` in responses,
preserves that anchor across restarts, and never rewrites submitted timestamps.
A future-time batch fails with `action_time_outside_window` and stays retryable.
Legacy runtimes reject `actionTimes`; untimed batches retain submission-time
semantics. Existing legacy saves therefore retain their old timing until an
explicit checkpoint migration exists. No offline occurrence-time event scoring
or late event-credit policy is introduced.

The commit RPC is service-only. It fences the device and sequence under locks,
then writes event scores, the checkpoint and receipt in one transaction. The
service must always derive `next_state` and `verified_events` through replay;
never forward client values into that RPC.

Still required: physical-device pilot acceptance, broader story/progression command
verification, existing-save migration, remote-content compatibility, real concurrent
Postgres tests, deployed Auth/Edge acceptance and account recovery UX. Existing
paid events remain disabled.
