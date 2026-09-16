# Journey Chapters

A Journey Chapter is a friend's personal storyline: short authored episodes, said to this
player, that open as the two of them get somewhere. Episodes are not days. They open on
world progress (a mist cleared, a friend home), on the relationship (Bond level, enough
small moments), on the player's answers (enough evidence for a theory), and on time (a
soft "reflecting" pause after the last one). Daily cards and the Garden stay separate;
a chapter is what the friend has to say about the adventure, about themselves, and about you.

This supersedes the day-and-rest rhythm in `unified-companion-journeys.md`. The rest
cycle machinery (`game/katchimeras/companion-journey-cycle.ts`) is still the reflecting
pause and the return gift; nothing else about it is player-facing.

## Model (`types/companion-journey-chapter.ts`)

- `CompanionJourneyChapterDefinition`: `familyId`, `chapterId`, `title`, `purpose`,
  `episodes` (authored order = arc order), `reflectMs` (default pause, 4h for Steppling),
  `dayOne` (the first-meeting flow and run ids), `generatorId`, optional `orders` (Garden
  orders offered alongside the chapter), `evidence` (`steps` | `water` | `none`), `lines`
  (`foreshadow`, `complete`, `checkIn`, `lifeIcon`, `lifeRequestSubtitle`, `hints` per unlock
  kind), `legacyEpisodeIdPrefix` (save migration only).
- `JourneyEpisodeDefinition`: `id`, `title`, `flavour` (`adventure` | `personal` |
  `companion` | `relationship`, never shown), `dayOne?` (the first meeting; no beats),
  `unlock: JourneyUnlockCondition[]` (all must hold), `reflectMs?`, `beats?`, `consequence?`
  (below), `bond?` (default 20).
- `JourneyUnlockCondition` kinds: `day_one_complete`, `episode_complete`, `mist_cleared`,
  `friend_hatched`, `friend_home`, `island_revealed`, `places_restored`, `friends_home`,
  `bond_level`, `interactions` (Bond ledger events for the family since the previous
  episode or the chapter start), `evidence` (theory-of-you evidence count), `since_previous`,
  `story_tile_revealed`. Every kind reads a durable fact the game already keeps.
- Beats: `say` (one Continue), `ask` (options with `traits`, `reply`, optional `fact`),
  `poll` (a village poll seed), `end`. A `say`, `ask` or `end` may carry `variants`
  (`[{ when, text }]`, first match wins) so the line changes with the player's theory,
  facts or earlier answers.

## Episodes are conversations

`constants/companion-journey-chapters/episode-conversation.ts` compiles an episode's beats
into one `ConversationDefinition` (id `${familyId}:journey:${episodeId}`, `format:
'narrative'`, `purpose: 'journey'`, `repeatPolicy: 'once_ever'`, tag `journey-episode`).
The registry (`constants/companion-journey-chapters/registry.ts`) exports them as
`JOURNEY_EPISODE_CONVERSATIONS`, spread into the catalog in `companion-conversations-v2.ts`.
The poll builder lives in `constants/companion-poll-conversation.ts` so the chapters do not
import the catalog that imports them.

Personalisation happens when the conversation is served
(`utils/companion-journey-personalisation.ts`, called from `hooks/use-kingdom-quests.ts`):
`{{friend}}`, `{{today}}`, `{{theory.style|friction|reward}}`, `{{fact.<key>}}`,
`{{answer.<episode>.<ask>}}` tokens, and the variants above.

Completion (`completeJourneyEpisode` in `features/companion/companion-journey-service.ts`,
called from the conversation completion effect in the hook): records
`relationships.journeyEpisodes[`${familyId}:${episodeId}`]` with the answers and facts,
awards Bond once (`journey:${familyId}:${episodeId}`, kind `journey_day_completed`; day one
pays nothing here), writes a journal moment, starts the reflecting pause, and projects
the chapter's Garden orders. The life recorder skips `journey-episode` conversations so
the journal has one entry per episode.

## Availability (`features/companion/journey-triggers.ts`)

