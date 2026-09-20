# Wisps: a living collection for Heartwood

19 September 2026. Recommended product direction, not an implemented change.

This review covers current Katchimeras source, authored content, design records and the Wisp art contact sheet. It is not a native playtest or an audit of production flags, purchase configuration or analytics. Implementation takes precedence over older design documents. All proposed pacing, quantities and prices below are test hypotheses.

**Recommendation: make Wisps the small inhabitants players bring back to their restored world. Build permanent discovery and visible habitation first; add seasonal completion and paid expression after that loop works.** The strongest commercial value is owning a beautiful, personal place and completing a collection whose inhabitants can actually be seen there.

## 1. What the game actually has

| Current evidence | Implication |
| --- | --- |
| Generated catalogue: 120 identities, 51 marked ready and 69 planned. The ready roster includes Sprout, Fern, Bloom, Steam, Crumb, Wander, Moonlit, Relic and Grovelight. | Start with existing art. Dewdrop, Bubble, Pebble, Crema and Opal are still planned; they cannot be advertised as deliverable rewards yet. “Ready” here is the catalogue status, not a fresh audit of every file. |
| Wisp inventory, source records, equipped Wisp, discovery/repeat reveals, daily contextual selection and Journey reward receipts exist. | Extend the existing ownership system. This is integration and consolidation, not a new collectible backend from zero. |
| Three collection definitions and a Wisp detail route exist. The collection route renders reward labels and completion indicators. I found no corresponding set-reward claim implementation. | Turn the displayed rewards into real, durable grants and make collection accessible from the main world. |
| Haven is the main destination; old tab destinations remain registered with the tab bar hidden. | A working legacy collection route is insufficient discovery. The Lantern needs an obvious world entry point. |
| The provider combines local and server ownership, but set progress currently reads local inventory alone. Resonance, quantity and evolution terminology are also inconsistent between readers. | Resolve these before selling collection completion. A purchased Wisp must appear in the set count correctly. |
| Mossprout Journey rewards already select among Sprout, Bloom, Heartlet, Breeze and Giggle using conversation affinity. Merge receipts also support Wisp grants. | Contextual reflection rewards are partly implemented. Improve their meaning and presentation rather than postponing all Bond integration. |
| Heartwood has five displayed planting beds, six seed categories, lasting tree stages and a Seed-parcel producer. | The loose spec's “five upgrade structures” is not current canon. Keep the beds and place a Wisp Lantern beside them. |
| Runtime policy has `MERGE_GENERATORS_UNLIMITED = true`; energy values are zero. Generator capacity/rest data survives for future design work. | Do not sell energy, add energy rewards or promise regeneration helpers. Older charge/cooldown descriptions are not the current play policy. |
| Lantern Routes are three permanent mission boards with bounded daily Glow rewards and practice replay. They currently grant no event score. | Useful future Wisp-discovery surfaces, but integration needs explicit new rewards and receipts. It is not already a pack source. |
| Moonlit Mist and Restoration Week have disabled local pilots; event rules, reward infrastructure and Studio tooling exist. | Reuse the event foundation. A paid seasonal album and trusted purchase-to-Wisp delivery still need end-to-end work. |
| Existing economy policy makes Essence earned-only, proposes duplicate conversion, and provides a seven-captured-day visitor choice. Bundled commerce flags are off. | Avoid introducing Echoes as another wallet. Preserve the existing earned visitor mechanic; an additional Merge event invitation would be a new source. |
| Missions and Egg encounters also use “wisps” for obstructive or cleansing targets. | Clarify these before making players cherish and purchase friendly Wisps. |

The September 16 deployment record reports deployed economy/event infrastructure, but a disabled verifier pilot and outstanding RevenueCat credentials/native acceptance. That is a historical repository record, not a statement about today's live environment.

## 2. Lore and the player's promise

Established direction connects Mist with forgetting, Glow with attention, and restoration with recovering places and relationships. Wisps already represent lived experience in the art bible and daily system.

