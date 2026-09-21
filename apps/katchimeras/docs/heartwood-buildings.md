# Heartwood buildings and Merge energy

Status: built September 2026, waiting for a device test. Direction: merge-2 with
4X-style base building. Older docs that say energy is retired are history.

Heartwood has five patches around the tree. Each holds one upgradable building
that owns one part of the Merge economy. The Wisp Lantern already holds
`front-right` (collection). The other four:

| Building | Patch | What it owns | Per level (10 levels) | Milestones |
| --- | --- | --- | --- | --- |
| Dew Spring | `back-centre` | Energy cap and recovery | +10 cap (100 to 200) | One energy every 2:00, then 1:45 at L4, 1:30 at L7, 1:15 at L10 |
| Seed Nursery | `front-left` | Item tier odds, every item maker | +3% tier-two finds | Tier-three finds: 3% at L7, 5% at L10 |
| Root Cellar | `back-left` | Storage | +1 storage slot | none yet |
| Garden Stall | `back-right` | Glow from orders | +4% Glow on every served order | none yet |

Cost to reach each level, in Glow: 20, 40, 80, 140, 220, 320, 450, 600, 800,
1000. All four share the curve. Three looks over ten levels (1-3, 4-6, 7-10).

Everything above is data in `constants/heartwood-buildings.ts`. The engine reads
the numbers and the panel shows them; tuning is an edit to that file.

## Energy

- A new world, and any save written while energy was switched off (cap 0),
  starts full at 100.
- A tap on an item maker spends 1 energy. A full board is checked first, so
  energy is only spent on an item that appears. At 0 the tap is refused with
  `out_of_energy` and the board shows `OUT OF ENERGY` on the maker.
- Never charged: a lesson's scripted drop, a friend's authored Journey find
  (it carries its opportunity id), any tap while the first-session run is
  active, and the mission and restoration docks (`spendEnergy: false`).
- Recovery is computed, not ticked: `mergeEnergyStatus(state, now)` returns the
  value as it stands, the cap, and when the next point lands. `refreshTime` and
  every tap fold it into the save. Energy earned above the cap is kept and
  simply stops recovery until it is spent down.
- The Merge screen's HUD shows `value/cap` with a countdown to the next point,
  hidden during the first session.
- Item makers stay unlimited (`MERGE_GENERATORS_UNLIMITED`): energy is the one
  limit on tapping. Life-input energy grants (journal, steps) are unchanged.

## Building and upgrading

`features/heartwood-buildings/buildings-world.ts` is the pure step, like the
Lantern's. `upgradeHeartwoodBuilding(world, id, expectedLevel, now)`:

- changes nothing if the level has moved on (a double tap, a stale screen);
- needs Heartwood to have stirred (`haven.tileStages.mossprout >= 1`) or the
  Kingdom goal introduced, and enough Glow;
- on the first build, sends a memory plant standing in that patch back to the
  collection with its growth, as planting the Lantern does;
- the Dew Spring's new room arrives full; the Root Cellar's shelf is there at
  once.

`upgradeStoredHeartwoodBuilding` in the repository serializes it. Snapshot saves
from a buffered provider carry `heartwoodBuildings` over from the stored world,
the same rule the Lantern uses.

A built patch is no longer a bed: `availableHeartwoodBeds` drops it and the
engine refuses to plant there.

## In the world

All five patch items (the Lantern and the four buildings) take their size and seat from
`constants/heartwood-patch-item.ts`: 0.68 of the original 104 x 124 box, the label's bottom edge 40 under the patch's
centre so the art stands in the patch. They are sized by layout on whole pixels, never by a transform (a scaled view is
resampled and lands on fractional pixels, which softened the art), and their images set `allowDownscaling={false}` so
they are decoded at full size and stay sharp when the camera frames them. Heartwood's own upgrade button is drawn at
half the size of other tiles' (`HEARTWOOD_MARKER_SCALE` in `world-upgrade-marker.tsx`); its press target keeps the
68pt minimum.

`HeartwoodBuildingWorld` is drawn on each patch like the Lantern. A built
building is one button that opens its panel. An unbuilt patch shows only a small
`+ Name` sign (green when affordable); a plant still growing there keeps its own
tap. Signs show once buildings are eligible, outside the first session, and only
while the world is free to take the tap.

The panel is `HeartwoodBuildingPanel` on the shared upgrade stage
(`docs/upgrade-stage.md`): benefits list only the numbers the next level moves,
levels scroll, future looks stay hidden, the button reads `Build` or `Upgrade`
with its Glow cost.

## The first session

The first session builds the Dew Spring. It no longer hands out or plants a memory seed.

- End of the first meeting: the card that used to read "Memory Seed received" shows the Dew Spring ("The old spring"),
  with the line that reflects what the player said the first thing grown should be for.
- `world.garden_arrival`: the chip on the centre patch and Mossprout's action both read "Plant it". The tap runs
  `buildFirstSpring`: Level 1, free, no Heartwood stage needed. It is planted as it will stay.
