# Companion Journeys

## Editorial content rollout

Steppling and Batch 1 (Sleep/Rest, Tasklet, Mossprout, and Gatherglow) use fully
authored rotating content packs. Each pack contains 12 daily pulses, four
progress reviews, four return conversations, and bond moments for levels 2–4.
Every question owns its answer set; generic sentiment answers are not reused for
these families. See `companion-content-authoring-guide.md` and
`companion-editorial-rollout.md` for the authoring and rollout contracts.

Status: implemented for all fifty-four playable families, including the
foundation, daily-rhythm, and specialist batches. Creamalume shares Tasklet’s
work/focus Journey as a skin.

## 2026 semantic-quest and content expansion

Journey, quick-goal, rotating prompt, bond-dialogue, and real-life quest content
now covers all fifty-four playable families. A `partial` role status can still
mean that a separately planned signature mini-game has not been authored; it no
longer means that Focus, task suggestions, prompts, or progression are absent.

Some real-life quests ask for a specific written or voice-note reflection rather
than accepting any new note. These definitions use `semanticVerification`,
require `appleFoundation`, and set `offerVisibility` to
`hide_when_unavailable`.

- Offers appear only while the on-device Foundation model and structured bridge
  are ready.
- Typed notes remain usable without microphone permission. Voice additionally
  requires recording and transcription.
- The journal entry is always saved. Only a structured `match` with `high`
  confidence completes the quest.
- `uncertain`, `no_match`, timeout, malformed output, and model failure never
  complete or award bond. The player is asked for one more concrete detail.
- Evaluations are stored on the exact note evidence with deterministic identity,
  verifier version, verdict, confidence, reason code, timestamp, and
  `appleFoundation` provenance.
- There is no remote-model fallback. Journal text stays on device.
- If the model becomes unavailable after acceptance, the player can choose
  another quest rather than becoming trapped.

Broad journal routing answers "where does this note belong?" Semantic quest
verification answers "does this exact note satisfy this exact request?" Route
confidence must never be reused as quest proof.

The first rollout adds eight quick goals, a three-question You Journey, four
progressive real-life quests, and a Bond 3 weekly review for:

- **Flexel** — gym, strength, and mobility.
- **Sprintail** — running, pace, endurance, and recovery.
- **Hooplet** — basketball practice, play, and teamwork.
- **Serveling** — tennis and racket-sport practice.
- **Snuglet** — parenting and human caregiving.
- **Waglet** — dog companionship.
- **Whiskit** — cat companionship.

For device testing, the same Foundation-verified note pattern is also available
at Bond 1 for companions that are already common in existing saves:

- **Bedrotte / Snoozle** - a completed rest or recovery action and its effect.
- **Steppling** - a completed walk, one concrete detail, and its after-effect.
- **Mossprout** - a real green-space moment and one observed living detail.
- **Skylo** - a real local urban moment and one overlooked city detail.
- **Feastle** - a real meal and one taste, care, comfort, novelty, or connection detail.
- **Tasklet** - a completed project action and what it unlocked next.
- **Cheerlet** - a real piece of progress and why it matters.
- **Vesperitt** - a real late-night moment and whether it was chosen or drifted.
- **Shellio** - a real swimming, beach, shore, or non-entry water moment and one
  body, confidence, safety, sensory, movement, or changing detail. Shellio owns
  swimming as well as wider water connection; Stillo remains focused on quiet
  still-water places rather than swimming.

These test-access quests have a higher offer weight so one is easy to find when
Apple Foundation is available. They remain hidden when the capability is not
ready, leaving each companion's ordinary quest pool intact. Shellio now has a
dedicated creature pool containing its semantic quest, beach visit, and water
photo quests.

Steppling remains responsible for everyday walking. Voltstep and Pulsepounce
remain unchanged pending a later overlap audit informed by these authored roles.

## Current interaction model

### Evolving daily invitations

The fifty-four playable Journey families also share one authored daily-invitation
system. A companion receives at most one new invitation per local day. The
selection is persisted, deterministic, and ordered by: unfinished quest,
unfinished Focus conversation, missing Focus, newly reached bond moment,
progress review, contextual quest, then a rotating daily pulse.

- `constants/companion-content.ts` owns the modular catalogue: twelve pulses,
  four reviews, four return conversations, and Familiar/Devoted/Kindred moments
  per Journey family. Mossprout, Tasklet, Rest, and Gatherglow carry an
  additional hand-authored pilot voice layer.
