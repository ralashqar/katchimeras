# Katchimeras — Product Direction Recommendations (June 2026)

Status: recommendation doc, written after a full audit of the codebase, docs, data pipeline, and art system.

## Where the project actually is

- **Vision**: coherent and disciplined. The docs correctly parked the KatchaDeck collection-game framing and converged on a daily memory ritual: egg → moments → nightly hatch → creature postcard. The shareability framework and encounter model are genuinely strong product thinking.
- **App**: the MVP loop is largely built and polished — onboarding, egg, radial capture, hatch, timeline, day map, local-first persistence with migrations. The visual system (dark, glassy, serif, mesh gradients) is cohesive and premium.
- **The gap**: the live app still generates creatures from the five abstract trait scores (`home-engine.ts`) with template-built highlight/reflection strings. The encounter-first model — the thing the docs identify as what makes a katchimera legible and shareable — is only wired into the dev art lab. And the art system is ~99% defined, ~4% rendered (13 hero images against 104 encounter creatures / 300 catalog permutations).

## The one-sentence identity

**"Your day becomes a creature."** Not a journal with a mascot, not a tracker with rewards, not a chatbot with a skin. The creature *is* the product; journaling, capture, maps, and any assistant behavior exist to make the creature accurate, lovable, and worth keeping.

Positioning against the obvious comparable: **Finch** proves the self-care-creature market is large and pays. But Finch's loop is *effort → pet* (you do tasks to care for it). Katchimeras inverts it: *life → pet*. Zero-effort journaling — the day you already lived becomes the artifact. That inversion is the differentiator; protect it. Anything that adds obligation (streaks, tasks, check-in guilt) erodes the moat.

## Strategic recommendation #1: depth over breadth — a small recurring cast, not a 300-creature catalog

The biggest unacknowledged risk in the current design is **day-to-day variance**. Most real days are home → work → home. If Tuesday's creature ≈ Wednesday's creature, the magic dies by day 4. The instinct to solve this with catalog breadth (104 encounter variants, 300 permutations) is the wrong fix — it multiplies the art production problem 30x and still produces strangers.

The better fix is already latent in the docs: `repeatDepth` and the flagship mascot roster. Elevate them:

- **Recurring characters > endless new ones.** Your Lattelet showing up the third Tuesday in a row, *remembering* ("your cafe rituals are starting to leave a signature"), is a relationship. A new random creature is a slot machine. Relationships retain; slot machines fatigue.
- This collapses the art problem from 300+ renders to **~12–16 flagship-quality characters** (the existing roster: Baristabbit, Bedrotte, Signalhop, Errandimp, Mossprout/Mossmischief, Crumbun/Crumbelle, Sprintail, Hushling, Doggoblin, Shelfself + a few coverage fillers for common encounter categories), each with 2–3 mood/stage variants.
- It aligns the in-app cast with the TikTok/merch flagship strategy — same characters everywhere, compounding IP value. Finch has *one* bird.
- Novelty then comes from three cheaper sources: (a) rarity moments when a day genuinely breaks pattern, (b) stage/mood variants of known characters, (c) the reflection copy, which can be fresh every day even when the visual isn't.

## Strategic recommendation #2: wire the encounter model into the live hatch — this is priority zero

The "this is weirdly accurate" moment is the entire retention and viral engine, and it requires the user to instantly know *why* they got this creature. Trait-score creatures ("calm-exploration hybrid") can't deliver that; encounter creatures ("my coffee creature") can. The model, seeds, copy layers, and matching hierarchy are all designed — they need to be implemented in `home-engine.ts`:

1. Map the day's location clusters / moments / steps to encounter categories (the day-map clustering already produces the needed inputs).
2. Match to the flagship cast first, category fillers second, trait-based fallback last (passive-thin days must still hatch something warm — the current trait system becomes the fallback, not the default).
3. Track `repeatDepth` per character per user and surface it in the reveal copy.

## Strategic recommendation #3: the reflection must be real — and this is where the "assistant" idea belongs

