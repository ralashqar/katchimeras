# Lanes, deeper: board engines, plant life, wisps that fight back

Sept 27 2026. **Status:** slice 1 (the Seed Sprinkler) is built. The rest is the plan, in the order it will be built.

## Why

A Lanes battle is currently one idea: merge up, put a plant under each wisp, repeat.
- **The player** has two verbs: merge and move.
- **Seeds** appear from nowhere.
- **The wisps** have grown eight tricks (weave, dash, shield, mend, frost, snatch, split, call), but they still mostly just come down.
- **Plants** are never in danger except when a wisp reaches them.

To feel deep, a battle needs three things:
1. **Things on the board that do things:** your engines.
2. **An enemy that attacks your plants,** not just the bottom of the board.
3. **Position to matter in more than one direction:** range, neighbours, lanes.

Every new idea arrives one at a time, taught by a friend, and each can be upgraded.

## 1. Board engines (your side)

Engines stand on a cell of the board. They take space, which is the trade-off.

| Engine | What it does | Upgrades |
|---|---|---|
| **Seed Sprinkler** (built) | The board's seed source, a real spawner on a bottom corner cell. **Tap it** and it launches a Seed to a free cell near it (within 2 cells, never under a wisp), flown there by the same spawn flight as every Café spawner. It holds **6 charges**, and one comes back every Seeds beat. Every **3rd launch sparks the nearest wisp within 2 cells** (a small zap). | **Seed Nursery building:** Sprout odds on its Seeds; at level 4 it sparks every 2nd launch, at level 5 the spark hits for 2. **Bloom House:** charges come back faster. |
| **Storm Pot** | Grows the **Spark chain**: Spark Seed → Static Sprout → Thunder Bulb → Storm Lily. Spark plants **don't shoot up their lane.** They **zap the nearest wisp in any direction** within reach: tier 2 reaches 1 cell, tier 3 reaches 1 cell and arcs on to a second wisp, tier 4 reaches 2 cells and arcs twice. Strong against wisps on or near the board (crawlers, weavers, dashers); weak against wisps high in the sky. | **Drizzlet's Pond:** zap damage and reach. |
| **Dew Well** | Grows the **Dew chain**, support plants. A Dew plant **restores hearts** to the plants beside it, and at tier 3+ gives them an **aura** so they fire faster. | **Amberleaf's Orchard.** |
| **Lantern Post** (Region 2) | Lights its lane: shots in a lit lane pierce the first wisp and hit the next. | **Dawnle's Lamp House.** |

### Three kinds of battle

| Kind | Share | Seeds | Where |
|---|---|---|---|
| **Sprinkler** | most (about 60%) | tapped from the Sprinkler | every battle past the first session unless it says otherwise |
| **Make do** | about 25% | none: only the board and what waking the Mist brings | a couple per island and per Frontier land (`makeDo: true`); the level card says "No Sprinkler here" |
| **Rush** | events and some Surges | the Sprinkler launches on its own (`sprinkler: 'auto'`) | the time trial and rush events |

The first session (the first battle and the Lost Trail rescue) has no Seeds at all: every piece is on the board or wakes out of the Mist. The Sprinkler arrives in the battle after it.

## 2. Plant life: the enemy fights back

- **Hearts:** every plant has hearts equal to its tier, so a Sprout has 2 and a Blossom 4. A hit costs a heart; at zero, the plant drops a tier with fresh hearts. A Seed hit to zero is lost.
- **Display:** hearts show as small pips on a plant only once it is hurt.
- **Refills:** merging makes a fresh plant with full hearts. Dew plants and menders heal.
- **Existing strikers** (nibblers) become heavy hits that cost 2 hearts rather than an instant downgrade.

## 3. New wisps (their side)

| Wisp | What it does | Answer |
|---|---|---|
| **Gunner** | Fires a bolt straight down its lane every few seconds; the first plant in its path loses a heart. | Out-fire it: a strong plant under it, or bigger plants. |
| **Crawler** | Comes up out of a **Mist Vent** on the board (or drops in) and walks cell to cell slowly toward the nearest plant. Every plant it touches loses a heart. | Plants below it in its lane shoot it; Spark plants zap it; merge bursts beside it hit it; Vine Snare roots it. |
| **Bomber** | Drops a Mist bomb that lands in a **+ shape** (five cells of light Mist). | Keep plants spread out, and clear the Mist fast. |
| **Burrower** | Sinks out of reach for a few seconds and comes up two rows lower in the lane beside it. | Cover neighbouring lanes. |
| **Mirror** | The first shot in each volley bounces back and costs the shooter a heart. | Hit it with zaps and bursts, not plain shots. |
| Built already | weaver, dasher, bulwark, mender, frost, snatcher, splitter, caller, nibbler, spitter, warden | |

