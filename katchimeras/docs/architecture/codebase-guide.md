# Katchimeras Codebase Guide

This guide describes the post-refactor code structure and the conventions to
follow when adding or changing features. It is written for engineers and AI
agents that need to find the right module quickly without expanding route files
or reintroducing large mixed-responsibility files.

## Quick Map

```txt
app/                         Expo Router route entrypoints
components/katchadeck/       Product UI components and shared UI patterns
features/                    Screen/feature orchestration hooks
game/                        Domain logic for mutable game state
storage/                     Persistence repositories and storage boundaries
utils/                       Pure engines, selectors, catalogs, device adapters
types/                       Shared TypeScript domain contracts
constants/                   Static UI/game constants
data/                        Authored/generated game and world data
scripts/                     Regression verification scripts
docs/                        Product, art, architecture, and implementation docs
```

The intended dependency direction is:

```txt
app -> features -> game/storage/utils -> types/data/constants
app -> components
features -> components only for UI-specific types when unavoidable
components -> utils/types/constants, but not storage mutations
game -> types/utils/data, but not React or route code
storage -> low-level persistence only
```

Avoid importing route files from anywhere. Route files compose controllers and
components; they are not reusable modules.

## Current Architecture

### Routes

`app/` contains Expo Router screens. Route files should stay thin:

- read high-level screen state from hooks;
- compose feature controllers;
- render components and sheets;
- route to other screens.

Important routes:

- `app/(tabs)/today.tsx`: main daily egg/capture loop.
- `app/(tabs)/world.tsx`: Kingdom/world surface.
- `app/(tabs)/collection.tsx`: archive, calendar, and collection views.
- `app/(tabs)/explore.tsx`: exploration/discovery surface.
- `app/moment-capture.tsx`: full-screen capture flow.
- `app/note-capture.tsx`: note capture flow.
- `app/photo-essence.tsx`: photo meaning flow.
- `app/day-map/[dayId].tsx`: day-specific map.

If a route starts growing local business logic, move it into `features/<area>/`
or a pure engine in `utils/` / `game/`.

### Feature Controllers

`features/` contains React hooks that orchestrate workflows for a screen or
surface. These hooks may combine state, callbacks, navigation, and native APIs.
They should not render JSX.

Current Today controllers live in `features/today/`:

- `use-home-state-mutation.ts`: updates stored home state through a mutation boundary.
- `use-hatch-controller.ts`: hatch finalization workflow.
- `use-health-route-import.ts`: Health route import orchestration.
- `use-prompt-photo-candidates.ts`: prompt photo candidate loading.
- `use-egg-feed-controller.ts`: egg feed animation state.
- `use-prompt-sheet-controller.ts`: prompt sheet open/close state.
- `use-today-sheet-controller.ts`: Today sheet state.
- `use-today-action-router.ts`: routes category/dock actions to the right UI.
- `use-today-category-model.ts`: derived category ring data, quests, step average.
- `use-today-prompt-answer-controller.ts`: prompt answers and photo essence navigation.
- `use-today-memory-writers.ts`: food, studio, mood, sleep, steps, and big-moment writes.
- `use-note-capture-controller.ts`: quick note and voice note capture.
- `use-place-prompt-controller.ts`: place confirmation and map/vault entry points.
- `use-morning-prompt-controller.ts`: morning sleep/mood prompt sequence.
- `use-observatory-controller.ts`: observations and travel memory model.
- `use-discovery-reveal-controller.ts`: discovery celebration timing.
- `use-moment-follow-up-controller.ts`: food/studio follow-up prompts.
- `use-microcopy.ts`: transient toast copy.
- `use-today-share-comic-controller.ts`: share card and generated comic flow.

Use this pattern for new controllers:

```ts
export function useFeatureController(params: UseFeatureControllerParams) {
  // state, derived data, callbacks
  return { state, derivedData, handlers };
}
```

Keep controller parameters explicit. Do not let controllers import a route's
local state or reach through global singletons unless that is the established
repository/device boundary.

### Game Domain

`game/` owns mutable game-domain behavior. It should remain React-free.

Current day-domain modules live in `game/days/`:

- `index.ts`: public barrel for day-domain operations.
- `actions.ts`: typed public action exports for day mutations.
- `records.ts`, `hydration.ts`, `derived-records.ts`: state shape and derived records.
- `migrations.ts`, `state-normalization.ts`: compatibility and persisted-state repair.
- `lifecycle.ts`, `date.ts`: day rollover and date helpers.
- `moment-factories.ts`, `mutations/`: behavior-preserving day mutations.
- `scoring.ts`, `scores.ts`, `shape.ts`, `visuals.ts`: day score/visual derivation.
- `hatching.ts`: hatch readiness and hatch result generation.
- `locations.ts`, `geo.ts`, `photo-locations.ts`: place/location behavior.
- `health-routes.ts`: activity and route import domain logic.
- `backfill.ts`: archive backfill behavior.

When adding a new kind of day mutation:

