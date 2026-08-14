# Merge World game-layer architecture

## Boundaries

The feature is split into four layers:

1. **Catalog** — static items, chains, generators, recipes, orders, expansions, and economy fallbacks.
2. **Pure engine** — accepts a state and command, returns a result and next state; it performs no I/O.
3. **Repository/provider** — serialises commands, persists state, reconciles activity, Friendship, and Wisps.
4. **Presentation** — responsive board, requests, storage, collection, expansion, and Legacy entry.

The original Feastle quest remains a finite 6×6 challenge. Merge World is a
separate persistence domain because it owns durable inventory, timestamps,
currencies, and external reward receipts. It is not a separate interaction or
art system: both modes share Feastle's merge item rendering, move/merge flight,
landing, and celebration primitives. The persistent 7×9 adapter preserves the
same coordinate-based drag targeting, highlights, invalid feedback, and haptic
language while dispatching durable commands instead of round commands.

## State and commands

`MergeWorldState` v10 is a schema-versioned snapshot containing the 63 cells,
storage, generator charge state, Energy, Coins, XP, discoveries, active orders,
unlock state, reward inbox, typed life arrivals, chapter landmarks, activity
receipts, and external reward receipts.

Each v10 cell carries a board region and an optional Dream Mist descriptor.
Dream Echoes identify their trapped item and stable receipt ID. Successful
Echo merges and authored story clears write idempotent board-awakening receipts
so an interrupted FTUE can recover after the resulting item has moved or been served.

Typed arrivals carry an explicit `journal`, `companion_story`, `goal`, or
`legacy` source. Loading v1-v6 snapshots migrates activity-sourced inbox rewards
into companion-owned arrivals, repairs their contents from the owner's core
chains, and removes the obsolete activity inbox entries. The migration is
idempotent. Non-activity inbox entries remain readable for compatibility.

Commands are `refreshTime`, `tapGenerator`, `move`, `serveOrder`, `storeItem`,
`restoreItem`, `sellItem`, `claimInbox`,
`grantActivityRewardsBatch`, `claimArrival`, `viewMemoryArrival`,
`reconcileCharacters`, and `ackExternalReward`.

Every successful command increments `revision` and updates `updatedAt`. Failed
commands return an unchanged state and a recoverable player message.
Successful `claimArrival` results also return the spawned item IDs, definitions,
and cells, allowing presentation to animate the exact committed state without
reimplementing placement rules.

## Persistence

`katchimeras-merge-world.db` uses WAL mode and two tables:

- `merge_world_snapshot`: current JSON snapshot plus the previous valid JSON as a backup.
- `merge_world_outbox`: immutable Friendship/Wisp receipts and their applied timestamps.

Writes run in a SQLite transaction. Gameplay commands reduce synchronously so
animation never waits for storage. A single writer retains at most one active
write plus the newest pending snapshot, while unioning every outbox receipt
delta; rapid generator taps therefore cannot create an unbounded SQLite queue.
The database/schema promise is initialized once, and ordinary board commands
do not scan or rewrite historical outbox rows. Loading validates the schema and
board shape, normalises bounded values, and falls back to the backup before
creating a new starter world. The outbox is intentionally compatible with
later cloud sync, but v1 remains local-first.

## Data flows

```text
Persisted day records
  → stable activity receipt IDs
  → grantActivityEnergy
  → engine de-duplicates receipt
  → transactional snapshot
```

```text
Serve order
  → verify all board requirements
  → consume items + grant Coins/XP/Energy
  → append Friendship/Wisp receipts
  → persist snapshot + outbox
  → idempotently apply external ledgers
  → acknowledge receipts
```

```text
Katchimera collection changes
  → reconcileCharacters
  → unlock family/generator/branch
  → generator placed in preferred or next available open cell
  → order templates become eligible
```

## Invariants

- Board length is always 63 and locked cells cannot receive moves.
- Instance IDs are unique and monotonically allocated.
- Energy and Coins never become negative; Energy never exceeds its cap.
- A generator tap consumes nothing when the board is full.
- A parcel claim consumes nothing when all of its items cannot fit.
- An order is served only when all quantities exist on the board.
- A receipt ID affects activity, Friendship, or Wisps at most once.
- Order templates reference catalogued items and enabled branches.
- Natural regeneration and generator cooldowns derive from timestamps, not background timers.
- A Friendship/Wisp side effect runs only after the snapshot containing its receipt is durable.

## Presentation performance

- The 63-cell surface is a memoized static layer; one Reanimated overlay owns drag hover feedback.
- Sprite world positions and settlement transforms remain on the UI thread, and unchanged sprites retain stable gesture handlers.
- Snapshot persistence, Friendship refreshes, and routine generator messages never block or duplicate the motion path.
- Ambient drift and animated order rims pause during interaction. Repeated slow-frame samples reduce concurrent particles for the remainder of the session.
- The board stage uses top justification so the grid stays attached directly beneath the tray separator. The parcel stack participates in the tray rail's stable-key layout transitions, parcel flights remain absolute overlays, and parcel/serve transitions are mutually exclusive.
- Merge item art is decoded from 192 px WebP sources, compact HUD art from 128 px WebP, and the full-screen Feastle environment from WebP.

## Extension points

New content is authored in the catalog without changing reducer branches.
Remote config may overlay numeric tuning after schema validation. A future sync
adapter can upload revisions/outbox receipts and reconcile authoritative state
without changing UI commands.
