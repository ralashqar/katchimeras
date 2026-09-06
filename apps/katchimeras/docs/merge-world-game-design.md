# Katchimeras Persistent Merge World

> Historical shared-world design. The production Mossprout vertical slice now
> follows [Mossprout Personal Merge World v18](./mossprout-personal-merge-world-v18.md).
> Where this document mentions a shared board, Merge Energy, or orders awarding
> Friendship, the v18 document is authoritative.

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

- Board: 63 cells partitioned without orphaned fog: 13 starting cells, 12
  Mossprout Rootbound cells, 18 Garden Growth cells, and 20 Discovery Mist
  cells.
- Dream Mist overlays normal tiles. Matching items merge into Dream Echoes, create the next tier on the reclaimed cell, and permanently remove its Mist.
- Garden Growth Mist clears in three-cell groups on active Journey Days 3, 7,
  12, 15, 21, and 28; there is no Mist-clearing currency.
- Discovery Mist belongs to Katchimera arrival paths and opens when its
  companion joins the shared board. Discovery trails dynamically choose empty
  safe cells and cannot overwrite a Rootbound cell or an item the player owns.
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

Authored five-request bundles keep all five requests as durable entries in the
horizontal rail. They may add a companion note after the second delivery. This
is a midpoint interlude, not a new order set: the note appears before the three
unserved requests, which remain present while the note is waiting and while its
conversation is open. Only requests actually served may rotate out.

Serving consumes every requirement atomically, applies Merge-local rewards, and
creates idempotent receipts for Friendship and Wisps. Friendship uses the
existing Bond event ledger with a 20-level presentation. Old Bond levels 1–4
anchor to Friendship levels 1, 3, 6, and 10, so existing progress cannot fall.

## Life arrivals and chapter landmarks

The first meaningful journal capture for a local day may create one contextual
Life Parcel and one Memory Arrival in addition to the daily Energy grant. The
parcel belongs to the active Katchimera (favourite first, then active story
request, then the first unlocked companion) and contains only tier-one items
from that companion's unlocked core chains. A confirmed journal route may pick
between those core chains; an unrelated route falls back to the companion's
active order or primary core chain rather than introducing off-theme items.

Memory Arrivals contain only a stable local journal reference and safe route
label. Raw text, photo URIs, place names, and coordinates never enter Merge
state. Opening one returns to the source day's Memory Vault; it never occupies
a board cell. Memory Arrivals remain hidden from the Merge screen until their
permanent collection presentation is ready. One completed optional real-life
goal per day may also create a themed three-item chest. Every delivery is
receipt-idempotent.

The Merge screen presents the oldest claimable parcel as one compact gift crate
with a queue-count badge. The stable parcel stack is always the first item in
the horizontally scrolling request rail. Claiming from a multi-parcel queue
updates the same badge in place; only the final claim removes the stack, with a
smooth outro while the remaining trays slide left. Pressing claims atomically,
opens a visual copy of the crate, and flies the granted items to their actual
board cells. The flight copy stays opaque through landing while the committed
board sprite is revealed underneath. Its destination center and responsive
art size come from the board's measured cell geometry, and the flight ends at
exactly scale one, so delivery has one continuous entrance
rather than a flight followed by a second fade. A full board leaves the parcel unclaimed and uses recoverable
feedback. Legacy activity parcels are converted once to the same typed,
companion-owned model; their former random contents are discarded.

Serving an authored signature order for Feastle, Baristabbit, Steppling,
Voyagle, Flexel, or Bedrotte permanently records that chapter's shared-world
landmark. Landmarks decorate progression outside the 63 inventory cells.

## Mossprout board progression

Mossprout's first long-form board arc spans 28 active Journey days across four
chapters: Quiet Patch, Returning Pond, Memory Nursery, and Heartwood. Twelve
Rootbound Echoes keep authored Mossprout cells throughout the arc. Later
Katchimera discovery trails allocate around any root that is still sealed.

Each covered cell displays one central image only. Rootbound cells show their
specific contained reward; Garden Growth cells use unmarked full Dream Mist;
Discovery Mist shows its discovery sparkle. Conditions and explanatory copy
live in the tap panel rather than additional corner badges. This makes full,
unmarked Dream Mist the consistent visual language for passive Journey growth,
not a mergeable item or a required key.

