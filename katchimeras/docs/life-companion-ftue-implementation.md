# Life Companion FTUE implementation

## Product contract

Katchimeras is a life companion game. The first session establishes that the Havenling is the persistent player avatar, Eggs contain separate companions, Mossprout remembers lightweight personal input, Bond opens possibilities, Merge performs restoration work, and the Haven contains more undiscovered realms.

The implementation principle is: reuse current game systems before adding presentation or state.

## Production architecture

- The primary Home route is `/katchimeras`.
- Production Home always renders the existing `KatchimeraKingdomScreen` and `KingdomHexCanvas`.
- The production canvas always selects `floating_neighborhood_v2`. World Asset Lab overrides remain developer-preview only.
- The Home hex remains `{ q: 0, r: 0 }`. Mossprout owns the first adjacent coordinate returned by the existing hex spiral and never changes position when discovered.
- The former collection-grid/Haven toggle is removed from player-facing Home. Collection and developer grids remain on their own routes.
- Existing FTUE orchestration, route recovery, action cards, Egg camera, pulse/crack/hatch effects, companion screen, Merge board, orders, Bond events, timers, Haven upgrades, and avatar layering remain authoritative.

## Navigation ownership

- Haven is the only player-facing Home and the bottom tab bar is retired.
- The old Today route redirects to Haven instead of presenting a competing loop.
- During Egg attunement and hatching, Haven mounts the existing Egg presentation internally. Its camera angle, pulse, reward-flight, crack, zoom, and hatch sequence are reused unchanged.
- The developer first-session restart resets the existing supporting state, starts the current FTUE script, and navigates directly to Haven.

## Data ownership

- `FtueRunState.answers` is the interruption-safe record of exact answer IDs used for immediate Mossprout callbacks.
- `OnboardingProfile.mossproutAnswers` stores the attunement place preference, current feeling, and desired-more choice.
- Existing relationship progression owns Bond stages and the four-hour reflection delay.
- Existing Merge state owns board items, orders, Coins, relationship-gated roots, three-cell story clearings, generators, and Haven stages.
- Existing Egg avatar storage equips the free `moss-sprout` layer as the Leaf Pin reward.

No second memory service, currency, board, Bond model, dialogue renderer, or avatar system is introduced.

## Cutover policy

Unfinished prototype FTUE runs below script version 31 restart at the new Haven entry. This resets only the guided FTUE record. It does not delete captured moments, notes, photos, or their source files. Completed runs remain completed; developer reset tools can replay the new sequence.

## Early progression

- The Garden Basket is the existing `wild-garden` generator with updated player-facing naming.
- The First Garden upgrade costs 50 existing Merge Coins.
- Relationship downtime is four hours; Merge remains available.
- The first early Bond gate becomes eligible at Familiar on the second active Mossprout day.
- The Seedbed Edge clears exactly three existing board cells on Day 2.
- Later pond, nursery, tree, Journey, Wisp, and second-companion systems continue through the existing campaign and discovery architecture.

## Guardrails

- Merge rewards never generate grindable Bond.
- Do not add a daily Egg or required journal checklist.
- Do not ask for the same personal fact on separate surfaces.
- Keep dialogue to one to three short bubbles around an action-card choice.
- Major Grove progress uses the existing Haven environment stages and upgrade presentation.
- Add animation only when no current camera, pulse, reward-flight, merge, hatch, reveal, or environment-swap behavior can express the beat.
# Navigation ownership

Haven is the only player-facing Home and the bottom tab bar is retired. The old
Today route redirects to Haven. During Egg attunement and hatching, Haven mounts
the existing Egg presentation internally, preserving its camera angle, pulse,
reward-flight, crack, zoom, and hatch sequence without exposing Today as a
separate product loop. Developer first-session restart resets the existing
supporting state, starts the current FTUE script, and navigates to Haven.
