# Live operations implementation

Implementation of the September 2026 progression/live-ops plan. Existing player
saves and the in-progress content-pack work are the compatibility baseline.

## Delivery order

1. Content release lifecycle: immutable manifests, composition, compatibility,
   retained ownership, safe activation, validation and regression tests.
2. Durable gameplay actions, reward receipts, Harmony and event projections.
3. Account checkpoints, verified server scoring and complete commerce delivery.
4. Generic campaign/world definitions and a non-destructive incursion overlay.
5. Designer authoring, staged publishing and the Moonlit Mist pilot.
6. Native end-to-end acceptance, observability and controlled rollout.

## Product defaults

- Generators remain unlimited. Energy/cooldown products remain disabled.
- Core merge and downloaded story work offline; verified event claims are online.
- Health/journal activities are optional accelerators, never purchase pressure.
- Glow is spendable; Harmony is cumulative world progress.
- Content expiry never deletes earned possessions or world restoration.
- Cloud saves use one active device; private journal/photo data stays local.
- Paid event products remain disabled until server verification, purchase and
  reward-delivery acceptance tests pass.

## Validation baseline

Before implementation: app typecheck and 16 focused content-pack, predicate,
mission, Journey-trigger and season tests passed. The linked database and native
purchase configuration have not been independently verified. The content-pack
runbook reports migration-history drift; reconcile that before deployment.

## Implemented foundation

- Schema 2 composes multiple packs, validates dependencies, collisions and
  cross-pack references before activation, and commits one stored release pointer.
  The previous single-pack record migrates on read. Identical refreshes are a
  no-op. Retirement retains definitions and art for existing saves.
- Mission validation uses the candidate item catalogue without first mutating
  the running registry. New merge chains can therefore be validated before install.
- Successful merge/order actions and world milestone facts are journalled in the
  same SQLite transaction as the world snapshot. Buffered writes retain every
  action. IDs deduplicate retries; historical milestones backfill Harmony without
  scoring current events. Each installed active event has an independent capped
  projection, with action/context filters and separate scoring/claim windows.
- Journey chapters support validated linear continuations with stable saved
  episode IDs. An unfinished rest remains pinned to its original chapter.
- A SQL migration adds multi-pack release delivery and transactional RevenueCat
  receipt/Plus updates. Failed processing can retry, older events cannot replace
  newer entitlements, and only service_role can process purchase events. The
  webhook calls this transaction; reconciliation reports failed writes.
- Local Live Ops Studio authors, validates, saves/reloads, exports and simulates
  event drafts. Optional staging inserts disabled releases. Start from the root
  with `npm run live-ops:studio`; see `tooling/live-ops-studio/README.md`.

## Explicitly not complete

This is the foundation, not the full playable/monetized vertical slice.

1. A restricted server-owned board replay pilot now produces verified actions
   (details below). Native outbox integration, general story/progression commands
   and existing-save migration remain incomplete. The observational local journal
   must never directly authorize rewards. No journal compaction yet.
2. Production account recovery/checkpoints and the one-active-device policy.
   Existing developer snapshots are not a production cloud-save implementation.
3. Durable Bond, Wisp, Journey and expedition action producers; these kinds are
   accepted by the rule engine but are not yet wired to their source stores.
4. Generic regions/rescue arcs/eras and configurable Harmony awards. Existing
   milestone adapters still use the Grove world model and fixed initial awards.
5. A playable incursion layer, completion persistence and permanent keepsake
   delivery. Only the pure non-destructive overlay selector exists.
6. Seasonal player UI, the authored Moonlit campaign, premium pass/offer ladder,
   full reward-bundle application, analytics, hosted designer roles/audit/publish
   workflow and native purchase/refund/restore acceptance.
7. Explicit runtime registry injection everywhere, compatible definition
   migrations, dependency-closed server release selection and retained-asset GC.
   Until migrations exist, installed pack identities are immutable; additive
   releases must use new IDs. Dependencies must be offered together for new users.
8. Optional real-world activity paths still need a complete gate audit.

## Verification and deployment

- App TypeScript check passed after the final changes.
- `npm run test:live-ops --workspace=katchimeras`: 26 tests passed.
- Journey service/triggers, merge performance, Mossprout arc and Steppling mission
  regression selection: 45 tests passed.
- Studio production build passed. Browser verified restoration scoring, first
  tier reachability and local draft saving.
- Targeted ESLint: no errors; the merge engine retains existing structural/unused
  import warnings. Full repository check is not green: the broader merge run
  had 11 unresolved failures after the event persistence assertion was updated.
  Failures concern old FTUE drops, water/garden orders, energy/starter chains,
  selection rendering, Steppling order counts, signature landmarks and gate
  candidates. Their pre-change status was not independently established.
