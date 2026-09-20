# Wisp Lantern pilot

## Test from the profile snapshot

Load **Kingdom · Before Wisp Lantern** and return to Haven. Once other story screens have cleared, Mossprout offers the Lantern introduction:

1. Choose **Find a place**.
2. Tap the highlighted front-right patch or **Plant Lantern**.
3. Watch the Lantern settle and light, then **Open welcome pack**.
4. Watch the pack shake and the card grow into view with the friend discovery rays and confetti, then browse the deck, choose **Welcome home**, and **See collection**.

The snapshot includes Feastle hatched, Pantry unpacked, first Snack served, Steppling home, Heartwood introduced and the first Memory Seed sprouting in its front-center patch. No Lantern placement, introduction or welcome reward is pre-applied.

## World and presentation

The Lantern occupies the front-right patch. If occupied, its plant returns to the collection with growth and historical milestones intact. Four beds remain available; Heartwood still counts five historically grown categories, including swapped-out plants. Both planting paths reject the reserved patch. Placement is retained during world normalization and stale provider saves.

The ContentFlow introduction separates invitation, planting, lighting, pouch opening and the final Mossprout conversation. Ordinary interactions are disabled while the planting target remains tappable. The existing first-seed camera and guide infrastructure frames the actual patch.

Wisps and the friend collection use `CollectibleCardDeck`, extracted from the existing friend carousel. It retains the gesture controller, snapping, visual slots and neighboring-card hit targets, with accessible previous/next buttons. Both the sealed pack and its card reveal use the full-screen dark reward Modal and `DiscoveryRewardSequence`, exactly like friend rewards. The pack grows in with rays and confetti, then stays at that reveal size and position through the pack-only `keepHeroInPlace` layout. A “Your first Wisp pack” pill appears above; text and Open appear directly below. The hero remains directly centered in the original reward overlay. The pill and lower controls are absolutely positioned around it; only the copy scrolls on shorter screens, with the CTA outside that scroll region. Friend rewards retain their smaller portrait transition. Pressing Open shakes the same pack in place. There is no world-space pack sprite, camera projection or Mossprout dialogue during pack opening. Planting still uses the world and its existing FTUE guidance.

Only the pack's shaking/pulsing effect and tactile feedback use the Egg code: continuous 62ms rattle, 720ms pulse and `createEggHatchHaptics` sequence, with the same platform support as Eggs. The pack never fades or snaps away: over 150ms the sealed stage starts shrinking it (to `WISP_PACK_HANDOFF_SCALE`, 0.72) and hands over still fully visible; the card page mounts its own copy at the same spot and size and carries the shrink on (`wisp-pack-handoff.ts`). Reduced motion keeps the plain 80ms fade. Timers and animations cancel on unmount. Reduced motion skips visual rattles and uses the shortened feedback sequence.

Card opening is one page (`WispPackReveal`), like a friend's card joining the deck: the swipeable deck, its heading and its action are there from the first frame, with no separate big-card reward screen that later turns into the deck. The opened pack goes on shrinking in the middle of the page (300ms) while the new card grows out of the same spot (340ms, lifted 34 points over the deck), holds for 360ms, then slides down into the deck's middle slot (420ms); the other cards and the copy fade in a beat behind it. The friend celebration's rotating rays and tier-3 confetti play behind the deck for the same 1150ms and then leave. Browsing away and back never replays the arrival, and the card keeps its wrapper so it does not remount when the arrival ends. No card flip remains. Duplicate cards still show their Echo value. Reduced motion shows the settled deck at once. The sealed pack stage still uses `DiscoveryRewardSequence`. The reveal Modal opens without an extra fade to preserve the dark background during the world-to-reward handoff.

The collection has a six-card deck and set progress, with silhouettes for missing cards. Wisp details, resident/follow actions, Echo exchanges and probability details are separate views. Personal Bond and story Wisps remain outside visitor pools. Collected Wisps can still inhabit the world.

Generated transparent artwork lives in `art/assets/images/katchimeras/wisps/cards`: a green-and-gold Wisp pack and a cream-and-gold card frame. Source PNGs and exact generation prompts are in `art-source/katchimeras/wisp-cards-v1`. The Lantern anchor is 14 world units lower on its reserved patch. The lit Lantern artwork is used consistently from planting onward; the dormant source remains archived. Planting registers the actual CTA with the existing seed tutorial target: the finger points to Plant Lantern and the spotlight includes both the button and its patch.

Rarity metadata supports Common, Rare, Epic and Legendary, each with a label, colour, symbol and Echo value. Current content remains five Common visitors plus Rare Crystal; this update does not add higher-rarity drops or change existing odds. Epic/Legendary treatments are ready for future authored content.

## Rewards and save compatibility

- New welcome pouch v2: one common visitor, 20% each for Dewdrop, Bubble, Nimbus, Clover and Pebble.
- Previously granted v1 welcome pouches retain three distinct common visitors. Repeated unlocks never grant another welcome pouch.
- Ordinary pouches remain three visitors: each common has an 18% per-slot chance, Crystal 10%. After two wholly duplicate ordinary pouches, the next guarantees a missing visitor if needed.
- Duplicates leave one Echo, or five for Crystal. Fifteen Echoes invite a missing visitor; twenty unlock the golden Lantern glow. Completing all six grants the First Gathering habitat.
- Pack outcomes, ownership and Echoes commit together before presentation. Each pack slot has its own presentation ID, so repeated species remain separate cards. Browsing persists `focusedCardIndex` without consuming the reveal; the final CTA acknowledges the whole pack. Old saved reveal prefixes supply a compatible initial selection. Neither reopening nor browsing rerolls or grants rewards again.
- The welcome prompt requires an unopened pack. After acknowledgement, the same card stays mounted with a disabled Continuing action until the tutorial advances. A failed story handoff offers a retry without reopening or shaking the pack. Stale Open callbacks check persisted pack state before starting animation.
- Existing introduced saves receive only the missing placement step; ownership, pouches and introduction completion survive.
- Placement is a serialized SQLite world transaction. Failed writes roll back; retries are idempotent. World-earned pouches use durable receipt IDs when delivered to Wisp storage.

Two welcome Garden requests and the five-order daily pouch continue unchanged. Local event rewards may grant Lantern pouches; this update adds no purchases or commercial authority. The local scope remains `local-lantern-v1`. Paid products still require verified server outcomes and purchase receipts.

## Verification

42 targeted tests cover the profile fixture, placement and displaced growth, normalization, four-bed progression, welcome compatibility, reveal remounts, shared celebration timing, reduced motion, SQLite rollback, existing Garden rewards, duplicate deck slots, persisted selection and shared deck navigation. TypeScript passes; targeted lint has no errors. Android export is written to `dist/wisp-card-deck`.

The latest 24 focused tests cover the Wisp flow, shared reward celebration, hatch feedback, interruption cleanup, reduced motion and planting CTA registration. They verify that the same pack image and dimensions persist from sealed to opening, cracking does not restart the shake, and welcome/opening remain inside the same reward Modal.

The actual Wisp card component was visually checked in a browser preview with the generated assets and project fonts. That preview is not the full native flow. No attached native device/runtime was available: on-device acceptance should check Lantern centering at different zooms, patch/finger alignment, swipe gestures, safe areas, large text, and the complete snapshot flow.
