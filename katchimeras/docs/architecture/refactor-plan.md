# Modular Refactor Plan

The refactor is incremental. Each PR should keep current behavior stable and
leave the app shippable.

## Rules

- Preserve persisted local data unless a versioned migration is included.
- Prefer extraction before redesign.
- Keep route files thin: route files should compose feature controllers and
  presentational sections.
- Keep engines pure when possible: inputs in, derived data out.
- Put storage reads/writes behind repositories.
- Use the existing facts/providers/criteria quest system as the model for new
  data-driven game rules.
- Add or update verification before changing shared game behavior.

## Phase 1: Guardrails And State Boundary

- Add `npm run typecheck`, `npm run verify`, and `npm run check`.
- Add a `verify-all` runner for existing engine verification scripts.
- Introduce repository wrappers around stored state.
- Migrate safe consumers from direct storage helpers to repositories.

## Phase 2: Day Engine Extraction

Split `utils/home-engine.ts` into behavior-preserving modules:

- day creation and rollover;
- hydration and archive selectors;
- migrations;
- day mutations;
- scoring;
- hatch readiness and hatch result generation;
- location and health-route processing.

Keep compatibility exports until all consumers have migrated.

## Phase 3: Feature Controllers

Extract screen orchestration:

- Today: controller, hatch flow, capture prompt flow, share/postcard flow, sheets.
- Kingdom: controller, decor controller, companion controller, arrival ceremony,
  sheets.
- Collection: archive/dex controller and shared day source.

## Phase 4: Canvas Layers

Split the world canvas into:

- camera hook;
- gesture hook;
- ground layer;
- sprite layer;
- egg/hatch layer;
- decor drag layer;
- badges and alerts;
- canvas config.

Keep `world-scene` as the pure layout producer.

## Phase 5: UI/UX System

Promote repeated UI into shared primitives and patterns:

- app screen;
- sheet shell and sheet header;
- icon action;
- segmented control;
- action tile;
- stat pill;
- journal section;
- discovery and creature badges;
- bottom action bar;
- inline toast.

Feature-specific visual art stays in feature components. Generic primitives
should not know game rules.

## Acceptance Criteria

- `npm run check` is the standard pre-merge command.
- New game content can increasingly be added through definitions/catalogs.
- Today, Kingdom, and Collection consume the same day source.
- No screen route grows new long-running orchestration.
- No new storage key is added without a repository owner and migration decision.