The highlight/reflection lines are currently template strings. Replace with **one LLM call at hatch time**: feed the day's moments, places (categories, not raw coordinates), steps, note text, and the matched character's voice; get back 1–3 sentences. Cheap (one call/user/day), and it's the journaling payoff — the moment the app proves it was paying attention.

On the personal-assistant / motivational-agent instinct: **yes, but as the creature's voice, not a coach.** The docs' rules (non-judgmental, calm, reflection over tracking) should govern hard here. The distinction:

- ✅ The katchimera *remembers*: "Third park morning this week — Mossprout approves." A morning greeting from yesterday's creature. A gentle observation about a pattern.
- ❌ A generic agent that sets goals, nags, or motivates. That's a different app, a crowded category, and it breaks the brand promise ("it is not a game you play; it is a game your life creates").

Sequence it: reflection copy now → morning greeting + weekly recap next → conversational companion (talk to your katchimera) as the premium phase 3 feature, once the cast has personality equity.

## Strategic recommendation #4: finish the loop's two open ends — notification and share

- **The hatch notification is the single most important notification in the app.** "Your day is ready to hatch" at the user's chosen hatch time (make `HOME_HATCH_HOUR` user-set or sunset-based, not fixed 20:00). This is the ritual anchor; without it the nightly reveal depends on the user remembering the app exists.
- **Finish the memory postcard share.** `view-shot` infra exists; compose the card per the shareability framework (portrait, name, reflection line, encounter cue) and hand it to the native share sheet. This is the only viral surface in the MVP — it should be beautiful and frictionless before any other social feature is considered.

## What to cut, keep, defer

| Keep / double down | Defer | Cut / park |
|---|---|---|
| Home-first navigation, timeline, ghost egg | Collection/deck view — let it *emerge* after ~3–4 weeks of hatched days as a simple grid; the deck builds itself | Player avatar studio (dilutes focus; the user's portrait is the creature, not an avatar) |
| Day map as memory layer (genuine differentiator, beautiful) | Premium/billing — until D30 retention is proven | 300-permutation render ambition |
| Radial capture; add the planned **one-line note** and voice — they feed the LLM reflection directly | Evolution/fusion mechanics | Manual path-picker on Home (asking the user to *choose* energy/calm conflicts with "reflection over configuration"; demote to a fallback for sensor-thin days or remove) |
| Photo-library map seeding, HealthKit route import (they fatten thin passive days) | Android | Streak mechanics of any guilt-bearing kind |

## Risks to manage

- **Thin passive days.** Foreground-only capture means many days have little signal. Mitigations already half-built: photo seeding, HealthKit import, manual moments. Consider iOS significant-location-change API later. The fallback creature path must always feel warm, never like a "you did nothing" verdict.
- **Location privacy.** Local-first is currently true — make it a loudly stated feature ("your days never leave your phone"), and keep raw coordinates out of any LLM call or share card (send place *categories* only).
- **Reveal fatigue.** Guard the hatch as a once-per-day ceremony. Resist anything that makes creatures cheap (multiple drops, loot mechanics).

## Suggested sequence

**Phase 1 — make the creature true (now → TestFlight):**
encounter matching in the live hatch · render the 12–16 flagship cast via the existing FAL pipeline (pre-render + bundle/CDN, not per-user generation) · LLM reflection at hatch · hatch-time notification + user-set hatch hour · finished share postcard · one-line note capture.

**Phase 2 — make the relationship compound:**
repeatDepth surfaced in copy and visuals (mood/stage variants) · weekly recap artifact ("your week's habitat") · collection grid emerges · rarity moments for pattern-breaks.

**Phase 3 — make it a companion, then a business:**
morning greeting / conversational voice (premium) · subscription (deeper reflections, story moments, variants, printed postcards) · social beyond the share sheet only if organic sharing demands it.

The test for every decision stays the one already written in the shareability doc: *would the user know why they got it, and would they post it without explaining the app?*
