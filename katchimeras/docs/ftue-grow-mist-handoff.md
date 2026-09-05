# Mossprout → Grow → mist → Steppling

Implemented September 5, 2026. Preserves the existing action cards, narrative choices, art, fonts, timer panel, and horizontal submenu transitions.

## Player flow

The opening Egg question is “How do you feel?” with the original Radiant, Light, Meh, Heavy, and Stormy art in a centered 3 + 2 grid. This exception uses the shared question panel, fonts, and reward sequence. Other Egg questions keep their existing layout; previous saved feeling answers and replies remain supported.

1. After restoring the garden, Mossprout responds to the shared accomplishment. Three conversational answers lead to a short personal reply and the Notice one small thing card. The FTUE skips the Grow gateway.
2. Tapping Notice one small thing opens the shared narrative choices immediately, asking about light, a sound, or something growing. Not now continues without rewards. The FTUE hides both the header and submenu Back buttons; Not now remains available in the noticing choices. Regular Grow navigation keeps Back.
3. An answered observation uses the normal daily activity journal and Bond reward animation. There is no confirmation button. It counts as that day's noticing action; retrying or reopening cannot award it twice. After the reward finishes, the existing Bond spotlight highlights the top bar with one short explanation underneath. Continue saves acknowledgement and opens the rest dialogue. Skipping the activity bypasses this spotlight.
4. Mossprout explains that the next Journey waits while the garden remains available. The farewell uses three short speech beats, with Continue between them and Rest only on the last beat. Grow replies also use the shared 120-character page limit. Rest starts meditation. Until the mist handoff is accepted, the only activity is Explore the mist beneath the existing Journey timer.
5. Explore the mist (including Back) saves the handoff and starts the existing two-request Glow mission before leaving the companion. The requests and 40 Glow mist cost are unchanged.
6. The Steppling tile and sleeping Egg share the same reveal progress, so they fade in together after the tile art is ready. The Egg stays mounted into the questions without a second entrance fade. Its face wakes through the shared feeding expression sequence, and saved feeding keeps it awake on return. The reveal says Meet the egg. Pressing it records acceptance, hides the reveal, and opens the existing Steppling encounter with its camera framing. Only a mounted encounter with saved egg data and a settled camera completes the handoff. Players still answer, feed, and hatch themselves.

The floating world Garden button is visible for planting/restoration and ordinary world exploration. It is hidden during the separately hosted FTUE companion dialogue, Grow, meditation, and any normal companion interaction.

## Recovery

- Old unfinished garden returns enter the new dialogue. Completed water-offer checkpoints move forward without repeating the introduction.
- A committed FTUE scene edge can repair a lagging story journal using its existing receipt. Unanswered choices are never invented.
- An interrupted noticing reward resumes its receipt; acknowledgement opens the saved Bond spotlight, then Continue leads to Rest. Older profiles already past the observation stay past it, including lagging old journals. Resetting the profile also resets the pinned noticing day and activity journal.
- Accepted mist handoffs recover the world story on foreground/cold launch. Companion auto-exit belongs only to the mounted interaction that witnessed the meditation-to-complete transition. Old receipts and loading/unfinished Glow stories cannot close or lock a newly opened Mossprout interaction. Failed live navigation remains retryable.
- Accepted egg reveals resume at `egg.enter`. Older completed reveals with an unopened egg are migrated there; visited or hatched encounters are not replayed. Completed reveals never reconstruct their CTA.

## Verification

Passed: TypeScript, ESLint on changed TypeScript files (no warnings), all 214 story-flow tests, 37 native-transition and Steppling tests, and `git diff --check`.

Automated coverage: story graphs, existing two-request mission/economy, skipping, shared daily reward deduplication, activity reset, paced speech and hidden FTUE Back controls, lagging journal repair, accepted-reveal reload, duplicate presses, host readiness, and failed readiness-save retry.

Native visual walkthrough still required (no connected native test device available in this session):

- Fresh profile: restore garden, each dialogue answer, notice/skip, Bond spotlight, Rest, mist mission, Meet the egg.
- Verify Continue through the FTUE speech, no Back during the Grow introduction, and normal Back navigation after the tutorial.
- Interrupt during reward flight, meditation handoff, mist reveal, and egg camera motion; resume without duplicate rewards or stranded CTAs.
- Narrow screens, large text, and reduced motion: readable shared narrative panels and full card reward exits.