1. Add or update the domain type in `types/home.ts`.
2. Add the pure mutation in `game/days/mutations/`.
3. Export the action from `game/days/actions.ts` and `game/days/index.ts`.
4. Wire the feature controller to call the action through `useHomeScreenState`
   or the relevant repository-backed state hook.
5. Add/update a verify script if the mutation affects scoring, hatching,
   quests, discoveries, world objects, or persisted shape.

### Storage

`storage/` is the persistence boundary. Prefer repositories over direct calls to
storage helpers.

Current repository:

- `storage/repositories/home-repository.ts`: load/save/subscribe for home state.

Rules:

- New persisted state needs an owner repository or an explicit decision to add
  it to an existing repository.
- New storage keys need a migration/compatibility plan.
- Feature controllers should call repository-backed hooks/actions rather than
  reading/writing AsyncStorage directly.

### Pure Engines And Utilities

`utils/` contains pure engines, selectors, catalogs, capability adapters, and
legacy compatibility modules. The direction is to keep pure game rules in
testable modules and avoid putting screen state here.

Important areas:

- `utils/day-prompt-engine.ts`: prompt eligibility and prompt construction.
- `utils/daily-seeds-engine.ts`: daily seed selection and completion.
- `utils/today-categories.ts`: Today category ring derivation.
- `utils/memory-quests-engine.ts`: contextual memory quest selection.
- `utils/encounter-engine.ts`, `utils/hatch-selection.ts`: creature selection.
- `utils/world-*.ts`, `utils/kingdom-*.ts`: world/Kingdom scene and progression.
- `utils/discoveries-*.ts`: discovery catalog, evaluation, artefacts, storage.
- `utils/quests/definitions.ts`, `utils/quests/evaluate.ts`: data-driven quest rules.
- `utils/signals/`: fact providers and signal resolution.
- `utils/intelligence/`: provider contracts, taxonomy, and evidence builders for
  model/rule-backed photo, note, voice, and quest verification.
- `utils/photo-*.ts`, `utils/vision-signals.ts`, `utils/scene-classify.ts`: photo/vision derivation.
- `utils/app-storage.ts`, `utils/home-storage.ts`: lower-level storage helpers; prefer repositories for new work.

Good utility modules are deterministic where possible: input data in, derived
data out. If a utility needs native APIs, storage, network, or time, make that
dependency explicit.

### Components And UI

`components/katchadeck/` contains app UI. Prefer presentational components with
typed props and callbacks. Components should not know how to mutate persisted
game state.

Key folders:

- `components/katchadeck/home/`: Today/home UI such as egg, prompt strip, dock, postcard, comic overlay.
- `components/katchadeck/world/`: Kingdom/world sheets and canvas UI.
- `components/katchadeck/collection/`: collection/calendar UI.
- `components/katchadeck/capture/`: capture-specific UI.
- `components/katchadeck/onboarding/`: onboarding UI.
- `components/katchadeck/ui/`: reusable product UI patterns.
- `components/ui/`: generic Expo starter/shared UI primitives.

Shared UI patterns now include:

- `components/katchadeck/ui/action-tile.tsx`
- `components/katchadeck/ui/segmented-control.tsx`
- `components/katchadeck/ui/meadow-sheet.tsx`
- `components/katchadeck/home/today-bottom-dock.tsx`
- `components/katchadeck/home/microcopy-toast.tsx`
- `components/katchadeck/home/day-comic-overlay.tsx`

UI rules:

- Keep sheets and repeated action surfaces componentized.
- Use shared primitives for action tiles, segmented controls, sheet shells, and
  bottom actions before creating new one-off UI.
- Components receive data and callbacks; controllers decide what callbacks do.
- Avoid nested cards and overly decorative wrappers in operational UI.
- Keep text sizes bounded and responsive; do not scale font size directly with
  viewport width.

## Where To Change Things

