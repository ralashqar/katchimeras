# Game UI migration ledger

## Audit baseline

The initial audit found 312 UI source files, 257 local StyleSheets, 1,249 distinct literal hex colors, 516 direct Pressables, 14 native Modals and 244 z-index declarations. Existing debt is migrated incrementally; new shared chrome should not add to it.

## Reference migrations

- **Today:** shared currency HUD, wallet boundary and warm day-history sheet. Egg/environment remains feature-owned.
- **Merge:** shared currency HUD, feedback queue and inline errors. Board, order rail, items and gameplay flights remain feature-owned.
- **Companions:** shared hero-stage geometry and warm semantic tokens. Character scenes and accents remain feature-owned.

## Next queue

1. Consolidate companion interaction panels and status treatments.
2. Move remaining Today microcopy callers directly to the global feedback API.
3. Migrate Collection and Goals shells.
4. Replace production `Alert.alert` confirmations with shared dialogs.
5. Audit archive/readers, onboarding and remaining mini-game shells.
6. Ratchet static checks after each subsystem reaches zero local generic treatments.

## Compatibility

`KatchaSurfaceProvider`, `KatchaSheet`, `KatchaDialog` and existing buttons remain supported during migration. Compatibility wrappers may delegate to the new system but should not gain new variants. No persisted game-data migration is required.

## Enforcement

Run `npm run verify:game-ui` before merging. It protects the shared primitives and reference migrations from drifting back toward screen-local currency HUDs, feedback, or persistence reads. It also compares legacy `Alert`, native `Modal`, local toast, and shared-UI raw-color usage against `scripts/game-ui-debt-baseline.json`; new work must not increase those counts.
