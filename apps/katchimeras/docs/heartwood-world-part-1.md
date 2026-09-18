# Part 1: Wake Heartwood

Canonical implementation: one central Heartwood hex, five foreground planting beds, six available seed categories. See [design vision](heartwood-world-design-vision.md).

## Opening and shared story

1. Clear the Mist and hatch Mossprout using the existing tutorial.
2. Mossprout plants the first chosen seed in Heartwood’s front-center bed.
3. Grow that seed through the authored opening. Heartwood becomes Stirring and grants its initial two-Seed parcel.
4. Rescue Steppling, welcome Feastle, and light the Lantern Post through the existing shared adventure.
5. Fill four more beds, grow the five chosen categories, and awaken the Tree. Existing Lantern Routes remain gated by story completion.

Mossprout’s home stays separate. Introductory companion dialogue hides all world tiles and projected plants. Story cards remain text-only; the root connector line remains removed. Egg questions and first-board Merge guidance are unchanged.

## Five beds and the collection

The Tree owns the middle and rear of the hex. Five shallow circular beds form a foreground horseshoe: front-center, front-left/right and left/right sides. All six categories remain available: Momentum, Stillness, Renewal, Warmth, Curiosity and Connection.

Tap an empty bed or open a planted memory’s tending shortcut to select a destination. The Heartwood panel shows each occupied bed and the six categories. Choosing a replacement returns the old plant to the collection; its ID, growth and original planting history remain intact. Replanting a collected plant is free. A newly introduced category costs one Merge Plant even when replacing an existing plant.

| Action | Delivery | Result |
| --- | --- | --- |
| Introduce a category | 1 Plant (`nature:garden:3`) | Seed, growth 0 |
| Replant a collected plant | Free | Its existing growth and visual stage |
| First nurture | 1 Plant | Sprout, growth 1 |
| Second nurture | 2 Plants | Stronger sprout, growth 2 |
| Third nurture | 3 Plants | Bloom, growth 3 |

Only unlocked, unobstructed main-board items qualify. Growth 1 and 2 share sprout art; the progress count distinguishes them. These costs are initial tuning, not validated long-term pacing.

| Tree stage | Requirement |
| --- | --- |
| Dormant | Before first growth |
| Stirring | One sprouting category, or existing FTUE/legacy introduction proof |
| Rooted | Three sprouting categories, or completed first-answer adventure |
| Blooming | Five distinct sprouting categories, at least three blooming |
| Awakened | Five distinct blooming categories |

Tree progress uses the strongest achieved growth per distinct category that has been planted at least once, including collected plants. The sixth category is optional. Swapping a bloom for a new seed does not regress the Tree or remove its unlocks.

## Persistence and migration

The combined tile retains `structure:mossprout-hex-garden` for existing tutorial and save targets. Slot IDs remain save-compatible: `back-centre` now denotes the front-center showcase bed; `back-left`/`back-right` are the sides, and `front-left`/`front-right` are the diagonals. The retired `front-centre` ID remains readable by legacy normalization but is absent from the rendered five-bed layout.

`sync_heartwood` migrates once to `gardenBedsVersion: 2`. It preserves all memory IDs, growth and timestamps, places the FTUE plant in front-center, and retains at most one plant per category in five unique active beds. An excess sixth plant returns to the collection; earned Tree stages survive. Duplicate-category memories are retained too, with the strongest growth copied to the preferred planted instance.

`tend_heartwood` uses an expected-growth precondition. `place_heartwood` specifies the destination and its expected occupant ID; stale or duplicate taps cannot charge another delivery or replace an unexpected plant. Board consumption, placement, receipts and state changes share the serialized repository transaction. Failed persistence leaves inventory and plants unchanged.

## Supplies

Two Seeds per parcel, one parcel every 12 hours, storage capacity two. The introduction grants one parcel once. Supplies enter the arrival system so full boards do not lose items. A full producer pauses and resumes from collection time; partial intervals survive collection below capacity. No pre-upgrade backlog is awarded. Stored production time cannot move backward with the device clock; this is a local economy, not server-authoritative anti-cheat.

## Art and placement

Heartwood occupies axial `(0, 0)`. Its first ring contains the Nursery, Mossprout, Bloom/Petalimp, Baristabbit, Steppling and Feastle. Remaining nature, friend and story tiles fill consecutive outer rings, with no empty interior hexes. Placement changes only presentation coordinates; tile IDs, unlocks and saved progress stay intact. Residents and camera targets use the same remapped coordinates as their supporting islands.

During the opening, hatch and Mossprout's first conversation, only Mossprout's island is drawn. Heartwood and its plants have no exception to this rule. The island remains visible underneath the narrative subject; the Garden reveal restores the surrounding map. Hidden tiles still reserve their bounds so the scene origin stays stable through these transitions.

All five stages are generated with `fal-ai/nano-banana-2/edit` through `tooling/art-pipeline/scripts/generate-heartwood-garden.py`. V4 sources, prompts, reference hashes and review images live in `art-source/katchimeras/heartwood-garden-v4`. The original Heartwood defines the Tree identity. Five foreground beds replace the prior six-bed circle; the back has room for the canopy.

Runtime images use transparent 1024/512/256 WebP variants and measured alpha bounds. Every stage shares one reserved frame. Independent plant sprites use measured soil contacts from `utils/mossprout-garden-layout.ts`; first planting is front-center. Real sky gaps between branches stay transparent through the matte pass. Existing six-category plant art is reused.

## Validation

- Shared-adventure suite covers five-category thresholds, free replanting, stale actions, six-bed migration, save/reload and transaction failures during replacement.
- UI regression checks that a collected bloom offers a free swap into the selected bed with the correct occupant precondition.
- Placement checks require exactly five non-overlapping hit targets and preserve the first-planting button alignment; scene checks keep the stage envelope stable.
- Generation validates source hashes, alpha bounds and all fifteen runtime exports. Review artwork is a layout composite, not a device screenshot.
- Native phone playthrough is still required for camera travel, finger guidance, touch feel and panel scrolling; no connected device is available here.

Broader producers, new currencies, monetization offers, seasonal systems and the Connected stage remain future work.

Current five-bed validation: 27 shared-adventure tests and two scene/FTUE placement checks pass. Typecheck and Android Expo export pass. Lint reports no errors and two existing warnings outside this change. All five Nano Banana sources and fifteen transparent runtime variants pass hash, size and bounds checks. See `art-source/katchimeras/heartwood-garden-v4/placement-review.jpg` for the actual scene geometry with plant growth across stages.
