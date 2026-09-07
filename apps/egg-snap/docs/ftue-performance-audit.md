# FTUE performance audit

## Findings and fixes

| Finding | Evidence | Change |
| --- | --- | --- |
| Covered world routes kept their scenes mounted | World pushes duel/avatar/campaign; stack retention keeps map residents, camera, tile art and story subscriptions alive. Only sky animation was gated by pathname. | FocusedScreen releases world, avatar and campaign contents on blur and remounts them on focus. |
| Return navigation could accumulate world entries | World → push duel → replace results → replace world retains the earlier world. The stack pattern predates FTUE; the richer map makes it more expensive. | Return actions use dismissTo, which reuses the existing destination or replaces when no destination exists. |
| Opening redirects constructed the map unnecessarily | A fresh profile rendered Neighborhood and resident eggs before the effect redirected to battle. | Redirect-only world visits render no map scene. |
| Tutorial measurements continued throughout guided fights | Every refill scheduled per-piece measureInWindow calls, stored new anchors and caused battle renders, even after coaching finished. | Subscribe to piece anchors only while a coaching step is active. Bomb/defense guides retain their measured hand positions. |
| Spotlight rebuilt an unchanged native view tree | Battle renders supplied fresh frame/screen objects; useMemo therefore recomputed the multi-cutout bands. The representative two-target test mounts over 50 views. | Value-based memo comparison skips the complete subtree when geometry, radius and opacity are unchanged. Moving targets and viewport changes still update it. |
| All avatar body thumbnails breathed continuously | Seven body previews used the animated Egg component with its default unpaused energy animation. | Pause thumbnails; the main selected egg keeps its animation. |

## Verification

- Egg Snap typecheck, lint and 72 tests pass.
- Shared package typecheck and spotlight lint pass.
- Regression tests exercise ten focus/blur cycles and verify active scene effects fall to zero while covered.
- The installed navigation stack reducer retains exactly one original world entry after ten battle/result/return cycles using POP_TO (Expo Router's dismissTo action).
- Thirty equal-geometry spotlight updates cause zero additional View renders and no geometry recomputation; a moved target correctly rebuilds.
- Browser verification: map → avatar → map → battle → map. DOM queries found zero map headings while covered, then one world heading and zero opponent puzzles on return.

## Scope and remaining measurement

These are verified reductions in redundant work, not measured device FPS gains. Native release-build frame time and GPU memory still need profiling on the affected device before attributing the entire slowdown to these changes. The spotlight still uses its existing band renderer; changing that renderer without GPU measurements would add shared rendering risk.

Map and avatar screen contents remount on return, so temporary camera/category state resets; saved progression and customization stay in the shared profile. Combat is not focus-unmounted: its current routes replace or dismiss it on exit, preserving its existing lifecycle.

The profile repository performs event-driven writes, not per-frame combat writes. The frame loop and quality sampler also predate this FTUE work; they were not rewritten in this targeted pass.
