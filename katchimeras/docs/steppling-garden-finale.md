# Steppling Garden lesson

The first Day 1 Garden handoff starts `ftue:steppling-garden:1` before navigation. Previously acknowledged handoffs do not start it. The content-flow journal owns parcel, first spawn, second spawn, merge, serve, closing and summary checkpoints. Profile reset clears this journal with the other stories.

The shared Garden prioritizes the Journey Locker parcel and `steppling:discovery:first-trail` Shoe order. Claim and serve animations finish before journal reconciliation or return navigation. The board checkpoint is rebuilt from the placed generator, loose Socks/Shoe and persisted served receipt. Setup never overwrites occupied cells; a full board opens merging/storage until there is room.

`stepplingGardenLesson` in the Merge save records preparation and serving. While unserved, the Locker guarantees the missing Socks without spending charges, then blocks extra generator taps until the Shoe is served. The existing order reward is 20 Glow, 18 merge XP, 12 friendship XP and 2 energy. Completion releases this restriction permanently.

The journal restores the shared Mossprout world and opens the Garden for board checkpoints, or focuses Steppling for closing/summary checkpoints. Only the summary's “Let’s explore” action completes the extension and releases navigation. It does not reset or replay the original FTUE.

## Summary design

The finale uses a single generated portrait, `assets/images/katchimeras/world/ui/ftue-game-loop-baked-v5.png`. It follows the user's five-step Game Loop illustration: Merge & Earn → Upgrade / Discover → Hatch Companions → Bond → Journey with them, then back to merging. Official Mossprout and Steppling art provides the character identities in both the Bond and Journey scenes. Its title, numbered panels, arrows, descriptions and floating-island scenery are all baked into the image. The taller art fills the screen with scenic bleed around the content. The existing “Let’s explore” button overlays the lower garden area with safe-area insets, without a separate parchment footer. Wider screens (width/height above 0.52) scroll the complete portrait to avoid cropping the text. The image supplies the complete reading order as an accessibility label. See `ftue-game-loop-art-v5-prompt.md` for the generation prompt and references.

## Verification

`tests/steppling-garden.test.ts` exercises catalog registration, all journal actions, a real parcel/spawn/merge/serve sequence across save normalization, zero energy/charges, rapid third taps, one-time rewards, full-board preservation and journal recovery. It runs in `verify:story-flows`.

Device checks: parcel bubble below the rail, placement/spawn/reward animation timing, return camera framing, safe-area and large-text summary layout, reduced motion, interruption at every checkpoint, final return to normal Steppling cards. Native visual checks are not simulated by the Node tests.