- `utils/companion-content.ts` owns deterministic selection, fourteen-day exact
  prompt exclusion, lifecycle events, and small reusable memory facts.
- `utils/companion-content-storage.ts` persists under
  `katchadeck.companion-content-v1`.
- The companion Home page leads with the invitation and offers a non-destructive
  **Not today** action. Today promotes only the companion hatched that day.
- Repeatable real-life quests rotate three presentation variants while keeping
  the same quest ID, evidence contract, cooldown, and Journey contribution.
- Quick goals remain independently completable, but only the first quick-goal
  completion for a family/day awards relationship bond.

Invitation analytics are local, metadata-only lifecycle records. They never
contain journal text or free-text answer content.

The player-facing model is intentionally simpler than the original staged Journey UI:

1. **Do / quick goals** are the low-friction daily loop. They are one-tap actions with today-only, daily, or selected-weekday recurrence.
2. **Do / quests** are richer activities that can use photos, notes, tracked signals, or a mini-game.
3. **You / Focus** is the deeper branching questionnaire. Each family has one current Focus. Choosing another pauses the prior Focus rather than deleting it.
4. **Reflect** remains the place for richer meaning-making.

The old stage events and progress calculations remain readable for migration and history, but stage tracks and manual "log a moment" controls are no longer the primary UI.

Quick-goal completion awards 5 bond and does not contribute to hatching. Undo removes that exact bond event. After completion, "Remember this" opens the normal journal composer with a stable link to the goal completion.

## Quick-goal architecture

- Definitions: `constants/companion-quick-goals.ts`
- Pure state and recurrence logic: `utils/companion-quick-goals.ts`
- Local storage: `utils/companion-quick-goal-storage.ts`
- React controller and bond integration: `hooks/use-companion-quick-goals.ts`
- Shared Today/Kingdom UI: `components/katchadeck/goals/companion-quick-goals.tsx`

Storage key: `katchadeck.companion-quick-goals-v1`.

The authored template families are `steppling`, `feastle`, `pagelet`,
`mossprout`, `flickerbun`, `relicoon`, `encora`, `gatherglow`, `cheerlet`,
`skylo`, `coffee-ritual`, `errandimp`, `dawnle`, `mendle`, `quietome`,
`vesperitt`, `tasklet`, and shared `sleep-rest`. Presets are
authored per family; custom goals use the same state and recurrence rules.
Today exposes a compact **Goals** button beside the **Map** action; its badge
shows the remaining count or a checkmark when everything is complete. The
button opens the global goal sheet. Kingdom shows the selected companion's
goals at the top of **Do**; its **Add** action opens an inline subpage containing
only that companion family's presets and custom-goal option.

Questionnaire endpoints can provide `suggestedQuickGoalIds`. The UI offers these as an optional group; accepting them uses the same duplicate-safe add path as the goal sheet.

This document is the source of truth for extending multi-day quests, branching “You” conversations, goals, and reflections to the remaining Katchimera families.

The editorial, wellness, accessibility, questionnaire, and quest-copy standard
for completing those families is in
[`companion-content-authoring-guide.md`](./companion-content-authoring-guide.md).
Steppling is the first fully authored reference pack under that standard.

## Product model

Each logical Katchimera family represents one aspect of life. Skins never create a second quest, goal, bond, or insight system.

Each family can have three activity lanes:

1. **Real-life quests** — repeatable moments shared through a photo, note, voice entry, journal entry, or tracked signal.
2. **You** — branching conversations that learn the player’s preferences and create trackable goals.
3. **Mini-game** — a separate repeatable activity with its own difficulty curve.

Bond level remains the relationship progression. Companion Journeys add persistent progress *inside the life aspect*: a player chooses a goal, completes relevant real-life quests across days, reflects, and then consciously completes, pauses, reshapes, or abandons the goal.

## Current vertical slices

### Bedrotte and Snoozle — rest and recovery

Bedrotte and Snoozle are two skins of the single `sleep-rest` family. They share one companion ID, Journey definition, goal ledger, quest history, reflection history, bond, and stage progress. Equipping either skin changes presentation only.

Branching conversation:

