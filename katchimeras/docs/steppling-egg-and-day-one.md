# Steppling: revealed Egg → Day 1 → Garden parcel

The new encounter lives on `steppling-home` in the same world as Mossprout. The
existing mist-unlock flow still ends at its final Continue. Tapping the revealed
Egg then starts this encounter; no world route or transition curtain is involved.

## Authoring

- `features/onboarding/steppling-egg-policy.ts`: the three opening intentions,
  three movement alternatives, and the 500-step threshold.
- `features/content-flow/steppling-day-one-flow.ts`: the regular Day 1 journey.
  Scenes use `journey.reflection`; its optional choices are action edges. Closing
  leads to the reusable `journey.grant_generator_parcel` effect. Keep the reward
  ID stable when changing copy so existing players do not receive another parcel.
- `components/katchadeck/world/steppling-encounter-panel.tsx`: uses the original
  `EggQuestionPanel` and `EggActionDock` from Today Nurture, including the question,
  Bond reward header, illustrated options, typefaces and selection lifecycle.
  Both Eggs use the same `eggQuestionAction` adapter. The steps offer retains the
  existing steps widget; answers stay visible until their feed animation lands.
- `components/katchadeck/world/shared-resident-presentation.ts`: shared tile-relative
  anchor, subject dimensions, baseline and camera presets. Steppling is full-size,
  so its Egg uses the first Egg's full-grown framing. Hatch and ordinary resident
  art share the same position. The resident interaction owns the pre-Egg camera
  snapshot after hatching, so Back restores the original world view.
- `constants/steppling-day-one-conversation.ts`: adapts Day 1 authoring to the
  existing companion conversation engine. `use-steppling-day-one.ts` reconciles
  its completed answers into the durable journey/parcel ledger. There is no
  separate Steppling day panel or tap interception outside normal interaction.
- `utils/hatch-reveal-timing.ts`: shared discovery phase timings, including reduced
  motion. Both the original hatch controller and Steppling use these values.

## Persistence and economy

`MergeWorldState.stepplingEgg` stores the frozen local source day, intention,
explicitly fed cumulative steps, alternative answer, and hatch timestamps. Reading
steps never feeds them. Feeding the same observed total twice does not add more
progress; only an increase above previously fed steps counts, capped at 500.
An alternative reflection, including rest, grants readiness without inventing
steps. Neither path changes Glow or merge Energy.
The question headers advertise 10 Bond for the opening intention and 20 for the
movement reflection. Saved answers reconcile these real Bond rewards using stable
event IDs; retries do not pay twice, and Bond does not fabricate any step count.
The second beat shows only the steps action card, or automatically uses the shared
movement question when steps are unavailable, zero, or already fed. No extra
explanation panel, Check steps button, or Find my own pace button is shown.
Steps grant `ceil(total explicitly fed steps / 300)` Bond: 500 steps grants 2,
and 5,444 grants 19. `bondFedSteps` preserves the full total separately from the
500-step hatch counter. Partial feeds pay only the increase in the rounded total;
the stable aggregate Bond event makes retries safe.
The steps card measures its right-hand Bond section as the flight source and uses
the same `eggBondFeedPayload` batch as the Egg questions. Launch drives the feeding
expression; arrival triggers the shared shake/glow and releases the held card.
Reduced motion and partial feeds awarding zero new Bond settle without fake tokens.
Question choices, steps cards and Hatch use the shared Egg action-confirmation
haptic. The overlay forwards actual Bond-token landings to the original feed
controller's soft/light/medium sequence. Both hatch controllers use
`egg-haptics.ts` for soft pulses every 100 ms through shaking/cracking, a heavy
reveal impact, and the settling success cue. The pulse loop stops before the
impact and on cancellation, backgrounding or unmount; a stalled sequence is
bounded to eight seconds. Reduced motion gets one soft cue instead of the loop.
Waiting-Egg rays and reminders are disabled during hatch and resident handoff;
the shared renderer keeps only the first Egg's centered hatch sunburst.

Hatch intent is saved before animation. Reopening after interruption replays the
reveal. Finishing the animation automatically commits ownership through the existing discovery ledger.
The retained hatch subject remains mounted until the normal resident projection
is available, then opens the same hosted companion interaction used by Mossprout.
There is no extra claim button or intervening camera retreat. No spawner is granted at hatch.

Day 1 version 3 is a two-selection conversation: choose A little walk, Movement my way,
or A gentle day; then press Tend garden under the personalised response. There are no
reply acknowledgements, timing questions, habit offers or extra completion controls.
Day 2 retains optional habit setup. The normal steps, Garden and trail-chat cards
remain available without any required walking or new permissions prompt.

The final selection completes the conversation before the receipt-backed parcel grant.
A pending Garden handoff survives a restart until the shared Garden mounts with the
parcel present and records `gardenHandoffAt`. Existing completed v1/v2 sessions are
not replayed; unfinished sessions retain their turns and resume at the new question
or the response to their saved movement choice. Archived definitions remain available
for settling older completed sessions and their rewards.

Speech bubbles normalize whitespace before rendering and FTUE pagination. Authored
newlines no longer force extra pages; the 120-character FTUE limit and natural text
wrapping remain. Inline emphasis keeps its word-boundary spaces.

Day 1 remains a regular conversation with no FTUE locks or spotlights. Leaving through
the shared Back control and tapping Steppling resumes the saved conversation. Completing its closing
beat delivers one Journey Locker parcel. Opening it uses the existing parcel
flight, installs a generator only into an empty unlocked, mist-free cell, and
unlocks its chains for regular requests. A full board leaves the parcel intact.
Legacy owners and existing generators are preserved.

## Verification

Automated coverage is in `tests/steppling-encounter.test.ts` and included in
`npm run verify:story-flows`. Also run typecheck, lint, Merge World, and kingdom
tests after modifying the flow.

Device QA still required:

1. Tap revealed Egg: full-size idle, same-world zoom, no curtain or stray controls.
2. Check 0, 230, exactly 500, and 5,000 yesterday steps; repeat taps and denied
   Motion permission. Confirm partial progress persists across restart.
3. Try all three alternatives, including rest; confirm there are no fake steps.
4. Background during feed/hatch; reopen and finish automatically without duplicate ownership.
5. Check Steppling WebP, reduced motion, small-screen/large-text layouts, and the
   handoff to the normal resident without a missing or doubled subject.
6. Leave/resume each Day 1 scene, finish it, and open the parcel. Repeat with a
   full board, free one cell, and retry. Confirm one spawner and no forced lesson.
7. Compare prompt, steps-feed and Hatch haptics with the first Egg on an iPhone.
   Confirm each Bond landing feels synchronized and no offset waiting rays remain
   behind Steppling during reveal, including after background/resume.
