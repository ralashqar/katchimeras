# Katchimera Encounter Model

## Direction

Move Katchimeras from a `species-first` model to an `encounter-first` model.

The user should usually understand immediately why they got something:

- went to a cafe -> coffee creature
- visited a park -> park creature
- played basketball -> court creature
- had a huge walking day -> step creature
- visited a rare landmark -> landmark creature

## Core Principle

The main vector is the `topLevelType`.

Everything else flows from the encounter trigger:

1. `topLevelType`
2. `triggerCategory`
3. `triggerSubtype`
4. `timeOfDay`
5. `intensity`
6. `repeatDepth`
7. `rarity`

## Top-Level Types

- `location`
- `activity`
- `landmark`
- `routine`
- `special`

## Recommended Weighting

- `location`: `70%`
- `activity`: `15%`
- `landmark`: `10%`
- `routine`: `5%`

Most Katchimeras should be location-driven.

## Creature Style

Katchimeras no longer need to be mostly animals.

They can be:

- food creatures
- object creatures
- place spirits
- sports creatures
- plant creatures
- hybrid mascots

Examples:

- `Lattelet` from a coffee shop
- `Broccolite` from groceries / healthy food places
- `Hooplet` from a basketball court
- `Mossprout` from a park
- `Tourbelle` from the Eiffel Tower

## Modifiers

The base definition comes from the encounter. Variants come from modifiers:

- `timeOfDay`
- `intensity`
- `repeatDepth`
- `novelty`
- `rarity`

This keeps the system understandable while still creating variety.

## Data Files

- `data/katchimeras/encounter-types.json`
- `data/katchimeras/location-subtypes.json`
- `data/katchimeras/activity-subtypes.json`
- `data/katchimeras/cuisine-types.json`
- `data/katchimeras/landmarks.json`
- `data/katchimeras/variant-modifiers.json`
- `data/katchimeras/encounter-seeds.json`
- `data/katchimeras/encounter-katchimeras.json`

## Launch Recommendation

Start with a broad encounter catalog using:

- common place types
- a few activity triggers
- a small set of landmark rares

The first batch should optimize for delight and recognizability, not perfect taxonomy coverage.

## First Catalog

The first generated encounter catalog lives in:

- `data/katchimeras/encounter-seeds.json`
- `data/katchimeras/encounter-katchimeras.json`

Current v1 batch:

- `25` encounter seed groups
- `4` variants per group
- `100` encounter-based Katchimeras total

The strongest categories in the first batch are:

- parks, gardens, farms, forests, beaches, riverwalks
- cafes, bakeries, pizza, sushi, ramen, dessert, bubble tea
- bookstores, libraries, museums, cinemas
- malls, groceries
- basketball courts, tennis courts
- run sessions, high-step days
- landmark rares like `Eiffel Tower` and `Shibuya Crossing`
