# Heartwood and the living world

Status: canonical direction. Part 1 implementation is specified in [Heartwood Part 1](heartwood-world-part-1.md). This supersedes the distant-destination premise in the previous opening rewrite.

## Promise

The world begins fragmented beneath the Mist. Heartwood, its central Heart Tree, is still alive but cut off from the places and friends that once sustained it. Players restore those connections through Merge. Every recovered home makes the world more useful, more inhabited, and more personal.

**Merge → restore a place → help a friend → reconnect a root → heal Heartwood → discover another connection.**

Heartwood is visible from the opening. The mystery concerns the missing friends and broken connections beyond its grove, rather than reaching a tree somewhere off-screen. The first distant answering signal proves someone else is still there.

## Progression layers

| Layer | Purpose |
| --- | --- |
| Merge | Active play: create items, clear obstructions, complete deliveries. |
| Structures | Persistent results: restored places supply Merge inputs and host activities. |
| Heartwood | Shared accomplishments made visible; major milestones open the next connections. |
| Bond | A personal relationship expressed through visits, dialogue, memories and later bounded utility. |
| Journeys | Each friend's local story contributes to the shared recovery while retaining its own choices and boards. |

The Tree's stages are Dormant, Stirring, Rooted, Blooming, Awakened and Connected. The current implementation reaches Awakened through the six planting categories; Connected remains the future milestone for connecting this regional Heart Tree to other worlds. Friend arcs unlock their own routes alongside the planting progression. Completing this grove remains a meaningful achievement even as the wider story expands.

Milestones combine a small number of relevant story and restoration achievements. Previously earned accomplishments count. No second currency payment, rare random drop, expiring event, or high Bond requirement blocks core recovery. Requirements must form an acyclic progression graph.

## Five beds, six seed categories

The planting Garden and Heartwood share one hex. The original sculptural Tree occupies the middle and rear: thick intertwined trunk, sweeping branches, prominent amber heart and a broad evolving canopy. Five soil beds form a symmetric foreground horseshoe: one front-center, two front diagonals and two sides. Mossprout’s home remains separate.

Mossprout plants the first seed in the front-center bed. Momentum, Stillness, Renewal, Warmth, Curiosity and Connection remain six category choices, with five displayed at a time. A player can swap a plant into a chosen bed; its predecessor returns to the collection with its identity and growth intact. Replanting a collected plant is free. This creates room for personal choices and future seasonal plants without adding rear beds beneath the canopy.

Each category grows independently from seed to sprout to bloom through Merge deliveries. Three sprouting categories make Heartwood Rooted; five sprouting categories with at least three blooms make it Blooming; five distinct blooms make it Awakened. Progress counts previously planted categories in the collection as well as currently displayed plants. Swapping never undoes a Tree milestone, and the sixth category is optional for awakening. Completed legacy story milestones retain their earned Tree stages. Awakening does not bypass friend rescue or story gates.

Reflections give each plant personal meaning; Merge supplies its growth. The collection is not limited to five memories. The wider world continues through rescue arcs, new chains, restored places and story unlocks.

## Places and their owners

| Place | Friend and contribution | Long-term role |
| --- | --- | --- |
| Heartwood planting circle | Mossprout: first growth | Five displayed memory plants and six category choices and a modest supply patch, on the central Tree hex. |
| Trail / Lantern Post | Steppling: reconnect paths | Routes, clues, later expeditions. |
| Hearth | Feastle: welcome returning friends | Food requests and traveller stories. |
| Bloom Garden | Petalimp: restore flowers | Flower commissions, pollinators, seasonal displays. |
| Seed Nursery | Blossle: propagate life | Plant supplies and later selectable production. |
| Pond Sanctuary | Drizzlet: restore water | Water encounters and Wisps. |
| Orchard | Amberleaf: sustain the community | Harvest and shared requests. |
| Ancient Tree Grove | Mistle: remember the roots | History of the network; not a duplicate Heartwood. |

Discovery and restoration are distinct. Hidden/discovered describe visibility; existing restoration levels retain their meaning. Most tiles remain landscape, story or rescue spaces. Not every location produces a timed reward. New Workshop, Dream Well and shrine economies are deferred until a concrete gameplay need exists.

## Economy, Bond and return play

Structures feed existing Merge chains. Part 1 has one producer: two Seeds per parcel, one parcel every 12 hours, capacity two parcels. The initial gift teaches the relationship immediately. This is an initial tuning hypothesis, not a revenue forecast.

Keep Glow spendable, Bond personal, and Harmony accomplishment-based. Do not turn Harmony into a passive production currency. Collection must tolerate a full Merge board and offline absence.

Later Bond milestones first add visits, scenes, parcel choices and visual changes; numerical bonuses should be modest and bounded. Reflection can create keepsake plants that recall a player's answer. Every answer is mechanically equal, and sharing personal text remains optional. Emotional difficulty never causes corruption or weaker rewards.

## Live operations and monetization

Seasonal stories inhabit existing places: moon flowers in the Nursery, a visitor at the Hearth, a memory near the Tree. Events can leave ornaments and keepsakes, avoiding an indefinitely growing set of permanent producers. Optional Mist encounters offer extra rewards; they do not erase upgrades or reduce normal production.

Future commercial opportunities: coherent Tree/structure skins, friend cosmetics, seasonal decoration collections, event passes, and bounded convenience. Capacity or production purchases accelerate resources indirectly and must be described honestly. Core structures, friends and story recovery stay obtainable through play. No commercial offer is added in Part 1.

Evaluate whether players understand the shared goal, reach the first visible transformation, use Garden parcels, finish the first connection, and return to Lantern Routes before adding economy pressure. Monetization should deepen attachment to a world players already value.

## Visual canon

All hex tile generation uses the existing fal.ai Nano Banana pipeline. Heartwood stage edits retain the same camera, footprint, trunk and materials. Generate from existing world references; matte and package through the existing pipeline with provenance and LOD verification. Light pulses and Mist can be runtime effects. The former vector Heartwood illustration is superseded.

### Heartwood silhouette correction

The original Tree is the visual reference: a thick intertwined trunk, sweeping asymmetric branches, broad roots, and a prominent glowing amber heart. The five-bed adaptation must retain that identity. Do not shrink it into a sapling or replace its crown with a generic round bush. Growth adds buds, separated foliage cushions, blossoms and hanging seed lights to the same recognizable silhouette. Soil centers remain available for independent plant sprites.
