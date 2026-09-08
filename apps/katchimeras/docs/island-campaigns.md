# Island campaigns: friends who come home

The Kingdom has one long-term purpose, told by Mossprout at his first rest and again — as a blocking full-screen scene owned by the Kingdom screen (`MergeWorldState.kingdomGoal`) — once Steppling's garden lesson is complete. Choosing “Find the first friend” closes Steppling, locks the camera, hides the other controls and points at Bloom Garden's mist until its marker is tapped: *this garden used to be full of friends; when the mist came they drifted into it, and every place we bring back helps one of them find the way home.* Each of the six nature islands hosts one friend with a four-chapter story. Islands wake in order — the next one sleeps until the previous friend's card is home.

## Where things live

| Concern | File |
| --- | --- |
| Campaign shape (`IslandCampaignDefinition`) | `constants/island-campaigns/types.ts` |
| Registry + lookups (`ISLAND_CAMPAIGNS`, `islandCampaignForIsland/ForResident/ForOffer`) | `constants/island-campaigns/registry.ts` |
| Wake order, sleeping state, next open island | `constants/island-campaigns/wake-order.ts` |
| Chapter status, panel view model, conversation builder, callbacks | `constants/island-campaigns/helpers.ts` |
| One file per friend (`petalimp-bloom.ts`, `fernip-wildgrowth.ts`, …) | `constants/island-campaigns/` |
| Kingdom-wide progress selector (friends home, places restored, next step) | `features/kingdom-progress/kingdom-progress.ts` |
| Tracker UI (pill, sheet, goal scene, wake handoff) | `components/katchadeck/world/kingdom-progress-*.tsx`, `components/katchadeck/onboarding/kingdom-goal-scene.tsx` |
| Durable state | `MergeWorldState.islandCampaigns`, `MergeWorldState.kingdomGoal` (v24) |

`constants/petalimp-island-campaign.ts` is a compatibility facade over the registry; new code should import from `constants/island-campaigns`.

## The loop, per chapter

1. **Opening** — the friend's situation, then one personal question with three answers. Chapters 2–4 open with a `callbackLine` keyed by the *previous* chapter's answer style (the builder registers `<conversationId>:after-<style>` variants; `islandCampaignOpeningConversationId` picks one).
2. **Merge** — the chosen answer shapes the request (`choice.order`).
3. **Return** — chapter 1 plays a full scene, then the first restoration is the friend's gift (free). Chapters 2–4 skip the overlay: the friend's `returnLine` appears as speech on the island's upgrade panel, where the Glow is spent. `copy.speech.restoration_ready` voices the wait (progress-aware; never put a price in a `returnLine`).
4. **Resolution** — after the upgrade cinematic. Chapter 4 ends with an `insight_reveal` built from `payoff` (the accumulated answer style), then the friend's card, then a `wakeHandoffLine` pointing at the next island.

Completed chapters stay readable in the panel's "Story so far" log.

## Authoring a campaign

Create `constants/island-campaigns/<friend>-<island>.ts` exporting an `IslandCampaignDefinition<Style>` and add it to `ISLAND_CAMPAIGNS` in wake order (the entry must match `ISLAND_WAKE_ORDER`). Rules enforced by `tests/island-campaign-registry.test.ts`:

- four chapters, three choices each, every `prompt` has one blank line (situation, then question);
- every order `definitionId` exists in the merge catalog;
- every choice `style` is declared in `payoff.styles` with an insight and an insight choice;
- `copy.mistNextName` / `copy.mistDescription` never name the friend (the reveal is the surprise);
- conversation ids are unique and registered.

Copy checklist: chapter-1 question light enough for a stranger; one honest stumble somewhere in chapters 2–3 so the friend's flaw plays instead of being asserted; the gift lands in every chapter-1 `returnLine`; no Glow numbers in dialogue; `helperText` omitted.

## Migration notes

Saves that grew an island before its friend existed keep every level: `migrateIslandLevelsIntoCampaigns` (engine normalize) synthesises completed chapters, and a fully grown island brings its friend home once. Island stories in `world-upgrade-stories.ts` and `rewardSkinId` grants were retired; only the two shared clearings keep a panel story.
