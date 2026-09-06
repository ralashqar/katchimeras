# Katchimera role framework

The gameplay identity of a Katchimera belongs to its family. Skins share the
same role, bond, quests, discovery answers, insights, and future evolution.
Broad life aspects organise the catalogue but do not merge companions.

## The three engagement lanes

1. **Real life** — detectable activity or a memory the player deliberately
   shares through a photo, journal entry, note, voice note, place, movement,
   health signal, or another canonical fact provider.
2. **You** — editable questions about preferences, routines, and goals. These
   answers form a small local profile used by later content.
3. **Mini-game** — a repeatable in-app activity whose mechanic and fiction
   reinforce the family role.

Bond levels unlock depth rather than access to the basic loop: New (0),
Familiar (100), Devoted (250), and Kindred (500). Hatches award 10 points,
real-life quests 25, discovery answers 15 once per prompt, and the first
successful mini-game clear per family each day 10. Existing reflection and
insight awards remain 15 and 10.

Visible evolution is deferred. Bond levels currently unlock content only.

## Role authoring contract

A completed role needs:

- a single-sentence purpose and an explicit boundary from neighbouring roles;
- reliable hatch signals;
- at least six family-scoped quick goals, including repeatable and one-off actions;
- at least four progressive real-life quests: two low-friction repeatables, a
  Bond 2 intentional quest, and a Bond 3 weekly review;
- a three-question branching Journey that ends in a plain-language Focus and
  suggests at least two quick goals from the same family;
- at least one signature mini-game;
- tiered insight themes, reflection lenses, and goal types.

The runtime catalogues live in `constants/katchimera-roles.ts`,
`constants/companion-quick-goals.ts`, and `constants/companion-journeys.ts`.
Cross-catalogue validation lives in `constants/companion-content.ts`. Entries
marked `fallback` or `planned` intentionally expose only basic fallback content
while waiting for their authored batch.

### Authoring checklist

1. Write the role promise and boundary before writing content.
2. Compare the family with its two closest neighbours using the merge audit
   below.
3. Write the Do presets and the Journey together so every suggested action is
   genuinely useful for the Focus that recommends it.
4. Add the real-life ladder and connect every quest to its Journey stage,
   repeat policy, family ID, bond requirement, and goal contribution.
5. Re-theme an existing mini-game first. Add a new mechanic only when the life
   role cannot be expressed by an existing one.
6. Register the quest pool and run `npm run test:roles`.
7. Mark a role `complete` only when
   `validateCompleteCompanionContent()` returns no issues.

### Merge audit

Keep families separate by default. Merge one into another as a skin only when:

- the life promise and boundary are the same;
- the same real-world signals prove progress;
- at least 70% of useful Do goals and real-life quests work unchanged;
- the Journey would ask substantially the same questions and create the same
  Focus types; and
- neither family has a distinct mini-game purpose.

An art theme, cuisine, season, venue, or personality difference alone does not
justify a separate gameplay family. A distinct player behaviour or outcome
does.

## Rollout batches

1. **Foundation — complete:** Steppling, Bedrotte/Snoozle, Feastle, Tasklet,
   Pagelet, Mossprout, and Vesperitt all satisfy the current content contract.
2. **Existing scaffolds — complete:** Flickerbun, Relicoon, Encora,
   Gatherglow, Cheerlet, and Skylo now satisfy the complete content contract.
   Their merge audit kept all six separate because they create different
   behaviours, evidence, Focus outcomes, and mini-game purposes.
3. **Daily rhythm and wellbeing — complete:** Coffee Ritual, Errandimp,
   Dawnle, Mendle, and Quietome now satisfy the complete content contract.
   Creamalume merged into Tasklet as a skin because its work/focus role,
   actions, signals, questionnaire outcomes, and game loop were duplicates.
4. **Movement and sport — next:** Flexel, Sprintail, Hooplet, Serveling, then a direct
   overlap audit for Voltstep and Pulsepounce.
5. **Relationships and care:** Snuglet, Waglet, Whiskit, Kindling, then
   Nestkin versus Snuglet and Heartmote versus Gatherglow.
6. **Creative leisure:** Museling, Pixooka, then Glimmuse against the completed
   culture roles.
7. **Food specialities:** audit Crumbun, Hayhorn, Crustling, Nigirimp,
   Noodloo, Sundael, and Bobaloo against Feastle and Coffee Ritual before
   writing content.
8. **Nature, weather, and travel:** audit the setting and seasonal families
   before authoring; only behaviours such as gardening, hiking, stargazing,
   travel planning, commuting, and local discovery warrant distinct roles.
9. **Planned/art-incomplete:** resolve Nestkin, Heartmote, Chapterling,
   Homecraft, and Signalhop only after their closest completed roles exist.

After each batch, compare role boundary, real-life quest patterns, discovery
domain, reflection lens, and mini-game purpose. Recommend a skin merge only
when the families substantially overlap across all five. A different visual
theme or hatch subject is not sufficient by itself. Add a new family only when
the missing life role has reliable hatch signals and supports all three lanes.

## First role review: Vesperitt

Vesperitt owns intentional late-night life: what a player makes, does, or
experiences while awake in the small hours. It remains separate from the
Bedrotte/Snoozle family, which owns rest, winding down, and recovery.

- Real life: capture a meaningful moment between 11pm and 5am; record what
  filled a late night and whether it felt chosen.
- You: identify what usually fills the small hours, choose how late nights
  should feel, and later reflect on what night provides that daytime does not.
- Mini-game: Moon Signals, a Vesperitt-themed constellation sequence game.
- Insights: late-night frequency, activities, intentionality, and next-day
  energy.
