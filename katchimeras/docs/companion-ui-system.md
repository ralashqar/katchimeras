# Companion UI system

The Kingdom companion experience is a feature boundary, not a collection of
independent sheets. Its navigation, surfaces, typography, motion, and common
states should remain predictable even when individual Katchimeras provide
different quests or artwork.

## Flow

The root flow is:

`Kingdom resident → companion sheet → Do / You / Insight / Skins`

Focused work opens from one of those thread roots:

- Do → quick-goal picker or quest preview → active quest → result
- You → journey questionnaire or daily check-in → result
- Insight and Skins remain thread-root content

Back always unwinds one level. An active mini-game asks for confirmation,
then returns to Do. A questionnaire, check-in, goal picker, or quest preview
returns directly to its owning thread. Only a thread root closes the sheet.

`CompanionRoute` in `types/companion-interaction.ts` is the source of truth.
Do not add a new `*Open` boolean for a navigable companion subflow. Add a
route case and reducer action instead.

## Ownership

- `features/companion/use-companion-experience-controller.ts` owns navigation
  state and exposes intent-named actions to the renderer.
- `CompanionInteractionSheet` composes the current route. It must not own
  persistence, quest rules, bond calculations, or questionnaire definitions.
- `companion-ui-primitives.tsx` owns shared companion shell, actions, cards,
  sections, back controls, status and result presentation.
- Questionnaire scenes and quest boards own their immersive artwork and
  mechanics, but use shared chrome and tokens.
- `KatchaUI` and `KatchaSurfacePalette` are the canonical style contract.
  Meadow and Lantern values may remain inside artwork-specific implementations,
  but new reusable UI must not introduce another token family.

## Layout rules

- Standard companion sheets keep the identity header and thread switcher above
  one scrolling content region.
- Full-screen questionnaires keep the background, creature, speech bubble, and
  top progress mounted. Only the answer region scrolls and transitions.
- Mini-games use full bleed only when their execution explicitly requests it.
- Use `KatchaUI.layout.phoneGutter`, semantic spacing, continuous radii, and
  the surface provider rather than copied color or shadow literals.
- Use `KatchaUI.type.companionName` for creature names, `screenTitle` for page
  titles, `sectionTitle` for section headings, and `companionBody` for copy.
- Use transform and opacity for transitions. Respect reduced motion and avoid
  remounting stable artwork to replay entrance animations.

## Component choices

- Use `CompanionPrimaryAction` for the single main action in a view.
- Use `CompanionSecondaryAction` for reversible or less prominent actions.
- Use `CompanionBackAction` for focused subflow navigation.
- Use `CompanionSection` to establish hierarchy without adding an unnecessary
  card.
- Use `CompanionCard` only when selection, elevation, or grouping is meaningful.
- Use `CompanionResultNotice` for questionnaire/check-in task creation rather
  than repeating the answers and generated tasks in several stacked panels.
- Use `QuestExperienceHost` with grouped `session`, `history`, and `handlers`
  objects. Keep game-specific configuration inside the session.

## Adding a new companion subflow

1. Add a discriminated `CompanionRoute` case and reducer actions.
2. Add pure reducer/back-navigation tests.
3. Expose an intent-named controller action.
4. Render the route from the interaction sheet using shared shell primitives.
5. Add representative default, loading, empty, error, and completion states to
   the UI gallery when they apply.
6. Verify compact phone, standard phone, tablet, enlarged text, and reduced
   motion before release.
