# Cozy 4X FTUE v2: "The Wayfinder's Road", from the first battle to the Hollow Tree

Status: design approved Sept 25 2026. Phase 0 (this doc) written. **Phase 1 built Sept 25 2026 (uncommitted, device test pending):**
- first-session XP: 45 for Mossprout, carried on `grantStoryGlow`'s `xp`;
- the lift held for 2.2s;
- the mission card folded into the tracks (flow v61, script v59);
- event lines on the stones, and the muffled "Someone in the Mist" voice (`SpeechLine`, `rescueBattleLine`);
- Chapter 1 as "The Lit Window": a tile opening with a runtime `TileBeacon`, then Baristabbit's Lanes rescue with no ticket (`constants/rescue-battles.ts`), the Café's teaching lines, and training Mossprout;
- a tap on a hero opens their hero panel.

Not yet built:
- the evening tint in the cliffhanger;
- Mossprout's Bloom intro on stone 2 (Phase 2).

Phases 2–6 are in Part E. Supersedes the post-Act I beats of `cozy-4x-ftue-the-last-clearing.md`.

## Context

The first session (the Last Clearing to Steppling's rescue) is built and plays well. The chapters that follow were bolted on across several older directions, and they don't form one game yet. Three problems stand out:

- After Steppling, almost every reward source is an **old mechanic**:
  - Territory battles: the Sleeping Grove, Daily Mist, Fernip, and every friend after Petalimp.
  - Glow-strikes boards: the Baristabbit and Feastle rescues, which are also behind a 60-Glow toll.
  - Column-shot: Wanderling.
  - The time trial: the Rush Track.
- **Heroes do nothing in Lanes.** The dock hides ability buttons on Lanes (`hatchable-mission-dock.tsx:388-393`), and `laneFire` ignores hero level. Island friends can't fight or level at all.
- **The story goes flat** once the session ends. Goals appear with no scene. Nothing in the flow says *why* you gather, *why* you train, or what the Mist is doing back.

The target game has exactly two merge modes:

- **Lanes:** merge plants that shoot up at wisps coming down from above, clearing the Mist.
- **Gathering:** merge items at the Café / Kitchen to serve orders.

One loop ties everything together, and every beat is dramatised through the lore bible: **fight → rescue → feed → grow → push further**.

The user's decisions (Sept 25 2026):
- **Frontier tiles** on the map replace the Grove and Daily Mist.
- **Every rescued friend is a hero.**
- **Heroes matter in combat** through an ability button docked under the board, plus level power.
- **Hide** the Wanderling and Rush packs now; convert them later.

---

## Part A: What's broken or fragmented

### Old mechanics a player still plays for rewards
1. **The Sleeping Grove** (`constants/regions/sleeping-grove.ts`, territory `dark-wisps`) is where every "Needs Glow/XP" goes (`features/sanctuary/goal-need.ts:29-40`, `openGlowSource` in `katchimera-kingdom-screen.tsx:3093-3099`). The playthrough test grinds it. It has a Mist % meter, turns, Resolve and Seed Pods, none of which the first session teaches.
2. **Daily Mist** (`features/encounters/daily-mist.ts`) is territory too, and unlocks at Grove 5.
3. **Baristabbit and Feastle rescues** (`mission:baristabbit` and `mission:feastle`, no `mechanic`) fall back to **glow-strikes** (`mechanic.ts:33-35`). Each costs a 60-Glow ticket (`hatchable-flows.ts:57-68`). The rescue is a toll booth, not a rescue.
4. **Fernip onward:**
   - Fernip's `FERNIP_LEVEL_SPECS`, his `:boss` extra rung, and the `patternLevelSpecs` used by Blossle, Drizzlet, Amberleaf and Mistle are all territory (`island-levels.ts:313-401`).
   - Blossle through Mistle have **no boss**.
   - The Bloom House and Thicket perks only work in Lanes, so they do nothing on these islands.
5. **Wanderling Trail** (column-shot plus territory) and **Rush Track** (wisp-rush) wake as soon as Steppling is home (`wake-order.ts:46`). Their island taps work, but no chapter mentions them.

### Heroes are cosmetic in battle
6. Lanes hides the ability buttons, and `laneFire(tier)` (`lanes.ts:30`) has no hero input. Training changes nothing you can feel.
7. `PLAYABLE_KATCHIMERAS` covers only mossprout, steppling, baristabbit, shellio and voyagle (`katchimera-progression.ts:16`). Petalimp, Fernip, Feastle and the rest never earn XP, but the roster still gives each of them a Train button (`hero-roster-sheet.tsx:51`).
8. "Playable" is computed three different ways (`kingdom-screen:625`, `level-track-sheet.tsx:46`, `kingdom-screen:4108`).
9. Ability copy (`constants/companion-abilities.ts`) is written for territory ("merge beside Mist").

### Economy and goal soft-locks
10. **Chapter 7 "Train Steppling to 4" and Chapter 9 "…to 6"** need Lodge 3 and Lodge 5. No goal asks for those, and `goalNeed` returns null for a building shortfall. The card is a dead end.
11. **"Fill a Kitchen crate"** is really `crates>=2` (`sanctuary-chapters.ts:146`), so Café crates already satisfy it.
12. **The Dew Spring** ("keeps the Mist calm") only acts in territory turns (`settle.ts:165`), and levels 1-2 give 0 anyway. Chapter 1 promises something false.
13. **The Seed Nursery's `tierTwoChance`** isn't passed to `lanesTick` at the call sites found. This needs checking at the live dock.
14. **The Lodge at level 1** adds +0 Timber per order, but Chapter 2's copy says it pays more.
15. **The first-session battles pay no XP.** Mossprout leaves at level 1 with nothing to train.
16. **A `world_offer` goal whose offer is missing does nothing silently** (`kingdom-screen:3119-3123`). This could bite "Bring X home" once an island reaches level 4.
17. **Pacing past Chapter 3 is untested.** Chapters 5–9 need 135+ Timber for the tree alone.

### Story and flow gaps
18. **The first session ends flat** on "Welcome home". Chapter 1 appears with no scene.
19. **Steppling's muffled line** plays in the same unnamed bubble as Mossprout's, so it reads as Mossprout.
20. **About 7 tap-through beats** sit between the first battle and trail stone 1: lift, tree, Sanctuary card, frontier, tracks, tile tap, mission card. The "We did it" lift commits after 200ms.
21. **Trail stones 1 and 2 are nearly silent** (one or two lines each).
22. **The first session never teaches** abilities, XP, training or buildings. Chapters 1–3 introduce all of them at once.
23. **Tapping Mossprout or Steppling** opens the old companion-life page: Bond, meditation, day-one, "Tend garden" (`selectResident` at `kingdom-screen:1817-1831` → `KatchimeraCompanionRouteScreen`).
24. **Merge-era copy** remains in the Blossle, Drizzlet, Amberleaf and Mistle campaigns ("Open Merge", "Requested in Merge"). Mistle says "Keep living your days with Mossprout". Head-counts in lines ("Three of us") are wrong. Steppling's and Baristabbit's `dayOne`/`lesson` guides still talk about the Garden board.
25. **Nothing ever pushes back.** The Mist never re-takes anything, so there is no 4X tension and no daily reason to fight.
26. **There is no Chapter 10.** The Hollow Tree, the big mystery of the first session, is never paid off.
27. **Stale docs:** `cozy-4x-ftue-the-last-clearing.md` has the wrong first goal, a "level track" that doesn't exist, and wrong line counts. The dead script steps are at `mossprout-ftue-script.ts:249-~895` (version 58 vs flow 60).

---

## Part B: Design pillars

1. **Two merges, one war.**
   - Lanes is how you *fight*.
   - Gathering is how you *feed the fight*: Meals train heroes, Timber raises the Tree and buildings.
   - Every gathering screen says who it's for and what it unlocks next.
2. **The map is the progress bar.**
   - The Mist sits on real tiles around the Sanctuary. Each win reclaims a tile you can see.
   - The Heart Tree's level is its *light radius*, which decides how far out you can fight.
   - Reclaimed land yields resources: that's the 4X territory.
3. **Every chapter is a rescue with a signal.** Its drama arc runs: a sign of life in the Mist → push the frontier toward it → a hard fight → a friend home → they make the Sanctuary stronger (a building plus an ability) → a new sign.
4. **The Mist pushes back.**
   - Reclaimed edge tiles can turn **contested** overnight (a Mist Surge).
   - Scripted Surges hit the Sanctuary itself at key story moments.
   - Stakes stay real but cozy: what the Mist takes can be taken back.
5. **Teach one thing per beat, through a character.** Every new mechanic is introduced by the friend it belongs to, in their voice. There are no tutorial pop-ups without a speaker.

---

## Part C: The improved and extended script

The voice follows the lore bible v2 (`docs/cozy-4x-ftue-the-last-clearing.md` §1):
- short lines;
- no "!" while the Mist is present;
- the Mist's verbs are *take/hold/forget*;
- ours are *restore/reclaim/reconnect/grow*.

### Act I: The Last Clearing (built; tighten it)

The beats stay. The changes:

- **The lift breathes.** Hold "We did it" / "We actually did it" for at least 2.2s. Mossprout gets a small exhale animation.
- **One continuous camera move.** Merge `world.frontier`, `world.lost_tracks` and `world.lost_trail_mission`:
  - The pull-out ends *on* the trail tile. "That's all Mist. All of it." → "And that… is the Hollow Tree. Nobody goes near it anymore." → the camera drifts → "Wait. Tracks." → "Someone's still in there."
  - The tile is spotlit with the button **"Follow the Lost Trail"**.
  - This saves three taps. The mission card is shown inside the tracks panel as an eyebrow.
- **The stones get a voice.** Event-driven lines through `lostTrailLine`:
  - **Stone 1**, on the fast wisp's arrival: "That one's quick. Don't let it through."
  - **Stone 1**, on its fall: "Faster than it looked. Not faster than you."
  - **Stone 2**, on the first Mist-row burn: "See? It can't hold against the light."
  - **Stone 2 introduces Mossprout's ability.**
    - This is the first time the new Lanes ability dock appears (Part D2). Stone 2 is scripted so Bloom charges early.
    - Mossprout: "I can help. Tap me when I'm glowing." The finger points at the button, then Bloom grows a piece a tier.
- **Stone 3's rescue gets a speaker.**
  - Steppling's lines get their own bubble style: a muffled, italic name tag, "Someone in the Mist".
  - "Hello? Is someone out there?"
  - At the halfway point: "I can see light. Keep going."
  - When the last wisp falls: "Almost. Burn it off."
- **XP.** The four first-session battles pay Mossprout XP: 10/10/10/15 = 45, which reaches level 2 at 40. The reward card shows "Mossprout is ready to grow". The training *lesson* waits for Act II.
- **A cliffhanger ending replaces the flat "Home".**
  - After "Welcome home, Wayfinder.", the sky dims to evening (Kingdom tint).
  - Steppling: "Hey… is that a light out there?"
  - The camera goes to the `baristabbit-home` tile, still misted, with a warm lit window glowing through the Mist (a runtime glow effect on the misted tile).
  - Mossprout: "Someone's keeping a lamp lit."
  - Mossprout: "In the Mist. On purpose."
  - Chapter card: **Chapter 1: The Lit Window**.

### Act II. Chapter 1: The Lit Window (Baristabbit, and teaching gathering)

| Beat | What happens | Lines | Teaches |
|---|---|---|---|
| 1 Goal: "Answer the lit window" | Tap the glowing tile, then a **Lanes rescue battle** docked under it. There's no ticket. Baristabbit is silhouetted in a cell, holding a teapot. | Muffled Baristabbit: "Kettle's on. If anyone's out there." · Mossprout: "They're guarding the light. Of course they are." | The rescue objective, again, off-trail |
| 2 Baristabbit joins | Tile opens → card reveal → joined card | Baristabbit: "You walked through *that*? You must be starving." · "Nobody's eaten properly since the paths closed." · Steppling: "I could eat. I could *always* eat." | — |
| 3 The Café opens | The Café is built at level 1 as part of the rescue (no separate "build" goal first). The gathering board docks. Order cards: Mossprout and Steppling. | Baristabbit: "Heroes fight on full bellies. Merge me something warm." · On the first serve: "That's a Meal. Meals make heroes stronger." | The gathering merge; Meals and Timber |
| 4 Goal: Serve 3 orders | Café orders | — | The order loop |
| 5 Goal: **Train Mossprout to level 2** | Opens the hero panel. Pays Glow and Meals. Level-up flourish. | Mossprout: "I feel… brighter." · Baristabbit: "That's the tea." | **Training**, why Meals matter, and the level-power damage (Part D2) |
| 6 Reward | Chapter card | Mossprout: "Two friends home. A kitchen that smells like morning." | — |

The Dew Spring moves out of Chapter 1 (see Chapter 3).

### Act III. Chapter 2: Push It Back (Frontier tiles, the Heart Tree's light, the Lodge)

**Opening scene (new).** It's night. The Mist creeps onto an empty frontier tile beside the Sanctuary, and its edge ripples.
- Mossprout: "It's closer than yesterday."
- Steppling: "Then let's move it."

| Beat | What happens | Lines | Teaches |
|---|---|---|---|
| 1 Goal: Reclaim a frontier tile | The first **frontier battle** (Lanes) docks under a misted wild tile. On a win the tile lifts to meadow art, and a small yield bubble appears. | Mossprout: "Land we take back gives back." | Frontier tiles; reclaimed land yields Timber |
| 2 Goal: Reclaim 3 frontier tiles | The light radius stops at ring 2. Tiles beyond it show "Beyond the Tree's light". | Mossprout, at the edge: "Past here the Tree can't reach. Not yet." | The **light radius** |
| 3 Goal: Heart Tree to level 2 | Pays Glow and Timber. The tree grows, **the light radius visibly expands**, and new frontier tiles become attackable. | Mossprout: "It remembers more of itself." | The Heart Tree as HQ and gate |
| 4 Goal: Build the Explorer's Lodge | Steppling's hero building | Steppling: "If I'm going to find paths, I need somewhere to draw them." | Hero buildings: they make Timber and **cap their hero's level** |
| 5 Goal: Train Steppling to level 2 | Steppling's **Dash** ability is shown on the reward card | Steppling: "Watch this." | Every hero has an ability |
| 6 Reward and signal tease | A pink flare over the Bloom Garden (the existing Signal) | Steppling: "Did you see that?" | The next chapter hook |

### Act IV. Chapter 3: The Signal (Petalimp; two heroes; the Colour Thief)

The existing opening stays. The goals change:

1. **Lift the Mist at the Bloom Garden** (Lanes).
2. **Play Petalimp's first two levels** (Lanes, already authored).
3. **Build the Dew Spring**, just before the tough levels.
   - Mossprout: "The old Spring could hold a line. We'll need one."
   - The Dew Spring is repurposed as **Spring Shield**: per battle it pushes back N wisps that break through, reusing the `forgiving` push-back (N = 1 at level 1–3, 2 at 4–6, 3 at 7+).
4. **The Colour Thief** (the existing boss). Its intro card is written like a villain reveal. The Mist's voice (narration, no "!"): "It takes the colours first. Then the names."
5. **Petalimp home.** Petalimp: "You found me by my *flare*? I'd given up sending them."
6. **Unlock: two heroes per battle.** The next battle opens a scripted loadout tip.
   - Petalimp: "Take me with you. I'm small, but I'm *loud*."
   - Petalimp's ability, **Petal Burst**, is introduced as the partner button.

### Act V. Chapter 4: Supper, and the First Surge (Feastle, the Kitchen, the Mist strikes back)

- **Opening:** the smell of supper drifts out of the Mist at `feastle-home`.
- **Rescue Feastle:** a Lanes rescue battle, with no ticket.
  - Feastle, muffled: "If you're a wisp, the soup isn't for you."
- **The Kitchen:** the board gains the hearth-pantry, and feasts pay big Meals.
  - Goal: **fill a Kitchen crate.** Fix: count only the crates filled while the Kitchen is open (`world.supplyRun.kitchenCrates`).
- **The First Surge (new drama beat).** The goal "Build the Kitchen" plays, then a scripted event:
  1. The screen dims and a low rumble plays.
  2. Two reclaimed frontier tiles turn **contested** (purple edge, a wisp perched).
  3. Mossprout: "They noticed us."
  4. Mossprout: "They're taking the edges back."
  5. A **defence battle at the Heart Tree**: Lanes, not forgiving, with the wave pace ramping.
  6. On the win, the Kingdom brightens.
  7. Feastle: "Right. Everyone eats *double* tonight."
- This teaches that **reclaimed land must be held**, and it switches on daily Surges (Part D3).
- **Reward:** the Bloom House goal (Petalimp's building) closes the chapter as the "strengthen for the road ahead" beat.

### Acts VI–X: the friend chapters (Fernip → Mistle)

Every chapter follows one shape, with **one new Lanes wrinkle** and **one new hero ability** each:

| Ch | Friend / island | Signal image | New Lanes wrinkle | Friend's ability | Building (perk) |
|---|---|---|---|---|---|
| 5 | Fernip / Wildgrowth | Vines moving against the wind | **Rootbound cells** (Mist binds a piece until an adjacent merge) | Vine Snare (slows one lane) | Thicket (wisps slow, built) |
| 6 | Blossle / Seed Nursery island | Seeds drifting *out* of the Mist | **Lucky Seeds** (tier-2 drops, a rare Seed that lands as tier 3) | Seed Burst (drops 3 Seeds) | Nursery hero building (tier-2 chance) |
| 7 | Drizzlet / Pond | Rain falling upward | **Rain lanes** (a column where shots fly faster; its Mist regrows) | Ripple (clears Mist in a row) | Pond building (Spring Shield +1) |
| 8 | Amberleaf / Orchard | Fruit glowing on dead branches | **Harvest wisps** (drop Meals when they fall) and Orchard orders in the Kitchen pool | Harvest (the next falls pay double Glow) | Orchard building (Meals per order) |
| 9 | Mistle / Ancient Tree | A voice *from* the Mist that isn't a wisp | **Mist-born wisps** (they turn back into Mist cells on falling) | Unmist (turns one wisp into a Seed) | Ancient building (Heart Tree yield) |
| 10 | **The Hollow Tree** (finale) | The Hollow Tree's crown flickers | A multi-phase **boss** at (0,-4). The Mist has a heart, and it was *forgotten* too. | — | Opens Region 2 (teaser) |

**Each friend chapter's goal list** replaces `friendChapter()`:
1. Signal scene.
2. **Reclaim the frontier tiles on the path to the island** (the frontier ring reaches toward it).
3. Heart Tree level N (the light radius reaches the island).
4. Train a hero, **including the required hero building level as its own goal** (fixes the Chapter 7 and Chapter 9 soft-locks).
5. Lift the island's Mist.
6. The island campaign (all Lanes, ending on a boss).
7. Friend home.
8. Build their building.

Mistle's chapter reveals the lore turn: the Mist is a forgetting, and the Hollow Tree was the *first* Sanctuary, the one everyone forgot. Chapter 10's boss is its forgotten guardian. That sets up restoration, not killing, as the win.

---

## Part D: Systems changes

### D1. Retire old mechanics from the player's path
- **Grove and Daily Mist → Frontier** (D3).
  - `openGlowSource` and `goalNeed`'s "play the Grove" now route to the nearest attackable frontier tile, or a contested tile once Surges are on.
  - The Grove marker is removed from Mossprout's tile (`HOME_TRACK_OFFER_ID`, `withTrackBadges`).
- **Rescue boards → Lanes rescue.**
  - Give `mission:baristabbit` and `mission:feastle` Lanes specs with the `rescue` objective, reusing the built `rescue` objective and `TrappedFriendSilhouette`.
  - Drop the 60-Glow ticket step from `hatchable-flows.ts` for `arrival: 'rescue'`.
  - The misted tile gets the "lit window" glow while it's that chapter's goal.
- **Fernip, the pattern levels and the extra rungs → Lanes.**
  - Rewrite `FERNIP_LEVEL_SPECS` with `lanes`, and add a `lanesPatternSpecs(campaignId, chapter)` generator built on `waves()` to replace `patternLevelSpecs`.
  - Give each friend campaign's final level `difficulty: 'boss'`, with a signature boss wisp.
  - `islandLevel()`'s territory fallback is no longer used by any shipping content.
- **Hide the Wanderling and Rush packs:** take their entries out of `wake-order.ts` (or behind a `hidden` flag) so the islands stay asleep and misted.
- **Resident tap → hero panel.** `selectResident` opens `KatchimeraUpgradePanel` (the hero screen) for heroes, never `KatchimeraCompanionRouteScreen`.
- **Copy cleanup:**
  - Remove the garden, dayOne and lesson guides from Steppling, Baristabbit and Feastle.
  - Rewrite the Blossle, Drizzlet, Amberleaf and Mistle campaign copy under the bible, then copy the voice-rule test block from the Petalimp and Fernip tests.
  - Fix the head-counts.
- **Leave dormant, don't delete (yet):** the territory, tactics, glow-strikes, column-shot and wisp-rush code, until the playthrough test proves no path reaches them. A later cleanup phase deletes them along with their tests.

### D2. Heroes in Lanes
- **Ability dock.** Draw the lead and partner ability buttons *under* the board for Lanes (the sky stays clear), reusing `pressAbility` / `useAbility(target, slot)`.
- **Lanes abilities.** Add a `lanes` effect to each `companion-abilities.ts` definition, applied in `lanes.ts` through a new `applyLaneAbility`:
  - Mossprout **Bloom**: +1 tier to a piece.
  - Steppling **Dash**: a volley up one column.
  - Baristabbit **Focus**: the next 3 shots do ×2.
  - Petalimp **Petal Burst**: 3 Seeds land.
  - Fernip **Vine Snare**: one lane is held for 4s.
  - …and one for each later friend (table above).
  - Charge comes from merges, as today (`settle.ts`).
- **Level power.** `laneFire(tier, power)`, where `power` comes from the lead's level: +1 damage at levels 3, 6 and 9, and fire period −5% per level after 1. Pass it through `LanesLuck` (rename it `LanesBoost`) from `EncounterProfile`. `lanesFairness` gets a `power` option, and a level-1 lead must stay the fairness baseline.
- **Every home friend is playable.**
  - `PLAYABLE_KATCHIMERAS` becomes derived: any friend with an ability definition who is home.
  - One `playableHeroes(world)` selector replaces the three computations.
  - The roster's Train button always works.
- **Seed Nursery fix:** pass `tierTwoChance` into the live `lanesTick` call.

**Every friend a hero, built (Sept 26 2026):**
- **Who plays.** `PLAYABLE_KATCHIMERAS` now includes Feastle and the island friends. The island friends play under their form's id (`ISLAND_HEROES`) and count as home once their island's card is earned.
  - `playableHeroes(world)` / `heroHome` is the one rule for the Kingdom, the level track and the playthrough.
  - The engine accepts them in battles and training (`KNOWN_HEROES`).
- **Abilities.** Seven Lanes abilities (`features/encounter/lane-abilities.ts`) act on the battle in play:
  - **Petal Burst:** Sprouts land on free cells.
  - **Vine Snare:** holds the nearest wisps.
  - **Second Helpings:** every plant fires now.
  - **Seedkeeper:** Seeds grow a size.
  - **Rainfall:** washes spat Mist off and pushes wisps back.
  - **Falling Leaves:** damages every wisp over the board.
  - **Forget:** the nearest wisps go back to the top.

  `applyBattleAbility` routes them. A hero says a `callout` line in the battle's bubble when they use theirs.
- **Story.** Chapters 5–9 train the friend brought home before: Petalimp, Fernip, Blossle, Drizzlet, then Amberleaf, each to level 2, with their ability as the reason.
  - An XP shortfall names the hero (`GoalNeed.heroId`), and the Frontier battle the card starts brings them as partner.
  - An island hero's panel frames their island, and their level-up plays on it.

### D3. Frontier tiles and Mist Surges (the 4X layer)
- **New tile kind `frontier`.** It fills the empty ring-2 cells (4) and ring-3 cells (18) through `ringSources` in `mossprout-hex-neighborhood-scene.ts:245-263`, with authored frontier ids in `constants/frontier-tiles.ts`. Its states are `misted | contested | reclaimed`, stored in `world.frontier[tileId]` and changed by engine commands `reclaimFrontierTile` and `contestFrontierTile`.
- **Art:** 4 wild reclaimed variants (meadow, copse, brook, stones), plus a contested edge overlay drawn at runtime. It goes through the shared-world hex pipeline (`shared-world-discovery-v2/briefs.json` → generate → matte → package → bounds → review). The misted state reuses `dream_mist_locked_hex_tile_v4`.
- **Levels:** `frontierLevel(tileId, ring, heartTreeLevel)` generates a Lanes spec with `waves()`. Difficulty scales with the ring and the number of tiles already reclaimed. It pays Glow and XP for both heroes. Replays of reclaimed tiles aren't allowed; contested ones are.
- **Light radius:** `heartTreeLightRing(level)`. Levels 1–2 reach ring 2, levels 3–5 reach ring 3, and friend islands get their own gate (existing `ISLAND_WAKE_ORDER.heartTree`). Tiles outside it show "Beyond the Tree's light".
- **Yields:** a reclaimed tile adds Timber per hour to a Sanctuary store, collected through the existing `tileBubbles` / `collectHeroBuilding` pattern. The Lodge's level raises the cap. This replaces the Lodge's solo Timber stream as the main Timber source.
- **Mist Surges:**
  - **Daily:** after the Chapter 4 Surge beat, on each new day 1–2 reclaimed *edge* tiles turn contested. Seeded by day, and their yields pause.
  - **Scripted:** the Chapter 4 defence at the Heart Tree, and one before the Chapter 10 finale.
  - Contested tiles replace Daily Mist as the daily fight.
- **Docking:** frontier battles use the existing `islandEncounter` slot, with a `frontierTileId` and a `frontierTileNodes` map like `storyTileNodes`.

**Built (Sept 26 2026).** This differs from the sketch above in these ways:
- **Tiles.** `constants/frontier-tiles.ts` authors 23 tiles:
  - the second ring's 5 empty cells, starting with the one beside Steppling's trailhead;
  - all 18 cells of the third ring.
  - They are placed as world cells and are never mapped through the ring spiral. A content pack's island placed onto a Frontier cell wins it, and that Frontier tile is not drawn.
- **State.** Nothing new is stored. A tile is reclaimed when the encounter ledger holds its battle's first clear (`frontier:<tile>`).
  - A tile beyond the light is `dark`: drawn faint (`layer.dim`), and it brightens over 1.4s when the Tree grows.
  - A tile in the light is `misted`.
  - The `contested` state waits for Mist Surges (Phase 4).
- **Light.** Each tile wakes at its own Heart Tree level instead of a whole ring at once.
  - Tree level 1 lights the second ring.
  - The third ring then lights nearest home first: 6 tiles at level 2, 5 at 3, 4 at 4, 2 at 5.
  - At level 7, the Hollow Tree's doorstep (0,-3), a boss, is the last tile lit.
- **Battles.** `features/frontier/frontier-levels.ts` builds one Lanes level per tile from its power (1 to 6) and its land, which sets the wrinkle:
  - **Copse:** strikers.
  - **Brook:** spitters.
  - **Meadow:** quick wisps.
  - **Stones:** a slow warden.

  Every tile passes `lanesFairness` (`tests/frontier.test.ts`).
- **Yields.**
  - The first clear pays `1 + ceil(power / 2)` Timber (`completeEncounter` → `encounterCleared.reclaimed`).
  - Reclaimed land feeds the Lodge: +1 to its store per tile, and a faster stream per 3 tiles (`lodgeTimberWaiting`).
- **Flow.**
  - A tap on a lit tile starts its battle, docked under the tile (`islandEncounter.frontierTileId`).
  - The reward card reads "Land taken back". Then the tile's Mist lifts through the story-tile crossblend, and the tile is held misted (`frontierRevealing`) until the reveal plays.
  - A tap on a reclaimed or dark tile gets a one-line Mossprout card; the dark tile's card links to the Heart Tree.
  - The next tile in the light carries a "Take back" bubble.
  - The Frontier opens once Chapter 1 is claimed.
- **Routing.** Glow and XP shortfalls go to the next Frontier tile (`GoalNeedSource` `frontier`), then to the latest island, then to the Café. `openGlowSource` follows the same order.
- **Chapters.**
  - Chapter 2 is "Push It Back". Its opening is on `frontier-1` and ends on a guided tap. Its goals: reclaim 1, the Lodge, reclaim 3, the Café, Lodge level 2, Heart Tree level 2.
  - Each friend chapter adds a goal, "Push the Frontier toward <place>", with a running total: 8, 12, 16, 19, 23.
- **Art.** `shared-world-discovery-v2/frontier-{meadow,copse,brook,stones}`.
- **Pacing** (`PLAYTHROUGH_LOG=1`): 79 battles, 48 orders and 168 steps to the end of Chapter 9. Chapter 2 plays 3 battles and 4 orders.

**Mist Surges built (Sept 26 2026):**
- **State.** `world.frontierSurges` holds three things:
  - `contested` tiles, each with the time it was taken;
  - `lastDay`;
  - `firstHeldAt`.

  A contested tile draws the house Mist again. It still counts toward the chapters, but not toward the Lodge (`frontierHeldCount`).
- **The First Surge** is Chapter 4's `first-surge` goal, after the Kitchen:
  - The Kitchen's outro ends on "Do you feel that?"
  - The defence (`surge:heart-tree`, a Lanes battle with a striker and a quick wisp) docks under the Heart Tree. It sits on `islandEncounter.structureId`, and the phone buzzes as it starts.
  - Holding it contests two edge tiles in the same write. The reward card reads "The Heart Tree held", then the outro: "They took back the edges."
  - `surge-retake` asks for both tiles back.
- **Daily Surges.** After that, the first time the Sanctuary is seen each day, `mistSurge` contests edge tiles, seeded by the day:
  - 1 tile a day, or 2 once 10 are held;
  - never more than 3 contested at once.

  An edge tile is held land beside Mist that isn't held, or on the outer edge. Mossprout reports the loss, with a "Take it back" button.
- **Retakes.** A retake (`retake:<tile>`) is the tile's own level one step harder. It pays a smaller purse and 1 Timber, then plays the same reveal. The next Frontier target, the bubble ("Retake") and the goal card all pick contested land first.
- **Pacing:** 82 battles, 47 orders and 170 steps. Chapter 4 now plays 4 battles.

### D4. Economy and goal fixes
- **`goalNeed`** handles the `hero-building` and `heart-tree` requirement rows by returning "Needs the Lodge at level N" / "Needs the Heart Tree at level N", and the tap routes there.
- **`followChapterGoal`** falls back to opening the island track when the `world_offer` is missing. It never silently does nothing.
- **The Kitchen crate goal** counts Kitchen crates only.
- **Lodge copy** matches its level 1 effect, or the Lodge gets +1 Timber per order at level 1.
- **The Dew Spring becomes Spring Shield** (lanes push-back charges), and its tagline and panel copy are updated.
- **The Root Cellar** opens misted cells at the start of Lanes battles; check that `openCells` applies in Lanes.
- **Pacing targets:** Chapters 1–4 take about 45–60 minutes total, and each friend chapter about 1–2 sessions. The playthrough bot logs the number of battles and orders per chapter; tune costs in `heart-tree.ts` and `hero-buildings.ts` to hit that.

---

## Part E: Build phases

Each phase ends playable on device. Nothing is committed before the user tests it (memory: no-commit-before-user-tests). Work continues on `feature/cozy-4x`.

**Phase 0: Doc.** Write `apps/katchimeras/docs/cozy-4x-ftue-v2-wayfinders-road.md`: Parts A–C as the source of truth. Mark the Last Clearing doc as superseded for the beats after Act I.

**Phase 1: Act I polish and Chapter 1 "The Lit Window"**
- Merge the frontier, tracks and mission beats (`mossprout-ftue-flow.ts`, `mossprout-ftue-script.ts`, `last-clearing.ts`, the Kingdom beat renders), and extend the lift hold.
- Event lines for the stones (`lostTrailLine`, `constants/last-clearing-battle.ts`), and the muffled-speaker bubble (`friend-speech-bubble.tsx`).
- First-session XP.
- Add the cliffhanger beat `world.lit_window` to the flow (version 61), with the tile glow effect.
- Baristabbit's Lanes rescue with no ticket (`baristabbit.ts`, `hatchable-flows.ts`). The Café opens on rescue.
- Rewrite Chapter 1's goals in `sanctuary-chapters.ts`.
- Resident tap → hero panel.

**Phase 2: Heroes in Lanes**
- The ability dock under the board (`hatchable-mission-dock.tsx`).
- `applyLaneAbility` in `lanes.ts` and Lanes effects in `companion-abilities.ts`.
- Level power in `laneFire`.
- The derived `playableHeroes`.
- The Nursery fix.
- The scripted Bloom intro on stone 2.
- `lanes-playtest.ts` power and ability options.

**Phase 3: Frontier tiles (replaces the Grove and Daily Mist)**
- Art through the hex pipeline.
- `constants/frontier-tiles.ts`, the scene layer, world state and engine commands, `frontierLevel`, the light radius, yields.
- Reroute `goalNeed` / `openGlowSource`; remove the Grove marker.
- Chapter 2 "Push It Back", with its opening scene.

**Phase 4: Lanes everywhere, and Chapters 3–4**
- Feastle's Lanes rescue.
- Convert Fernip, the pattern levels (`lanesPatternSpecs`) and the extra rungs; add the missing bosses.
- Hide the Wanderling and Rush packs.
- Spring Shield, the Root Cellar check, the Kitchen crate fix, the `goalNeed` building rows, the `followChapterGoal` fallback.
- The Chapter 3 Colour Thief framing and two-hero intro.
- Chapter 4's Kitchen and **First Surge** (the defence battle and contested tiles) and daily Surges.

**Phase 5: Every friend a hero, and Chapters 5–9**
- A Lanes ability per friend.
- A Lanes wrinkle per chapter (rootbound, lucky Seeds, rain lanes, harvest wisps, Mist-born).
- The remaining friends' buildings (hex art per the recipe in memory).
- New `friendChapter()` goals, including the hero-building goal.
- Campaign copy rewrites plus voice-rule tests.

**Phase 6: The Hollow Tree finale and cleanup**
- Chapter 10: the boss and the lore turn.
- Delete the unreachable mechanics, the dead script steps and the retired tests; update `known-test-baseline.md`.

### Critical files
- **Flow and script:** `features/onboarding/mossprout-ftue-flow.ts`, `features/onboarding/mossprout-ftue-script.ts`, `features/onboarding/last-clearing.ts`, `constants/last-clearing-battle.ts`, `features/onboarding/content-flow-bootstrap.ts`.
- **Kingdom:** `components/katchadeck/roster/katchimera-kingdom-screen.tsx` (the beat renders, `selectResident`, `openGlowSource`, `followChapterGoal`, the battle dock slot), and `components/katchadeck/world/mossprout-hex-neighborhood-scene.ts`.
- **Chapters:** `constants/sanctuary-chapters.ts`, `features/sanctuary/goal-need.ts`, `components/katchadeck/world/chapter-goal-card.tsx`.
- **Battle:**
  - `features/mission-mechanics/lanes.ts`, `features/encounter/{settle,adapt,team,lanes-playtest,spawner-profile}.ts`, `constants/companion-abilities.ts`, `constants/katchimera-progression.ts`;
  - `components/katchadeck/world/hatchable-mission-dock.tsx`;
  - `constants/island-campaigns/{island-levels,ladder,extra-rungs,wake-order}.ts`.
- **Rescues:** `constants/hatchable-companions/{baristabbit,feastle,steppling}.ts`, `features/onboarding/hatchable-flows.ts`.
- **Economy:** `constants/heart-tree.ts`, `constants/hero-buildings.ts`, `constants/heartwood-buildings.ts`, `features/heartwood-buildings/buildings-world.ts`, `features/supply-run/supply-run.ts`, `utils/merge-world/engine.ts`.
- **New:** `constants/frontier-tiles.ts`, `features/frontier/*` (level generator, surges, yields), and the doc.

### Reuse, not rebuild (memory: reuse-existing-friend-tile-systems)
- **Rescue:** the `rescue` objective, `TrappedFriendSilhouette`, `rescueWorldFriend`, `revealStoredStoryTile`.
- **Presentation:** the `SignalFlare` and chapter `opening`, `LastClearingTitleCard`, `BattleRewardCard`, `tileBubbles`, the `upgradePresentation` crossblend.
- **Levels and tracks:** `islandEncounter` docking, `waves()`, `lanesFairness`, `forgiving` push-back (Spring Shield), `LevelTrackSheet` for island campaigns.

---

## Verification
- **Unit and playtest.**
  - `lanesFairness` over every new or converted Lanes level (careful ≥4/6, idle loses, calm levels novice ≥3/6), with power 0 and with the chapter's expected lead level.
  - Extend `tests/encounter-lanes.test.ts` from a hand list to "every shipping level".
- **Guard test.** Extend `tests/new-player-playthrough.test.ts` phase by phase: through Chapter 1 (Phase 1), then Chapter 2 (Phase 3), then Chapter 4 (Phase 4), then Chapter 9 (Phase 5). Add assertions:
  1. Every battle played has `mechanic.kind === 'lanes'`.
  2. No ticket is paid.
  3. No goal card is ever a dead end (`goalNeed` or a reachable action always exists).
  4. Battle and order counts per chapter stay within the pacing targets (`PLAYTHROUGH_LOG=1`).
- **Voice rules.** Copy the voice-rule test block onto all new copy (no "!" near the Mist, Mistwisps named once, capital "Mist").
- **Test runs.** Per memory keep-test-runs-short: `tsc` plus the targeted files per edit, and the broad suite once per phase (`--experimental-sqlite` for the SQLite files).
- **Browser pane.** Follow the Egg Snap recipe in memory to screenshot the new beats (cliffhanger, rescue battle, ability dock, frontier reclaim, Surge).
- **Device test by the user** after each phase, before any commit.