## 4. Merge bursts: your big moves

- **Bursts:** a merge that makes a tier-3+ plant **bursts** as it lands:

  | Merge result | Burst |
  |---|---|
  | tier 3 | zaps the nearest wisp within 2 cells (2 damage) |
  | tier 4 | zaps two wisps |
  | tier 5 | fires a **beam up its lane**, hitting every wisp in it |

  Merging becomes an attack, not just growth. This is the answer to a wisp that is about to reach you.
- **Combos:** merges within 1.5 seconds of each other build a combo (×2, ×3…). At ×4 a **Bloom Wave** pushes every wisp back a row.

## 5. Board terrain

Each region's boards get their own cells:
- **Sunny cells:** plants there fire 30% faster.
- **Stones:** blocked.
- **Mist Vents:** crawlers come out of them.
- **Puddles:** a Spark plant's arc jumps further across them.
- **Echo stones** (the Hollow Reaches): a shot that hits one echoes into the next lane.

## 6. Heroes

Heroes already have abilities. Next, the lead hero also brings a small **passive**:

| Hero | Passive |
|---|---|
| Mossprout | Sprouts get one extra heart |
| Steppling | The Sprinkler launches 20% faster |
| Petalimp | Merge bursts reach one cell further |
| Fernip | Crawlers move at half speed |
| Drizzlet | Spark arcs jump once more |
| Dawnle | Mirrors can't bounce the first shot |

These are shown on the loadout, so choosing a lead matters.

## When each thing comes in (one new thing at a time)

| When | New | Taught by | Upgrade path |
|---|---|---|---|
| Chapter 2 (Push It Back) | **Seed Sprinkler:** seeds arc out of it | Mossprout | Seed Nursery (Sprout odds), Bloom House (pace) |
| Chapter 2 (Heart Tree 2) | **Sprinkler sparks** | Steppling | Seed Nursery level (spark rate and damage) |
| Chapter 3 (Petalimp) | **Plant hearts + Gunners** | Petalimp: "They shoot back now." | Bloom House (hearts) |
| Chapter 4 (the First Surge) | **Merge bursts** | Mossprout, during the defence | hero level (burst damage) |
| Chapter 5 (Fernip) | **Crawlers + Mist Vents** | Fernip | Thicket (slower crawlers) |
| Chapter 6 (Blossle) | **Bombers, combos** | Blossle | Nursery |
| Chapter 7 (Drizzlet) | **Storm Pot + the Spark chain** | Drizzlet | Pond |
| Chapter 8 (Amberleaf) | **Dew Well + hearts healing** | Amberleaf | Orchard |
| Chapter 9 (Mistle) | **Burrowers** | Mistle | none |
| Region 2 | Mirrors, Hush wisps, Lantern Post, echo stones | Dawnle and the Reaches' families | the Reaches' buildings |

Each new thing gets:
- **A first appearance:** its first level is built around it, the way each island got its own idea.
- **A line from its teacher:** the first time a kind appears in a battle, it is named, as `WISP_KIND_LINES` already does.
- **A fairness pass:** it has to pass the playtest bots before it ships.

## Build order

1. **The Seed Sprinkler.** Tap-to-launch with a refilling supply, the seed source for every battle past the first session, with its own art and a spark that grows with the Seed Nursery; make-do levels; a first session with no Seeds. **Built.**
2. **Plant hearts and Gunners.** The heart rule, pips on hurt plants, and bolts from Gunners.
3. **Merge bursts** and the burst visuals.
4. **Crawlers and Mist Vents:** the first wisp that moves across the board.
5. **The Storm Pot and the Spark chain:** four new item arts, and zaps in any direction.
6. **The Dew Well;** then Bombers, Burrowers, Mirrors, terrain, and hero passives.
