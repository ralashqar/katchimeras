# Life companion implementation

The first experience now connects a short conversation, an optional daily habit, a shared game objective, and a memory the player can revisit. Choosing an action expresses an intention; it does not count as completing that action.

## Player experience

1. Mossprout remembers the player's description of today. After the greeting, one follow-up adapts to wanting calm, progress, or being unsure. Each answer has its own response and an appropriate small habit suggestion. Choosing company allows the player to continue without a habit offer.
2. The first Seed explains what the player chose. The Journal opens only from the bottom-left of the world map.
3. The habit offer shows one contextually suggested action and Skip. An existing daily action opens Complete or Skip today, with Back available. Suggestions include a quiet minute, a window view, noticing something living, water for the player, or checking a plant's needs. Checking a plant never prescribes daily watering.
4. Mossprout retains the original action-list renderer. Habit controls reuse DayActionCardSurface, the existing Bond reward chip and completed tick. Dialogue choices reuse CompanionChoiceList and companion panel colour tokens. Optional merge requests expand from the building card.
5. The first return offers a brief check-in about the episode's selected habit, then what the player got from it. Every step can be skipped with “Continue our story.” “Not yet” and “doesn't fit” have respectful responses; an unhelpful habit can be changed or paused.
6. Mossprout's “The Pond Knocked Twice” has two opening questions, distinct replies, an optional daily habit offer, the existing merge objectives, and a closing reflection.
7. Steppling's six episodes explore a suitable kind of movement, an ordinary-day cue, motivation, noticing, practical barriers, adjusting the plan, and what to carry forward. Walking, adapted movement, and deliberate rest remain available. Existing step evidence and rest acceleration stay separate from habit selection.

## Authoring locations

- `constants/companion-life-content.ts`: Mossprout's complete conditional follow-ups, all daily habits, and return outcome responses.
- `features/onboarding/mossprout-ftue-copy.ts`: opening, Seed, Garden and farewell copy.
- `constants/mossprout-ftue-conversations.ts`: first meeting and rest dialogue.
- `constants/mossprout-campaign-conversations.ts`: `pondOpening` and `pondResolution` contain the complete second episode script.
- `constants/steppling-life-chapter.ts`: complete scripts and branch targets for all six Steppling episodes.
- `features/content-flow/companion-life-flow.ts`: shared question/reply and optional habit-offer scenes.
- `components/katchadeck/world/companion-life-actions.tsx`: exact check-in, habit-management and Journal UI text.

## Persistence and compatibility

- One selected story habit per companion uses the existing quick-goal store and daily cadence. Selecting another pauses the previous selected habit. Other goals and completion history are retained; an existing matching template is reused.
- Daily completion uses the existing Bond award path. Skipping a habit never blocks dialogue, orders, rewards or chapter progression.
- Journal entries use stable source IDs, factual choice summaries and optional goal/Seed links. Editing or removing an entry takes precedence over source replay. Notes are preserved. Existing insights and returned chapter keepsakes appear in the same timeline.
- Habit receipts prevent a recovered Day 1 flow from reactivating a habit the player subsequently paused.
- Existing Steppling v1 flows and conversations remain available for saved runs. Older Mossprout first meetings and pond conversations resolve their old paths.
- The native FTUE script is v45; the content-flow definition is v47. The action receipt IDs, rewards and eight-hour rest remain unchanged. `20260904140240_register_mossprout_ftue_v45.sql` registers the new receipt version without altering schema or privileges.

## Verification and release

- `npm run verify:story-flows`: 147 passing checks, including the new life-companion suite.
- `npx tsx --test tests/companion-quick-goals.test.ts`: 12 passing checks.
- TypeScript and focused ESLint checks cover the implementation.
- The broader conversation suite has three failures concerning the existing Mossprout form finder: a missing end node, missing finder affinity, and no winning path for its base form. These are outside the new journey scripts.
- The database registration migration is prepared, not applied to a remote database. Apply it through the normal release process before shipping v45.
- Native device visual verification is still required: small phone and large text, the habit picker and keyboard, Journal scrolling/editing, Seed return, and an actual step-permission/step-sync session. The React renderer checks behavior and callbacks, not native drawing.

The first release intentionally uses authored dialogue and exact player choices. It does not create psychological conclusions from single answers or require an open-ended AI chat.

## Steppling action row correction

Steppling mounts the original DayActionActiveRow and DayActionGoalRow with the existing entry timing, layout animation, swipe gesture and goal-completion animation. The original QuickGoalActionModal offers Complete/Skip in simple mode. Its origin row remains mounted until the completion exit and Bond flight finish. Existing movement, reflection and quest artwork replaces the placeholder symbol wells. The interaction sheet passes its existing Bond reward handler and environment gesture into these rows.

## Direct tasks and dedicated requests

Task rows show the existing Bond reward and complete on tap; swipe reveals Skip. No goal modal opens from these rows. Completion remains mounted until the slide-out and Bond arrival finish, then the task disappears for today. Skipped tasks also leave the list. Daily cadence and historical completion receipts are retained.

