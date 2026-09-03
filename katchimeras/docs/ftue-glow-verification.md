# Glow FTUE implementation and release checks

## Player journey

1. Merge the first Plant and serve its request for 20 Glow.
2. Spend 20 Glow to restore the Garden. The balance and restoration cost are visible.
3. Enter the actual meditation interaction, then choose **Explore the mist**.
4. Focus the Overgrown Trail; show its 40 Glow unlock cost after the camera settles.
5. Return to Merge: spawn a Seed, match the bound Seed, then match the bound Sprout.
6. Serve the Plant for 20 Glow. Independently make and serve another Plant for 20 Glow.
7. Return to the same world, focus the mist directly above Mossprout, and spend 40 Glow.
8. Cross-blend the mist into Steppling's tile, then reveal an unhatched Egg and end the chapter. There is no transfer, hatch, or new spawner in this revision.

Glow retains the existing persisted `coins` balance. Existing balances and restored nature islands are not reset. First nature-island unlocks cost 40 Glow; subsequent upgrade prices are unchanged. Board-bound pieces are freed by matching, while world mist is cleared with Glow. The Shell lesson is deferred.

Discovery runs as resumable Content Flow v2. Garden restoration and mist clearing share the receipt-backed world-upgrade recipe. Lesson copy, cues, and gates come from authored merge beats. Domain mutations guard against duplicate lesson preparation, request rewards, and purchases. The removed automatic Garden-mission Egg trigger is not used by this journey. See `shared-world-flow-authoring.md` for the reusable contracts.

## Automated verification

- Lint and TypeScript checks pass.
- Story-flow verification: 86 tests pass, including the shared-world discovery flow.
- Merge-world suite: 162 tests pass.
- Kingdom suite: 69 tests pass.
- Today-growth suite: 137 pass, 1 skipped.
- iOS production JavaScript bundle builds successfully.
- EAS asset audit passes after regenerating the inventory, including the new Glow art and Steppling presentation assets. Its Android and iOS exports both succeed.

Broader checks are not entirely green: `test:game-ui` has one failure in an unchanged story-stage source contract, and `test:roles` has three failures concerning the Mossprout form-finder. These are outside the modified discovery journey. Web export is blocked by the development photo-place lab importing native-only `react-native-maps` code.

## Before release

- Apply `supabase/migrations/20260903174807_register_mossprout_ftue_v44.sql` through the normal deployment process. It registers the new FTUE version using the existing v43 event allowlist. It has been generated, not applied or SQL-tested against a local database.
- Play through the journey on a device. Check the Garden speech bubble, compact meditation interaction, settled-camera spotlight, bound-item targets, and the shared-world mist-to-terrain/Egg reveal.
- Repeat with reduced motion enabled and narrow-screen layouts.
- Close and reopen at meditation, each Merge lesson boundary, before/after payment, and during the mist reveal. Verify the same state resumes without duplicate spending or rewards.
- Check an existing save with restored islands and an already-owned Steppling: preserve progress and do not replay the discovery purchase.
- Exercise a full board, insufficient Glow, interrupted navigation, and failed art loading; verify recovery remains usable.

No remote migration, commit, or push is part of this implementation handoff.
