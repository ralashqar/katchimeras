> Superseded premise: Heartwood is now the central recoverable Tree. See [canonical design vision](heartwood-world-design-vision.md) and [current Part 1](heartwood-world-part-1.md). Historical implementation details below remain useful, but distant-destination copy and vector art are retired.

# Shared adventure: Part 1

## North Star and canon

Reconnect the forgotten lantern paths to Heartwood. The player restores a welcoming home with friends, discovers who is answering from the Mist, and eventually joins other homes in rebuilding the grove’s network. Restoration is permanent: absence never damages a home, friendship, or signal.

The opening question is concrete: **can we reconnect the paths to Heartwood?** Only the first Lantern Post finale establishes that someone answers our light. Mossprout anchors the roots, Steppling recognizes the trail marks, and Feastle remembers the welcome at the other end. Their different strengths now contribute to one visible result. The two-handled bowl belonged at a table shared with Mistle; Part 1 deliberately withholds that name. The Mistkeeper holds signals within the old grove network. Later chapters reveal why, rather than treating the Mist as a punishment for the player being away.

Longer-term direction, not implemented in this release: follow answering posts into regional expeditions; reunite Feastle and Mistle; reach Heartwood; then rebuild connections between communities through cooperative seasonal goals. Future monetization can support expression and optional expedition depth once these loops show retention. This implementation adds no purchases, subscriptions, competitive pressure, or paid reward clocks.

## Playable sequence

1. The opening shows dormant Heartwood. Mossprout names it at the first meeting; the planting checkpoint reveals the destination and Garden objective. Restoration sends a visible light along a root to Steppling’s broken marker. Existing tutorial actions and saves remain valid.
2. After Steppling’s lesson, the Kingdom introduction recaps the team’s first shared task. The player chooses what their signal promises: welcome, rest, or company.
3. Steppling’s trail mark leads to a normal Garden request: one Plant and one Shoe. Its 60 Glow funds Feastle’s existing rescue price. The request is a durable story order, not a second inventory system.
4. Rescue Feastle and finish the existing first-Snack lesson. Progressed saves satisfy this from their recorded lesson or served receipt.
5. Feastle’s bowl and doorstep connect the hearth to the lantern path. This uses the existing `feastle:chapter-1:doorstep-snacks` ID. A previously served order is recognized; personal Journey episodes are never completed by the shared arc.
6. Clear the signal-site mini-board. A Lantern Post appears on Steppling’s existing tile; no hex is added. Raising it records one permanent structure milestone.
7. Mossprout, Steppling, and Feastle exchange the finale’s lines. Three flashes receive a deliberate answer. The chosen promise is recalled. The post is lit and Lantern Routes open.

Petalimp and all existing island campaigns keep their mechanics, chapters, orders, mini-boards, and save identities. An active or newly discovered island friend keeps tracker priority. Players can still enter the shared adventure manually. Baristabbit and the islands are optional alongside it.

## Permanent Lantern Routes

| Route | Board | Completion |
| --- | --- | --- |
| Overgrown Turn | Nature pairs, sleeping echoes, veiled pieces | Reach the nature tier-6 item |
| Broken Waymarker | Trail pairs, sleeping echoes, veiled pieces | Reach the trail tier-6 item |
| Warm Delivery | Eight food pieces | Deliver the food tier-4 item |

All use the existing mission renderer and merge engine. One unfinished route is allowed and persists offline. The main board can be full without blocking play. Each route grants 20 Glow on its first completion per local day (60 total), then clearly labelled practice replays. Completing all three at least once earns the permanent First Pathfinder stamp. Routes grant no Bond, Harmony, event score, or repeat restoration milestones.

The reward day uses the maximum committed timestamp and current local time; rolling the clock backward cannot repeat an already recorded reward day. This is a local free-play policy, not a trusted server clock. It must not be reused for paid or competitive rewards.

## Save and content ownership

- `features/shared-adventure/catalog.ts`: bundled story, orders, seeds, and development rollout flag.
- `definitions.ts`: durable ContentFlow scenes, one stable run per beat and world save. Each line resumes after restart.
- `runtime.ts`: domain gates, isolated boards, daily receipts, and bounded local activity history.
- `applyStoredAdventure`: flushes buffered writers, reduces the latest SQLite snapshot, and commits world rewards and milestone projections atomically. Ordinary provider writes preserve adventure state; stale revisions are rejected.
- The additive world field retains schema 24. Invalid adventure state uses the existing snapshot recovery path instead of silently resetting reward receipts.
- Live Ops Studio `/shared-adventure` reviews the bundled narrative and requests, validates that each mission reaches its final delivery, and exports the review JSON. It does not publish or mutate live content.

## Rollout and verification

`SHARED_ADVENTURE_ENABLED` is true in both development and release. The opening, tracker, and chapter share the same bundled content. Native acceptance remains a verification task, not a hidden feature gate. Content and art are bundled, so the first session does not depend on downloads. The post reuses the existing lantern asset.

Run `npm run test:shared-adventure --workspace=katchimeras` for progression, save/reload, duplicate actions, full-board isolation, route rewards, clock rollback, tracker priority, SQLite failure rollback/provider interleaving, and scene-resume coverage. Run the app typecheck and the existing merge, story-flow, and local-event suites as regression checks.

Native acceptance still required: play a fresh save and a progressed Feastle/Petalimp save; drag each route on a small phone; background/relaunch during a move and during the finale; inspect post placement and modal safe areas; verify VoiceOver, large text, and reduced motion; test the daily boundary offline. Automated component tests are not a substitute for these device checks.

At implementation verification, unchanged commit `36f1ac66` reproduced the same 24 merge-suite failures and 20 story-suite failures as the working tree. These are existing failures, not passing checks. Local-event regression tests passed.

## FTUE narrative and guidance follow-up

The egg questions are unchanged. The post-hatch overlays now introduce the seed Mossprout kept, establish the player's preferred kind of support through a shared adventure scenario, see an outgoing root-light after restoration, and end with Steppling's three-notch trail marker. The farewell recalls the saved support choice. Choice IDs, seed mapping, Bond awards, and tutorial checkpoints remain stable; previously saved transcript entries retain their original words.

The opening mini-board keeps a finger cue through all seven merges. Only the first merge is spotlit; the first two retain exclusive input, then the player can make other valid moves while the finger suggests a pair. The first parcel lesson spotlights the first generator tap, guides two Seed spawns, then immediately points at the Seed pair and the available sleeping Sprout. Guidance considers only merges that lead to the requested item and falls back to loose pairs/spawning if that sleeper is already gone. No inventory is replaced or reseeded.

Verification: the new real-board test reaches and serves the Plant with exactly two spawns, including normalization/reload between moves. The targeted opening, parcel, Bond-overlay, first-grow, and Steppling-lesson checks pass (15 tests), as do the two updated narrative checks and TypeScript validation. On-device finger placement and pacing still need native acceptance.

## Heartwood opening rewrite

See [the opening beat sheet and acceptance record](heartwood-opening-rewrite.md) for the visible destination reveal, safe saved-game recap, semantic scene migrations, and before/after checklist.
