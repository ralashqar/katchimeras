# Story Flow Architecture

This is the runtime contract for FTUE, Journey Days, resident discoveries, and rewarded optional actions. Content Flow owns the live cursor. Screens render the current node; they do not decide what the next node is.

## Invariants

1. A story has one durable `ContentFlowRun` cursor.
2. Every visible node names a registered capability and a surface.
3. Routes come from `story-route-registry.ts`; story files never contain path strings.
4. A route is acknowledged only for its exact `runId + nodeId + routeId` navigation key.
5. A curtain reveals only after its declared readiness gates pass.
6. Effects receive a durable effect key and must be idempotent.
7. Domain repositories store facts (orders served, cards earned). They do not advance story nodes directly.
8. Optional activities are child flows. The parent is suspended and resumes only after the child completes.
9. Released node IDs are permanent. Renames require a manifest migration alias.
10. A recoverable failure always offers Retry or Return. There is no indefinite curtain and no silent half-loaded success.

## Runtime ownership

```text
Typed story manifest
        |
        v
Compiler + capability/route validation
        |
        v
ContentFlowDirector -- atomic command --> SQLite journal
        |                                     |
        |                                     +-- cursor + revision
        |                                     +-- event/effect/presentation receipts
        v
StorySurfaceHost / NavigationCoordinator
        |
        +-- scene/presentation renderer
        +-- correlated curtain handoff
        +-- task waits for domain events
```

`ContentFlowDirector` reads, reduces, and writes a command inside one serialized SQLite transaction. Each persisted reduction increments `revision`, so an older async callback cannot overwrite a newer cursor.

## Navigation transaction

A route node performs this sequence:

1. The route node and navigation intent are already durable.
2. The coordinator starts a curtain using the node's exact navigation key.
3. Expo Router replaces the route using a registered target.
4. The destination reports the same key plus its readiness gates.
5. The director writes the navigation receipt.
6. The curtain reveals and the interpreter enters the next node.

The standard readiness gates are `route`, `data`, `layout`, `background`, and `foreground`. Add `interaction_target` for a tutorial that immediately spotlights a specific parcel, card, order, or button.

The transition retries navigation once after eight seconds. A second failure shows an interactive recovery panel. Developer routes bypass story navigation ownership.

## Surface ownership

`StorySurfaceHost` gives an active flow exclusive control of its declared surface. Regular dashboard actions must be its `children`, so they cannot leak underneath a blocking FTUE/Journey beat. When a child flow and parent both request a surface, the child wins. Competing root flows are reported in the Content Flow Inspector.

## Persistence and recovery

- Event IDs are unique and recorded in the same transaction as the cursor change.
- Effect, presentation, and navigation receipts are durable and replay-safe.
- Cold launch loads the durable cursor; it does not infer progress from the last visible screen.
- A missing old definition uses `migrations` to move its node to the latest registered version.
- If no safe migration exists, the run becomes `failed_recoverable` and remains inspectable.

The old FTUE step store remains only as a released-save adapter while existing Mossprout saves are migrated. New stories and nodes must not add screen-owned branching or a second cursor.

## Modules

- `types/content-flow.ts`: graph, run, command, route, readiness and policy contracts.
- `story-manifest.ts`: the designer-facing TypeScript authoring facade.
- `story-capability-registry.ts`: executable scene/task/effect/presentation contracts.
- `story-route-registry.ts`: canonical typed destinations.
- `content-flow-compiler.ts`: graph and capability validation.
- `content-flow-director.ts`: command, child-flow and effect orchestration.
- `content-flow-repository.ts`: SQLite journal and atomic reductions.
- `content-flow-navigation-coordinator.tsx`: cold/live route handoff.
- `story-surface-host.tsx`: exclusive story rendering boundary.
- `content-flow-inspector-screen.tsx`: run graph, receipts, revisions and diagnostics.

## Migration sequence

1. Keep released FTUE saves readable through the adapter.
2. Author every new story in `defineStory`.
3. Move existing FTUE renderers behind capability renderers without changing node IDs.
4. Start Journey Day definitions as root runs and publish existing order/resident facts as domain events.
5. Move optional actions to child runs.
6. Remove the legacy FTUE/Journey cursor only after snapshot migration coverage proves every released node resumes correctly.

Do not delete compatibility code before the last step. Having one authority does not require invalidating existing saves.