Suggested extension: **a Wisp is a little life that gathers around something remembered. The Mist can hide its home or entangle its light. Restoring a place gives it somewhere to belong.** Whether Wisps carry memories, are made from them, or predate them can remain a mystery for Mistle and later stories. Do not immediately declare that all Mist is corrupted Wisps or all Wisps are literal Harmony fragments.

Keep the hierarchy legible: Katchimeras speak, remember, form Bonds and lead stories. Wisps express a small personality through movement, a line of description and occasional reactions. They do not need feeding, happiness bars, deterioration or their own dialogue trees.

Use distinct presentation for obstructive Mist knots and collectible Wisps. A selected encounter can reveal a friendly Wisp inside a knot; ordinary mission targets need not all become collectible species. Revise player-facing terminology and transition art together, while preserving existing mechanic/save IDs. Never connect the player's difficult feelings or absence to corruption.

The loop should be:

> Merge or explore → uncover a contextual encounter → help a Wisp → watch it settle in the world → progress a collection → earn a visible improvement → choose the next discovery.

Daily noticing and Bond conversations join this loop as personal sources, without becoming requirements for every collector.

## 3. The Wisp Lantern and first experience

Put a small Lantern beside Heartwood, outside the five planting beds. Steppling's Lantern Post continues to serve routes and signals; the Wisp Lantern is a refuge and collection entrance. Do not give both the same silhouette, name or tutorial moment.

Introduce it after the first Garden restoration/Heartwood Stirring beat, at the next calm return to the world. The opening already teaches Mist, Egg questions, Mossprout, Merge and a seed; add no extra reflection questionnaire there.

Example first encounter:

1. Mossprout notices a Sprout Wisp caught beside the newly restored garden.
2. The player completes one short, solvable task using unlocked items. If an existing delivery provides the right moment, reveal it as that delivery's consequence rather than adding another toll.
3. The Mist loosens, the Wisp reacts, and its ownership is saved.
4. It flies into the Lantern and then settles beside a plant.
5. A small notice shows the first collection and a visible next lead. The player can choose “Keep nearby” or continue playing.

If Sprout is already owned, preserve its discovery date and personal history. This scene welcomes it to the grove rather than pretending it was newly discovered. Existing achievements qualify for Lantern unlocks; do not make progressed players replay onboarding.

Use three initial Lantern stages, not five independent grind ladders:

| Stage | Proposed unlock | Meaning |
| --- | --- | --- |
| First Light | First contextual Wisp encounter | Collection access, an equipped follower, automatic residents. |
| Gathering Place | Six distinct owned Wisps plus an existing restoration milestone | Choose displayed residents; show the next useful discovery lead. |
| Beacon | First permanent set completed and Lantern Post lit | Seasonal visitor stories and collections, once shipped. |

The Lantern never gates friends, essential restoration or the Tree's stages. Progression is one-way: core restoration unlocks collection opportunities; missing a rare Wisp cannot stop core restoration. Signature-Wisp collection rewards must not require the signature they award.

## 4. Organise collection around places and provenance

Use one inventory with three collection views: **Around the Grove**, **Our Memories**, and **Seasonal Visitors**. These are filters and authored sets, not separate versions of the same Wisp.

Keep the existing four rarity values: common, rare, epic and legendary. Helper, memory, guide and seasonal describe roles or sources; they should not become competing rarity ladders. Launch can mostly use common and rare while preserving existing higher-rarity owners.

Feature 18 existing ready Wisps in three proposed permanent sets:

| Set | Existing identities | Proposed completion reward |
| --- | --- | --- |
| First Growth | Sprout, Bloom, Breeze, Sunbeam, Fern, Nest | A small Wisp resting nook near Heartwood and a Mossprout reaction. |
| A Warm Welcome | Steam, Crumb, Feast, Heartlet, Giggle, Sizzle | A miniature supper gathering beside the Hearth. |
| Lights Along the Path | Wander, Drizzle, Sunset, Moonlit, Relic, Starlit | A string of route lights and a short remembered scene. |

These are new groupings and proposed additional in-game acquisition paths, not claims that all these encounters exist. Several current entries describe real-life places or activities. Revise source hints and lore where needed without rewriting historical records or achievement requirements. Grovelight remains an earned signature with its existing identity; do not relocate its unlock into a random pool.