- `scripts/verify-live-ops-sql.mjs` passed against isolated PGlite PostgreSQL:
  migration replay, release compatibility, webhook duplicate/out-of-order delivery,
  retrying an unprocessed receipt, rollback and function permissions. Supply
  `KATCHIMERAS_PGLITE_MODULE` pointing to an installed PGlite module.
- No migration or Edge Function has been deployed. Reconcile the linked migration
  history and deploy the SQL before the webhook function that calls its new RPC.
  PGlite does not replace Supabase/RLS integration and native acceptance testing.

## Verified event claims increment

`20260916135221_verified_live_event_claims.sql` introduces a separate event ledger;
it does not reuse legacy client-reported season XP. All tables live in `private`,
have RLS enabled, and are inaccessible to client roles. Invoker RPC wrappers call
private definer functions with empty search paths.

- `stage_live_event_definition_v1`: service-only, validates and inserts immutable
  definitions **disabled**. Retries of identical definitions succeed; conflicting
  IDs fail. Operator inserts are validated by the same insert trigger.
- `enroll_live_event_v1`: authenticated account, server time, verified Harmony gate.
  Enrollment time prevents scoring actions from before joining an event.
- `record_verified_live_action_v1`: **service-role only**. This is the future
  replay worker's output sink, not an event-upload API. It serializes per account,
  deduplicates action IDs, rejects conflicting replay, awards milestone Harmony
  once, and scores enrolled overlapping events with the authored filters/caps.
  Historical backfill cannot score events. Delayed verified actions may arrive
  during the claim window, but their occurrence must precede scoring closure.
- `claim_live_event_reward_v1`: authenticated account; locks progress and commits
  the claim receipt, Gem ledger entries and Wisp grants in one transaction. It
  derives all rewards and thresholds from immutable server definitions. Retries
  return the existing receipt, even after retirement. Unsupported bundle items
  reject the entire claim. Premium claims remain disabled, independently of Plus.
- `get_live_event_state_v1`: returns only the caller's verified progress/receipts
  and available definitions. No private memory or journal content is involved.

The native client adapter has no scoring/upload method and never applies a
server reward locally a second time. Content Packs developer tools now include
verified state, enrollment and free claims; successful operations refresh the
existing economy inventory. This panel still requires the migration to be deployed.
Studio staging now stages the event definitions before the disabled content pack.

Reproducible local checks (PGlite is now a development dependency):

```
npm run test:live-ops-client --workspace=katchimeras
npm run test:live-ops-sql --workspace=katchimeras
```

The database suite exercises actual authenticated/service/anonymous roles,
account isolation, invalid definitions, enrollment gates, duplicate/conflicting
actions, capped overlapping events, historical/pre-enrollment exclusions,
Gem/Wisp bundles, unsupported rewards, injected delivery rollback/retry, claim
grace/expiry, retirement and immutable definitions. SQL scoring is compared
directly against the Studio TypeScript engine for context filters, tiers, tags,
caps and unusual rule IDs. PGlite runs queries on one connection: true concurrent
Postgres sessions and deployed Supabase/native UI acceptance remain outstanding.

The subsequent increment below adds a restricted command verifier. Do not connect
the client event journal directly to the trusted-action RPC to bypass replay.

Increment verification: app typecheck, targeted ESLint, 26 foundation tests,
4 client-contract tests, both isolated PostgreSQL suites and Studio production
build passed. The new native developer panel has not been exercised on a device;
the previously reported 11 broader merge failures are not resolved by this work.

## Trusted checkpoint and replay increment

The `verify-merge` Edge Function now replays a strict board-command allowlist
through the actual game reducer. Its bundled bytecode has a SHA-256 ruleset ID.
A server-created Chapter Zero pilot checkpoint records that ruleset, random seed,
global command sequence, active device, ownership epoch and a 24-hour lease.
It is deliberately separate from the player's current local save.

`20260916144019_verified_merge_checkpoints.sql` adds private checkpoint and batch
receipt tables plus service-only begin/load/commit RPCs. Commits fence device,
epoch, ruleset and sequence; checkpoint updates, verified event scoring and batch
receipts share one transaction. Identical retries return the current checkpoint;
conflicting retries fail. An authenticated explicit transfer preserves the world
and invalidates work from the previous device. No automatic takeover is wired.

The handler verifies the caller, limits request size and command count, rejects
client timestamps/seeds/grants/snapshots and uses server submission time for
eligibility. It supports bundled Mossprout move/tap/serve/store/restore/sell only.
An unsupported ruleset fails closed; archived-version routing is not implemented.
The pilot defaults off via `VERIFIED_MERGE_PILOT_ENABLED`.