- Identifies whether the player needs a steadier sleep rhythm, gentler wind-down, recovery after demanding days, restorative downtime, or permission to stop.
- Captures what that form of rest would look like as a goal.
- Asks whether time, switching off, responsibilities, screens, or guilt most often gets in the way.
- Keeps the boundary with Vesperitt explicit: this Journey is about stopping and recovering, not meaningful activity after dark.

Repeatable real-life quests:

- `quest-bedrotte-rest-note` — two-day cooldown.
- `quest-rest-wind-down` — two-day cooldown.
- `quest-rest-boundary` — three-day cooldown, bond level 2.
- `quest-rest-recovery-checkin` — three-day cooldown, bond level 2.
- `quest-early-night` — three-day cooldown, bond level 2; contributes only to sleep-rhythm and wind-down goals.
- `quest-rest-weekly-review` — seven-day cooldown, bond level 3.

The existing `quest-bedrotte-breathe` mini-game remains shared by both skins, but does not count as real-life goal evidence.

### Tasklet — meaningful work and focus

Branching conversation:

- Identifies whether the direction is a project, recurring responsibility, learning goal, backlog reset, or a need for clarity.
- Captures a concrete outcome as a goal.
- Asks what friction is most likely: unclear next step, time, energy, scale, or distraction.

Repeatable real-life quests:

- `quest-tasklet-next-action` — two-day cooldown.
- `quest-goal-note` — two-day cooldown.
- `quest-tasklet-clear-three` — three-day cooldown.
- `quest-tasklet-focus` — two-day cooldown, bond level 2.
- `quest-tasklet-tomorrow-first` — three-day cooldown, bond level 2.
- `quest-tasklet-weekly-review` — seven-day cooldown, bond level 3.

### Vesperitt — intentional life after dark

Branching conversation:

- Identifies what fills late nights.
- Distinguishes chosen, mixed, and mostly accidental nights.
- Creates a protect, understand, or gently shift goal from four suggested answers, with optional custom text.
- Keeps questionnaire wording separate from goal wording. For example, choosing “When a chosen night turns into drift” creates the actionable goal “Notice when and why a chosen night turns into drift.”
- Explicitly avoids rewarding a player merely for staying awake.

Repeatable real-life quests:

- `quest-late-capture` — two-day cooldown.
- `quest-vesperitt-night-note` — two-day cooldown, bond level 2.
- `quest-vesperitt-next-day-note` — three-day cooldown, bond level 2.
- `quest-vesperitt-weekly-review` — seven-day cooldown, bond level 3.

### Foundation expansion

Steppling, Feastle, Pagelet, and Mossprout now use the complete vertical-slice
contract: eight scoped Do presets, a three-question multiple-choice Journey,
four progressive real-life quests including a Bond 3 weekly review, and their
existing themed mini-games.

Their Journey IDs are `steppling-everyday-momentum`,
`feastle-meaningful-meals`, `pagelet-living-curiosity`, and
`mossprout-nearby-nature`.

## Journey stages

The current slices use the same four-part rhythm, with family-specific copy:

1. **Define / choose** — create a goal through the branching conversation.
2. **Build momentum / observe** — log three real moments on separate days, either directly in **You** or through a relevant completed quest.
3. **Review** — save one contextual reflection.
4. **Decide** — mark the goal completed or abandoned. Pausing preserves it without resolving it.

There is deliberately no streak failure. Missing a day does not erase progress.

The target values and stage names are data, not hardcoded UI logic. A future family may use a different number of quest moments or reflections.

## Data architecture

### Definitions

`constants/companion-journeys.ts`

- Owns family journey copy.
- Owns branching conversation nodes and routes.
- Owns goal types.
- Owns ordered stage requirements.
- Owns contextual reflection templates.
- `companionJourneyByFamilyId` is the feature gate. A family in this map gets the new Journey UI; other families keep the original flat discovery prompts.

### Persistent state

`utils/companion-journey.ts`

The local store is schema version 1:

```ts
type CompanionJourneyState = {
  schemaVersion: 1;
  goals: CompanionJourneyGoal[];
  conversations: CompanionJourneyConversationSession[];
  questEvents: CompanionJourneyQuestEvent[];
  momentEvents: CompanionJourneyMomentEvent[];
  reflectionEvents: CompanionJourneyReflectionEvent[];
};
```

Important rules:

