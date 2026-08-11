# Merge World rollout and acceptance

## Delivered foundation

- Persistent 7×9 board, authored blockers, starter Food generator, Merge-2, hybrid recipes.
- Energy regeneration, generator charges/cooldowns, storage, selling, discovery, Coins, XP, expansions.
- Three persistent request slots with solvability filtering and signature rewards.
- Five launch Katchimeras across Food, Nature, and Adventure.
- SQLite snapshot/backup/outbox repository and activity receipt projection.
- Unified Friendship ledger and Wisp grant receipts.
- Merge tab plus archived Legacy Games route.
- Feastle's production merge assets and animation primitives shared by both the
  finite quest and persistent board; Food uses the authored item art directly.

## Verification gates

1. **Engine:** catalog integrity, merge/recipe results, invalid actions, order consumption, full-board safety, timestamp regeneration, and idempotency.
2. **Migration:** empty, malformed, interrupted, and repeat-loaded snapshots; legacy Bond milestone anchors.
3. **Integration:** activity → Energy, character → generator/branch, order → Friendship/Wisp, Legacy deep link → Merge return.
4. **Presentation:** narrow phone, standard phone, tablet, large text, screen reader, reduced motion, drag and tap controls.
5. **Retention safety:** terminate after generation and after Serve; relaunch with no missing or duplicated objects/rewards.

## Balancing and telemetry follow-up

Before a production rollout, record privacy-safe counters for generator taps,
board-full rejections, merge tiers, order completion time, storage pressure,
Energy source/spend, and expansion conversion. Use those results to tune catalog
numbers; do not migrate saved state for balance-only changes.

## Subsequent content releases

Add Café and Gifts next, then Creativity, Home, Memories, and Social families.
Each release should prefer recipe, branch, generator-upgrade, or hybrid unlocks
over adding another permanent generator. Keep the final ecosystem within roughly
8–12 core families while supporting the full Katchimera roster.
