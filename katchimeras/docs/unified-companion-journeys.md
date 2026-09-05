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

The companion scene has a compact chapter name / Journey Day header. Active
Journey dialogue opens through Continue Journey. Meditation reuses DayActionCardSurface: the original warm gradient, rim, shadow,
left moon icon, and the exact action-card title typography for the chapter/day.
“Next Journey in”, the countdown, animated progress bar and leaf marker fit inside
the same panel with compact spacing; ready and finished states retain one compact action.

Below it are the original illustrated cards, in fixed order: companion tracker,
Tend Garden, and one named playful conversation. Steppling tracks real steps;
Mossprout offers “Log a glass of water” through the existing daily habit repository.
Every completion uses the original slide-out animation, then disappears. Repeatable
water logging slides in a fresh card with today’s count; Bond pays once per day. The narrative card is selected
once per calendar day, survives reopening, resumes unfinished work, and respects
content cooldowns. Exhaustion leaves two cards. There is no Your day / More actions
hierarchy. Conversations remain available while the next Journey is resting.

Resident and FTUE choreography remain dedicated. The first-rest preview uses the
compact header and water / Tend Garden cards, with Garden still owning the required
mist/Steppling discovery. The surrounding scene scrolls on small phones.

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

New cycles keep two settlement slots rather than creating their own merge orders.
Each companion receives two optional calendar-day Garden requests: a two-item
combination and one higher-tier item. Early tiers are 3+3 / 4, established 4+3 / 5,
and advanced 5+4 / 6. Generation uses owned generators and their currently available
outputs; forced drops constrain eligibility. Requirements are frozen for that day.
The initial bands use progression counts 0–3 / 4–11 / 12+, with Steppling using its
existing friendship level. These are initial tuning values.

Each order pays 8 Glow. Serving both grants an automatic 8 Glow bonus in the same
Merge transaction, protected by a durable receipt. Orders are never replenished
within the day. Midnight refresh preserves inventory and required story orders.
Tend Garden reveals the original MossproutJourneyRequestPanel over the action
list. Cards and Journey chrome remain mounted in their original layout, hidden
with opacity and excluded from touches/accessibility. Back restores visibility
without replaying entrance animations. Visibility wrappers explicitly disable
native view flattening so toggling opacity cannot reparent the animated rows.
Orders use a bottom-anchored overlay outside the card scroll area and reserve no
height in the normal layout, including when only one action remains. Daily and chapter orders use the original request
art, description, scrolling and tap-to-open behavior. No inline expansion or new
request grouping is introduced.
Daily completion never gates episodes or their return gift.

Only the first two eligible deliveries during each new meditation shorten it by
five minutes each. Earlier deliveries are not banked. The existing eight-hour
rest and shared two-hour acceleration cap remain. Delivery receipts are routed
away from chapter progression. Water completion links its existing goal receipt
to the life request before ordinary action settlement, preventing double reduction.

Steppling’s steps card has no submenu. Below its target, a tap only speaks the
remaining-step dialogue and silently refreshes permitted readings. At or above its
target, a tap immediately starts the existing reward flight and card exit sequence.
Meditation can also settle from 500 new steps. Authored journey conversations retain
their movement/rest choices. Motion is read only when already permitted.
Supported devices query the exact meditation window. Stored step aggregates
retain their source dates and baselines, including across midnight. Overlapping
sources take the maximum rather than being added. Unsupported devices and
denied permissions retain stored readings and the authored story alternatives. Rest
never fabricates steps.
Day 1's movement choice is an intention, not completed activity evidence.

Mossprout’s “Log a glass of water” card is an explicit checkoff after drinking.
The count persists across reopening and starts fresh on each local calendar day.
The outgoing card retains its count until its animation finishes. Any needed
clarification uses the existing character speech and multiple-choice flow, replacing
the action list; no explanatory text or buttons expand beneath a card.

Legacy meditation requests expire when the companion is ready. New optional
daily requests expire at the local calendar-day boundary. Return context freezes when presented. Ordinary returns queue two
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

Existing legacy Garden batches finish under their saved rules for the current
day; the next calendar day adopts the shared pair. Saved meditation cycles keep
their old order identities until return. No existing board items, rewards, chapter
orders, or conversation sessions are reset.

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


Leaving a companion restores the live camera snapshot captured before entry,
including pan and zoom. Egg-to-resident handoffs retain their pre-Egg snapshot.
A direct entry with no world-camera history instead fits that resident's complete
tile with a small margin, rather than backing out to the entire kingdom.