- A family has at most one active Focus.
- Creating or resuming a Focus pauses the previous active Focus for that family.
- Quest, manual moment, and reflection events are attributed to the current goal.
- The player can log one goal moment per day. A relevant completed quest automatically fills that day instead, so the same lived moment is never double-counted.
- Event IDs are deterministic, so repeated synchronization cannot award progress twice.
- A quest completed before a goal was created cannot be back-credited to that goal.
- Paused and completed goals remain in history.
- Paused and resolved Focus records remain available as history.

`utils/companion-journey-storage.ts`

- Storage key: `katchadeck.companion-journey-v1`.
- Normalizes malformed or partial data on load.
- Migrates the old Rest, Tasklet, and Vesperitt flat discovery goal answers once, using deterministic IDs.

If the schema changes, add a versioned normalization/migration path rather than changing the meaning of existing fields in place.

### Quest integration

`utils/quests/definitions.ts`

Real-life quests can add:

```ts
repeatPolicy: {
  cadence: 'daily' | 'weekly' | 'anytime';
  cooldownDays: number;
};
progression: {
  journeyId: string;
  stageId: string;
};
goalContribution: {
  goalTypeIds?: readonly string[];
  amount: number;
};
```

- `repeatPolicy.cooldownDays` is authoritative for offer eligibility.
- `progression` explains the intended journey/stage for tooling and audits.
- `goalContribution` makes a completed quest eligible for automatic goal progress.
- Omitting `goalTypeIds` means the quest can progress any current goal in that family.
- Add `goalTypeIds` only when a quest truly makes sense for a subset of goal types.

The existing `CompanionQuest` ledger remains the source of truth for quest occurrences. A quest definition can repeat, but the player can still accept only one quest per companion per day.

`hooks/use-kingdom-quests.ts`

- Loads and saves journey state alongside quest, bond, and discovery state.
- Reconciles completed quest rows into idempotent journey events.
- Records a journey reflection when the companion reflection is saved.
- Derives the current conversation, current goal, stage progress, and contextual reflection prompt.

### UI

`components/katchadeck/world/companion-journey-thread.tsx`

- Renders the branching questionnaire in the **You** tab.
- Shows only the current Focus, a change/choose Focus action, and a compact count of previous Focus history.
- Offers relevant quick goals after a Focus answer when the definition provides suggestions.
- Keeps legacy stage and manual-moment data out of the primary interface.
- Exposes only a compact “Advances your current goal” note in **Quest**, and only when the selected quest is compatible with the current goal.

`components/katchadeck/world/companion-interaction-sheet.tsx`

- Uses the Journey UI when the selected family has a journey definition.
- Labels the action thread **Do**, with quick goals above richer quests.
- Falls back to `CompanionDiscoveryThread` for families not migrated yet.
- This incremental fallback is intentional: families can be implemented one at a time.

## How to add the next family

Use this checklist in order.

### 1. Confirm the role boundary

Update or verify the family in `constants/katchimera-roles.ts`.

Write:

- The one aspect of life it owns.
- What it explicitly does *not* own.
- The real-world signals that hatch or support it.
- Insight themes.
- Reflection lenses.

If two creatures would produce essentially the same answers here and the same quest catalogue, they are probably skins. If their role boundary, goals, and repeatable quests differ materially, keep them separate.

### 2. Design the branching conversation

Add one `CompanionJourneyDefinition` to `constants/companion-journeys.ts`.

Requirements:

- Start with a meaningful classification question.
- Use answers to route to more specific follow-ups.
- End in a free-text node with `createsGoalTypeId`.
- Keep a path to roughly two to four questions.
- Every `nextNodeId` must exist or be `null`.
- Every `createsGoalTypeId` must exist in `goalTypes`.
- When a multiple-choice answer describes a topic or question rather than an action, give it a separate `goalTitle`; the answer label should not be reused as an awkward goal heading.
- Avoid diagnosing, moralising, or implying there is one correct lifestyle.

Then add the definition to `companionJourneyDefinitions`. That single registration enables the new You/Focus UI for the family.

Also add a compact family template set to `constants/companion-quick-goals.ts` and attach `suggestedQuickGoalIds` to goal-creating nodes or choices. Suggestions must belong to the same family.

### 3. Define a multi-day stage rhythm

Prefer this baseline:

- Create one direction.
- Share three relevant moments on separate quest days.
- Reflect once.
- Decide the goal’s status.

Change the targets only when the life aspect genuinely benefits from a different rhythm.

