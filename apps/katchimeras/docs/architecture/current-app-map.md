# Current App Map

This document maps the current codebase so refactor work can proceed in small,
behavior-preserving steps.

For the day-to-day developer and AI-agent navigation guide, see
`docs/architecture/codebase-guide.md`.

## Runtime Shape

- Expo Router owns navigation through `app/`.
- Today is the default production surface and owns the daily egg/capture loop.
- Kingdom is the persistent world derived from the day archive plus owned decor
  placement state.
- Collection reads the archive as calendar and dex views.
- Native Expo modules provide device capabilities for health routes, speech,
  vision, and foundation-model features.

## Current Boundaries

- `app/` contains route entrypoints, but several routes still own feature
  orchestration and local UI state directly.
- `components/katchadeck/` contains product UI, grouped mostly by surface
  (`home`, `world`, `onboarding`, `collection`, `ui`).
- `utils/` contains most game engines, storage wrappers, selectors, capability
  adapters, and data derivation.
- `types/` contains shared domain contracts.
- `data/` contains generated and hand-authored game/world catalogs.
- `scripts/verify-*.cjs` are the current regression checks for pure engines.

## Main Refactor Pressure

- `utils/home-engine.ts` mixes storage migrations, day mutations, scoring,
  hatching, location processing, health-route import, and formatting.
- `hooks/use-home-screen-state.ts` is a high-level app controller hidden behind a
  hook.
- `app/(tabs)/today.tsx` and `app/(tabs)/world.tsx` mix screen rendering,
  feature orchestration, sheet state, side effects, and game operations.
- `components/katchadeck/world/world-canvas.tsx` mixes camera, gestures,
  rendering layers, hit testing, drag/drop, and egg/hatch overlays.
- Multiple screens and utilities read/write local state through storage helpers,
  so day data does not yet have one repository boundary.

## Target Boundaries

Use these modules for new code and for extracted code:

```txt
game/
  days/
  hatch/
  signals/
  quests/
  kingdom/
  world/
  katchimeras/
features/
  today/
  kingdom/
  collection/
storage/
  repositories/
  migrations/
ui/
  primitives/
  patterns/
  sheets/
```

Do not move a file only to make the tree look cleaner. Move code when it creates
one of these improvements:

- a route becomes thinner;
- a pure engine becomes testable;
- a storage side effect moves behind a repository;
- repeated UI becomes a shared primitive or pattern;
- a game rule becomes declarative data consumed by a generic evaluator.
