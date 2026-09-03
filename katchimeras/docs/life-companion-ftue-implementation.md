# Life Companion FTUE implementation

## Architecture

FTUE v40 reuses the existing world host, Egg renderer, conversation engine, Bond ledger, Merge board, Haven progression, Daily Seeds, Journey campaign, and durable action receipts. It adds no parallel profile, quest, currency, board, or timer system.

The live route is:

`Egg → day texture → Hatch → contextual meeting → growth intent → Bond → Garden story → four-Seed merge → First Bloom → immediate restoration → Water Together → first Seed → eight-hour rest`

Legacy question and resident-card nodes remain in the graph as recovery targets for saves already inside older FTUE versions, but they are excluded from live reachability validation.

## Important ownership rules

- The Egg answer is stored as `egg.day_texture` and selects Mossprout's first-meeting conversation variant.
- The soft goal answer is stored as `companion.choose_growth_intent`; it also determines the first Seed.
- Serving `mossprout:chapter-0:first-sprout` produces the First Bloom, then exposes a world-anchored `Restore with First Bloom` action over the focused Garden.
- That action uses the shared focus → atomic `world.upgrade` → receipt-backed reveal recipe. Haven stage 1 and all six level-1 nature islands are committed for zero Coins only when that operation runs.
- Accepting Water Together surfaces the existing manual `water` Daily Seed. It is never required to finish FTUE.
- Every Water Together answer receives a character response before Mossprout forms the first Seed.
- Keeping the Seed opens a final authored conversation before the durable Katchimera meditation record begins. Meditation owns the eight-hour wake time and suppresses ordinary interaction actions on every Mossprout visit.
- The first Journey completes after the chapter-zero return. `MOSSPROUT_FTUE_REST_MS` is the single eight-hour gate used by the Home handoff and same-day Journey creation.
- Journey Day 2 asks for support preference in character dialogue and uses Petalimp as its authored guest.

## Privacy and safety

Backend FTUE receipts contain action identifiers only. Exact answer labels remain local profile data. Mossprout explicitly frames the Seed insight as tentative, and every wellness choice can be declined without loss of progression.
