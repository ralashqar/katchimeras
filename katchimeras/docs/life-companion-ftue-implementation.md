# Life Companion FTUE implementation

## Architecture

Script v43 is the native presentation/checkpoint projection. Content Flow v45 owns the live graph and durable effect receipts. Existing Egg, conversation, Bond, memory planting, Merge, Haven, Daily Seeds, and meditation systems are reused; no parallel quest, timer, or currency system was introduced.

## State ownership

- `egg.day_texture` selects the personalized first meeting; `egg.desired_help` determines the personal Seed.
- Profile growth intent is normalized to `desired-help:<id>`; both old unprefixed and canonical values resolve correctly.
- Greeting selection is stored locally as `firstGreetingId`. Journey 2 saves the existing support-style answer.
- First-meeting completion runs the existing Day 1 relationship effect, brings Bond to the existing first target, and grants the memory Seed. Granting checks its source before creating another.
- Continue on the Seed reveal prepares the board once and crosses the existing camera presentation into planting.
- Planting commits the existing world-memory placement. Open Merge is the next explicit action, with no timed dismissal.
- Serving the first Plant unlocks the existing receipt-backed free world upgrade. The same memory instance receives its first growth.
- Growth Continue completes the first Journey resolution and existing Bond milestone before Water Together.
- Water choice is optional; accepting only pins the normal manual Daily Seed. It never fabricates wellness completion.
- Rest starts the existing eight-hour meditation with the stable FTUE source ID, then enters Mossprout’s normal interaction UI with its compact next-Journey timer.
- Go to Merge prepares the existing post-FTUE Garden mission, opens the activity board, and starts two event-driven handoff nodes. Back exits to the Garden.
- Two successful Basket spawns and one Seed merge finish coaching. No modal follows. The existing path/spring request remains independent.
- The Mossprout activity Basket remains free (`spendEnergy: false`); no Energy reward or economy change accompanies the handoff.

## Compatibility and interruption recovery

Removed v42 checkpoints map forward to their closest surviving scene. Run IDs, answers, receipts, board contents, and meditation records are retained; completed saves stay completed. Retired script actions remain available for old offline receipt synchronization.

The Seed reveal uses a new `companion.continue_to_planting` action ID, so an old acknowledgement receipt cannot swallow its new Continue action.

Older flow journals migrate before replaying automatic effects. A legacy checkpoint without a flow journal is reconstructed at its saved position; the Seed reveal re-drives idempotent relationship/Seed effects if needed. Partial objective progress is retained. Recovered Basket facts include item instance IDs in event identity.

Back during meditation or Basket coaching writes the terminal checkpoint and dismisses only that FTUE flow, without inventing merge events. Startup reconciles a completed checkpoint before resuming flow work, covering interruption between those two writes.

Mossprout’s map never renders the Steppling movement Egg. That progression data remains independent, but has no art or interaction path on this world surface.

## Receipt deployment

`supabase/migrations/20260903180000_register_mossprout_ftue_v43.sql` copies the v42 allowlist and adds the new Continue and two handoff actions. It contains no answer labels or personal text. Apply this migration through the normal deployment process before releasing the v43 client; it has not been deployed by this change.

## Verification

Automated coverage includes graph reachability, serialized replay at each boundary, duplicate effect acknowledgements, ignored unrelated events, two-spawn counting, one final merge, Seed mappings, forward checkpoint mapping, navigation exits, receipt allowlisting, free Basket behavior, and existing Merge/Haven/relationship regressions.

Native visual and process-kill acceptance checks remain in `docs/mossprout-ftue-day-1.md`. Passing reducer/source-contract tests is not a substitute for that device pass.

The broader `test:roles` run reports three failures in the untouched Mossprout form-finder: a missing terminal end node, missing Mossprout affinity/reveal coverage, and no winning path for that form. These are outside the first-session flow and remain unresolved here.
