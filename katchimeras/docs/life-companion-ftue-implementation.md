# Life companion FTUE and shared scene implementation

## Ownership

The FTUE manifest remains v47 and Glow discovery remains v4: no progression edge or receipt identifier changed. The first meeting is conversation v9. Its resolver preserves v8 follow-ups and pre-v8 short conversations; new greetings lead directly to the Memory Seed. The existing `companion.water_together` checkpoint now renders the post-Bloom personal question and habit offer. Its historic name remains save data.

The question saves `lifeFollowupId` through the existing onboarding profile before revealing the offer. Resuming with an answer shows the matching reply/offer. Habit acceptance uses the existing idempotent life-action service. Company and decline create no goal or completion. No backend migration or new permission is required by this revision.

## Shared scenes

`companionSceneModel` derives active/meditating/ready/finished presentation without owning domain state. `CompanionSceneCards` renders compact chapter/day information and a timer or continuation button above the original flat activity cards. Resident and FTUE choreography retain their dedicated presentations.

`StepplingActions` owns actual step milestones; `MossproutWaterAction` uses explicit confirmation and the existing quick-goal repository. Completed trackers stay in place. Water settlement is shared across completion entry points and cannot receive both listed and ordinary meditation acceleration. Failed saves abort the completion animation and allow retry.

`CompanionGardenAction` uses the shared per-companion calendar-day batch in Merge state. Its detail view groups optional daily orders and required Journey orders. Two frozen, obtainable orders pay 8 Glow each plus an automatic 8 Glow batch bonus. Item consumption, rewards and receipts are one persisted transaction. Existing legacy batches finish before adopting new daily pairs. See `unified-companion-journeys.md` for tuning and migration.

The daily conversation selector persists one eligible authored activity. Its completed card remains for the day; unfinished conversations carry across midnight. Existing conversation engines and insight storage remain authoritative. No eligible activity means two cards, with no generic action picker or replacement filler.

## Guidance and accessibility

`FtueGuide.coaching = 'practice'` suppresses only the demonstration hand until six seconds have elapsed or Show hint is pressed. It does not change board evidence, input permissions or readiness. First-time mechanics retain immediate demonstrations. Text stays visible and is exposed to assistive technology.

The shared scene scrolls when it exceeds the available scene area. Expandable action cards do not truncate title/subtitle text; goal rows support accessible Skip for today. Choice semantics, existing motion and reduced-motion handling are reused.

## Verification

`npm run verify:story-flows` includes `companion-scene.test.tsx`: all nine life follow-up branches, failed-save retry, remount recovery, v7/v8/v9 conversations, phase/slot identity and native-rendered scene behavior. Cycle component tests cover return double submission and flat cards during meditation. Daily Garden tests cover multi-item consumption, saved batches, midnight, bonus receipts and capped rest settlement. Daily action tests cover water confirmation, failure/retry, double-reduction prevention and conversation persistence. Existing merge, relationship, lifecycle and accessibility checks remain relevant.

Device acceptance and five-person usability validation are listed in `mossprout-ftue-day-1.md`. This revision does not claim an on-device walkthrough or measured engagement improvement.
