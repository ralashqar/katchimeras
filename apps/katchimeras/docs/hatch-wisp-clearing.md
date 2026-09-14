# Main companion hatch: two wisps

Mini Merge still reveals the egg. The revealed egg now asks two equal-value,
character-specific questions: friction and support. Each question offers three
reauthored choices (question-set version 2), with equal Bond rewards. Each saved answer sends
15 Bond into the egg, triggers its existing reaction, and cleanses one hovering
wisp. The final dissolve exposes Hatch; answering never starts the hatch itself.

## Runtime and content

- `features/onboarding/hatch-profile.ts` owns question IDs, answer IDs, mappings,
  domains, evidence increments, and authored reaction fragments. Mossprout,
  Steppling, and Baristabbit are active. Shellio, Bedrotte, Pagelet, and Encora
  have content ready for their future discovery integrations.
- The shared encounter preserves the answered card until coin arrival, the
  700 ms cleansing beat, and its existing slide-out. One answer clears one wisp,
  regardless of how many coins are rendered. Failed saves do not launch coins.
- Mossprout’s FTUE camera pulls back from 3.0 to 2.42 to 1.95 zoom with the two answers.
  Steppling and later eggs use their original fixed 2.05 framing and are full-sized from reveal.
  Coin arrival starts Egg growth, camera movement, and wisp cleansing together;
  only the card waits for the cleansing beat. Two wisps hover at opposite shoulders
  on a 5.6-second cycle with a 52-point vertical range, a Glow pulse, and dissolving motes.
  Their positions follow the Egg camera on the UI thread; they fade in with the reveal. Reduced motion
  uses stationary wisps and a brief fade.
- Mossprout's Content Flow is version 55; its legacy FTUE projection is version
  51. The reveal goes straight to `egg.opening`, then `egg.context`. Saves at
  the retired `egg.wisps` or `egg.listening` steps migrate to question one.
  Existing question action IDs remain stable.

## Saved evidence and compatibility

The original four-choice question sets remain available only for decoding saved
version-1 answers and their first reactions. Removed options cannot be submitted
as new answers. No historical choices are reinterpreted as the new categories.

Shared eggs save versioned `wispAnswers` in their world record. Each answer
contains companion, question, answer, dimension/value, tags, timestamp, and a
confidence increment of one. Stable Bond receipt IDs prevent replay payments.
Answers are projected idempotently into the existing onboarding profile's
`hatchProfiles` map. Mossprout saves there before its animation and reconciles
an interrupted FTUE receipt on resume.

`loadHatchProfile` exposes friction, support, tags, and the initial insight.
The first conversation reflects both answers. Later noticing invitations use
the support preference, without changing rewards. Aspiration remains unknown;
new Mossprout runs use the existing Momentum seed with neutral copy. Existing
seed selections and aspirations are retained.

Legacy answer/feed fields remain readable. Previously ready eggs stay ready;
partial eggs receive completion credit without invented profile evidence.
Already hatched companions stay complete. Reopening an encounter does not
replay saved coin flights. Daily collectible eggs and collectible Wisps retain
their separate flow.

## Rollout and device checks

Apply `20260914120000_register_mossprout_ftue_v51.sql` through the normal database
release process before shipping script 51. It registers the existing receipt
IDs for the new version. This change
does not deploy a database migration automatically.

On small and large phones, check the complete fresh flow for each active
companion, then relaunch after an answer and during hatch. Check text scaling,
reduced motion, hover framing around the actual egg, coin/impact alignment,
the final CTA delay, and the personalized first greeting. Native visual QA is
still required; a successful bundle alone does not verify these compositions.
