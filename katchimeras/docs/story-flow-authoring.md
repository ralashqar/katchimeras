# Story flow authoring

FTUE, Journey Days, and future world stories use the same Content Flow graph. Authors compose typed nodes and reusable recipes; screens render capabilities and publish domain facts without deciding story progression.

## Atomic world operations

- `storyOperations.focusCamera(...)` focuses a semantic `StoryTarget` and acknowledges only after the camera settles.
- `storyOperations.fitCamera(...)` frames several semantic targets.
- `storyOperations.restoreCamera(...)` returns to a named runtime snapshot.
- `upgradeWorldTargetRecipe(...)` expands into focus → durable upgrade → reveal.

World upgrades require an explicit economy policy:

- `normal` spends the catalog cost.
- `free` requires an authored reason and never displays payment by default.
- `grant` requires an amount and reason, grants and spends in the same transaction.

The effect key is stored as a Merge World mutation receipt. A retry returns the original receipt without charging, granting, or upgrading twice. The reveal reads that receipt, so presentation cannot claim a state change that was not committed.

```ts
const nodes = upgradeWorldTargetRecipe({
  id: 'garden.first-bloom',
  target: { kind: 'haven_tile', familyId: 'mossprout' },
  focusTarget: { kind: 'haven_structure', structureId: 'mossprout-hex-garden' },
  toLevel: 1,
  economy: { mode: 'free', reason: 'First Bloom story reward' },
  presentation: {
    reactionLine: 'The garden remembered.',
    showCoins: false,
  },
  next: 'mossprout.reflects',
});
```

`focusTarget` is optional. Use it when the visible object the camera should frame differs from the durable progression target being upgraded.

If two levels use the same art, the reveal still runs particles and reaction timing but omits the redundant image crossfade.

## Targets and readiness

Story data names semantic targets such as a Haven resident, tile, nature island, Merge generator, order, or UI control. Runtime geometry lives in a surface-local target registry and is never saved into story data. Camera work waits for registered targets before starting; missing targets fail as a recoverable flow error with their semantic keys.

## Adding and changing nodes

1. Add nodes to a typed manifest with stable IDs.
2. Register any new capability with payload validation.
3. Compose side effects as idempotent domain commands that consume the supplied effect key.
4. Add migrations when a released version removes or renames a node.
5. Add an alternate manifest to its `StoryVariantSet` with a distinct definition version when comparing variants.
6. Run `npm run verify:story-flows`, focused tests, typecheck, and lint.

The Content Flow Inspector shows run status, cursor, receipts, graph nodes, and diagnostics. Previous, Replay, and Next preview controls preserve effect receipts, which makes visual iteration safe. Local variant selection affects newly started runs only.

## Mossprout migration boundary

`MOSSPROUT_FTUE_FLOW` is now the explicit shipping graph. Its scene/task payloads retain `legacyFtueStepId` while existing bespoke React views are migrated to generic story surfaces. New durable effects and world presentations belong in the Content Flow manifest; do not add another screen-owned FTUE state machine.