`npm run test:verified-replay --workspace=katchimeras` builds the worker and tests
the actual handler + reducer + PostgreSQL checkpoint transaction + event scoring
+ Gem claim. It covers authentication, privileged command injection, bounds,
deterministic generation, exact retries, later duplicate recovery, partial failure
rollback, sequence/ruleset conflicts, lease renewal, transfer fencing (including
an already computed in-flight batch), and client-role/account isolation.

### Native pilot queue and diagnostic board

The Content Packs developer screen now links to `/dev-verified-merge`. Opening it
loads an account-scoped SQLite envelope; Connect creates or renews the server
checkpoint. The diagnostic board supports move, generator tap, store, restore,
sell and serve order. Submit verifies the entire pending batch. This board never
imports the player's existing save or writes to it.

`pilot-queue.ts` persists a batch before submission and freezes that batch until an
exact receipt arrives. Further moves go into dependent batches, so a pending
submission does not freeze play. A timeout, process restart or failed local
receipt write leaves the original batch retryable. Reconnect never rebases uncertain commands. Storage
errors and incompatible rulesets fail closed. Explicit device recovery preserves
the server world and archives this device's superseded pending commands; a lost
transfer response is resolved by checking ownership before retrying. Recovery
cannot discard a batch whose ownership epoch has not been fenced. Account changes
clear the screen; network calls capture the intended account's token.

The native predictor uses the checked-in `features/live-ops/generated/replay.js`
snapshot, isolated from remotely primed registries. `build:verified-replay` updates
both worker and native copies with the same ruleset ID. Include that generated
native file when committing a ruleset change. Old checkpoints still need their
original worker; version routing remains future work. Prediction time is a device
clock estimate fixed when the batch starts; it never goes to the server, which
evaluates the batch at submission time. No automatic background retry
is enabled. A permanently rejected batch remains preserved for diagnosis.

Validation for the initial single-batch increment: ten SQLite-backed queue tests cover retries, restart, disk failure,
bad receipts, operation exclusion, account scope and uncertain transfer recovery.
The full handler/PostgreSQL test now drives a lost-response/reloaded-queue retry
and verifies event score and Gem claims. Run `test:verified-pilot` and
`test:verified-replay` in the app workspace. Native UI/device acceptance has not
been performed. No functions or migrations have been deployed.

Next: staging deployment and native two-device/offline acceptance; verified story
command coverage; explicit existing-save migration and ruleset version routing.
Full account backup/restore still spans more domains than this board checkpoint.
See the function's README for protocol and deployment requirements.

### Offline hardening increment

The pilot now loads its selected local account synchronously from persisted auth
storage. This is only a save-selection hint, even if the token is expired; online
calls still refresh/check the session and bind requests to that account. Local
loading never invokes `getSession` or creates an anonymous account. Explicit
first-time online setup remains available separately. Supabase's storage key is
now configured explicitly to its existing default, preserving existing sessions.
Signing out does not delete queues; without a selected local identity the pilot
will not guess which account's save to open. The ordinary Merge World hydration
continues to use its existing local repository, independently of this pilot.

Queue envelopes are version 2, migrated from v1 in memory and persisted on the
next atomic write. A submitted head is immutable; subsequent moves are stored in
draft batches of at most 100 commands. There is no 100-command total session cap.
Sequence-derived generator seeds continue across batches. Sync drains a bounded
number of batches, accepts each receipt atomically, and includes moves appended
while the request was in flight. Failed writes leave the prior envelope intact.
The predicted board is cached between moves to avoid replaying the full offline
history on every tap; reloads and acknowledgments validate the dependency chain.

The developer board's **Sync saved moves** renews the lease before draining.
Transport and authentication waits have a 20-second operation deadline; uncertain
submissions remain retryable, and late responses cannot clear newer local work.
Device recovery archives every superseded batch. If an acknowledged server state
invalidates later predicted commands, those commands and their previous local
board remain saved with an explicit reconciliation state. They are never silently
dropped or sent as a replacement server snapshot. Editing is paused in that
exceptional state; a general player-facing conflict-resolution flow remains work
for the real-save integration.

Event eligibility remains based on server acceptance time, not client clocks.
The developer screen now states that offline progress must sync before an event
ends; a reward-claim grace period does not extend action eligibility. Core local
play is independent of event reward eligibility. Supporting late offline event
credit requires a separate trusted timing policy and is not implied by this queue.
Likewise, commands do not carry trusted offline elapsed time: generator cooldowns
and energy regeneration spanning a long offline session can differ from replay
at server acceptance time. A timing/reconciliation policy is required before this
verifier becomes the ordinary game's save path; transport hardening alone does
not establish equivalence for those timed mechanics.