All 51 ready identities remain accessible through their supported sources. The 18 form a guided campaign spotlight, not a reduction of the player's collection. Preserve the three legacy sets and owned progress in the archive; avoid presenting six equally urgent albums on the Lantern home screen. Existing legacy reward labels need either implemented grants or accurate availability text before promotion.

Give permanent sets small milestones at two and four discoveries, with the main diorama at six. This supplies early payoffs while later discoveries remain attached to real story progression. A milestone can add a cushion, leaf perch or little lantern to the same display, making the set feel like a place being populated.

Every missing entry should offer a useful lead: “Help Drizzlet restore the pond,” “Visit the Lantern Routes,” or “A visitor returns in a future migration.” Hide identity where mystery matters, not the existence of a reachable path. Broad geographic/health requirements should not block these featured world sets.

Keep ownership distinct from personal provenance. Finding Fern in a fictional forest grants Fern; it does not certify a real forest visit. Buying a seasonal visitor grants that visitor; it does not create a Bond memory. A Wisp can show several earned memories over its lifetime without multiplying its species count.

## 5. Give each acquisition source a job

| Source | Recommended role |
| --- | --- |
| First restoration and selected Mist missions | Guaranteed, contextual first discoveries. The encounter remains available until completed. |
| Companion Journey milestones | Earned signature/personal rewards and authored callbacks; reuse affinity selection. |
| Daily contextual discoveries | Continue the existing personal history and earned Resonance. No paid reroll of the player's day. |
| Completed order bundles | Capped progress toward an earned visitor invitation, rather than a random chance on every order. |
| Lantern Routes | New bounded discovery milestones with stable completion receipts; practice replay earns no further invitations. |
| Restored places | Visible visiting encounters that persist until played, rather than disappearing real-time spawns. |
| Seasonal story | Guaranteed featured visitors plus progress toward selectable missing visitors. |

Because normal generators are unlimited, raw merge counts and repeatable orders cannot mint unbounded collectible value. Use authored bundles, first-completion flags and account-period caps. Balance effort across bundle difficulty so trivial orders do not become the optimal farm. A player can finish a session with progress preserved instead of meeting a strict daily streak.

Existing seven-day visitor choice remains earned from captured days. Do not silently replace that promise with a Merge grind. A separately authored event invitation can use gameplay milestones and the same visual reveal, with its own eligibility and receipts.

Reflection should give meaning rather than an answer-optimisation puzzle. Use neutral identities such as Breeze, Sprout or Heartlet, equal reward value, and a “just help” route without personal disclosure. Different answers can change a remembered line or preference. Allow later encounters with alternative Wisps so a one-time honest answer never makes a permanent set impossible. Do not sell story-signature or Reflection Wisps.

Memory Wisps should link to existing Discoveries, scenes and memory records. Avoid a third competing memory-card album.

## 6. Make ownership visible

Use the current transparent Wisp art and personality-driven bob/orbit/reaction animation for the first release. These assets support convincing small residents without commissioning 51 new 3D rigs.

Start with a free follower and approximately six visible residents in the current camera area, testing performance on lower-end target phones. More ownership changes the variety and gathering compositions, not an unbounded sprite count. Let players pin favourites; automatically rotate other visitors. Paid decoration should never be required to display owned Wisps.

Examples: Sprout peeks around a plant; Crumb settles near Feastle's table; Drizzle follows pond ripples; Wander hovers by Steppling's markers; Grovelight rests near the amber heart. Tap a resident to see its name, where it joined, and its set. Keep their footprint small enough to preserve the Egg, Katchimeras and important world hit targets.

Start the archive with readable set rows and small staged scenes. A bloom animation can communicate completion. Add a constellation overview later if it remains readable on phones; a beautiful branching map must still make “what am I missing?” quick to answer. Reduced motion uses static poses and a brief reveal.

## 7. Duplicates, growth and helpers

**Keep Resonance as earned familiarity; use existing Essence for eligible surplus value.** “An echo of its light” can describe a duplicate reveal without introducing an Echo wallet.