- `world.seed_planted` moves straight on to the first restore, as before, the moment the Spring is planted. If the
  plant did not land, the same guide and a "Try again" come up and `ensureStoredFirstSpringBuilt()` repairs it.
- Restoring the tree's tile does not touch the Spring: it stays drawn on its patch through the whole upgrade (buildings
  are no longer hidden while a tile's upgrade plays) and looks the same after. `haven.grow_first_memory` is now only a
  safety net (it plants the Spring if the planting beat never landed). Mossprout's line at that beat is about the
  tree's first root, not the Spring.
- The Spring stays drawn for the rest of the first session (not tappable). The `+` signs on the other four patches
  wait until the first session is over.

An earlier pass planted the Spring asleep and woke it with the garden. That read as the tile upgrade also upgrading
the Spring, and it vanished during the upgrade, so it was removed. A save from that short time has `dormant` cleared.

The step ids, action ids and the three `haven.*_first_memory` capability ids are unchanged (they are save data); what
they do is different. The screen keeps the names `firstSeedPlanted` and `firstSeedGrown`; they now read
`firstSpringBuilt` and `firstSpringAwake`. `haven.grant_first_memory` grants nothing.

Saves:

- Caught mid-session with the old seed already in the patch: building the Spring sends the seed back to the collection.
- Finished the old first session (a sprouted first-session seed in the patch, no Spring): `growFirstSeedIntoSpring`
  gives them the Spring they would have built, free, and records `from` so the panel says "Grown from your Seed of
  Stillness." The Kingdom screen calls `ensureStoredFirstSpring()` for this whenever no first session is running.

The first return notification no longer names a seed: "The old spring kept running while you were away."

## Heartwood's stage

`heartwoodStage` reads the buildings as well as the old seeds and takes whichever is further along: one building
stirs the Tree, three root it, all four at Level 4 bring it to bloom, all four at Level 7 wake it. A seed leaving its
patch never sends the Tree backwards.

## Art

Style, for all five Heartwood patches: cozy toy diorama 3D, soft bevels, cushiony forms, low detail and low texture
detail, big readable shapes. The first set (v1) was too detailed and was redone as v2 with that brief stated first
in the prompt and much simpler subjects: a few big shapes per look, and a building grows by getting bigger and adding
at most two big shapes, never small details. The Wisp Lantern already fits the brief and was left as it is.

Each building has its own three looks, in the Wisp Lantern's style (it stands on the patch beside them):
`art/assets/images/katchimeras/world/heartwood-buildings/<building>_<1-3>.webp`, 512 px, wired in
`constants/heartwood-building-art.ts`.

`python scripts/generate-heartwood-buildings.py` makes them through the existing generation and matting pipeline. The
first look is generated from the Lantern's art as the style and camera reference; each later look is generated from
the look before it, so a building stays itself as it grows. Sources, prompts and hashes are kept in
`art-source/katchimeras/heartwood-buildings-v2` (v1 is kept beside it as the record of what was tried). A look whose `source.png` exists is only re-matted; delete it to
regenerate; a look that is already matted is only packaged again, with no remote call. `--only root-cellar:1` does
one look.

Matting: the matting model reads a flat, pale surface inside a ring (the Spring's water) as a hole and cuts it out,
while the hex pipeline's own repair fills every enclosed area, real gaps included, with the black background. The
script's `restore_enclosed` sits between them: an area enclosed by the object is given back only where the source has
colour there (the background is pure black by construction). The outer edge and every real gap stay exactly as the
matting model made them. It retries a refused prompt or a network timeout three times.

## Energy icon

`art/assets/images/katchimeras/merge-world/ui/energy-dew-v1.webp`: a cyan dewdrop with a cream bolt, in the Glow
swirl's chunky toy style but cool where Glow is warm, so the two never read alike in the top bar. Used by the Merge
HUD (`GAME_CURRENCY_ART.mergeEnergy`), the Dew Spring's "Energy cap" row, and the order rail and serve overlay that
used the old orange drop. `python scripts/generate-merge-energy-icon.py` regenerates it. The matting model kept the
bolt and threw the flat drop away with the background, so this icon is lifted off its pure black background exactly
instead (alpha from distance to black, colour unmixed), with no model.

## Not built yet

- The Heartwood tree as the HQ that gates building levels (its stage already follows the buildings, above).
- A beat that teaches tapping the Spring to upgrade it, and what energy is. The first session never spends energy,
  so nothing introduces it yet.
- A ghost of the Spring on the empty patch before "Dig it out" (the old flow previewed the seed there).
- Energy refills (Glow, rewards, offers) and an out-of-energy sheet.
- Milestones for the Root Cellar and Garden Stall; item-maker charges and rest.

## Verification

`npx tsx --test tests/heartwood-buildings.test.ts` covers the numbers, energy
spend and recovery, legacy saves, the build step, beds, tier odds, order Glow,
storage and the panel model. `tests/merge-world.test.ts` holds the engine's
energy expectations. The dev UI gallery has live building panels ("Heartwood
buildings · live panel") that run the real step over a stand-in world.
