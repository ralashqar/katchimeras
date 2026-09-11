# Friend Restoration: mini boards for the island campaigns

Status: built for Petalimp (Sept 2026). After a device pass the user rejected the "bed" idea; the board now works like the opening's: **merges fill the bar**, some cells are **half-hidden in mist holding an item** (ordinary Dream Echoes: match the item to set it free, and that match counts), the local pieces can never fill the bar alone, and when the board is spent the chapter's order brings what unlocks the rest. Built: the chapter's `restoration` record and the three engine commands (`requestIslandCampaignDelivery`, `recordIslandRestorationProgress`, `completeIslandRestoration`), the pure helpers in `features/island-restoration/island-restoration.ts`, `IslandRestorationDock` over the shared `MistMissionDock`, the Kingdom wiring (camera on the island, checkpoint → order, deliveries placed from the store, the last bloom's impact → free upgrade), the marker's beds bar and the panel's stage cost. Petalimp's four boards are authored in `petalimp-bloom.ts` and proven by exhaustive search in `tests/island-restoration.test.ts`. Fernip's four boards followed on Sept 11, 2026 (`fernip-wildgrowth.ts`, same supply, larger boards; `tests/fernip-island-campaign.test.ts`). The other four friends keep the panel-only flow until their boards are authored. Device verification pending.

Original recommendation (Sept 2026) follows. Adapts the "Friend Restoration System" spec to what the Kingdom already has: the six island campaigns (`constants/island-campaigns/`), the two built mist missions (`docs/mist-missions-design.md`), dream echoes, parcels, and the static per-level island art.

## The short version

Keep the island campaigns exactly as they are on the outside, and put a small restoration board *inside* each chapter, between the friend's question and the island's upgrade. The chapter's existing Merge order becomes the delivery from the Main Board. The island's existing level art becomes the world payoff. Nothing about Bond, journey days, meditation or hatching is added for friends; Petalimp and the others stay lightweight.

Today, per chapter:

> question → Main Board order → return → pay Glow on the panel → island level up → resolution

Recommended, per chapter:

> question → **pay Glow, the restoration board opens under the island** → local merges into rooted beds → **checkpoint: a bed needs something the board cannot make** → the chapter's order on the Main Board (the delivery) → delivered items drop into the board → beds reach their target → **island level up** → resolution

The loop the spec asks for, `Main Board produces → Friend Board uses → World changes`, maps one-to-one: order (produces) → delivery cells (uses) → level art (changes).

## What already covers the spec

