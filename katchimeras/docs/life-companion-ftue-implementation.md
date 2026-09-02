# Life Companion FTUE implementation

## Product contract

The first session establishes Eggs as the origin of companions, Mossprout as the player's first relationship, Merge as Garden work, and mist-covered Katchimera tiles as future discovery. The implementation reuses current game systems and changes their FTUE orchestration and presentation.

## Production architecture

- `/katchimeras` remains the primary Home route and keeps the roster/world host mounted throughout FTUE.
- The top-level roster is one hex per Katchimera. While FTUE is active, Mossprout is the only available hex and every other Katchimera is forced to its locked mist presentation.
- FTUE bypasses the top-level selector and opens `KatchimeraKingdomScreen` for Mossprout immediately.
- Before hatching, Mossprout's main world hex uses its Egg state instead of its companion state.
- The existing Egg/companion interaction UI is layered transparently over the still-mounted world host, but renders no second subject. The Egg resident anchored inside `KingdomHexCanvas` remains the sole Egg, receives reward-flight measurements, face and growth state, and hatches in place into Mossprout. The world camera provides the close framing and feed-to-feed motion.
- Mossprout's standalone cinematic companion route is legacy. Every Mossprout dialogue entry redirects to the focused Mossprout world, locks and closes the world camera on the resident, and renders the resident's animated idle WebP in place. Horizontal interaction swipes dismiss back to the regular world framing without translating speech; active FTUE beats suppress that dismissal.
- Existing FTUE persistence, route recovery, action cards, Egg effects, companion dialogue, Merge board, orders, Bond events, timers, and resident-card systems remain authoritative.

## Navigation ownership

- `world.egg_intro` owns the cold-start route, presents “Something is waiting here” at the top, and gradually focuses the Mossprout Egg.
- The intro advances automatically into the first action card once the locked camera move settles. The redundant “There’s something here” inspect beat remains retired. Questions and Hatch stay over the focused world rather than mounting the cinematic environment.
- `companion.first_meeting` advances through `companion.bond_spotlight` before the first action card so Bond is taught in context.
- `companion.order_preview` prepares the canonical tutorial Merge board, then advances to `world.garden_arrival` without navigating directly into Merge.
- `world.garden_arrival` pans to the Garden and presents its unspotlighted introduction before advancing automatically.
- `world.garden_handoff` returns to the world host, focuses the Garden tile, renders one non-interactive First Bloom request, and spotlights the actual Garden button.
- `world.open_garden` persists before routing to the existing activity/Merge screen.
- `world.complete` owns the terminal return and completes FTUE on Mossprout's world map.

## Data ownership

- `FtueRunState.answers` remains the interruption-safe record of exact answer IDs.
- `OnboardingProfile.mossproutAnswers` stores the three Egg attunement choices.
- Existing relationship progression owns Bond stages and reflection timing.
- Existing Merge state owns board items, orders, Coins, generators, and story clearings.
- Script version 35 retains the version-34 backend actions while adding the local narrated Garden-arrival beat; no second memory, currency, board, Bond, or dialogue system is introduced.

## Cutover policy

Active older runs migrate to the nearest safe current beat. Superseded world-entry steps restart at `world.egg_intro`, while the retired inspect step resumes at `egg.opening`; retired reveal/upgrade completion steps resume at `world.complete`. Completed runs remain completed, and captured user content is untouched.

## Guardrails

- Normal world-map rendering does not expose order trays. The FTUE Garden handoff may show only `mossprout:chapter-0:first-sprout`.
- Merge rewards never generate grindable Bond.
- Do not equip the Leaf Pin, reveal another Katchimera, or apply a Haven/world upgrade during completion.
- Do not add a daily Egg or required journal checklist.
- Do not ask for the same personal fact on separate surfaces.
- Keep dialogue to one to three short bubbles around an action-card choice.
- Preserve reduced-motion behavior for every new cross-fade or camera transition.
