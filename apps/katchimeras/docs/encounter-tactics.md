> **Replaced Sept 24 2026 by Lanes (`encounter-lanes.md`)** on every level that used it. The code stays for reference; no level plays it now.

# Merge vs Mist: the simple core

Status: **built Sept 23 2026, uncommitted, device test pending.** This is the user's "Simple Merge vs Mist" spec. It replaces the walking-wisp tactics that came before it (those were too confusing). The territory battle underneath it (`encounter-territory.md`) still plays every level that has not moved over yet.

## The five rules

1. **Merge identical items.** Moving pieces and tapping the Seed Pod are free. Only a merge is a turn.
2. **A merge fires Glow at the nearest Mist** (`glowShots` in `features/encounter/mist.ts`). The shots are what clear it, never the merge itself:

   | Result | Shots | Reach |
   |---|---|---|
   | Sprout | 1 | a cell beside it |
   | Plant | 2 | up to 2 steps |
   | Flower | 3 | up to 3 steps |
   | Tier 5 and up | 5 | anywhere |

   - **Targeting:** each shot takes the nearest Mist in reach as the board stands after the shot before it, so a second shot finishes Thick Mist the first wore. On a tie, the Mist walling in a wisp goes first.
   - **Hits:** a shot is one hit. Water hits twice on light and Thick Mist, and only Growth cuts roots. A locked piece is freed when its Mist opens.
   - **On the board:** each shot is a Glow token from the first battle's Glow store (`launchVolley` in `kingdom-opening-merge-dock.tsx`): the same icon, rise and flight, and the same strike burst as a hit on a wisp. The Mist it hits is held on the board (`heldMist`), and a piece it frees stays under its Mist, until that exact shot lands. Then the Mist puffs out. The hold is written to a ref in the same synchronous step as the store's commit, so no render ever shows the cleared board early. A cleansed wisp's collapsing ring is shots too, and any other Mist the merge lifted waits for the volley's last landing. A test pins it: every Mist a merge lifts is a shot's target. Since Sept 24 2026 territory battles do the same: their Harmony pulse is flown as one Glow shot per cell it opened or wore, and the dock holds that Mist for every battle, not only Merge vs Mist. The old friend-restoration board (`island-restoration-dock.tsx`, boards kept from before the pivot) is separate and still wakes Mist the old way.
   - **Preview:** while you hold a piece over its twin, the cells its Glow would hit light up.
   - **Direction:** merge direction matters, because the result lands on the piece you drop onto.
3. **Higher tiers clear more.** That is the choice: merge small now, or build toward a big clear.
4. **Every merge lets each Dark Wisp spread.** After each merge a wisp Mists one free cell beside its Mist, and that cell is shown before you merge: it pulses dark on the board. Moving a piece onto that cell does not stop it; the Mist goes to the next nearest free cell. Only a Drifter moves (below).
5. **Clear the Mist around the wisp to cleanse it.** Once the 4 cells beside it are clear, a merge landing right next to it cleanses it (`darkWispsCleanseStrike`). The Mist and any locked pieces around it collapse too.

**Losing:**
- the Mist reaches the level's line (Mist % on the meter);
- or the board can never merge again: no pair, no Pod charge with room, and nothing the rescue can bring.

The rescue brings twins of your best pieces every time the board runs dry, so random drops never block a level.

## Wisp kinds (each one sentence; `features/encounter/wisp-ai.ts`)

- **Creeper:** Mists one free cell beside its Mist after every merge. The nearest cell, then the one with the most pieces around it.
- **Spore Wisp:** a Creeper that spreads 2 cells on every third merge.
- **Root Wisp:** its Mist is Thick (two clearing effects).
- **Snare Wisp:** reaches for a piece beside its Mist first. The piece stays locked until that Mist is cleared.
- **Drifter:** drifts one cell through its own Mist, away from your pieces, leaving Mist where it was. Its next step shows as an arrow. With no Mist beside it, it spreads like a Creeper. Chase it: clear around it and it has nowhere to go.
  - It first moved *toward* the pieces, but that walked it out of its own Mist and got it cleansed in three merges.
  - Every move of any kind giving the wisps a turn was considered and left out: it was the confusing part before.

## Abilities (`constants/companion-abilities.ts`, `features/encounter/abilities.ts`)

Using an ability is not a merge, so the wisps never get a turn for it.

| Katchimera | Ability | Effect |
|---|---|---|
| Mossprout | Bloom | raises a plant a step; from level 4 it also clears light Mist beside it and frees a piece locked beside it |
| Steppling | Clear Path | clears one Mist cell outright (never a wisp's own) |
| Baristabbit | Focus | the next merge clears as if 1 step bigger (2 from level 5) |
| Shellio | Ripple | the next Water merge clears as if 1 step bigger (2 from level 4) |
| Voyagle | Scout | shows what 2 to 6 hidden Mist cells are holding |

**Engine hooks:**
- the boost lives in `run.boost` and is used up by the merge it applies to;
- Scout's cells are kept in `run.revealed`.

## On the board

- The cell each wisp will Mist next breathes dark with a cloud badge (a lock badge when a Snare Wisp reaches for a piece).
- The Mist meter reads "Mist 42%".
- A "Next merge +1" chip appears while Focus or Ripple is waiting.
- Scout shows the hidden pieces faintly over their Mist.
- Locked pieces are drawn under the first boards' half-Mist.
- The friend says "Every time we merge, it spreads too. We have to push it back." after the first merges, and "It is open. Merge right beside it." once a wisp is exposed.

## Where it's used

- **Lift the Mist** (every friend's first level): one Creeper in three cells of light Mist. It was a territory board until Sept 24 2026, which is why the first shots never showed.
- **Petalimp chapter 1** (5×5 board):
  - **1-1:** one Creeper in its Mist, 18 of 25 cells open, a generous Pod;
  - **1-2:** Thick Mist and a pair of Sprouts, to show that bigger merges clear more.
- **Petalimp chapter 2:**
  - **2-1:** the Drifter, in a deep blanket of Mist;
  - **2-2:** two wisps at once, a Creeper and a Drifter.
- **How a level opts in:** a level is Merge vs Mist when its wisps have a `kind` (`islandLevel` sets `mode: 'tactics'`).
- **Next:** move the rest of the campaign over, one idea per chapter, following the spec's progression:
  - rescue;
  - then locked pieces and the Snare Wisp.

## Balance (bots, 10 seeds)

- **Petalimp 1-1, 1-2, 2-1 and 2-2:** the careful bot wins all four 10/10. The chapter 2 levels take about 6–7 merges.
- **The careless bot** never merges toward the Mist on purpose. It still wins 1-1 10/10 and 1-2 about 7/10.
- **Older levels** are unchanged: careful 10/10, and careless loses the bosses 10/10.
