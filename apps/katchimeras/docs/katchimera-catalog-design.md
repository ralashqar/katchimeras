# Katchimera Catalog Design

## Launch Recommendation

Launch with `300` core Katchimeras generated from:

- `20` families
- `5` habitat aspects
- `3` stages

Formula:

- `20 x 5 x 3 = 300`

This keeps the launch catalog large enough to feel collectible without forcing us to hand-design 300 unrelated creatures.

## Core Model

Each earned Katchimera has two layers:

1. `Catalog identity`
   - fixed collectible definition
   - family + habitat + stage
2. `Daily instance`
   - how the user earned it on that day
   - activity, time, route pattern, rarity roll, edition tags

Time-of-day and daily activity should not multiply the base catalog. They should decorate the earned instance.

## Main Lifestyle Axes

These are the primary vectors used for creature assignment:

- `activityLevel`
- `explorationStyle`
- `routineDepth`
- `placeAffinity`
- `timeAffinity`

Supporting vectors:

- `recoveryBalance`
- `tempo`
- `noveltyBias`
- `consistency`

## Daily Reward Loop

- user earns `1` featured Katchimera per day
- strongest daily vector bundle determines family + habitat match
- repeated behavior evolves existing lines
- unusual combinations can unlock rarer branches
- duplicates convert into `essence`

## Progression

### Days 1-7

- prioritize stage-1 discoveries
- easy unlocks
- low friction novelty

### Days 8-30

- introduce more repeats
- repeats feed evolution
- rarer habitat combinations begin to matter

### Day 30+

- stage-3 forms require stronger conditions
- deeper routine, consistency, and habitat fidelity should matter more than raw step count

## Data Files

- `data/katchimeras/vectors.json`
- `data/katchimeras/habitats.json`
- `data/katchimeras/stages.json`
- `data/katchimeras/stage-profiles.json`
- `data/katchimeras/families.json`
- `data/katchimeras/family-profiles.json`
- `data/katchimeras/habitat-modifiers.json`
- `data/katchimeras/image-style-guide.json`
- `data/katchimeras/assignment-rules.json`
- `data/katchimeras/catalog.json`
- `data/katchimeras/render-profiles.json`

## Character Profile Layer

Keep a separate user-facing profile layer for each family. This is where character writing and image-generation prompts should live.

Recommended fields:

- `familyId`
- `name`
- `subtitle`
- `userFacingDescription`
- `caption`
- `motivationalQuote`
- `lifestyleMatch`
- `deckRole`
- `associatedLifestyleProperties`
- `visualDescription`
- `imagePrompt`
- `paletteHints`
- `signatureDetails`

This layer should be referenced by cards, reveals, art generation, and premium story moments.

## Notes

- avoid treating `more steps` as always better
- calm/home/recovery days should generate meaningful creatures too
- rarity should come from behavioral depth, not only effort