Verification: `test:verified-pilot` has 17 tests including 206 offline commands,
v1 migration, expired local identity, account switching, in-flight play, deadline
and late-response handling, failed writes, and preserved reconciliation. The
actual handler/PostgreSQL suite also verifies 132 offline moves across batches,
lease expiry, restart and catch-up, with unchanged event points/Gem grants.

Native acceptance still required before promoting this pilot:

1. Connect once, enter airplane mode, play more than 100 moves, kill/reopen the app
   with an expired token, and verify the local board loads without an auth wait.
2. Reconnect with an expired lease and sync while making more moves; verify final
   board, order progress and event rewards, including a deliberately lost response.
3. Transfer to another device, then reconnect the first; verify ownership fencing
   and explicit recovery without loss of the archived queue.
4. Exercise installed content changes, app/ruleset updates, failed local writes,
   and the reconciliation display before enabling this for normal saves.

No backend deployment or physical-device acceptance was performed in this
increment. Historical ruleset routing, migration of ordinary game saves, full
account backup, verified story commands and automatic background sync remain
separate follow-up work. The previously reported broader merge-test failures
are not resolved by these queue changes.

### Bounded offline timeline and historical rulesets

The next verifier ruleset accepts optional per-action timestamps outside the action
objects. It checks array length, safe integers, monotonic order and the window
from the last checkpoint state to the current database clock. Reducer execution
uses those bounded times; scored events still use server acceptance time. This
allows an elapsed gameplay timeline without treating a device clock as evidence
of event eligibility. It does not prove the exact time an action occurred: a
modified client can optimize a schedule within the actual elapsed window.

The native queue stores a server/device clock anchor and persists each proposed
action time with the command. Restart, device-clock rollback, batching and exact
retries retain the same timeline. A clock jump into the future preserves and
rejects the batch until it fits the server window; it does not silently retime
already-submitted commands. The current game keeps unlimited generators and its
retired energy wallet; this change introduces no extra resource constraints.

`build:verified-replay` now retains immutable hash-verified ruleset snapshots and
generates registries for both native prediction and server replay. The server
selects a runtime using its stored checkpoint. Reconnecting an older checkpoint
finds its installed archive; the native queue likewise predicts with that archive.
Unknown versions still fail closed. Existing saves remain pinned, so legacy pilot
saves retain their old untimed behavior until an explicit migration is implemented.
This is routing compatibility, not migration of the ordinary player save.

The queue suite now has 22 tests. Validation adds bounded-window, malformed timeline, restart, clock rollback,
server-time scoring and archived-native-save tests. The handler/PostgreSQL suite
also reconnects and submits an archived checkpoint, rejects timed commands on the
legacy runtime, rejects future-time submissions without advancing the checkpoint,
and verifies exact timed retries. Generated archives are checked on every build.

Native acceptance could not run here: neither adb nor xcrun is available on PATH,
and adb was absent from the standard local Android SDK location. No remote
deployment or device test is claimed. Next work is explicit checkpoint upgrades,
ordinary-save migration/trust boundaries, and device acceptance of these flows.

## Supabase deployment — 16 September 2026

Deployed to the existing linked **Katchimeras** project (`ecwlxvidbrvatqtyttpw`).
The remote migration ledger had the content-pack migration already applied out
of order, but no Gem/season or FTUE tables. A scoped CLI staging directory included
all previously recorded migrations and the four required pending migrations;
older unrelated FTUE migrations were not replayed or marked as applied.

Applied through the CLI migration runner (after a rollback-only remote preflight):

- `20260813112651_add_season_progression_and_gems.sql`
- `20260916133000_live_ops_release_and_delivery.sql`
- `20260916135221_verified_live_event_claims.sql`
- `20260916144019_verified_merge_checkpoints.sql`

Deployed `verify-merge` version 1, `revenuecat-webhook` version 19 and
`reconcile-revenuecat` version 19. The verifier includes the new bounded-timing
ruleset `merge-v1-1fcfd9ee9e59e7949dd4163c79bbea97732481f371082068933f91a380663814`
and the retained legacy runtime. JWT verification remains on for `verify-merge`
and `reconcile-revenuecat`; the webhook retains its own request authentication.

Post-deployment checks confirmed all four migration records, RLS on the eight
new private tables, service-only checkpoint initialization, authenticated-only
device transfer, and no error-level security-advisor findings. HTTP smoke tests
returned 200 for the content-release RPC, 401 for unauthorized purchase endpoints,
and the expected 503 `pilot_disabled` response from the verifier. No player
checkpoints, reward claims or purchase events were created by these smoke tests.

The merge pilot remains disabled pending native acceptance. RevenueCat integration
secrets are not configured on this project, so paid reconciliation/webhook
processing still needs credential setup. No live event was enabled, and no app
build or physical-device acceptance was performed as part of deployment.
