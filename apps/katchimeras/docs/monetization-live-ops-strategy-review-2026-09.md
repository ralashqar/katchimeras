# Katchimeras: progression, narrative, monetization and live-ops review

18 September 2026. Recommendations, not approved product changes.

This is a source-code and authored-content review of Katchimeras, not Egg Snap. It covers the current chapter and island registries, dialogue, merge policies, progression, economy configuration, event implementation and authoring tools. I did not play a native build, inspect production analytics, verify current remote flags or make backend changes. Statements about deployment below describe the repository's deployment record. Pacing, prices and schedules proposed here are hypotheses to test.

**Recommendation: make Katchimeras a cooperative restoration adventure, powered by a persistent merge game and a cast whose personal stories change the same world.** Keep real-life noticing as its distinctive source of intimacy. Give the game stronger goals, choices and recurring challenges so players also return for what happens next, what they can build and what their group can accomplish.

## 1. What exists, and where the experience loses strength

| Area | Evidence in the current project | Strategic implication |
| --- | --- | --- |
| Core play | Persistent merge board, generators, authored orders, hybrid recipes, Dream Echoes, Mist mission boards and visible restoration. | Enough mechanics for a coherent game; adding disconnected minigames is not the priority. |
| Companion journeys | Three bundled Journey definitions: Mossprout, Steppling and Feastle. Mossprout combines 13 campaign beats and seven personal episodes into 32 episode records. Steppling has six episodes; Feastle has seven main episodes plus delivery returns. | The cast has uneven depth. Episode-record counts should not be confused with distinct dramatic chapters. |
| Island stories | Six bundled campaigns: Petalimp, Fernip, Blossle, Drizzlet, Amberleaf and Mistle. Each has four restoration chapters, choices and payoffs. | Substantial existing content to connect and sharpen before adding another large cast. |
| Baristabbit | Rescue, Egg, first meeting, generator lesson and daily activities exist; no bundled Journey continuation appears in the chapter registry. | A newly acquired character needs something meaningful to do after onboarding. |
| Unifying goal | Kingdom tracking already counts friends home and places restored, suggests next actions and eventually says every friend is home. | Do not add a competing quest hub. Evolve this tracker into a longer campaign with named shared milestones. |
| Lore | Mist as forgetting; Glow as attention; friends rediscovered rather than summoned. Mossprout suspects something is feeding the Mist; Feastle remembers a missing person. | Strong common premise, but plot hooks need shared answers and consequences. |
| Economy | Generators are explicitly unlimited; old energy values are zeroed. Campaign baskets can supply the tier immediately below the requested item. | High item tiers do not necessarily mean deeper gameplay or longer investment. Energy sales and generic acceleration lack a sound current value proposition. |
| Progression | Bond, world restoration, collections and cumulative Harmony already exist. | Connect their purposes without converting every track into one interchangeable power number. |
| Live ops | Local world events now use companion dialogue, main-board orders, docked missions and permanent keepsakes. Moonlit Mist and Restoration Week are disabled pilots. | The free playable event foundation exists. Use it for the first event test. |
| Commerce | Plus, earned Essence, Gems, shop configuration, receipt infrastructure and a subscription simulator exist; fallback commerce flags are off. | Foundation does not establish a functioning commercial funnel. |
| Paid readiness | The September 16 deployment record says migrations/functions were deployed, the merge verifier remained disabled, and RevenueCat secrets/native acceptance were outstanding. Local encounters cannot grant premium rewards. | Joining playable events to trusted paid entitlement and reward delivery is real remaining work. |
| Production tools | Studio edits current characters, drafts additive arcs, creates supported roster companions, and validates event/content releases. Some existing-content edits still require reviewed source integration. | Expand this toolchain; do not commission a second CMS. |

**The central weakness is insufficient convergence.** Many activities contribute to progress, but fewer make another character's problem newly solvable. The player needs to understand both “what I am doing now” and “what this lets all of us do next.”

The dialogue often repeats a structure: a small difficulty, a question about the player's habits or feelings, three valid answers, a crafting request, a reassuring resolution. These are useful relationship moments. Repeated as the main adventure, they can feel like questionnaires with crafting between them. That is an editorial diagnosis, not a measured retention finding.

## 2. What to learn from Whiteout Survival

