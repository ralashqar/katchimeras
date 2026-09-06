# FTUE and companion-scene verification

Base commit: `bc0f9140`. Changes remain local and uncommitted.

## Passing checks

| Check | Result |
| --- | --- |
| TypeScript | `npm run typecheck` passes |
| ESLint | `npm run lint` passes without warnings |
| Story flows, journeys, first-life moments and native-rendered components | 178/178 pass |
| Merge world and FTUE interaction coordinator | 202/202 pass |
| Lifecycle and foreground recovery | 18/18 pass |

The new tests cover all nine post-Bloom answers, failed-save retry, remount recovery, old/new first-meeting paths, compact Journey headers, flat cards, timer/check-in access, duplicate return claims, and one completion/reduction receipt per life action for both families. The real goal-row test verifies that failed saves cancel the success watchdog and allow retry.

## Daily card revision

The latest local revision also verifies the two-order daily batch, multi-item consumption,
exactly-once 8 Glow bonus, midnight refresh, legacy batch migration, and daily orders
surviving active chapter reconciliation. Native component tests cover direct water logging, save failure/retry, count
persistence and rollover, replacement after exit, and prevention of duplicate rest
reductions. Both families’ Garden tests verify the original request-panel destination,
order navigation, slide-out completion, and removal after reopening. Completed
narrative cards disappear after their original reward/outro sequence. Conversation selection survives completion and remount, rotates on the next
calendar day, carries unfinished work, and handles exhausted content.

Card-restoration checks are in `.cache/card-restoration-{story,typecheck,lint}.log`.
The earlier Merge/lifecycle results are in `.cache/daily-cards-{merge,lifecycle}.log`;
this presentation revision does not change their engine or lifecycle code.
The story-flow, TypeScript and lint checks were rerun for this presentation revision. The baseline comparisons below were
performed during the earlier FTUE pass and are retained as historical context.
On-device visual/gesture checks and difficulty playtesting have not been performed.

## Existing failures reproduced on the base commit

An isolated source archive of the base commit, using the same installed dependencies and unchanged assets, reproduces the same failures. No new failing test names were found in these comparisons.

### Roles and companion content

- Feastle story scenes advance contextually without a completion menu
- all 25 V2 packs are runtime-enabled while skin onboarding remains art-gated
- companion viewport resets across destinations and content-shape transitions
- every authored family form is represented in its finder answers and reveal copy
- every authored form can win a complete three-answer finder path
- goal picker returns to the dedicated goals destination
- journal, goal, quest, and bond chats resolve to their correct outcome classes
- meditation reclaims the hidden bottom dock space for its action cards

### Native transition regression

- Steppling retains the answering card across camera unsettles and changed step readings

### Game UI tests

- Mossprout Journey status uses the shared compact plaque without joining action layout animation

### Today action completion

- Today goal popup returns completion to its originating action row
- Today holds replacement actions until the completed row exits

### Static game UI verifier

The same five static failures reproduce on the base commit:

- Today uses illustrated shared currency art
- Merge uses illustrated shared currency art
- UI debt alertAlert is 46/29
- UI debt nativeModal is 17/14
- UI debt sharedUiRawHex is 51/36

## Not established by these checks

- No native iPhone/Android visual walkthrough or process-kill acceptance pass was performed in this Windows session.
- No usability participants were recruited; engagement and retention improvements remain hypotheses.
- No production telemetry or backend deployment was added. Existing durable flow receipts remain available for milestone inspection.

The device scenarios and five-person usability protocol are in [mossprout-ftue-day-1.md](mossprout-ftue-day-1.md). Raw local logs are retained under `.cache/ftue-redesign-bc0f9140/` and are not source-controlled.
