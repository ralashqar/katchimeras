# Unified Companion Journeys

## Product contract

A Journey Day is an episode, not a calendar date. The rhythm is opening →
honest life participation → world activity → resolution → eight-hour meditation
→ return keepsake/gift → next episode. A chapter groups episodes around a
purpose and ends with a lasting world change. Missing days never resets progress.
Bond remains relationship progression; goals retain their own real-life evidence.
The legacy daily growth calculation is independent of story episode numbering.

Steppling's first chapter is **The Path Outside**: the existing Day 1/Locker,
then A reason to go, Something along the way, When the path is difficult,
A pace worth returning to, and Room for your pace. The existing five village
orders appear one per episode; the last episode also completes the existing
signature landmark. Normal companion content remains available after the final
return; there is no countdown to an unauthored chapter.

Mossprout retains its FTUE, thirteen campaign anchors, resident discoveries,
world prerequisites and rewards. Its historic active-day thresholds remain in
definitions for compatibility, but no longer gate episodes. The first rest
still starts at the FTUE farewell. Later resolutions begin their rest directly.
Open episodes resume across midnight. Later opening conversations include an
honest nature/quiet/not-today check-in; optional insight saving is unchanged.

## Ownership and persistence

The companion surface uses the original routine action resolver, illustrated
cards, swipe-to-skip and completion/reward presentation while resting. The timer
sits above all action cards, followed by two routine cards. A single compact
mission card is pinned at the bottom, completing the three-card layout. Its requests scroll horizontally
inside one cream surface, with no individually framed order tiles. Tapping an
unserved mission opens its order. Narrative uses the existing speech bubble; authored return and
episode choices still acknowledge the durable Journey flow. No scrolling
Journey dashboard replaces the companion scene.

- Content Flow owns Steppling episode answers, order gates, rest effects, and
  both families' return reward effects. Stable run/effect identities allow retry
  after a process stops between a domain write and effect acknowledgement.
- The existing relationship repository owns `journeyCycles`, an optional
  schema-7-compatible extension. Each record retains its episode/chapter,
  participation, frozen requests, step baselines, return presentation and
  completion timestamps. Skins use the same canonical family identity.
- Existing meditation records remain authoritative. `cycleId` links them to
  an episode without replacing their original FTUE `sourceId` or timer.
- Merge owns actual served-order receipts, board contents, landmarks, parcels,
  and permanent reward receipts. A flow event is reconciled from real receipts;
  submitting a scene cannot satisfy the crafting gate.
- The old Steppling story ledger projects active orders while `journeyManaged`
  is true; it no longer independently starts midpoint/friendship conversations.
  Its completed order IDs, authored deck, and reward amounts remain intact.
- Chapter journal keepsakes record shared story milestones. No unconfirmed
  pattern or free-text journal content is copied into this ledger.

## Meditation and evidence

Each cycle freezes two small merge requests (5 minutes each) and one life
request (60 minutes). All acceleration, including ordinary existing Bond
actions, shares a two-hour cap. A listed request cannot also award generic
acceleration. The list is optional and does not improve the earned return gift.
Each meditation Merge request also pays 8 Glow on serving. Currency payout and
its time-reduction receipt are recorded together; serving again cannot pay twice.
Saved zero-reward orders are repaired, and procedural templates must award Glow.

Steppling offers 500 new steps, adapted movement, or an honest rest check-in.
It reads Motion only when already permitted; no permission prompt is forced.
Supported devices query the exact meditation window. Stored step aggregates
retain their source dates and baselines, including across midnight. Overlapping
sources take the maximum rather than being added. Unsupported devices and
denied permissions retain the adapted/rest paths. Rest never fabricates steps.
Day 1's movement choice is an intention, not completed activity evidence.

Mossprout offers a living detail or quiet moment. These explicit check-ins do
not fabricate goal, wellness, or semantic-quest completion. Optional journal
and goal buttons hand off to their existing tools.

Requests expire when the companion is ready and their unserved orders leave
the board. Return context freezes when presented. Ordinary returns queue two
tier-one resources through the existing parcel UI; finales retain their existing
world reward instead. A full board leaves the parcel queued. A permanent reward
receipt survives arrival-history trimming. Reminders reschedule to the actual
reduced deadline and cancel after return; permission denial is nonblocking.

## Migration and adding a family

Steppling maps already served legacy routes to completed episodes without
retroactive gifts. An unfinished legacy conversation finishes on its existing
nodes before migration. Existing Day 1 run and generator-parcel identities are
unchanged. Completed chapters remain complete. Mossprout keeps all original
journey records and adopts its latest completed episode into the cycle while
preserving an existing meditation's deadline, reductions and source identity.

For the next family:

1. Add explicit life-area copy and an existing resource chain to
   `constants/companion-journey-profiles.ts`; unregistered families cannot
   accidentally inherit Mossprout's content.
2. Author chapter purpose, ordered episodes, participation alternatives,
   resolution callbacks and a finale using existing world reward IDs.
3. Compile/register Content Flow scenes/tasks/effects, using stable family and
   episode IDs. Reuse the cycle reducer, return effect, request receipts and
   existing domain evidence. Supply a family adapter for its current story
   ledger; do not create another timer, goal store or currency.
4. Enable the shared stage and reminder adapter for the family only after its
   migration and full chapter flow pass the same test contract.

## Verification

`npm run verify:story-flows` includes cycle, service and native-rendered component
tests. Coverage includes all Steppling branches, the full six-episode chapter,
legacy saves, duplicate submissions, reward-write interruption, natural expiry,
acceleration caps, independent families, source-date steps and FTUE rest adoption.
Also run relationship, Merge World, kingdom, role and lifecycle suites, typecheck
and lint when changing these integrations.

Device acceptance remains required: small screens/large text, native scrolling,
Motion permission denial and live readings, background/foreground, notification
rescheduling, parcel flights with a full board, and process termination at
resolution, rest, and return. Render tests verify component behavior; they do
not establish iPhone visual or sensor correctness.