AppMagic estimates approximately **$1.40 billion in 2025 store IAP revenue** for Whiteout Survival. Its report excludes webshops and other alternative monetization sources from the relevant store-IAP analysis. This is a market estimate, not audited publisher revenue or a forecast for Katchimeras. The same report identifies high-priced packs as a substantial part of leading 4X games' US iOS offer revenue. [AppMagic, Mobile Market Landscape 2026, pp. 33, 48–50](https://appmagic.rocks/files/view/upload/Reports/EN_MobileMarkeLandscape2026.pdf).

Whiteout's current listing and release history connect the Furnace, city growth, heroes, alliances, progression tiers, events and paid reward tracks. Century's July update adds another alliance stronghold event. These establish the systems; my interpretation is that their commercial strength comes from making the same investment useful across several goals. [Official App Store listing](https://apps.apple.com/us/app/whiteout-survival/id6443575749), [Century Games update](https://www.centurygames.com/whiteout-survival-wos-update/).

| Transferable principle | Katchimeras adaptation |
| --- | --- |
| One instantly understandable central aspiration | Reconnect the Kingdom through a visible Heartwood landmark and its light network. |
| Long progression with new capabilities | Kingdom eras, restored routes and companion specialties, with each milestone changing available play. |
| Roster investment matters beyond collection | Choose a small team for missions; friends solve different problems and enable combinations. |
| Events make existing activities useful again | A themed season links chapter goals, supplies, missions, collections and a shared project. |
| Other people give progress an audience | Small cooperative Circles, visited Kingdoms, shared landmarks and visible contribution. |
| Different spend motivations have suitable products | Entry offer, seasonal pass, expressive sets and later bounded convenience products. |

**There is a commercial fork.** A primarily reflective companion app can support subscriptions and collections. A deeper cooperative adventure can support more frequent spending. A competitive 4X with purchased power might support much higher spending per payer, but requires combat, rivalry, matchmaking, economy depth and an operating model this project does not currently demonstrate. These are different products. I recommend the cooperative adventure direction and would not forecast Whiteout-level revenue from cosmetics and a pass alone.

## 3. Give every system one campaign to serve

Use the existing Heartwood concept as the visible long-term landmark rather than inventing an unrelated castle. Show its dormant outline early; its identity and full function become clearer through the story.

**Proposed shared objective: reconnect the paths, homes and memories of the Kingdom, then discover who is still answering from beyond it.**

The core loop becomes:

> Notice or meet a friend → learn a specific problem → merge supplies and choose an approach → solve a Mist encounter → restore a place → gain a clue or capability → advance Heartwood → open the next shared goal.

Real-life activities personalize this loop and can provide modest bonuses. A player who declines sensors, photos and journaling must still have an enjoyable, complete route through the adventure.

Keep three permanent meanings clear:

| Track | Meaning | Main rewards |
| --- | --- | --- |
| Bond | This friend knows and trusts you. | Personal scenes, callbacks, expressive relationship keepsakes. |
| Harmony / Kingdom era | The community has recovered something lasting. | Regions, shared facilities, campaign chapters and group features. |
| Practical mastery and collection | You have learned how to help. | Recipes, mission approaches, Wisp collection effects and visual customization. |

Use existing Harmony for the campaign ladder. Do not introduce a second global restoration XP. Award major advancement for durable milestones rather than unlimited raw merges. Show progress such as “Reconnect the Lantern Path: restore the pond, finish Steppling's route, prepare Feastle's signal supper.” The player sees concrete requirements, not only an unexplained number.

A small number of eras can organize future releases: **A Place to Begin → Paths Between Us → The Remembered Grove → Beyond the Mist**. Each needs a visible world change, one new capability, a resolved question and a preview of the next question. More numerical levels without those changes will not solve the problem.

Keep a recommended route, but allow two useful activities when a friend is reflecting. Reserve cross-character hard gates for shared finales; making every episode depend on several friends would create stalls and confusing dependencies.

## 4. A concrete first campaign: The Light That Answers

This is proposed new connective story, not existing canon. It uses current locations, characters, the Old Grove mystery, Feastle's two-handled bowl and Heartwood.

| Act | Story and playable goal | Shared payoff |
| --- | --- | --- |
| 1. Someone kept a place | Mossprout wakes. A second light answers from the Mist; a damaged place setting suggests someone is missing. Clear a short route and make a first welcome. | The player understands who needs help and sees the dormant Heartwood silhouette. |
| 2. The paths disagree | Steppling's marks lead to a place the map does not remember. Baristabbit recalls a visitor using a name nobody recognizes. Choose and repair a route. | A new route connects two homes; the first cross-character scene resolves a clue. |
| 3. What water remembers | Petalimp's markers, Fernip's shelter, Blossle's old seed labels and Drizzlet's reflections reveal different pieces of the same journey. | Restored places provide capabilities needed for the Grove, not just another counter increment. |
| 4. A supper for someone absent | Amberleaf recognizes the apples in Feastle's scrap. Prepare a signal supper using the restored orchard, route and hearth. | The other light answers with a concrete identity clue; the empty chair acquires meaning. |
| 5. The promise under the roots | Mistle helps interpret the Grove. Mossprout admits a mistaken promise to preserve everything exactly as it was. A particular Mistkeeper holds that promise too tightly. | A multi-part mission restores Heartwood and resolves why this region's Mist thickened. |
| 6. The first reply | The friends gather in one scene. The bowl's other owner, or a definite message from them, provides an actual payoff. | A permanent shared landmark, new route and next-region hook. Do not defer every answer. |

Keep the Mist's established nature: forgetting, not a conventional evil army. A named Mistkeeper can embody one distorted memory without being the universal cause of all Mist. Natural drifting mist, obstructive Mist and friendly collectible Wisps need clear visual and narrative distinctions.

Resolve an existing tension explicitly: the main restoration promises permanence, while Moonlit Mist returns to a restored area. Seasonal silver Mist should reveal new traces or visit the edge of a protected home; it should not erase earned restoration. Absence from the app never causes a friend's home to decay.

## 5. Sharpen each character's chapters

The table below proposes external goals and shared consequences while preserving the emotional themes already present.

| Character | Keep | Strengthen their journey | Contribution to the common goal |
| --- | --- | --- | --- |
| Mossprout | Noticing, patience, Old Grove, the suspicion that something feeds the Mist. | He has withheld a specific memory because recovering it may change his view of himself. Break Growing Again into legible dramatic acts around the existing episode IDs. | Recovers the living root network and the truth behind the region's disturbance. |
| Steppling | Humor, snacks, movement at one's own pace. | Give the six episodes an actual expedition: find marks, select a route, meet an obstacle, change the plan, bring someone home. Habit questions become optional companion beats. | Reconnects homes and opens scouting routes. |
| Feastle | Two-handled bowl, empty chair, recipe scrap, answering light. | Pay off at least one clue inside this chapter. Replace repeated generic delivery thanks with a new fact, arrival or visible table change. | Creates the signal supper and supplies shared expeditions. |
| Baristabbit | The warm window and rituals of welcome. | Add a compact continuation about serving a visitor whose name has disappeared from the village's memory. | Establishes a meeting place and introductions for future events. |
| Petalimp | Welcome garden, courage and player-selected style. | A welcome intended for everyone does not suit a particular returning friend. Listen, redesign and see that friend use it. | Builds signals and gathering spaces that make returning possible. |
| Fernip | Rest, shelter, unhurried voice. | A sheltered path is useful in ways the obvious direct route is not. Let Fernip's approach solve a real obstacle. | Adds safe route options and places to regroup. |
| Blossle | Beginnings, the empty pot, uncertain labels. | A mislabeled seed connects to the Grove mystery. Try recipes and accept a surprising result. | Unlocks nursery recipes and propagation needed by the root network. |
| Drizzlet | Emotional acceptance, rain and the pond. | The pond reflects a place that is missing from the current map. Listening to the rain reveals something force cannot. | Restores water routes and reveals hidden clues. |
| Amberleaf | Seasons, keeping versus sharing, the orchard. | Decide which part of a harvest to preserve and which to share so the signal supper can happen. | Provides the first shared harvest and a natural recurring festival. |
| Mistle | Uncertainty, doorways, the ancient tree. | Understands a rule of Mist but cannot guarantee the result. Helps the group act on evidence rather than simply accepting fog. | Interprets the final clue and opens the next region. |

Future roster characters should fill missing functions. Pagelet could establish the archive; Tasklet a workshop; Gatherglow the Circle meeting place; Bedrotte a resting sanctuary. Do not give every character another reskinned board plus the same daily checklist.

For each chapter, require: **a want, an obstacle, a discovery, an action, a consequence and a payoff**. At least one episode should involve another character. Every chapter should reveal information, unlock a capability or visibly change a shared place.

Separate three kinds of choice in authoring: expressive answers change tone; tactical choices change the next task or route; lasting choices change a decoration, callback or scene. Do not imply three strategic alternatives when only the sentence changes. Use a small number of branches that rejoin at a shared milestone, keeping writing and testing affordable.

Example replacement for a generic delivery return:

> Feastle puts down the second bowl. Steppling stops chewing. “I saw that mark on the trail.” Under the handle, a little leaf points toward the Old Grove.

The current systems support much of the setup, but simultaneous multi-character staging, new mission mechanics and some persistent consequences would need implementation. Do not treat every proposed scene as a copy-only edit.

## 6. Give merging more decisions before adding scarcity

Keep unlimited ordinary generators for the first design test. Sudden energy restriction would change an existing product promise without proving that the underlying activity is worth paying to extend.

Campaign drop assistance currently makes many required items close to one merge away. Preserve that for tutorials and recovery from impossible requests. Later chapters need bounded opportunities to plan: choose between useful orders, assemble a cross-family recipe, reserve a piece for a mission, or use a companion's specialty.

Prototype three variations on the existing board:

1. **Routes:** opening one cell changes which objective or reward is reachable next.
2. **Mistkeeper patterns:** a distinct obstruction requires a sequence, matching family or positional solution; more merges alone are not the entire challenge.
3. **Shared recipes:** a garden ingredient, a drink and a trail item contribute to one visible project. Limit simultaneously active chains so the board stays readable.

Add a small expedition team only after these choices are enjoyable. Start with three companions and a few explicit specialties: grow, scout and shelter, for example. Friends provide alternative solutions; a required story mission always has an accessible base-team solution. No duplicate-character ladder is needed to prove this works.

Wisps can gain more relevance through collections, visual auras and earned mission options. Preserve the distinction between a Wisp earned from a real memory and a purchased cosmetic variant; buying one should not manufacture life history or relationship trust.

The commercial design question is: **what scarce, valuable outcome exists beyond another tap?** Candidate answers are a crafted landmark, a chosen collection set, a mission solution and a seasonal project. Test these before selling speed-ups. If expeditions later have bounded rewards or optional extra runs, give them a separate, explicit ruleset rather than covertly limiting the existing garden.

## 7. Add a reason to progress together

Start with asynchronous **Circles of roughly 8–12 players** as a prototype size, not a final commitment. Players contribute to a weekly shared landmark, visit each other's public Kingdoms and exchange preset encouragement. The player's private journal stays separate from their public game identity.

First shared project: restore a Lantern Bridge. Members contribute crafted supplies, cleared encounters or scouting milestones; the bridge visibly develops and grants everyone an earned memento. Put limits on counted contributions so unlimited merging cannot decide the result by itself. A missed day does not undo the group project.

Solve low population before rankings: join suggestions by activity window, open groups, inactive-leader recovery and project targets scaled to enrolled active membership. A solo route should provide the core event reward. Social success should add belonging and shared expression rather than making personal progress depend on recruiting friends.

Start with cooperative milestones. Later test opt-in, capped challenge leagues using comparable mission rules, with prestige rewards. Do not mix unlimited paid attempts into a supposedly skill-based ladder. Larger alliances, chat and competition also bring moderation and operating costs; they are not merely another screen.

## 8. Monetization: products attached to player desires

The existing Plus pitch combines history insights, avatar access, extra shop slots and a monthly Wisp. It is coherent for a companion utility. A game-focused payer also needs something they want to own, display, build or use. Clarify which audience the product serves.

The prices below are illustrative USD test points, not researched optimal prices. Storefront prices should remain localized. The current Plus runbook separately targets £5.99 monthly / £39.99 annual; avoid silently treating these as equivalent offers.

| Product | Test proposition | Why the player might want it | Timing |
| --- | --- | --- | --- |
| Welcome keepsake, $2.99–4.99 | Permanent Mossprout/garden style set with a clear preview. | Commemorate the first meaningful restoration. | After its payoff, without repeated interruption. |
| Season pass, $7.99–9.99 | Free story and baseline rewards; premium visible theme set, Wisp variant and premium reward track. | Extend an event they already enjoy and complete an attractive set. | Once they have experienced and understood the event. |
| Kingdom set, $9.99–19.99 | Coordinated home, path, lantern and companion expressions. | Make a visited Kingdom recognizably theirs. | Themed shop and relevant restoration moments. |
| Collector set, $24.99–39.99 | A substantial animated landmark plus a complete known collection. | Express deeper attachment and collection interest. | Only after lower-priced ownership proves demand. |
| Plus membership | Retain useful history capabilities; consider a permanent monthly choice and, if viable, a pass benefit. | Predictable ongoing value. | After repeated use; explain overlap with the pass. |
| Later convenience | Clearly bounded expedition tools or extra optional project capacity. | Reduce effort on a valued repeatable activity. | Only once that activity, reward limits and trusted delivery exist. |

Do not launch all of these together. Start with one entry purchase and one seasonal proposition. A high-priced SKU by itself does not create a high-spending audience.

Use Glow for ordinary crafting/restoration and Harmony as a non-spendable advancement measure. Keep Essence earned-only if retaining that promise. Gems may be the one paid currency if the catalog needs it; direct cash bundles are simpler for an early test. Avoid exposing several synonymous currencies in the first session. Explain that internal `coins` values presented as Glow do not constitute an additional player wallet.

For a pass, show the actual remaining time and rewards; grant already-earned premium tiers on purchase. Include a claim grace period and a defined late-join path. Decide whether an introductory offer, membership and pass overlap before marketing them. Permanent purchased items should remain owned after membership expiry.

Do not make journal access, personal distress, friendship trust, a real-life activity failure or an absent player's guilt the trigger for a sales pitch. Base offers on game milestones and chosen interests. Revenue growth should come from a world worth spending time and money in.

## 9. Live ops as returning chapters of the same world

Separate permanent progression from dated events. Main story acts never vanish. A season celebrates or extends a known part of the world; a player who misses it can still understand the main plot later. An event-introduced friend needs an eventual evergreen discovery route for players who never enrolled; current retention of enrolled content alone does not solve access for those players.

Suggested mature cadence, after capacity is proven:

| Rhythm | Purpose | Example |
| --- | --- | --- |
| Daily | A small optional reason to visit. | One changing request and an ambient character interaction. |
| Weekly | A reusable cooperative or personal objective. | Harvest delivery, route survey or Circle bridge project. |
| Roughly four-week season | A themed story arc, permanent keepsake and commercial collection. | The Lanterns Beyond the Mist. |
| Every few seasons | Substantial lasting expansion. | A new region, shared capability and selected companion continuation. |

Do not require a bespoke event every day. Begin with the existing seven-day Moonlit Mist pilot and one supporting objective. Keep the event experience on the Kingdom and its normal boards, as the new implementation already does.

**First event revision:** three encounters with different purposes: discover why silver Mist follows a path; combine a crafted lantern with a route clue; host a visitor and preserve a keepsake. A short final scene connects to the answering light. The present three brief encounters are a useful delivery test, but alone do not justify the proposed full-price monthly pass.

For the later four-week season, introduce the disturbance and a free reward in week one, a new mission pattern in week two, a shared preparation goal in week three and a proper resolution in week four. This is a production hypothesis; shorten the season or reduce price if the team cannot deliver enough valuable play.

Score varied objectives with caps, not uncapped merges. Give established players repeatable alternatives when they have no permanent tile restorations left. Validate event completion for new, midgame and caught-up players, including missed days and late entry.

Each event brief should contain its cast, lore dependency, eligible progression range, reusable mechanic, required assets, estimated play effort, free completion route, reward ownership, expiry behavior and measurement plan. Measure production cost per retained player as well as event revenue.

## 10. Delivery sequence and evidence to demand

| Priority | Deliverable | Decision it should enable |
| --- | --- | --- |
| P0: shared campaign | One campaign map and a linked Mossprout–Steppling–Feastle arc using current places. Improve the first-session objective and first cliffhanger. | Can players explain the goal and want the next chapter? |
| P0: measurement | FTUE funnel, episode starts/completions, wait exits, order effort, returns after cliffhangers and core progression pacing. | Identify where the experience loses players before changing prices or timers. |
| P1: gameplay depth | One route puzzle, one shared recipe and one permanent capability unlocked by a finale. | Does the change improve voluntary play and next-session return over existing content? |
| P1: free event | Complete, playtest and run the local Moonlit event with baseline/post-event retention measurement. | Does an event add engagement without exhausting the main game or confusing players? |
| P2: commerce | Trusted playable-event integration, credentials, account recovery, entitlement/claim delivery and native purchase/restore/refund testing. Then one entry offer and a pass test. | Can every purchase reliably deliver its promised value, and will people buy it? |
| P3: social | One small Circle project with public-world visits and low-population handling. | Do groups improve retention enough to justify their operational cost? |
| P4: scale | Repeatable seasons, selected chapter continuations, regional expansion and then optional convenience. | Can content cadence and acquisition grow profitably? |

Do not treat successful free local claims as proof of paid readiness. Current local encounters and verified scoring have different authority boundaries; the normal save and full story actions must be handled deliberately. The existing checkpoint pilot is not full account recovery for all progression and ownership domains.

Use these metrics together: D1/D7/D30 retention by acquisition cohort, first restoration and second-friend conversion, chapter completion and time spent blocked, event participation/completion, return after events, payer conversion, repeat purchase, average revenue per payer, refunds, subscription renewal and support burden. Compare content-led and offer-led changes with holdouts when traffic permits. Do not optimize revenue while hiding a worsening retention curve.

A simple planning identity is **monthly IAP spend = monthly active players × monthly payer share × monthly spend per payer**. At 100,000 MAU, 3% paying and $20 per payer imply $60,000 monthly gross IAP; 5% at $35 imply $175,000. These are arithmetic scenarios, not forecasts or benchmarks. Store fees, taxes, refunds, user acquisition, support and content costs still matter. Broader commercial scale needs a measured retention curve and lifetime value that supports acquisition, not only higher bundle prices.

**Build the first linked campaign before expanding the monetization catalog.** Its success would make chapters, collection, restoration, social projects and purchases reinforce the same player ambition. That is the most valuable structural lesson to take from Whiteout.

## Source map

All repository links are relative to this file. Current code takes precedence over superseded designs.

- [Chapter registry](../constants/companion-journey-chapters/registry.ts), [Mossprout chapter](../constants/companion-journey-chapters/mossprout.ts), [personal arc copy](../constants/mossprout-arc-one-copy.ts), [campaign and assisted drops](../constants/mossprout-campaign.ts).
- [Steppling chapter](../constants/companion-journey-chapters/steppling.ts), [Steppling script](../constants/steppling-life-chapter.ts), [Feastle chapter](../constants/companion-journey-chapters/feastle.ts), [Baristabbit definition](../constants/hatchable-companions/baristabbit.ts).
- [Island registry](../constants/island-campaigns/registry.ts), [wake order](../constants/island-campaigns/wake-order.ts), [Petalimp](../constants/island-campaigns/petalimp-bloom.ts), [Fernip](../constants/island-campaigns/fernip-wildgrowth.ts), [Blossle](../constants/island-campaigns/blossle-nursery.ts), [Drizzlet](../constants/island-campaigns/drizzlet-pond.ts), [Amberleaf](../constants/island-campaigns/amberleaf-orchard.ts), [Mistle](../constants/island-campaigns/mistle-ancient-tree.ts).
- [Kingdom tracker](../features/kingdom-progress/kingdom-progress.ts), [current generator policy](../utils/merge-world/economy-policy.ts), [Harmony and event pilots](../features/live-ops/local-catalog.ts), [event validation](../features/live-ops/validate.ts).
- [Mist lore](mist-narrative-plan.md), [current chapter model](journey-chapters.md), [world-integrated events](local-world-events.md), [deployment record and implementation](live-ops-implementation.md), [Wisp/Plus runbook](wisp-economy-live-ops.md), [fallback economy](../data/economy/fallback.json), [legacy disabled season](../constants/season-catalog.ts).
- [Live Ops Studio](../../../tooling/live-ops-studio/README.md).
