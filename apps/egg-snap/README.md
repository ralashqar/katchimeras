# Egg Snap

Portrait, offline puzzle duels inside the incubator. The game has six Mossprout duels, the neighboring Cheerlet jigsaw duel, persisted stories, coins, discovery, skins and a companion wisp. All six Formula Snap modifiers are available in the development arena.

## Run

From the repository root:

```sh
npm install
npm run start:egg-snap
```

Scan the Expo QR code on a phone, or run `npm run web --workspace=egg-snap` for a browser preview. Use a portrait viewport. The root `start` command still starts Katchimeras. Egg Snap uses Expo 54, React 19.1, RN 0.81.5 and the incubator's Skia 2.3.14 pin.

The web prestart step copies the installed CanvasKit WASM into the ignored public directory. Native and web Skia loading have separate module entrypoints; the native bundle does not load CanvasKit's Node branch.

## Play

New profiles open immediately into a guided duel. After winning, repair the central Mossprout nest, win two more battles on its tile, then spend 80 coins to unveil a neighboring Dream Mist hex. Its three-battle campaign leads to Pollen and Captain Crack. See [FTUE implementation](docs/ftue.md) for shared ownership, checkpoints and verification. Legacy campaign saves remain playable. Drag each piece to its matching colour and footprint; pieces lift above the finger. Return to the tray away from matching targets to cancel. A matching target takes priority even while the finger is still inside the tray. Both eggs independently play the same seeded puzzle sequence. Cells charge until the entire beat resolves, then launch toward the other egg. Exact beats build the egg's energy, even when slow. Each cell deals damage only when it arrives; both sides have equal health and the same damage rules. Chip protected cells with repeated placements; play the safe piece before an order bomb. A cycling bomb requires waiting for its safe phase.

Outside the new-profile FTUE, the original first duel starts with one piece, brings two on beat two, introduces gentle modifiers on beat five, and two-piece modifier beats from beat seven. Progression follows beat number, so misses never give either side a different future puzzle. Streak bonuses remain personal. The 64-turn introduction holds its final tier in unusually long duels; other encounters loop their authored mechanics. A first-seen mechanic opens a short tutorial with both combatants and projectiles paused.

Opponent difficulty contains only an action-time range and an accuracy probability. Campaign action times are 10% shorter than the initial tuning, with accuracy raised by five percentage points (capped at 97%). The arena defaults to 1.5 seconds per action and 85% accuracy. A separate seeded AI stream chooses real placements through the shared reducer, including partial matches, armour chips, wrong-colour refusals and bomb mistakes. Gusts and cycling mechanics use each egg's own beat-relative clock. The opponent has small footprints and no visible tray.

Feedback includes the source placement/praise/result audio, three placement voices for rapid drops, pickup and snap haptics, clear cascades timed to cell groups, shield chips, misses, bomb wind-up/detonation, cell impact and result cues. Escalating GOOD/GREAT/EPIC/LEGENDARY/GODLIKE callouts accompany streaks. Scenery recoil scales with the completed beat while aiming geometry remains fixed. Attack and placement celebrations take priority over damage shake: overlapping hits retain their red glow and haptics without changing the player’s expression or adding camera recoil. Pause settings save sound and haptics separately; muting sound does not mute haptics. Pausing or disabling haptics cancels queued pulses.

First wins pay 40 coins, the boss 100, replays 20. Defeat, draws and abandonment pay nothing and retries are free. Duel two discovers the 60-coin moss skin; duel three discovers the 60-coin wisp. The boss grants the Keeper skin and enables the 180-coin Cheerlet discovery. That region contains a playable jigsaw duel. Cosmetic ownership never changes damage.

In development, **Mechanics arena** selects modifier, strength, AI action time, AI accuracy and seed. Its results never grant coins or campaign completion. The arena is disabled in production.

## Ownership and extension points

