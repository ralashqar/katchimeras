# Katchimera new set — "Companions & Moments"

The roster today (108 definitions, 15 live) answers **where were you / what did you do** — cafe, park, run, home, landmarks. Not one creature answers **what or who was *with* you**. That is the axis the on-device vision pass + the salience/concept engine (`utils/vision-signals.ts`) unlocks: subject creatures that hatch from what filled the frame.

## The new axis: subject creatures
Hatched from the day's dominant photo concepts (already grouped + salience-scored in `aggregatePhotoVision`). They fit the two-axis model: pets/little-ones are **common but bond-rich** (seen daily → bond deepens); snow/sunset are the **living-rares** the product doc names ("first snow… a sunrise").

| Creature | Hatches from concept | Rarity | Signature motif |
|---|---|---|---|
| **Waglet** (dog) | `dog` | common (bond-rich) | floppy ears, heart-tag collar, paw-print glow |
| **Whiskit** (cat) | `cat` | common (bond-rich) | perked ears, curled tail, bell |
| **Snuglet** (little one) | `baby` | common (bond-rich) | swaddle blanket, star-pacifier, huge eyes |
| **Driftkin** (first snow) | `snow` | living-rare | frost crown, scarf, cool glow, breath-puff |
| **Duskle** (golden hour) | `sunset` | rare | sun-disc halo, amber-gradient coat |

Reuse, not new art: `flowers` → dormant **garden** creatures; `food` → dormant **food-spot** creatures; `people/faces` → **Gatherglow** + activate sibling **Chattermote**.

## Art style (unchanged family)
A subject creature is NOT a realistic dog/cat — the style guide forbids realism. It is the same rounded, glossy-eyed, glow-bellied Katchimera **themed by one signature motif** (as baristabbit *wears* coffee). Use the exact established `imagePrompt` template (family identity → signature traits → material/lighting → camera → pose/expression → quality → negatives, with `no realistic animal anatomy`). Pipeline unchanged: `katchimera-assets` skill → `nano-banana-2` → BiRefNet matte → cutout → wire. Same 5 QA taste gates.

## Wiring a creature (the checklist)
1. Profile → append to `data/katchimeras/encounter-katchimeras.json` (id matches cast `profileId`).
2. Visual → `HomeVisualKey` union (`types/home.ts`) + `homeCreatureVisuals` (`constants/home-mvp.ts`); placeholder = reuse an existing cutout (like `pulsepounce` → `hayhorn.png`) until real art.
3. Concept route → `CONCEPT_SEED_MAP` in `utils/vision-signals.ts` (e.g. `dog: 'dog_companion'`).
4. Cast entry → `constants/encounter-cast.ts` (`placeholderArt: true` until rendered).
5. Verify → add to `scripts/verify-encounter-engine.cjs` visualKeys list + a hatch test.

## Phases / progress
- **Phase 1 — Dog pilot (Waglet):** DONE — real art, hatch verified.
- **Phase 2 — Subject set:** DONE — Whiskit, Snuglet, Driftkin(rare), Duskle(rare) live with real art. Living-rare bucket seeded.
- **Wave A — Activated place bench:** DONE — Crustling(pizza), Nigirimp(sushi), Noodloo(ramen), Sundael(dessert), Bobaloo(bubble tea), Pagelet(bookstore), Hooplet(basketball), Serveling(tennis), Petalimp(garden), Fernip(forest). Granular vision concepts added (pizza/sushi/ramen/dessert/bubble_tea/bookstore/basketball/tennis/forest/garden) so food/scene photos route correctly.
- **Wave B — Moments & seasons:** DONE — Drizzlet(rain), Amberleaf(autumn), Blossle(blossom), Peakle(summit), Stillo(still water), Twinklet(starry night), Feastle(feast). `flowers` now routes to the live garden creature (Petalimp). New concepts: rain/autumn/blossom/stars (+ mountains/water/food now mapped).
- **Wave C — Life chapters:** DONE — Museling(creative), Tasklet(focus/work), Cheerlet(celebration), Voyagle(travel). New concepts: creative/focus_work/celebration/travel.

- **Capstone (city + gym):** DONE — Skylo(city), Flexel(gym). Closed the last two common day-types.

**ALL WAVES + CAPSTONE COMPLETE — CAST EXPANSION CLOSED.** Live cast: 44 (was 15). Total defs 126. Every defined vision concept hatches a creature. Coverage spans places, food, pets, family, weather, seasons, nature, creative, work, celebration, travel, city, and gym.

**Deliberately NOT doing more cast (diminishing returns + bond conflict):** per-city travel variants, place sub-types, and per-seed variants are skipped — repeat visits are meant to RE-MEET the same creature and bond (rarity ≠ bond), so variation belongs in **bond-stage art evolution** (stages 10/30/75, currently unbuilt), not more creatures. Next real levers: bond-stage evolution, validating the hatch lands, or a downstream product phase (Comic / Life Map / Wrapped onboarding / paywall).
