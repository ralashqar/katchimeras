# Friend Wisp collections

Status: September 2026. Decisions taken as recommended (nine per friend, four pouches a day across friends, economy
perks included, Lantern Echoes kept separate). **Built: the rules, the earning, the ledger and a first surface**
(phases 0, 1 and 3, and the opener from phase 2). **Not built:** the Wisps row on the friend's own page, set reward
claiming in the UI, the perks' effect on the economy, Wisps drawn for each friend alone. Waiting for a device test.

## What is built

- `constants/friend-wisp-constellations.ts`: the four live friends' sets (chosen for now from Wisps that already have
  art and fit the friend; no Wisp belongs to two friends), the five pack kinds per friend (`pouch`, `bright`, `gift`,
  `gift-rare`, `finale`), and a validator that runs when the game starts.
- `utils/wisp-pack-roll.ts`: the pack roll, taken out of the Lantern so both use one algorithm. The Lantern's results
  for a given seed are unchanged.
- `utils/friend-wisp-packs.ts`: friends' packs are their own ledger on the Wisp collection (`friendPacks`), beside the
  Lantern's. No Lantern needed, no Echoes: a duplicate is another copy. Grant, brighten, open, acknowledge, claim set.
- `features/wisps/friend-sparks.ts`: the spark meter, derived from the Bond ledger and the day's activities.
- `features/wisps/friend-wisp-rewards.ts`: one pure planner. Given where each friend stands and what has been given,
  it answers with what is still owed. Bond 2 and 3, the signature at Bond 4 (only once it has art), every third
  friendship level, each chapter's midpoint and end, and today's pouch. A player already far along is given
  everything owed the first time it runs.
- `features/wisps/friend-wisp-runtime.ts` and `use-friend-wisp-rewards.ts`: reads the real stores, applies the plan,
  and re-runs on launch, on return to the app, and whenever Bond or the day's activities change.
- The trophy room's constellation block now shows the friend's nine, today's three spark pips, and an Open button for
  waiting packs (`components/katchadeck/wisps/friend-wisp-pouch.tsx`), using the Lantern's own anticipation and reveal.
- In the Kingdom, each friend with a constellation has a small round Wisps button at their lower right (a dot on it
  when a pack is waiting). It opens that friend's own menu (`components/katchadeck/wisps/friend-wisps-sheet.tsx`):
  their nine cards in the game's collection deck, today's sparks and any pack to open, and for a found Wisp the
  choice to have it follow that friend. The carried Wisp is drawn at the friend's upper right shoulder on their tile
  and rides with them. It is stored per friend (`friendPacks.equipped`), must be one of that friend's own nine and one
  the player has found, and is separate from the player's own companion Wisp. A family with several residents (a
  friend's other forms) shows the button once, on the friend themselves.
- Tests: `tests/friend-wisp-collections.test.ts`.

Two changes from the design below, made while building: the household cap is "the first four friends to fill their
meter" (the planner gives as it goes, so it cannot rank the day's friends afterwards); and watering is not a spark
source yet because it leaves no dated record.

Every Katchimera gets a Wisp collection of its own (its **constellation**), earned by spending time with that friend.
This sits beside the Wisp Lantern's visitor collection; it does not replace it.

## What already exists (and is reused)

- The catalogue already tags Wisps to a friend: `primaryFamilyId`, `affinityFamilyIds`, `seriesId`
  (`<family>-constellation`). All 25 families have one signature Wisp; only Mossprout's (`grovelight`) has art.
  Mossprout, Baristabbit and Pagelet have a pilot constellation of five (`constants/wisp-family-series.ts`).
- The friend's trophy room already draws a "Companion constellation" block, switched on for pilot families only.
- Packs are data (`WispPackDefinition`): slots, weighted pool, rarity guarantee per slot, a pity counter per
  `protectionGroup`, contents rolled at open from a stored seed, reopening never rerolls. The pack reveal and deck
  (`WispPackReveal`) are built.
- Every grant is receipt-idempotent (`applyWispGrant`, `grant_pack.receiptId`).
- Daily tasks are already once per day per friend per kind (`<family>:life:<dayId>:<kind>`), step milestones are
  `<family>:steps:<dayId>:<steps>`, a photo carries a match grade (`ready | possible | no_match`), Bond level-ups
  produce a receipt with `beforeLevel`/`afterLevel`, and Journey episodes complete once ever.
- Mossprout's episodes already give one chosen Wisp by conversation affinity (`journey.wisp_reward`).

## The collection

Per friend, 9 Wisps:

| Tier | Count | How it arrives |
| --- | --- | --- |
| Common | 4 | Friend packs |
| Rare | 3 | Friend packs |
| Epic | 1 | Friend packs (low weight), guaranteed by the last Journey milestone pack if still missing |
| Signature | 1 | Bond level 4 only. Never in a pack, so the set reward never depends on luck for its centrepiece |

Duplicates raise that Wisp's copies, which already drive its evolution tiers (1 / 3 / 7 / 15 / 30). No new currency.
Completing tiers pays a set reward (below).

## Three ways to earn, three different feelings

### 1. Bond levels: a promise kept (no randomness in whether)

| Bond level | Reward |
| --- | --- |
| 2 Familiar | Friend Gift pack: 3 cards, at least one new |
| 3 Devoted | Friend Gift pack: 3 cards, one Rare or better, at least one new |
| 4 Kindred | The friend's signature Wisp itself, revealed as a moment with them |