The generic check-in is removed. Story titles and ready returns remain actionable. When no unfinished task is present, Choose a task (or Try something smaller after a skip) opens up to three contextual answers, then one suggestion with Add task / Not now. Suggestions exclude tasks already completed or skipped today. Accepting uses the existing single selected daily habit per companion.

Tend our little world replaces the top-level list with the existing horizontal order tray and Back. The timer and parent narration hide while this submenu is open. Each order retains its own Merge destination; there is no additional Open Merge button.

Validation: 147 story/life checks pass, including direct completion, animation retention, task selection and dedicated merge-request navigation. Native device visual verification remains a release check.

## Legacy Small Tasks source

Add task now opens the existing CompanionQuickGoalPicker, with the full family catalogue and custom-task entry. The custom three-answer task chooser has been removed. Picker presentation takes priority over the meditation view, and Back returns to the companion action list.

The rotating task slot uses all added, due, uncompleted tasks for that companion, including legacy templates and custom tasks. It retains the current choice through rerenders. After completion and Bond arrival, it randomly selects another eligible task using the existing row entry animation. Skipped, paused, wrong-family and not-due tasks are excluded. An exhausted pool leaves Add task available rather than replaying a completed task.


## Steppling-specific daily actions (supersedes Steppling's generic task slot)

Steppling now has its own action component. Mossprout keeps its existing routine. Steppling's first slot tracks today's cumulative steps: 500 / 2,000 / 4,000 / 6,000 / 10,000, awarding 5 / 8 / 12 / 16 / 20 Bond. The current goal can only be collected once its recorded step count is reached. Claim receipts are persisted per day and milestone in the existing Bond store; duplicate, out-of-order and premature claims are rejected. The original row stays mounted through the Bond flight and exit before the next goal enters. The ladder restarts the next local day; completion of all milestones exhausts the slot for today.

Steps refresh from recorded home activity and the native pedometer on foregrounding, home updates and every 30 seconds while active. Before the target is reached, tapping syncs steps and can request motion permission. Unavailable native history falls back to recorded home activity. No manual completion bypass is offered for step milestones.

Tend garden opens the original horizontal CompanionMergeRequestTray, inside the same dark panel style now shared with JourneyCohortStoryStage. Meditation orders retain their Glow/time rewards; ordinary chapter orders retain their original IDs and destinations. Back restores the top-level cards. No requests produces a clear empty state, rather than launching Merge unexpectedly.

The third slot prioritizes a ready Journey return or next Journey, otherwise offering four finite trail chats. Each has two themed answers, a response, and a saved Journal insight. Answered chats remain exhausted across visits; Not now leaves a question available. There is no generic Add task card in Steppling's new routine.

Validation: 150 story-flow checks cover milestone gating, increasing/idempotent rewards, rollover, animation ownership, original tray routing, persisted chat exhaustion and Journey continuity. Native layout and sensor readings still require an on-device check.


## Steppling reuses the original conversation/action completion system

The bespoke chat mode, reply screen, answer persistence and local chat navigation have been removed from StepplingActions. Trail questions are authored ConversationDefinition data registered with the existing conversation catalogue. A card opens the existing CompanionConversationScene with a KatchimeraActionOrigin, advances through the existing insight reveal and end page, then returns through the usual conversation exit.

The existing action completion transaction now accepts explicitly owned non-Mossprout conversations. Steppling receives the advertised 8 Bond once, attached to its action completion receipt; the separate conversation reward path is suppressed for these trail chats. Mossprout's Journey fallbacks remain Mossprout-only and Steppling preserves Mossprout's rotation deck. Steppling's chat row uses the same useActionPresentationController, DayActionCompletedRow and DayActionReplacementSlot as Mossprout: finish the conversation, return to the original row, animate Bond and exit, then reveal the next card. Pending presentations are scoped to their companion.

Conversation sessions own resumption and exhaustion. The normal insight screen offers insight persistence. Previously answered chats remain exhausted through a read-only compatibility check of old journal records. There is no new Steppling chat renderer or completion animation.


## Garden panel correction

Steppling now mounts MossproutJourneyRequestPanel directly with standalone/fitContent, the original horizontal item tray, and its existing action button labelled Back. The panel forwards order taps to their existing destinations. The custom wrapper and dialogue-option Back control are removed. Long reward sentences are kept in accessible order descriptions instead of the tiny inline badge, so they cannot crowd out order titles or inflate item height. Existing small badges now have an explicit compact line height and stay on one line.


## Pedometer-driven step completion

Steppling's step card displays the existing ProgressBar in Meadow green with today's measured count and target. Progress starts at zero and clamps at 100%. Reaching the target automatically starts DayActionGoalRow's original completion/reward animation, with no check-off or claim tap. Pending chat presentations finish first, then reached step milestones animate one at a time. Tapping the step card only syncs the pedometer or requests motion permission. The next milestone remains gated by the actual recorded step count.

Validation: 152 flow checks pass, including a render of the original row that begins automatically once, waits for Bond arrival, and finishes without a completion tap.