Resolve the current quantity-versus-Resonance inconsistency first. Daily and Journey encounters already support Resonance; bought or shop-granted quantities must not silently become personal days. Rename the displayed growth stages so they cannot be confused with intrinsic rarity. Start with three meaningful cosmetic milestones: a new reaction, a special resting pose, and a small aura. Existing earned counts survive migration.

Specify duplicate handling by source:

- Daily/Journey repeat: records the genuine encounter and advances eligible Resonance; retain its history.
- Earned, repeatable visitor surplus: converts once to a modest configured Essence amount after the invitation budget is enforced.
- Purchases: target unowned eligible visitors or identified cosmetics, with an explicit same-value owned-item fallback. No paid duplicate conversion into earned-only Essence.
- Legacy quantities: remain intact. Any conversion migration uses a one-time receipt and never consumes the first owned copy or pays again after reinstall/sync.

Do not sell Echo/Essence bundles. Direct cash-to-Essence and cash → duplicate → Essence would both undermine the current earned-only economy. Delay trading until quantities, conversion and reconciliation have one coherent authority.

Helpers are a later, small extension. Begin with one earned resident assignment at a genuinely implemented producer. For example, a nature Wisp could add one Seed to the first collected Heartwood parcel per day, maximum one bonus Seed daily. That is measurable; whether it is valuable enough with unlimited generators still needs testing. Other early helpers can indicate an available encounter or offer a cosmetic reaction instead of adding output.

Keep one ability per site, free reassignment, no duplicate scaling, no global three-Wisp power loadout and no essential-story dependency. Utility unlocks through gameplay independently of paid appearance. Do not implement water-storage bonuses, expedition multipliers or Harmony production before those systems have a defined role. Harmony remains earned accomplishment, never passive income from bought residents.

## 8. Seasonal depth with a finishable collection

First extend the existing Moonlit Mist pilot into a **free six-Wisp visitor story**. Its premise already supports safe restored roots and a small light seeking a home. Test whether bringing visitors home is satisfying before selling completion.

For the first full album, target **12 seasonal visitors across three sets of four over six weeks**, subject to content capacity. Use the permanent roster to host the story, and new approved seasonal identities for the collection. Do not reclassify the already-owned Moonlit or Starlit as newly exclusive or reset their ownership.

Proposed completion model:

- Four distinct visitors are guaranteed by story milestones.
- Eight earned invitations each offer up to three currently missing non-story visitors; select one. If fewer remain, show fewer. This guarantees a new eligible discovery.
- Make roughly two invitations obtainable per active week, with unused weekly opportunity carried forward within the event. A four-active-week player then has a deterministic route to all twelve, leaving a buffer within the six-week season.
- A free Prismatic Call substitutes for one remaining non-story invitation. It chooses an eligible missing visitor; it never replaces a required story scene or grants Grovelight/Reflection achievements.
- At full completion, later earned invitations grant a disclosed bounded cosmetic/Essence reward, not an empty selection. A paid selector must retain valid value or stop being sold.

This is a target model, not validated pacing. Simulate missed weeks, late joining, short sessions, pre-owned event returns and free/paying cohorts before selecting final requirements. New events should return in an archive or migration rotation; retained Wisp ownership and set progress never reset. Keep paid selectors valid for their named collection after the active event, with a clear archive claim route.

Completion rewards should build one coherent scene: a pond lantern, a sleeping nook, a branch ornament, then an ensemble animation. A signature finale Wisp can be an additional prize outside the twelve required slots. It must not be needed to unlock itself. Premium decorations sit outside the free album denominator.

Travel Town demonstrates activity-fed seasonal packs, set rewards and missing-item Jokers; its duplicate system also turns surplus into a reward currency. These are useful mechanical references, not evidence of expected Katchimeras revenue. Borrow the layered goals and late-set agency; use permanent residents and retained history to fit this game's promise. [Seasonal cards](https://support.traveltowngame.com/hc/en-us/articles/11039196924946-What-are-Seasonal-Cards), [duplicate cards](https://support.traveltowngame.com/hc/en-us/articles/12981602652050-What-can-I-do-with-my-duplicate-Cards), [Joker cards](https://support.traveltowngame.com/hc/en-us/articles/14125173901970-What-is-the-Joker-Card).

