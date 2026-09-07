# Egg Snap first-session implementation

Fresh profile → short opening battle → repair the central nest (40 coins) → two more home battles → unveil the neighboring Dream Mist hex (80 coins) → three-battle campaign with Pollen rescue and Captain Crack → nest upgrade gift and paid expansion.

## Shared technology

| Package | Responsibility |
| --- | --- |
| `@incubator/profile` | Serialized versioned saves; domain snapshot validation/installation; durable restore intent, recovery and rollback |
| `@incubator/story` and `story-expo` | Compiled FTUE graph, director, task events, surface subscriptions; native SQLite and durable web journal |
| `@incubator/environments` | Existing Katchimeras camera, sky/motion, Mossprout layout/art preset, hex tile renderer and upgrade phases/effects |
| `@incubator/avatar` | Existing layered compositor plus shared category tabs and selectable option cards used by both games |
| `@incubator/game-ui` | Shared narrative container, Katchimeras speech-bubble tooltip and developer profile controls |
| `@incubator/presentation` | Foreground/completion handling, shared Katchimeras spotlight cutouts/rings and reduced-motion drag guide |
| `@incubator/tile-match` | Existing puzzle rules, placements, rigging, drag geometry and combat feedback |

Katchimeras retains compatibility adapters and its inventory/economy, virtualized customization grid, dialogue content and world policy. Egg Snap owns its map topology, checkpoint definitions, egg roster, dialogue, reward rules and appearance permissions. The shared packages do not import either app. The Mossprout art preset is an optional art entrypoint; pure layout/camera/profile imports do not load image files.

## Gameplay adaptation

The tutorial uses the mechanics already implemented by the shared engine: order bombs must be made safe before the rigged piece, and armour requires repeated matching placements. They are not an offensive Eggsplosive or a defensive Hard-Boiled shield. The first enemy waits for the first successful snap; the opening moves from one guided piece to standard doubles with one gentle breeze round, and near-correct initial drops magnetize within one cell pitch. Early opponents use 36/60/64/64/80/120 HP while player health stays unchanged; damage and outcomes remain honest. The opening teaches snapping with a brief late breeze, the third home fight introduces defusing bombs, and the rescue introduces armour. Standard two-piece rounds are the default in all of them. Specials occur once in each authored sequence; prolonged fights continue on standard doubles rather than looping specials. There is no forced boss comeback.

The original projectile, crack, hatch and impact presentations remain. Each mechanic gets one saved lesson, dismissed after its first successful beat. The bomb notice pauses combat until the player taps “Show me how”, then pointers guide the safe shape and the defused shape. Existing currency and first-win rewards fund the first repair; no XP, energy, new currency or stat economy was added. Pip and Pollen have equal combat rules and separate body/face/hat/held selections. The captain unlocks a crown and one nest upgrade token.

The sole world view uses the shared Mossprout seven-hex scene: central nest plus six Dream Mist neighbors. The first three battles belong to the home tile; the second clearing contains battles four through six. The initial 40-coin reward funds repair, and two further 40-coin first-win rewards fund the 80-coin reveal. Optional purchases are gated until this reveal. The second campaign funds the 180-coin next-region reveal. Each tile has one compact campaign card with progress, replay and next-battle controls.

Both games use the extracted ground-bottom geometry, scene envelope and camera-settled upgrade phase controller. Egg Snap uses the existing tile crossfade renderer and currency/particle effects. A saved presentation receipt retains outgoing art until the camera, timeline and paint-ready crossfade finish. Interrupted presentations replay without spending again; matching acknowledgement clears the receipt. Inactive world/avatar screens remain unmounted, and presentation timers cancel on unmount. This is a working adaptation using existing art, not bespoke cinematic choreography for every beat in the original narrative spec.

## Persistence and reset

`state/adventure.ts` owns migration and pure progression commands. Version-one saves preserve coins, equipment, receipts and completed encounters; returning players receive free nest repair access. Version-two profiles now include nested world version 2 and pending presentation receipts. Migration preserves prior revealed tiles and earned rewards. Profiles persist nest level, revealed areas, fragments, reward claims, rescued eggs and per-egg appearances.

Economic commands serialize through the profile repository and publish only after a successful write. Battle receipts and world claims prevent duplicate rewards. The FTUE director catches up from those durable domain facts on return to the world; restarting between an economic commit and a story event does not require replaying the payment. Web story updates serialize run and event records in one journal.

Development builds expose **Dev** on the map and in battle pause controls. The panel supports capture, restore, rollback, fresh reset, mechanics arena and nine checkpoints through region completion. Profile and story domains restore together under a durable recovery journal; an interrupted restore resumes on boot. Cross-game snapshots are rejected. Controls are gated by `__DEV__`.

## Verification

Automated coverage includes the complete economic progression, duplicate/concurrent claims, failed writes, legacy migration, per-egg appearance isolation, interrupted restore recovery, cross-game rejection, web event deduplication, every released FTUE graph stage after repository recreation, initial AI gating and near-drop assistance.

Current browser checkpoint checks covered the central six-mist layout, 40-coin repair, camera settling, 80-coin reveal and the second tile’s three-battle card. Automated checks pass 78 Egg Snap tests and 121 focused Katchimeras rendering/FTUE tests, plus both application and shared package typechecks and dependency boundaries. Shared lint has five existing warnings outside this change. Earlier battle/drag validation is recorded below; a new physical-device full-session pass remains outstanding.

Run from the repository root:

```sh
npm run check --workspace=egg-snap
npm run typecheck
npm run check:boundaries
npm run test:packages
npm run test:tile-match
npm run verify:consumer
npm run export --workspace=egg-snap
```

The first-session time targets remain playtest targets. Physical iOS/Android interaction, suspension during every cinematic phase, accessibility settings on devices and a human 8–10 minute full-session balance pass still need validation. Platform exports are bundle checks, not physical-device tests.

The broader existing Katchimeras avatar/sky test selection has six failures in unchanged expectations (two save-schema-version expectations and four avatar/home source assertions). The focused camera and profile-snapshot suite passes; see the task report for final command results.

## Targeted battle guidance

The opening lesson spotlights the live tray and ghost target using the renderer shared with Katchimeras Haven and companion onboarding. Its 104-point hand starts at the measured centre of an actual occupied tray block and travels to the corresponding ghost cell, with the fingertip aligned using the source art's anchor. The shared Katchimeras speech-bubble shell points at the target; placement avoids the opponent. Guidance hides during pause and beat resolution and does not intercept puzzle input. Phone layouts were checked at 390×844 and 320×640, including a successful drag through the overlay.

The shared tray publishes occupied-cell screen anchors after refill settling and on viewport changes. Bomb coaching highlights both footprints throughout its notice/safe/defused steps. Successful lesson IDs use the existing persisted `mechanic:*` seen records, so later fights do not repeat them. A 20-seed pacing regression verifies the opening can be won in at most six accurate placements.