`journeyChapterState(chapter, facts)` returns every episode's status (`complete` |
`available` | `reflecting` | `locked`), the next episode, the friend's hint for a locked
one (from `chapter.lines.hints` or the defaults), and whether the friend is reflecting or
their return is ready. `JourneyTriggerFacts` is one snapshot: the merge world, the
relationship state, the Bond state, the content state, the clock and whether day one is
done. The stage (`companion-journey-cycle-stage.tsx`) recomputes it on world, story, home
and Bond changes; the card shows `active` (opens the conversation), `waiting` (the hint is
the card's reaction), `meditating` (timer, requests, check-in) or `ready` (the return).

## Migration

`initializeJourney(familyId)` maps a save from the day-and-rest era: each cycle with the
`legacyEpisodeIdPrefix` becomes a completed episode (`migrated: true`, no answers), a
completed authored chapter becomes every episode complete, and an unfinished legacy
conversation is left alone until it ends. Legacy episode runs on the deleted content-flow
builder are no longer registered; a run caught mid-flight becomes `failed_recoverable`
and the chapter continues from its recorded episodes.

## Authoring a chapter

1. A chapter file in `constants/companion-journey-chapters/<family>.ts`, added to
   `COMPANION_JOURNEY_CHAPTERS` in the registry.
2. Episode ids are save data. Unlocks name real tile, island, skin and episode ids.
3. Hints for the unlock kinds the chapter uses; the defaults cover the rest.
4. `tests/journey-triggers.test.ts` proves every chapter compiles, ends, unlocks on ids that
   exist and mixes at least three flavours; `tests/companion-journey-service.test.ts` and
   `tests/companion-journey-cycle-stage.test.tsx` cover completion, migration and the card;
   `tests/story-tiles.test.ts` covers story tiles and every consequence kind's flow.
5. `tests/companion-registry.test.ts` walks every chapter (unique ids across chapters, one first
   meeting, every flavour, every unlock and consequence on a real thing) and
   `tests/legacy-guard.test.ts` keeps the shared tech free of friend names.
6. A new story tile = a definition in `constants/story-tiles/`, art registered in
   `tile-art.ts`, the tile packaged with `generate-shared-world-discovery-art.py` (bounds are
   regenerated by the packager), and a free hex on the grid (the scene test proves it).

## World consequences

An episode can change the world after its conversation. `JourneyConsequence` kinds:
`reveal_story_tile` (a story tile's mist clears), `mist_mission` (a board is docked under
the story tile, its wisps fall, then the tile is revealed), `reveal_island` (a nature
island is revealed) and `grant` (a parcel from a generator). Each compiles to a story flow
(`constants/companion-journey-chapters/consequence-flow.ts`, run id
`journey:<family>:<episode>:consequence`) of camera, task, world-upgrade recipe (economy
free: the episode was the price, no coins shown) and complete nodes, played on the Kingdom
through the story surface like a hatchable friend's discovery. The runtime
(`features/companion/journey-consequences.ts`) starts the flow when the episode is recorded,
retries or starts a missing one on relaunch (`resumeCompanionJourneys`), and the pure state
(`journey-consequence-state.ts`) tells the Kingdom which tile mission is docked.

Story tiles (`constants/story-tiles/registry.ts`, art in `tile-art.ts`) are places under
the Mist with no marker, no price and no Egg: they join `SHARED_WORLD_TILES` with `story:
true`, so the engine (`unlockWorldTarget`, free, from level 0 whoever is home), the receipts,
the capability registry and the reveal presentation need nothing new; `worldUpgradeOffers`
skips them. The scene draws every story tile from the registry (mist until revealed; both
envelopes reserved) and the canvas reports each tile's node for Glow flights and wisps. The
Kingdom docks a journey board the way it docks a hatchable friend's (`HatchableMissionDock`,
`useMissionBoard` on the mission's own store; only one board at a time, the friend's
discovery board first) and records `journey.mission.cleared` when the last wisp has fallen.
The camera directive `{ kind: 'haven_structure', structureId }` frames any shared-world tile.

The first story tile is Mossprout's Old Grove (`mossprout-old-grove`, behind the Garden at
q 0, r 3), generated with the shared-world discovery recipe (`--tile old-grove`; source and
alpha under `art-source/katchimeras/shared-world-discovery-v2/old-grove`).

## Mossprout's one arc, Growing Again

`constants/companion-journey-chapters/mossprout.ts` generates his single chapter from the Garden
campaign definition (`constants/mossprout-campaign.ts`), copy for the personal episodes in
`constants/mossprout-arc-one-copy.ts`. The first session is episode one. Each of the twelve
remaining campaign beats is two episodes: the opening (its authored conversation, then its Garden
orders as a `garden_orders` consequence) and `<beat>:resolution` (unlocked by `orders_served`,
playing the beat's resolution conversation, then the wisp reward, the habitat stage and a four-hour
pause). Growing Again's seven personal episodes sit at anchors between the beats: Tiny Beginnings
after the first session, Something Is Wrong With the Mist after The Pond Knocked Twice, Petalimp
after The Little Rain Garden, The Old Garden after The Lantern Bank, What the Grove Kept and The
Wisp in the Grove inside Heartwood, Growing Again at the end. Guests stay a face on the orders,
never a gate.

Mossprout lives on the journey stage after the first session. The Garden reads the beat under way
from the chapter (`features/companion/mossprout-garden-activity.ts` feeds the engine's existing
activity reconcile, one order at a time, drops steered, guest named). Resolving a beat writes his
story summary the way a campaign day did (`game/katchimeras/mossprout-beats.ts`). A save from the
day-and-rest era has each completed journey day recorded as its beat's two episodes on first load;
the first session's own day keeps its legacy records. A time-locked episode counts down on the
timer card like a rest. The campaign's optional action cards are not carried over.

## Daily Moments and the Bond ladder

A Daily Moment is a life activity of kind `moment` (`CompanionDailyConfig.moment`): one tap a
day in the friend's life card, the same store, journal entry and small Bond as a photo or a
noticed thing. Mossprout's is the first session's weather question. A journey line reads it back
through `{{today}}` (`utils/companion-daily-moment.ts`, passed in by the hook).

`bondRewards` on a chapter lists what each Bond level opens; `nextBondReward(chapter, level)`
answers it, and a Bond-locked episode's hint says how much Bond is left.

FTUE lines changed for the arc: Mossprout's farewell now says he is thinking today over (his
first reflecting pause), Steppling's day-one bridge no longer names eight hours, and the Garden
handoff's waiting line says he is resting and thinking today over.
