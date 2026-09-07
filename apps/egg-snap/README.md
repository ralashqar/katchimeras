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

Choose the first duel in Mossprout. Drag each piece to its matching colour and footprint; pieces lift above the finger. Return to the tray away from matching targets to cancel. A matching target takes priority even while the finger is still inside the tray. Cells charge until the entire beat resolves, then launch together. Exact beats interrupt a warning and build the egg's energy, even when slow. Chip protected cells with repeated placements; play the safe piece before an order bomb. A cycling bomb requires waiting for its safe phase.

The first duel now uses Formula Snap’s earned progression: one exact beat opens two pieces, streak four rolls a gentle gust, shield or jigsaw, and streak six brings two-piece gust/shield/bomb beats. Breaking the streak returns to the opening solo beat. Duel two starts with two pieces. A first-seen mechanic opens a short tutorial with combat paused; the lesson stays dismissed on retries and relaunches.

Feedback includes the source placement/praise/result audio, three placement voices for rapid drops, pickup and snap haptics, clear cascades timed to cell groups, shield chips, misses, bomb wind-up/detonation, interruption and result cues. Escalating GOOD/GREAT/EPIC/LEGENDARY/GODLIKE callouts accompany streaks. Scenery recoil scales with the completed beat while aiming geometry remains fixed. Pause settings save sound and haptics separately; muting sound does not mute haptics. Pausing or disabling haptics cancels queued pulses.

First wins pay 40 coins, the boss 100, replays 20. Defeat and abandonment pay nothing and retries are free. Duel two discovers the 60-coin moss skin; duel three discovers the 60-coin wisp. The boss grants the Keeper skin and enables the 180-coin Cheerlet discovery. That region contains a playable jigsaw duel. Cosmetic ownership never changes damage.

In development, **Mechanics arena** selects modifier, strength, attack strength and seed. Its results never grant coins or campaign completion. The arena is disabled in production.

## Ownership and extension points

- `data/campaign.ts`: regions, duels, moves, tutorials, rewards and content validation.
- `game/combat.ts`: pure combat session, damage tuning and sequenced presentation events. Damage is committed on beat resolution, never by animation callbacks. A lethal placement at the attack deadline cancels the attack.
- `game/layout.ts`: shared visual/drop geometry and viewport bounds.
- `state/profile.ts`: serialized game services, progression, purchasing and idempotent attempt receipts.
- `state/sqlite-storage.ts`: a single SQLite statement commits the complete profile, including its reward receipt. Native saves use `egg-snap-profile.db`; story runs use `egg-snap-story.db`. Web previews use separate `egg-snap-*` localStorage keys.
- `components/battle.tsx`: scene composition, input and effect event consumption. Backgrounding pauses; unfinished combat is abandoned on process termination. Committed results recover on the world screen.
- `@incubator/tile-match`: attributed Formula Snap puzzle engine, modifier contracts, native presentation and effects. Public entrypoints are `engine`, `varieties`, `native`, `effects`, `geometry`, `timing`, `theme`, `feedback` and `audio/*`. Pure entrypoints do not load React or Skia. No racing scene or economy was imported.
- Shared additions: art-only egg catalog subpaths in `@incubator/art-egg-avatars/catalog/*`, passive `@incubator/avatar/energy`, and `@incubator/game-ui/reward-token-flight`. Katchimeras retains its reward-flight compatibility export.

New duel content should pass `validateDuel`, introduce its mechanic through dialogue and use warning budgets that account for waiting, protected cells and presentation. Opponent changes apply to the next beat; a warning can begin over an existing footprint without replacing it.

## Validation

```sh
npm run check:egg-snap
npm run test:tile-match
npm run verify:workspace
npm run export --workspace=egg-snap
```

Tests cover the imported engine and effects, all campaign encounters, deadlines, interruptions, bomb voiding, armour, duplicate input, stale events, layout, the streak progression across 25 seeds, haptic scheduling/cancellation, independent saved feedback preferences, purchases, result retries and SQLite close/reopen recovery. The SQLite test uses Node 22's experimental SQLite flag; this does not affect the Expo runtime.

Scripted exact play at approximately 1.1 seconds per placement targets 33–56 seconds (36 seconds for duel one and 44 for duel two) for the first five encounters, approximately 79 seconds for the boss and 64 seconds for the neighboring jigsaw duel. These are deterministic tuning samples, not measured human playtime.

Browser QA exercises the actual Skia footprint and pointer drag, volley, interruption, pause, dialogue and reload flow. Android/iOS exports validate bundling, not physical-device performance. Before release, complete the seven-duel acceptance path on iOS and Android, including purchases/equipping, relaunch, defeat/retry, reduced motion and rapid two-finger dragging. Check thermal/frame performance and native Skia compatibility on those devices.

The separately invoked legacy Katchimeras suites currently contain five unrelated source-assertion failures: the Mossprout journey plaque condition, the Today backdrop reference, an already-missing `today-tile-hatch-reveal.tsx`, Haven's legacy egg source assertion, and the You-screen background assertion. Their failing source files are unchanged by Egg Snap. Workspace validation includes the existing Katchimeras typecheck and shared package/packed-consumer checks.

PvP, login/cloud saves, monetization, combat upgrades and territory/resource simulation remain outside this first playable.
