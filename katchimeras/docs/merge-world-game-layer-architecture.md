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

`MergeWorldState` is a schema-versioned snapshot containing the 63 cells,
storage, generator charge state, Energy, Coins, XP, discoveries, active orders,
unlock state, reward inbox, activity receipts, and external reward receipts.

Commands are `refreshTime`, `tapGenerator`, `move`, `serveOrder`, `storeItem`,
`restoreItem`, `sellItem`, `claimInbox`, `unlockExpansion`,
`grantActivityEnergy`, `reconcileCharacters`, and `ackExternalReward`.

Every successful command increments `revision` and updates `updatedAt`. Failed
commands return an unchanged state and a recoverable player message.

## Persistence

`katchimeras-merge-world.db` uses WAL mode and two tables:

- `merge_world_snapshot`: current JSON snapshot plus the previous valid JSON as a backup.
- `merge_world_outbox`: immutable Friendship/Wisp receipts and their applied timestamps.

Writes run in a SQLite transaction. Loading validates the schema and board
shape, normalises bounded values, and falls back to the backup before creating
a new starter world. The outbox is intentionally compatible with later cloud
sync, but v1 remains local-first.

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
- An order is served only when all quantities exist on the board.
- A receipt ID affects activity, Friendship, or Wisps at most once.
- Order templates reference catalogued items and enabled branches.
- Natural regeneration and generator cooldowns derive from timestamps, not background timers.

## Extension points

New content is authored in the catalog without changing reducer branches.
Remote config may overlay numeric tuning after schema validation. A future sync
adapter can upload revisions/outbox receipts and reconcile authoritative state
without changing UI commands.