Write one reflection prompt per stage. Include `{goal}` where the current goal title should appear.

### 4. Author repeatable real-life quests

Add at least:

- One low-friction capture or note quest at bond level 1.
- One more specific action at bond level 2.
- One weekly synthesis/review at bond level 3.

For each quest:

- Set `familyId`.
- Set `lane: 'real_life'`.
- Set `minimumBondLevel`.
- Add `repeatPolicy`.
- Add `progression`.
- Add `goalContribution`.
- Add appropriate criteria and suggested actions.
- Add creature eligibility.
- Add the quest ID to the role’s `realLifeQuestIds`.
- Add the quest ID to the creature pool in `utils/quests/themed.ts`.

Recommended cooldowns:

- Small action or capture: two days.
- Heavier or more reflective action: three days.
- Weekly review: seven days.

Do not use a daily streak as the primary progression mechanic.

### 5. Keep the mini-game separate

Mini-games continue to use their existing difficulty curves and quest attempt history. They award bond, but the current Journey implementation does not treat mini-game completion as evidence that a real-life goal moved forward.

Only add `goalContribution` to a mini-game if product design explicitly decides that virtual play should advance the real-life goal.

### 6. Test the definition and state transitions

Add family coverage to `tests/companion-journey.test.ts`.

At minimum test:

- Every branch resolves to the expected goal type.
- The conversation completes.
- The first goal becomes current.
- A relevant quest completion adds one event.
- Re-syncing the same quest adds no second event.
- An unrelated or pre-goal quest does not contribute.
- A reflection moves the expected stage.
- Goal status changes preserve history.

Run:

```sh
npm run test:roles
npm run typecheck
npm run lint
```

For a broader pre-merge check:

```sh
npm run check
```

## Historical recommended batch (implemented)

1. **Steppling** — tracked steps provide objective repeatable progress and should expose edge cases in signal-driven goals.
2. **Pagelet** — a good test for multiple concurrent goals such as a book, a subject, and a course.
3. **Feastle and Mossprout** — extend the pattern to experiential and place-based evidence.
4. **Errandimp** — separates life administration from Tasklet’s meaningful-work role and replaces the remaining generic craft fallback.

## Completed scaffold expansion

Flickerbun, Relicoon, Encora, Gatherglow, Cheerlet, and Skylo each now have
eight Do presets, a three-question Journey, four progressive real-life quests,
a Bond 3 weekly review, and their existing themed mini-game. Their merge audit
kept all six separate: screen stories, material history, active music,
reciprocal friendship, milestones, and local urban discovery produce different
player behaviours and outcomes.

## Current recommended batch

Proceed with movement and sport: Flexel, Sprintail, Hooplet, and Serveling,
followed by a direct overlap audit for Voltstep and Pulsepounce. Then continue
through relationships and care, creative leisure, food specialities, and
finally the nature/weather/travel audit.

## Fresh-context handoff (historical)

Use this brief when continuing in a new context window:

> Continue the Companion Journey rollout described in `docs/companion-journeys.md`. The reusable v1 system is implemented in `constants/companion-journeys.ts`, `utils/companion-journey.ts`, `utils/companion-journey-storage.ts`, `hooks/use-kingdom-quests.ts`, and `components/katchadeck/world/companion-journey-thread.tsx`. The shared Bedrotte/Snoozle Rest family, Tasklet, and Vesperitt are complete vertical slices. Preserve the invariant of one logical Journey per Katchimera family, regardless of skin. Steppling is the recommended next family. Add its journey definition, repeatable signal-driven real-life quests with cooldown/progression metadata, themed quest-pool entries, and focused tests. Run `npm run test:roles`, typecheck, lint, and the relevant verification scripts.

## Deliberate future work

Not required for the current local-first slice:

- Supabase account sync for Journey state.
- Server-authored or remotely configured conversation definitions.
- Editing the text of an existing goal (status and current-goal selection are implemented).
- Photo and voice attachments on manual goal moments; the first implementation intentionally uses one-tap choices plus optional text for “Something else.”
- Goal-specific insights generated from accumulated event content.
- Calendar scheduling and reminders.
- Mini-game level map or maximum difficulty presentation.
- Analytics for conversation completion, goal survival, and stage conversion.

When remote sync is added, keep deterministic event IDs and use append/merge semantics for quest and reflection events. Goals and conversations will need conflict rules based on `updatedAt` and definition version.
