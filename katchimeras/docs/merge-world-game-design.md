# Katchimeras Persistent Merge World

**Status:** Focused v1 implemented · **Source:** Persistent Merge World GDS sections 1–34

## Product role

Merge World is Katchimeras' primary persistent game. Real-life activity grants
Merge Energy; Energy produces items; items are merged or combined into recipes;
Katchimera orders consume those items and advance Friendship, the board, the
collection book, and the existing Wisp collection.

Legacy signature mini-games remain available as an archive. They are not part
of the primary retention or Today recommendation loop.

## Non-negotiable rules

- One shared, persistent 7×9 board. A Katchimera never owns a separate board.
- Merge-2 is deterministic. Two identical, non-max items make the next tier.
- Explicit hybrid recipes may combine two different items; undefined pairs do nothing.
- Real-life activity accelerates play but never gates it.
- Essential board space and Energy are not aggressively monetised.
- Orders never request branches the player cannot generate.
- Board-full rewards go to the reward inbox and cannot be lost.
- Merge Energy, Merge Coins, existing Essence, and Today growth are separate resources.
- “Mote” rewards in the source GDS are existing Wisps. There is no second permanent inventory.

## Focused launch content

| Family | Anchor | Expansion visitor | Branches |
|---|---|---|---|
| Food | Shared Pantry → Feastle | — | Table |
| Nature | Mossprout | Shellio | Garden, Waterside |
| Adventure | Steppling | Voyagle | Trail, Travel |

Voyagle unlocks the first hybrid recipe: a Meal plus an Adventure Pack creates
a Picnic Pack. Players without a launch character still receive the Shared
Pantry, three tutorial orders, and a complete core loop. Feastle discovery
personalises and upgrades that generator.

## Board and economy

- Board: 63 cells; 33 open initially; blockers use vines, rocks, and clouds.
- Storage: 5 slots, growing at Merge Levels 3, 7, 11, and 15.
- Merge Energy: 100 cap, one point every two minutes, one point per generator tap.
- Generator: 12 charges and an 18-minute rest after depletion.
- Drop baseline: 70% tier 1, 25% tier 2, 5% tier 3.
- First discovery: 6 Merge XP, 5 Coins, and 1 Energy.
- Activity defaults: check-in +5, journal +10, photo/moment +5, 5k steps +10.

These values are bundled fallback configuration. Future validated remote config
may tune them without changing persisted state.

## Orders and relationships

Three request slots persist until served. Templates are filtered by unlocked
characters, enabled generator branches, and Merge Level. Major/signature orders
begin at Level 10. Recent-order suppression and favourite weighting keep the
rotation fair.

Serving consumes every requirement atomically, applies Merge-local rewards, and
creates idempotent receipts for Friendship and Wisps. Friendship uses the
existing Bond event ledger with a 20-level presentation. Old Bond levels 1–4
anchor to Friendship levels 1, 3, 6, and 10, so existing progress cannot fall.

## Interaction and accessibility

- Tap a generator to produce an item.
- Drag an item to move, merge, or combine it; tap-select then tap-destination is equivalent.
- Select an item to inspect, store, or sell it.
- Ready request cards expose a Serve action.
- Every cell, item, generator, and action has an accessibility role and label.
- Reduced Motion removes drag and reveal motion without changing game state.

## Deferred

Additional families and full-roster mappings, cloud sync, seasonal boards,
advanced chests, paid/ad bubbles, premium convenience, extensive surroundings,
and event currencies are post-v1 work.
