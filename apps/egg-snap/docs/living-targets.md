# Living targets, spin, and a visible mechanic ladder

Design for taking Egg Snap's duel from a working prototype to a playable first experience. All four slices are built; each section records what shipped and where.

## What the study found

- The only continuous motion, `drift`, moved the **whole field** by one vertical offset. The stage layout could reserve only 18 points above the play rect (`game/layout.ts`), under half a cell, and the first-session encounters dealt drift at strength 0.2, below `DRIFT_FLOOR` (0.55), where the drift reads its strength as a fade gate. The gust was decoration: a player who aimed once still landed exact.
- Targets never rotated, never moved independently, never moved sideways. `fuse`, `crossed` and `hues` are fully built and appear in no shipped encounter.
- Every first-time duel is `guided`, which suppresses rival dialogue *and* the six `MECHANIC_LESSONS`; only replays see them. Only tap, bomb and armour have in-battle coaching. Drift arrived silently on beat 3 of the first fight.
- All six early rivals shared one AI profile. Replays jump from 36 HP against a 4–6 s rival to 300 HP against a 1.5–2 s rival.

## Slice 1: living targets (built)

**Principle.** Continuous motion lives on the *footprint group transform*, which `SlotField` already had for the entrance animation. A moving target is a matrix change on a cached picture, so the settled-picture cache and the no-per-cell-views rule both survive. Per-cell effects stay one-shot (arrival pop, chip flash).

**Motion channel.** `GroupMotion` (`variety/view-registry.ts`) is one shared array, `dx, dy, angle` per footprint in `beat.groups` order (`MOTION_STRIDE`). Every consumer reads it: the footprint transform, the hover ghost, the tray's drop resolve, and the volley and blast launch positions in `battle.tsx`. Egg Snap produces it from the shared combat clock in `game/use-combat-offset.ts` so both eggs pause and resume together; the package's own `useGroupMotion` integrates a phase for hosts without a clock.

**Room.** `view/group-motion.ts` measures each footprint's room from its zone's own slack: a two-tall shape in the four-row flank has two rows above or below it, a three-tall has one, and the dealer's random origin decides which side. The layout's upward clearance is added on top. Travel is capped at `SLOT_MOTION_CELLS` (1.75 pitches); every flank shape gets at least one pitch, so the gentlest gust clears half a cell on every device. Sway is half a pitch inward toward the centre, keeping clear of the egg's corridor; the centre zone never sways.

**Vocabulary by strength.** At `DRIFT_FLOOR` the motion is the drift's own smooth vertical wave, one axis, so the mechanic's first reading is its most legible. As harshness climbs the third harmonic arrives (from `drift-metrics.ts`), then a horizontal sway a quarter cycle behind so the path is an ellipse, then a five-degree tilt. The second footprint of a double runs half a cycle behind the first, so a double never moves as one field.

**Honest grading.** `resolveDropAmongGroups` (`engine/slot-drop.ts`) resolves the piece in each footprint's own frame, shifted back by that footprint's live offset, and the footprint whose rectangle the piece most overlaps claims the drop. Nothing claiming it falls back to the un-moved resolve, so a drop into open space misses as before; zero motion reproduces `resolveDropCell` exactly. `DropRelease` and `onCell` now carry the claiming `groupIndex`, and the hover ghost is drawn in that footprint's frame. Rotation never enters the resolve: a turned footprint refuses its piece through `accepts`, so the grid answer is unchanged by the angle.

**Tuning.** First-session gusts are dealt at `DRIFT_FLOOR`; `MOVES.drift` is 0.55. Reduced motion holds every footprint at rest.

## Slice 2: `spin` (target turns, wait for it to face your piece) — built

A timing sibling of `hues` and the cycling bomb. One footprint of the beat turns through wrong orientations on a clock and accepts its piece only while aligned. Lives in `packages/tile-match/src/features/puzzle/variety/spin/` (`spin.ts`, `SpinLayer.tsx`, `spin.test.ts`); the angle rides `useSpinAngle` in `view-registry.ts` and Egg Snap's `use-combat-offset.ts`. Variety layers now receive `motion` so a countdown rides its footprint.

- Data: `groupId`, the wrong rotation indices to cycle, `windowMs`, `nextTurnMs`, `turned`, `facing`.
- `deal` rolls one group whose shape looks different turned (`visibleTurns`, deduplicated by silhouette, so a square never spins and a line has one turn), burning the roll regardless. Opens turned with `nextTurnMs: 0`. `SPIN_WINDOW_MS = 2400`, squeezed 35% by strength; above 0.6 it cycles two wrong turns.
- `expire` derives `turned` and `facing` from how many windows have elapsed. `accepts` refuses the spinning group while turned. `waitMs` is one window. No `shape`, so the perfect-beat guarantee holds trivially.
- View: the angle rides the `GroupMotion` angle slot, tweened over 220 ms; `groupMotionAt` is called with `tilt = false` on a spin beat. A `SpinLayer` draws a countdown bar under the footprint off the host clock, modelled on `HuesLayer`: amber while turned, green while aligned.
- Refusal callout: "Wait for it to turn back". The AI already waits on a live deadline for accurate actions. Add `MOVES.spin` ("Turnabout") so the arena can deal it. Not added to the package's default ladder.

## Slice 3: encounter ladder and visible teaching — built

One new idea per fight, introduced on a single before a double, with a rival that visibly speeds up. The table is `FIRST_SESSION` in `data/ftue-encounters.ts`; `replayEncounter` is the curve; coach copy is `data/coach-copy.ts`; the hold is `tickCombat(state, now, holdAi)`.

| Duel | Opp HP | AI ms | Acc | New idea |
|---|---|---|---|---|
| glade-1 | 36 | 4400–6000 | .68 | snap (no drift) |
| glade-2 | 60 | 3800–5200 | .72 | gust, coached, single first |
| glade-3 | 64 | 3400–4600 | .75 | bomb (defuse) |
| glade-4 | 72 | 3000–4200 | .78 | armour, single first |
| glade-5 | 84 | 2800–3800 | .80 | spin, coached, single first |
| glade-6 | 120 | 2400–3200 | .82 | everything, gust at .7 |

Every row ends on a plain double so a long fight settles. Replays use the same row with HP scaled by wins (capped at 2.5×) and the rival 8% faster per win, instead of jumping to the base numbers. Cheerlet gets `fuse` on its first duel and `hues` on its second; every first-session duel stays `guided`, since the rival's line now shows during the countdown regardless.

Teaching: the rival's intro line shows beside the rival during the countdown, non-blocking. New coach states `gust` and `spin` run over live combat (a pause would freeze the clock that is the lesson). The rival holds while any coach is up, generalising the opening gate. Coach copy moves to `data/coach-copy.ts`. The boss result gets one closing line.

## Slice 4: combat readability — built

A pip meter under the rival HUD (`components/rival-charge.tsx`, fed by `rivalCharge` in `game/rival-charge.ts`) and a clock-driven squash on the rival shell in the last 400 ms before it acts (`windUpAt`, mirrored from `state.aiAt`; held rivals never wind up). Character art for the rivals remains an art-pipeline task.

## Known gaps

- Armour and bomb layers do not yet ride `motion`; no shipped encounter combines them with a gust on one beat, but the arena's mixed mode can.
- The plain (non-atlas) `SlotField` path draws one picture and does not move per footprint; Egg Snap always uses the atlas path.
- The gust and spin coach bubbles, the countdown intro line and the rival wind-up were verified by type check and tests but not by a hands-on drag in the browser, because the desktop browser pane cannot render a live gesture.