| Spec section | Already built | Notes |
| --- | --- | --- |
| §3 Friend state | `IslandCampaignProgress` (`discoveredAt`, `cardEarnedAt`, `chapters`) in `MergeWorldState.islandCampaigns` | Add one field per chapter: `restoration` (below). |
| §4 Restoration stages | Four chapters = island levels 1–4, with `coinCost` per level in `constants/mossprout-nature-islands.ts` | Stage = chapter. Level 0 = discovered, misted-off. |
| §5 Mini-board configuration, §2 Friend Mini Board | `MistMissionDock`, `useMissionBoard` (own store, own merge count, sealed 5×4 window), `createOpeningMissionState` / `createStepplingMissionState` | Make the seed a data definition instead of a factory per mission. |
| §6 Rooted items | Dream echoes: a fixed cell holding an item that takes its twin (`mist.kind === 'echo'`, `dream_echo_cleared`) | Echoes *clear*; rooted items *upgrade in place*. One new mist kind. |
| §8 Delivery | Chapter orders on the Main Board (`choice.order`, `activateIslandCampaignChapter`), served with `order_served` | Add a delivery target to the order and inject the served items into the board. |
| §10 Spawner / chain discovery | Discovery parcels (`claimArrival` with `generatorId`), the Journey Locker "found in the mist" on Steppling's mission | Reuse as stage rewards. |
| §11 Glow | Island level `coinCost`, chapter 1 free (the friend's gift), progress-aware `speech.restoration_ready` | Move the charge to the start of the stage (decision 1). |
| §12 World visual upgrades | Static art per island level, `HavenUpgradeTileArt` crossblend, reveal particles, camera emphasis | Exactly the spec's "static states + generic polish". Nothing new. |
| §13 Completion | `completeIslandCampaignChapter` → `upgradeMossproutNatureIsland` | Trigger from the board instead of the panel button. |

New tech is limited to: a rooted cell kind, a delivery link on orders plus injection into a mission board, a data-driven mission definition, and the Kingdom mounting the dock under an island tile.

## Data model

### Mission definition (authored per chapter)

```ts
type RestorationBoardDefinition = {
  columns: 5; rows: 3 | 4;                 // window over the canonical board, as today
  items: { cell: number; definitionId: string }[];      // local, movable
  rooted: { cell: number; id: string; definitionId: string; target: string }[];  // fixed, upgrade in place
  generators?: { cell: number; generatorId: string; forcedDrop: string; charges: number }[];
  deliveryCells: number[];                 // where delivered items land, in order
  checkpoint: {                            // §7: explicit, deterministic
    // The chapter's order (choice.order / fallbackOrder) IS the delivery request.
    // Optional: which rooted item the friend says is waiting on it, for the guide copy.
    waitingRootedId?: string;
  };
  completion: { rootedAtTarget: string[] } // §13: every listed rooted item at its target
  reward?: { kind: 'generator'; generatorId: string } | { kind: 'items'; definitionIds: string[] };
};
```

Attach it to `IslandCampaignChapter` as `restoration?: RestorationBoardDefinition`. A chapter without one keeps today's panel-only flow, so friends migrate one at a time (Petalimp first) and the registry test can require it only where authored.

### Rooted cells (§6)

A new mist kind on the canonical board, next to `echo`:

```ts
| { kind: 'rooted'; id: string; definitionId: string; target: string; ready: boolean }
```

Engine rule: dropping an item whose `definitionId` equals the rooted cell's `definitionId` upgrades the rooted item to the next tier in place (the dropped item is consumed), the cell stays locked, and `ready` becomes true when `definitionId === target`. Dropping a non-matching item is refused with the ordinary "does not match" message. The finger/spotlight machinery already resolves `board_dream_echo` targets; add `board_rooted` the same way (or reuse the echo target with a kind check). The windowed board draws a rooted cell like an echo with a small "bed" frame rather than mist.

### Delivery (§8)

- `MergeOrder` gains `delivery?: { campaignId: string; level: MossproutNatureIslandLevel }`. Chapter orders set it.
- On `order_served` for such an order, the engine appends the served requirement items to `islandCampaigns[campaignId].chapters[level].restoration.delivered: { definitionId: string; deliveredAt: number }[]` in the same reduction that consumes them. One transaction, so a kill cannot lose or double a delivery.
- When the mission board next mounts (or is already mounted), it injects each undelivered entry into the next free `deliveryCell` and marks it `placed` in the mission store. The injection is idempotent by index.
- The panel's `orders_active` state already says "Requested in Merge"; keep it, and let the dock's guide say the same thing over the board ("Petalimp needs a Flower. The Garden Basket can grow one.").

### Chapter restoration state (§3)

```ts
restoration?: {
  startedAt: number | null;        // Glow paid, board open
  delivered: { definitionId: string; deliveredAt: number; placed: boolean }[];
  completedAt: number | null;
}
```

The board itself lives in the mission store (`useMissionBoard`, key `katchimeras.mist-mission.<campaignId>.<level>.v1`) while the stage is active, and is cleared on completion, as the built missions do. It is never an inventory (§14).

## Chapter status machine

Today: `available → orders_active → return_ready → restoration_ready → resolution_ready → complete`.

Recommended for chapters with a board:

`available → board_open → delivery_requested → board_open → resolution_ready → complete`

- `available`: the question. Answering it charges the level's Glow (chapter 1: free, the gift) and opens the board.
- `board_open`: the dock is mounted under the island tile with the opening's framing (as Steppling's mission does). Local merges only.
- `delivery_requested`: the board's checkpoint is reached (a rooted bed at the tier below its target with no local twin left). The chapter's order is published on the Main Board. The dock stays visible but its guide points at the Main Board; the panel says "Requested in Merge".
- back to `board_open` once the delivery lands; the delivered item is the twin the bed was waiting for.
- `resolution_ready`: every listed rooted item is at target. The final drop plays the island crossblend from the board (the impact-triggered pattern from Steppling's mission), then the resolution line.

`return_ready` and `restoration_ready` disappear for board chapters. The `returnLine` copy moves to the moment the delivery lands on the board ("You brought exactly enough for a beginning."), spoken as a guide bubble, and `speech.restoration_ready` is no longer needed because the Glow was paid up front.

## Petalimp, concretely

Each chapter's existing order requirements are already the right delivery. The boards below are sized so the local items get a bed to the tier *below* its target and no further, which is what makes the checkpoint deterministic (§7).

| Chapter | Board | Rooted beds (target) | Local items | Checkpoint delivery (= existing order) | Reward |
| --- | --- | --- | --- | --- | --- |
| 1 One Small Beginning (free) | 5×3 | one Seed Bed at centre (Flower) | Seeds ×4, Sprout ×1 → the bed reaches Plant locally | one Flower | — |
| 2 Colours That Belong (60 Glow) | 5×3 | two beds: Flower, Sprout | Seeds ×4, Sprout ×2 → one bed to Plant, the other to Seed | Flower + Sprout | — |
| 3 A Path at Your Pace (150) | 5×4 | misted: Flower, Shoe | Seeds ×4, Plant ×1 | Rare Flower + Shoe | — |
| 4 Room for Every Bloom (300) | 5×4 | misted: Rare Flower, Boot | Seeds ×4, Plant, Flower | Magical Plant + Boot | Petalimp's card, the payoff insight, wake handoff (as now) |

**Built (Sept 2026):** a request only asks for what the Main Board owns by then. Petalimp comes before Shellio and the Memory Nursery, so her later deliveries are the Journey Locker's Shoe and Boot (its founding trail chain; the travel branch is gated too, and the engine reroutes a gated request onto the open chain on load), never a Shell, a Travel Journal or a Memory Bloom; a test asks the engine's own gate. The spawner-under-the-path idea below is not built.

Chapter 3 is where §9 and §10 pay off together: the friend's board reveals a spawner that the Main Board then owns, and the chapter's own delivery (a Shell) needs it. The Wild Garden's second chain is already gated behind Shellio; if the Tide Pool is Shellio's, author chapter 3's discovery as a different waterside spawner or move the discovery to the friend whose island it belongs to. The point is the shape, not the specific spawner.

## Fernip, concretely

Second in the wake order, so the Main Board can make exactly what it could for Petalimp: the Seeds chain and the Journey Locker's trail chain. The boards grow with the grove: wider window, longer bar, more misted cells. Every stage's request is the delivery; every path is proven by the exhaustive search.

| Stage (Glow) | Window | Misted cells | Local pieces | Delivery | Bar |
| --- | --- | --- | --- | --- | --- |
| 1 Somewhere Soft to Spread (free) | 5×3 | Sprout, Flower | Seeds ×4 | Plant | 5 |
| 2 Neighbours at Ankle Height (75) | 5×3 | Sprout, Plant | Seeds ×4, Plant | Flower + Sprout | 7 |
| 3 An Enthusiastic Thicket (150) | 5×4 | Flower, Plant, Boot | Seeds ×4, Plants ×2 | Rare Flower + Boot | 8 |
| 4 Room to Be Yourself (300) | 5×4 | Rare Flower, Flower, Hiking Gear | Seeds ×4, Plant, Flowers ×2 | Magical Plant + Hiking Gear | 9 |

The dev page's `Kingdom · Before Fernip` snapshot plays Petalimp's whole arc with real commands (wish told, mist paid, four stages opened, served, cleared, grown and resolved, her card revealed) and lands with Wildgrowth Grove open, misted and affordable.

## Kingdom wiring

Reuse the Steppling mission's wiring almost verbatim:

- Mounting: `activeIslandCampaign(world)` with a chapter in `board_open`/`delivery_requested` mounts `MistMissionDock` (a thin `IslandRestorationDock` wrapper, like `StepplingMissionDock`) under the island tile, target `{ kind: 'haven_nature_island', islandId }`, camera `OPENING_CAMERA_ZOOM`/`ANCHOR_Y` on the island. The Glow flights target the island's registered node.
- Guidance: a `restorationBoardStep(definition, state, progress)` in the style of `stepplingMissionBoardStep`: spotlight the first rooted bed, finger on the first local pair, then free; at the checkpoint, a guide bubble pointing off-board ("Requested in Merge") and the dock's board free but with no twin to give.
- Completion: the final drop hides the delivered item, flies it into the bed, and on impact dispatches `completeIslandCampaignChapter` + the island upgrade with `economyMode: 'free'` (the Glow was charged at `available`). The existing reveal presentation and resolution conversation follow.
- Leaving the Kingdom mid-board is fine: the store persists; the panel's "Continue restoring" action reopens the dock.

## Decisions to make first

1. **When Glow is charged.** The spec (§11) says once, before the mission. Today it is charged after the order, on the panel, with progress-aware speech. Recommendation: charge at the question for chapters 2–4 (the answer is the commitment), keep chapter 1 free. It removes the wait-for-Glow limbo after the board is finished and makes the board's last drop the payoff. Cost: the `returnLine`s that mention Glow ("when the Glow comes") need a pass.
2. **Rooted as echo variant or new kind.** Recommendation: new kind. Echo semantics (clear on match, award the result) are load-bearing in the FTUE and the Glow lesson; a rooted bed that upgrades in place and reports `ready` is cleaner as its own kind with its own reducer branch.
3. **Board size.** 5×3 for chapters 1–2, 5×4 for 3–4. The dock already supports both through `MergeBoardLayout` rows.
4. **Delivery arrival.** Recommendation: items appear in the delivery cells with the ordinary spawn pop, no parcel, so "the thing you made is the thing the bed needed" reads instantly. Parcels stay for spawner rewards only.

## Build order

1. Rooted cell kind + engine branch + geometry target + board rendering (unit tests on the reducer).
2. `RestorationBoardDefinition`, `createRestorationState(definition)`, `restorationBoardStep`; author Petalimp chapter 1 only.
3. Order `delivery` link + engine injection into `chapters[level].restoration.delivered` (atomic with serving).
4. Kingdom: `IslandRestorationDock`, status machine changes in `helpers.ts`, panel actions (`continue_restoring`), completion from impact with `economyMode: 'free'`.
5. Petalimp chapters 2–4 and the chapter-3 spawner reward via parcel; registry test rules for authored boards (every rooted target reachable from local items + delivery, and not without the delivery).
6. Roll to the other five friends as data entries.

## What stays out

No Bond, journey days, meditation, personal memory, real-life tracking or hatching for friends (§1). No economy, Energy, shop or inventory on a friend board (§14). No bespoke art or animation per stage: the static island levels and the existing crossblend are the whole visual budget (§12).
