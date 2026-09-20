# Lantern hub and upgrade foundation

The Lantern now opens to owned pack rows, with Collection as a separate tab. The introduction's See collection action still opens Collection. Pack rows group identical definitions and versions, sort active seasonal packs first, and open the oldest owned instance. The hub stays mounted behind the existing reward overlays so navigation and scroll position survive opening. Pack details are generated from the saved definition, including explicit per-slot odds, duplicate Echo values and missing-visitor protection.

Growing the Lantern is not a hub page. The hub's Upgrade button closes the hub and opens the shared upgrade stage (`docs/upgrade-stage.md`): the Lantern framed on its plot in the top of the screen, `WispLanternUpgradePanel` docked below with the next Lantern in the hero row beside the free action, the resident stat as a strip, the three levels as slots and the two milestones as requirement rows. The panel stays up across an upgrade and moves on to the next level; closing it returns to the hub.

## Levels

| Level | Free milestone requirement | Resident capacity | Recurring reward |
| --- | --- | --- | --- |
| First Light | Finish existing introduction | 3 | Existing daily five-order pack |
| Gathering | Both welcome requests and 10 eligible everyday Garden orders | 4 | Additional ordinary pack every 20 eligible orders |
| Brighter Light | Gathering and 40 lifetime eligible Garden orders | 5 | Future recurring packs have two ordinary draws and one Rare-or-better draw |

Only the existing `lantern-daily-order` tagged committed events advance lifetime/recurring progress. Daily caps do not cap the other counters. Recurring progress begins when Level 2 is claimed and carries across days and the Level 3 upgrade. With the current six visitors, the Rare-or-better slot guarantees Crystal. Thresholds live in `constants/wisp-lantern-levels.ts`.

World progression and pack reward receipts are written through the serialized world repository. Upgrades are explicit, target a specific level and are idempotent. Resident assignment reads capacity from the committed world. Rewards pin their definition version when earned; changing Lantern level never alters an existing reward or pack.

Lantern save version 2 migrates version 1 without changing ownership, Echoes, packs, outcomes, reveal positions, residents or rewards. The legacy dry-pack counter moves to the ordinary permanent protection group. Each new group has independent protection. Guaranteed rarity constrains the eligible pool before missing-card protection; it is never weakened to force a missing Common. Existing world saves default to Level 1 and start lifetime progress at zero because no authoritative lifetime total existed.

## Seasonal foundation

`constants/wisp-albums.ts` defines permanent/seasonal albums, named sets, cosmetic rewards and explicit start/end/claim-end times. Production currently registers only Little Lantern Visitors. Future production pack definitions must remain versioned, reference a registered album, and include only ready, pack-eligible cosmetic or seasonal Wisps; validation rejects personal/story entries. Live-ops rewards accept registered local pack definitions and pin their versions.

Owned packs remain openable against their original definition after their season ends. Seasonal rewards can be claimed during the active and claim windows; the claim deadline is exclusive. Collections and cards persist afterward. Exchange remains limited to the six permanent visitors and the existing golden glow. No purchase API, premium pass, payment verification or wildcard economy is introduced. The existing local economy scope and Lantern feature flag remain in use.

## Test profiles and artwork

- **Kingdom · Before Wisp Lantern:** unchanged played-through Feastle/Seed of Momentum checkpoint.
- **Lantern · Level 2 Ready:** introduction complete, welcome requests finished, 10 eligible orders, grouped ordinary/Rare packs ready.
- **Lantern · Level 3 Ready:** Level 2, 40 eligible orders and 19/20 bonus progress; claim the upgrade and serve an eligible order to earn the Rare bonus.
- **Lantern · Seasonal Preview:** dev builds only, explicitly opted into a synthetic Moonlit album using existing art. Never registered in production. Preview ownership intentionally shares existing visitors; it is for UI and lifecycle testing, not season balancing.

Level 1 keeps the approved planting art. Level 2 adds gold trim and Level 3 a small leaf crown, with unchanged world anchor and image dimensions. Source PNGs and generation prompts are in `art-source/katchimeras/wisp-lantern-upgrades`; runtime 512px transparent WebPs are in the Wisp cards asset directory. Both were generated using built-in imagegen; opaque drafts were rejected. Upgrades crossfade the artwork and use the existing celebration particles, respecting reduced motion.

## Verification

Automated coverage includes save migration, thresholds, duplicate commands/events, failed upgrade writes, stale provider writes, recurring rollover, pinned rewards, separate protection, Rare guarantees, post-season opening, deadlines, grouped packs, tab preservation and the existing FTUE/reveal regressions. A React Native Web layout preview exercises the real hub and button components at 390×844 and 320×568, with native-only motion/deck dependencies substituted. Device playback, haptics and OS large-text settings require a native smoke test.