Mossprout battles use a dedicated cinematic two-platform plate. See the [art master, prompts and derivation guide](../../art/assets/images/katchimeras/world/backgrounds/duel-stages/README.md). Platform contacts are projected with the image crop, and every equipped egg is aligned using calibrated visible-body bounds. Growth pivots at the feet. Pause → **Stage guides** shows the development calibration overlay. Short phones use a compact HUD, while tablets centre the portrait battle area. Cheerlet and non-battle scenes retain their existing backgrounds.

- `data/campaign.ts`: regions, duels, AI profiles, puzzle sequences, tutorials, rewards and content validation.
- `game/combat.ts`: pure combat session, damage tuning and sequenced presentation events. A chronological impact queue commits cell damage at collision time, never through animation callbacks. Same-timestamp impacts resolve together; simultaneous knockouts draw. Later impacts are cancelled after a knockout.
- `game/layout.ts`: shared visual/drop geometry and viewport bounds.
- `state/profile.ts`: serialized game services, progression, purchasing and idempotent attempt receipts.
- `state/sqlite-storage.ts`: a single SQLite statement commits the complete profile, including its reward receipt. Native saves use `egg-snap-profile.db`; story runs use `egg-snap-story.db`. Web previews use separate `egg-snap-*` localStorage keys.
- `components/battle.tsx`: scene composition, input and effect event consumption. Backgrounding pauses; unfinished combat is abandoned on process termination. Committed results recover on the world screen.
- `@incubator/tile-match`: attributed Formula Snap puzzle engine, modifier contracts, native presentation and effects. Public entrypoints are `engine`, `varieties`, `native`, `effects`, `geometry`, `timing`, `theme`, `feedback` and `audio/*`. Pure entrypoints do not load React or Skia. No racing scene or economy was imported.
- Shared additions: art-only egg catalog subpaths in `@incubator/art-egg-avatars/catalog/*`, passive `@incubator/avatar/energy`, and `@incubator/game-ui/reward-token-flight`. Katchimeras retains its reward-flight compatibility export.

New duel content must pass `validateDuel`, use beat-indexed stream progression, and supply an AI speed/accuracy profile. Both sides use the same canonical deal for each seed/index. Existing result receipts remain readable through the `won` field; new receipts additionally record `outcome`, including draws. Campaign IDs, coins and ownership remain unchanged.

## Validation

```sh
npm run check:egg-snap
npm run test:tile-match
npm run verify:workspace
npm run export --workspace=egg-snap
```

Tests cover symmetric deals after different accuracy/speed histories, all six AI modifiers, incremental impact damage, simultaneous knockouts, frame-size independence, stale input, layouts, draw receipts, reward idempotency and persistence. The SQLite test uses Node 22's experimental SQLite flag; this does not affect the Expo runtime.

Scripted accurate play at 0.75 seconds per placement completes the initial encounters in roughly 24–39 seconds, the boss in 59 seconds and jigsaw in 49 seconds for the recorded seeds. These are deterministic tuning samples, not measured human playtime. Only AI speed and accuracy vary opponent skill; health is always equal within a duel.

Browser QA covers visible opponent placements, return volleys, damage and pause. Android/iOS exports validate bundling, not physical-device performance. Before release, complete the seven-duel acceptance path on iOS and Android, including purchases/equipping, relaunch, defeat/draw/retry, reduced motion and rapid two-finger dragging. Check thermal/frame performance and native haptic feel on those devices.

The separately invoked legacy Katchimeras suites currently contain five unrelated source-assertion failures: the Mossprout journey plaque condition, the Today backdrop reference, an already-missing `today-tile-hatch-reveal.tsx`, Haven's legacy egg source assertion, and the You-screen background assertion. Their failing source files are unchanged by Egg Snap. Workspace validation includes the existing Katchimeras typecheck and shared package/packed-consumer checks.

PvP, login/cloud saves, monetization, combat upgrades and territory/resource simulation remain outside this first playable.

## Performance

Combat effects use a single cached Skia atlas with adaptive decorative budgets. Health and hit reactions bypass the battle React tree, and settled footprints are cached. See [PERFORMANCE.md](./PERFORMANCE.md) for the stress arena, profiling controls, benchmark command and physical-device acceptance targets.