## 9. Monetisation that builds on attachment

Launch commercial products in this order. Illustrative UK price points below are product-test hypotheses, not market benchmarks; the app must display actual storefront prices.

| Product | Concrete value | Initial price hypothesis |
| --- | --- | --- |
| Lantern decoration bundle | Named Lantern skin, matching habitat and Wisp trail; previewed in the player's world | £2.99–£4.99 |
| Six-week visitor pass | Premium habitat scene, decorative variants, additional eligible choice invitations and a Prismatic Call | £6.99–£9.99 |
| Collection choice bundle | One specified missing-visitor choice plus a matching decoration, with exact eligibility shown | £2.99–£4.99 |
| Complete scene bundle | Coordinated Tree ornament, Lantern skin and resident gathering animation | £7.99–£12.99 |

Cosmetics serve expression; the pass serves sustained participation; choice bundles serve catch-up and completion; scene bundles serve world customisation. A repeating season can support repeat purchases without requiring an ever-growing catalogue of power stats.

Do not assume appearance revenue alone will fund a high-cost live-ops operation. The commercial hypothesis is that visible attachment plus a worthwhile recurring collection produces more repeat demand than an isolated cosmetic shop. Validate revenue per exposed player and net content economics alongside retention, rather than forecasting from another game's revenue.

At five of six or eleven of twelve, show a quiet completion panel with the free source and optional guaranteed choice. Never imply that three random packs will finish the set. No targeting based on journal content, emotional answers or inferred distress. No offer immediately after a vulnerable reflection.

Reconcile the proposed pass with existing Plus before launch: use the visitor pass as the first seasonal commercial product and keep Plus as its current separate feature set during the pilot. Do not simultaneously promise a second Wisp pass or include the pass in Plus without a deliberate entitlement/value decision. Previously claimed Plus Wisps remain owned after subscription expiry. Opal needs ready art before a real paid claim can promise it.