| Task | Start Here | Usually Also Touch |
| --- | --- | --- |
| Add a Today action button | `features/today/use-today-action-router.ts` | `components/katchadeck/home/today-bottom-dock.tsx`, `utils/today-categories.ts` |
| Add a Today category/ring item | `utils/today-categories.ts` | `features/today/use-today-category-model.ts`, `components/katchadeck/home/today-category-ring.tsx` |
| Add a prompt category | `constants/day-prompts.ts` and `utils/day-prompt-engine.ts` | `features/today/use-today-prompt-answer-controller.ts`, verify day prompts |
| Add a day mutation | `game/days/mutations/` | `game/days/actions.ts`, `hooks/use-home-screen-state.ts`, feature controller |
| Add a memory quest | `utils/memory-quests-engine.ts` | `scripts/verify-memory-quests.cjs` |
| Add data-driven quest/progression rules | `utils/quests/definitions.ts` | `utils/signals/providers/`, `scripts/verify-world-objects.cjs` |
| Add a discovery | `utils/discoveries-catalog.ts` | `utils/discoveries-engine.ts`, `scripts/verify-discoveries.cjs` |
| Add a creature encounter | `utils/encounter-engine.ts` / creature data | `scripts/verify-encounter-engine.cjs`, art/data files |
| Change hatch selection | `utils/hatch-selection.ts` | `utils/encounter-engine.ts`, verify hatch/encounter scripts |
| Change world object placement | `utils/world-scene.ts` / `utils/world-objects*.ts` | `components/katchadeck/world/world-canvas.tsx`, verify world scripts |
| Change Today sharing/comics | `features/today/use-today-share-comic-controller.ts` | `components/katchadeck/home/day-comic-overlay.tsx`, `utils/day-comic-render.ts` |
| Change note/voice behavior | `features/today/use-note-capture-controller.ts` | `hooks/use-inline-voice-note.ts`, `utils/note-interpret.ts` |
| Change place behavior | `features/today/use-place-prompt-controller.ts` | `game/days/locations.ts`, `components/katchadeck/world/place-prompt-sheet.tsx` |
| Change morning sleep/mood flow | `features/today/use-morning-prompt-controller.ts` | `features/today/use-today-memory-writers.ts` |
| Add shared UI widget | `components/katchadeck/ui/` | Replace duplicate local widgets in feature components |
| Add native/device capability | `hooks/` or a capability utility in `utils/` | Feature controller that consumes it |
| Add persisted state | `storage/repositories/` | migrations/normalization and verify coverage |

## Data-Driven Feature Pattern

Prefer definitions/catalogs plus generic evaluators for scalable game features.

Good examples:

- `utils/quests/definitions.ts` plus `utils/quests/evaluate.ts`
- `utils/signals/facts.ts` plus `utils/signals/providers/*`
- `utils/discoveries-catalog.ts` plus `utils/discoveries-engine.ts`
- `utils/world-props-catalog.ts` plus `utils/world-props-engine.ts`

Use this shape when possible:

```txt
definition/catalog -> generic evaluator -> derived result -> feature controller -> UI
```

Avoid this shape:

```txt
button onPress -> route-local if/else tree -> direct storage write -> UI patch
```

## Adding A Feature Safely

1. Identify whether the feature is UI, orchestration, game rule, or storage.
2. Put UI in `components/katchadeck/...`.
3. Put orchestration in `features/<area>/use-...`.
4. Put pure game behavior in `game/` or `utils/`.
5. Put persistence behind `storage/repositories/`.
6. Export through existing barrels only when it is part of the public module API.
7. Add/update verification when shared game behavior changes.
8. Run `npm run check`.

## Testing And Verification

Standard command:

```bash
npm run check
```

This runs:

- `npm run typecheck`
- `npm run lint`
- `npm run verify`

The verify suite is the main guardrail for game behavior. Add targeted scripts
under `scripts/verify-*.cjs` for pure engines and include them through
`scripts/verify-all.cjs`.

When changing UI only, still run `npm run check`. For visual changes, manually
run the app and inspect the affected screen. If the change touches canvas,
animation, gestures, or responsive layout, verify on at least one small and one
large viewport/device.

## Architecture Best Practices

- Keep route files thin. Routes compose; they do not own engines.
- Keep controllers hook-shaped and JSX-free.
- Keep components presentational and callback-driven.
- Keep engines pure and deterministic where possible.
- Keep storage behind repositories.
- Keep type changes centralized in `types/`.
- Prefer data definitions over hard-coded branching.
- Prefer adding a small controller or pure helper over expanding an already-large file.
- Do not create a barrel export unless it clarifies the public API.
- Do not add cross-feature imports casually. Shared behavior belongs in
  `components/katchadeck/ui`, `utils/`, `game/`, or `types/`.
- Preserve persisted user data. Any shape change needs migration or normalization.
- Keep comments useful: explain non-obvious decisions, not what code plainly does.

## AI Agent Working Rules

When an AI agent modifies this repo:

1. Read the relevant route, feature controller, domain module, and verify script
   before editing.
2. Search with `rg` before introducing new names or patterns.
3. Prefer extraction and small behavior-preserving changes.
4. Do not revert unrelated dirty work.
5. Use `npm run check` after meaningful edits.
6. If a file contains encoding/mojibake, make narrow identifier-based edits and
   validate carefully.
7. Summarize changed files and verification status at the end.

## Current Refactor Status

Completed directionally:

- Day-domain code has moved out of the old large home engine into `game/days/`.
- Home state now has a repository boundary in `storage/repositories/`.
- Today orchestration has been split into feature controllers under
  `features/today/`.
- Several repeated UI elements have been promoted into shared components.
- `npm run check` is the standard guardrail.

Remaining high-value work:

- Continue thinning `app/(tabs)/today.tsx` by extracting navigation/focus effects,
  hatch reveal state, and sheet host rendering.
- Continue thinning `app/(tabs)/world.tsx` and split world canvas layers.
- Move more direct storage helper usage behind repositories.
- Promote repeated sheet/action UI into shared primitives.
- Expand data-driven definitions for quests, discoveries, world objects, and
  encounter content.
