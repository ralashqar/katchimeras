# Shared-world discovery authoring

The first discovery now ends with an unhatched Egg on the tile directly above Mossprout. No world transfer, hatching, or Steppling spawner is part of this chapter.

During the board-to-story journal handoff, completed beats synchronously project the next actionable authored beat from committed board evidence, even if the journal is multiple inputs behind. This keeps copy, cue, and input gating aligned without a blank merge-to-merge beat or recovery-spawner flash. Actual setup/served-request boundaries remain blocked until their effect is ready. The persistent overlay retains its last valid cutout while measuring the next target, but input stays blocked until those new measurements are ready. The basket spotlight appears only for authored spawn beats or genuine missing-source recovery. Locked matches always keep the shared half-mist artwork until they are merged; there is no Glow-specific green-ring replacement.

An existing world unlock takes precedence over relationship-derived tile stages. The reveal must not depend on an active tutorial or Mossprout's current relationship stage. Loading a valid shared-world purchase receipt repairs a missing unlock field without payment or hatching; the existing opening-FTUE Egg renderer becomes visible after the terrain transition completes.

The two requests are fully guided: Plant for 20 Glow, then Seed → bound Seed → Sprout → Plant → Flower → Rare Flower → Magical Plant for another 20 Glow. Every spawn, locked match, and Serve has a hand cue, spotlight, and input gate. There is no free-practice gap. The second setup reuses the existing higher-tier bound cells; it never overwrites occupied cells. New-item discovery bonuses are preserved, so the balance may exceed the 40-Glow mist price. Guidance continues through returning to the world, clearing the mist, and acknowledging the Egg.

## Compose a chapter

Use Content Flow nodes and semantic targets, not component timers. A camera node acknowledges only after the visible world is ready and its camera settles. Follow it with a scene that exposes the real world control. Garden opening remains a tap on the Garden button with its request bubble.

`worldActionScene` authors the view kind, guide copy, action label, action ID, and next node together. The guide reads that scene data; copy edits do not require a component change.

`mergeLessonRecipe` takes ordered beats (`spawn`, `match`, `serve`, `practice`) and an exit node. Every beat contains its guide copy and generator/item/echo/request identifiers. `mergeLessonBoardStep` projects that same data into the finger, spotlight, and input gate. Completion uses persisted spawn/match/served-request evidence; inventory alone does not prove that a player performed an action. `GLOW_LESSON` is the working example. The lesson setup must author its bound pieces and requests without replacing occupied board cells.

Use `upgradeWorldTargetRecipe` for paid world changes. It composes camera preservation/focus, `world.upgrade`, and `world.upgrade_reveal`. The effect records payment and state atomically and returns a receipt. The presentation reconstructs old/new art from that receipt. Replaying a receipt cannot debit again.

Working examples:

- Garden restoration: the `world.first_bloom_restore` sequence in the Mossprout introduction, using a Haven tile mutation and Garden structure as its visual target.
- Mist clearing: `gateway.purchase` in Glow discovery, using the catalogued `steppling-home` structure target, normal economy, level 1, and the `mist-clear` presentation preset.

## Discovery visibility

Discovery-only companion tiles set `residentVisible: false`. Stored ownership and developer previews must not draw a resident over mist or the discovered Egg. After terrain blending completes, render the opening FTUE Egg at the tile center with its gentle shake/glow; this chapter never renders or hatches Steppling.

## Tutorial drop contract

`TutorialGeneratorRule` authors the generator, default drop, bound-item sources, and request item. An active Glow lesson overrides random drops, generator upgrades, and activity basket rewards without consuming those rewards. This is derived from persisted lesson progress, not only the mutable generator override. Missing Seed/Sprout/Plant sources guide a recovery tap supplying that exact piece; existing unrelated items remain untouched. A full board releases the input gate so the player can merge or store an item. The override ends after both tutorial requests are served.

## Tile and art contract

`constants/shared-world.ts` owns stable coordinates, companion associations, unlock IDs, prices, and reveal presets. The first two companion positions are Mossprout `(0, 1)` and Steppling `(0, 0)`. Add future companion/environment entries here; do not give each companion a separate world route. Their content is deliberately not authored yet.

The scene renderer must register every visual target and supply both art states with correct alpha bounds. Reserve the union of both art envelopes so a reveal cannot change scene dimensions. The existing Garden and Steppling adapters illustrate the contract. New art families require a renderer adapter as well as their catalog entry; do not assume a catalog entry alone renders an asset.

Purchase controls preload destination art before accepting payment. The base scene stays on its before-state until the receipt-backed cross-fade takes over. The Egg is visible only after terrain presentation finishes. Reduced motion uses the existing short reveal timeline.

## Save and navigation rules

- Preserve the old `mossprout:overgrown-trail` unlock ID for compatibility; it now means the local Steppling tile, not a destination world.
- Flow v2 maps old transfer/hatch checkpoints to the local Egg reveal. Existing ownership is preserved. Previously paid tiles receive a zero-cost reveal receipt.
- Flow v3 maps the former free-practice checkpoint to the second guided setup. Its persisted `guidedOrderIndex` makes setup idempotent across reloads, updates an old unserved Plant request to Magical Plant, and preserves served requests and balances. Both requests use stable save IDs even though the second request's content changed.
- End this chapter before ownership or generator mutation. The Egg's `hatchedAt` stays null for new players.
- Disable world presentation execution while its route is hidden or interaction UI is exiting. Use the presentation operation's abort signal after asynchronous readiness work.
- Back/Explore later dismisses or pauses guidance without losing domain progress. Retry errors must remain reachable, including a full board or failed purchase.

## Release checks

Run story-flow, merge-world, kingdom, lint, typecheck, and the native asset audit. Play through on a device with normal and reduced motion, including process restarts before/after payment, blocked art loading, a full board, and old paid/owned saves. No new remote schema migration is required for this revision; the earlier FTUE v44 registration migration remains a separate deployment task.