Friendship levels (the 20-step ladder) add a 1-card pack every third level so Bond keeps paying between the big four.
Hook: the Bond award receipt where `afterLevel > beforeLevel`; authored through the unused `gift` kind of
`bondRewards`, so the locked hint can say "A gift at Devoted".

### 2. Journey milestones: the story hands it over

A new consequence kind `wisp_pack` beside `wisp_reward`. Per chapter: a Friend Gift at the chapter's midpoint and at
its end (the end pack guarantees the Epic if it is still missing). Mossprout's existing per-episode chosen Wisp stays,
with its candidates drawn from his constellation, so the personal pick and the collection are the same set.

### 3. Daily tasks: a meter, not a slot machine

Recommendation: **do not roll a chance on each task.** A photo of someone's real day that "fails" a roll feels bad, and
a per-task roll invites retaking photos until it pays. Make earning certain and keep chance inside the pack.

- Each friend has a daily **spark meter**. Today's tasks with that friend fill it:
  photo graded `ready` 2, `possible` 1 · notice 1 · daily moment 1 · water 1 · each step milestone 1 · Journey episode 2.
- **3 sparks = that friend's Daily Pouch** (1 card). Hard cap: **one per friend per day**, receipt
  `friend:<family>:daily:<dayId>`. More sparks that day do nothing, so there is nothing to spam.
- **Score improves the pouch, never the count.** 5 or more sparks, or a `ready` photo plus the top step milestone,
  makes it a **Bright Pouch**: rare weights doubled. That is where "score" lives.
- Sparks are **derived, not stored**: a pure selector over the ledgers that already exist (life activities, step
  milestones, Journey episodes) for that friend and day. No new counter to drift, double count or migrate.
- A household cap of **4 friend pouches a day** across all friends, highest-spark friends first, so twenty friends do
  not mean twenty pouches. Bond and Journey packs are outside both caps: they are one-time.
- Pity: after 2 pouches with nothing new, the next card is a missing one (per-friend `protectionGroup`).

Pacing this gives: commons in about a week of play with one friend, the full pack set in four to six weeks, the
signature when the relationship gets there.

## Set rewards

| Milestone | Reward |
| --- | --- |
| All 4 Commons | A small decoration on that friend's tile |
| Commons + Rares | A friend skin tint or Egg cosmetic (the pilot families already have three authored) |
| All 9 | A constellation badge on their page and a permanent small perk in their own domain |

Perks, in keeping with the merge-2 and 4X direction (one number each, small): Mossprout +5% Glow from Garden orders,
Steppling +1 energy per step conversion block, Feastle +1 Pantry storage, Baristabbit +3% better finds. They stack with
the Heartwood buildings and are data, like the buildings' numbers.

## Where the player sees it

- The friend's page: a **Wisps** row with `4 / 9`, today's spark meter (three pips), and a pouch when one is ready.
- Opening reuses `WispPackReveal` and the deck as they are, framed by the friend instead of the Lantern.
- The trophy room constellation block, with the pilot gate removed.
- The Lantern hub's Collection tab lists each met friend's constellation as an album.
- Pouches earned before the Lantern is planted are kept and opened from the friend's page; the Lantern is not required.

## Build plan

**Phase 0: content** (gates everything visible)
- Author the 9-Wisp constellation for the four live friends (Mossprout, Steppling, Feastle, Baristabbit) in
  `data/wisps/catalog.planned.json`: reuse ready Wisps that fit (Mossprout: sprout, fern, bloom, dewdrop, grovelight),
  brief and generate the rest through the Wisp art pipeline, regenerate the catalogue and ids.
- A friend with fewer than 5 ready Wisps shows no Wisps row yet.

**Phase 1: rules, no UI**
- `constants/friend-wisp-packs.ts`: per family, `friend-pouch:<family>` (1 slot), `friend-bright:<family>`,
  `friend-gift:<family>` (3 slots, rarity guarantee), pools from the constellation minus the signature, one
  `protectionGroup` each; register `<family>-constellation` as an album.
- Pack validation today only admits cosmetic and seasonal Wisps. Widen it on purpose: a friend's pack may hold that
  friend's own constellation Wisps and nothing else, and never a signature.
- `features/wisps/friend-sparks.ts`: `friendSparks(familyId, dayId, ledgers)` and `friendPouchFor(sparks, inputs)`.
- `grantFriendPack(familyId, reason, receiptId)`; the household cap read from today's granted receipts.
- Tests: caps, idempotency across relaunch, bright rule, pity, a day rollover mid-session, validator rules.

**Phase 2: the friend's page**
- Wisps row, spark pips, pouch ready state, open flow, constellation screen; gallery fixtures.

**Phase 3: Bond and Journey**
- `bondRewards` `gift` entries for the four friends and the level-up hook; signature reveal at Kindred.
- `wisp_pack` consequence and its flow template; chapter midpoint and end packs.

**Phase 4: set rewards and perks**
- `claim_collection` for friend albums; perk numbers in one constants file, read by the engine like the buildings.

**Phase 5: new friends** get a constellation as part of their hatchable definition, so adding a friend adds a collection.

## Open decisions

1. Constellation size: 9 (recommended) or 6 to cut art per friend.
2. The household cap of 4 pouches a day: keep, raise, or drop in favour of one per friend only.
3. Set-completion perks that touch the economy: in from the start, or cosmetic-only first.
4. Whether the Lantern's visitor Echoes should also buy a missing friend Common (I would keep the two separate).