**Random paid packs are a later optional experiment, not the first product.** If introduced, use two clear tiers, a tightly defined seasonal pool, explicit guarantees, meaningful duplicate protection and a published missing-item pity rule. The new pool must exclude personal/achievement/story-signature identities and cannot generate earned-only Essence through purchased duplicates. Odds and stateful guarantees require authoritative draws and testing. Apple requires odds disclosure before purchase for random virtual items; the reveal animation does not change that requirement. [App Review Guidelines, 3.1.1](https://developer.apple.com/app-store/review/guidelines/).

Keep the magical reveal: lights answer an invitation and arrive at the Lantern. Present selectors as invitations rather than consuming one sentient creature to transform it into another.

## 10. Implementation order and release gates

| Phase | Deliverable | Gate to continue |
| --- | --- | --- |
| 0 — Reconcile foundations | Canon/source rules; one ownership read model; reward claims; quantity/Resonance policy; preserve existing IDs and histories | Local and server grants agree in the archive, details, equipped state and set progress; repeated actions never duplicate rewards. |
| 1 — A Wisp comes home | Lantern entry, one contextual encounter, six ready Wisps, one real set reward, follower and visible residents | Players understand how to find another Wisp, see ownership in the world and receive/save the reward reliably. |
| 2 — Permanent depth | Eighteen-Wisp spotlight, three place sets, Journey callbacks, explicit source hints, bounded invitations, earned duplicate handling | A player without sensors/journaling can finish featured world sets; progressed saves retain everything; no circular gates. |
| 3 — Free seasonal pilot | Six visitors, Moonlit Mist story, one visible completion scene, claim/archive rules | Completion works for normal sessions and missed days; players voluntarily revisit residents; measured retention warrants more content. |
| 4 — Commerce | One cosmetic bundle, then the twelve-visitor pass and eligible completion products | Verified purchase/grant/recovery path, production-compatible events, native acceptance, all promised art available and economics simulated. |
| 5 — Additional depth | Earned site helpers, migration events, signature story arcs, richer poses, optional paid-pack experiment | Each addition improves measurable engagement or revenue enough to justify its content/engineering cost. |

Reuse `data/wisps`, the generated registry, Wisp provider/state/storage, Journey Wisp receipts, the existing mission renderer, gameplay outboxes and Live Ops Studio. Extend content validation instead of authoring a separate Wisp CMS.

Add explicit definitions for set membership/reward IDs, encounters, residence anchors, seasonal eligibility, selector pools and cosmetic variants. Persist reward receipts, encounter outcomes, residence selection and any pity state. Variant ownership is separate from base-species discovery and must not inflate Harmony or species counts.

Grant/save before presentation. An interrupted flight replays or resumes presentation without another grant. Set completion consumes no Wisp and grants its reward exactly once. Full boards use the arrival/reward inbox for item rewards. Expired event definitions/art remain available for existing owners and unfinished valid claims.

The existing Wisp outbox records local first-discovery facts. It does not by itself make paid claims trustworthy, and it needs richer acquisition provenance before purchase-origin discoveries can be excluded from Harmony and earn-only event scoring. One qualifying order may progress a capped event and invitation; opening a paid invitation must not recursively create more event points, Harmony, invitations or purchase rewards. Distinguish first species discovery from a repeat visitor encounter.

Specific acceptance cases: local/server ownership overlap; existing set owners; duplicate/reordered grants; offline claim/relaunch; interrupted reveal; full board; content retirement; season boundary; reused selector; unsupported client catalogue; failed/refunded purchase; out-of-order entitlement updates; repeat claims after restore; invalid helper assignment; reduced motion and low-end scene performance. Native commerce and world presentation need device acceptance. No test suite or device playthrough was run for this planning review.

## 11. What to measure

Track the funnel from first encounter → successful grant → visible resident → Lantern revisit → first set milestone → set completion. Record whether players choose favourites, follow source hints, visit residents after the reveal and pursue a second set.

For collection health: time to each discovery, invitations needed per missing slot, duplicate rate by source, late-season completion, missed-day recovery, and completion among players declining personal inputs. A collection that works only for daily high-intensity players needs retuning.

For commerce: eligible offer exposure, cosmetic preview-to-purchase, pass attach rate, completion-product conversion, repeat purchase, refund/missing-grant rate and revenue per exposed player. Compare retention and story progression against a holdout or the pre-release baseline; do not accept better conversion achieved through worse free collection outcomes. Personal answer text is not needed for these events.

The first development milestone should be small and concrete: **help one existing Wisp, watch it move into Heartwood, complete one six-Wisp set, and see the reward change that same place.** That proves the value the later pass and collection products would sell.

## Repository evidence

- [Current Heartwood direction](heartwood-world-design-vision.md) and [implemented five-bed flow](heartwood-world-part-1.md).
- [Current Merge economy policy](../utils/merge-world/economy-policy.ts); this supersedes the retained capacity/rest description in [v18](mossprout-personal-merge-world-v18.md).
- [Generated Wisp catalogue](../data/wisps/catalog.generated.json), [art bible](wisp-art-bible.md), and [reviewed contact sheet](../../../art/assets/images/katchimeras/wisps/wisp-complete-contact-sheet.png).
- [Wisp ownership provider](../features/wisps/wisp-provider.tsx), [state](../utils/wisp-state.ts), [storage and Journey grants](../utils/wisp-storage.ts), [daily selection](../utils/daily-wisp-hatch.ts).
- [Set definitions](../constants/wisp-collections.ts), [set progress](../utils/wisp-collections.ts), [collection route](../app/(tabs)/collection.tsx), [main navigation](../app/(tabs)/_layout.tsx).
- [Mossprout Journey rewards](../constants/mossprout-journey-campaign.ts), [affinity resolution](../utils/journey-wisp-affinity.ts), [family series](../constants/wisp-family-series.ts).
- [Economy fallback flags and conversion policy](../data/economy/fallback.json), [Wisp commerce runbook](wisp-economy-live-ops.md).
- [Shared adventure and Lantern Routes](shared-adventure-part-1.md), [local event pilot](../features/live-ops/local-catalog.ts), [source outbox](../features/live-ops/source-outbox.ts), [live-ops implementation/deployment record](live-ops-implementation.md).