- Each root shows its authored condition when pressed: active Journey days,
  Friendship, distinct nature-memory days, choosing and acting on a small
  nature goal with Mossprout, or befriending an associated Wisp.
- A satisfied condition queues one exact, gate-bound **Root Memory** parcel.
  Root Memories are Mossprout progression keys: they cannot drop from ordinary
  generators, merge with normal items, be sold, or be stored. A key only wakes
  the root named on its parcel. Only one new root parcel may be earned per
  active day and at most two may wait unopened.
- Life conditions are accelerators rather than permanent walls. After the
  authored delay, sustained Mossprout garden play supplies a soft fallback.
- Matching the parcel item into the ready root consumes the Root Memory,
  permanently opens the cell, and records an idempotent awakening receipt.
  The reward is explicit and stays in Mossprout's lane: open space, Wild Garden
  growth, Memory Nursery growth, a Mossprout Keepsake, a Wisp, a Memory Card,
  or the Heartwood landmark. Foreign Katchimera chain items are never root keys.
- The day-12 root awards Fern. The day-21 root awards a rare Veiled Memory Card
  from the generic Small Wonders collection. Memory Cards reveal into their own
  album and are intentionally separate from Katchimera skin cards.
- The day-15 Nursery Key installs the Memory Nursery and its six-tier Keepsake
  chain. Later daily baskets may request Keepsakes and the authored Memory
  Bloom, Rain Mirror, and Heartwood Sanctuary recipes.
- The day-28 Heartwood root awards the Mossprout-associated Grovelight Wisp.
  Owners of Grovelight can also create a recovery match parcel for a ready root
  on a seven-active-day cooldown.

Merge state schema v17 persists only privacy-safe progress signals: stable day
identifiers, counts/stages, Wisp identifiers, and gate receipts. Journal text,
media, locations, and other raw memory content never enter Merge state.
When a v15 save had already claimed one of the retired cross-Katchimera root
parcels, migration preserves that ordinary item and issues the correct bound
Root Memory once, so no earned progress is lost or duplicated.

The production sprites and their crop manifest live in
`assets/images/katchimeras/merge-world/items/` and
`scripts/merge-world-mossprout-progression-art-manifest.json` and
`scripts/merge-world-mossprout-lane-art-manifest.json`. Checked-in contact
sheets at `artifacts/merge-world-v4/mossprout-progression-review.png` and
`artifacts/merge-world-v4/mossprout-lane-review.png` support visual review.

## Interaction and accessibility

Player-facing wording for covered cells, progression items, parcels, and item
makers follows the shared [Merge Board Player-Copy Guide](./merge-board-player-copy-guide.md).

- Tap an item maker to produce an item.
- A persistent inspector below the board remembers the last tapped item,
  generator, Echo, Rootbound cell, Garden Growth cell, or Discovery cell. It
  names the selection, previews its art when applicable, and explains the exact
  merge, Journey, relationship, memory, Wisp, or discovery condition that opens
  or advances it. Covered-cell inspection works with both touch and
  accessibility activation.
- Locked-item thumbnails reuse the exact art shown in their board cell with the
  lower Dream Mist layered over it. Player copy uses direct instructions such
  as “Save a nature memory to wake this root”; schema terms, fallback formulas,
  generator levels, and other internal progression labels never appear in this
  panel. Item-maker improvements name their visible benefit instead: the Wild
  Garden begins finding Sprouts and Shells, while the Memory Nursery begins
  growing Pressed Leaves; later improvements make those finds more frequent.
- Tapping a locked cell always moves inspection focus to that cell, replacing
  any previously selected movable item. The same corner frame marks the focused
  locked cell, but remains completely still to communicate that the cell can be
  inspected but not dragged. Dragging a matching item onto it remains the wake
  interaction.
- Drag an item to move, merge, or combine it; tap-select then tap-destination is equivalent.
- Select an item to inspect, store, or sell it.
- Ready request cards expose a Serve action.
- The Merge board's top edge stays attached directly beneath the tray separator; optional overlays never change that baseline.
- Parcel and order-serving flights cannot mutate the board at the same time.
- Every cell, item, generator, and action has an accessibility role and label.
- Reduced Motion removes drag and reveal motion without changing game state.

## Deferred

Additional families and full-roster mappings, cloud sync, seasonal boards,
advanced chests, paid/ad bubbles, premium convenience, extensive surroundings,
and event currencies are post-v1 work.
