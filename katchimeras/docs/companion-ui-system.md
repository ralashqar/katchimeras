# Companion UI system

The Kingdom companion experience is one feature boundary, not a collection of
independent sheets. Navigation, surfaces, typography, motion, and common states
must remain predictable even when individual Katchimeras provide different
quests or artwork.

## Flow

The root flow is:

`Kingdom resident → Visit → response / optional action`

Shared History and More are secondary routes from Visit. More contains Quests,
Focus, Goals, Achievements, and the latest Insight. Skins remain in You
customisation. A normal resident tap always opens Visit. An explicit launch
intent, such as returning from quest evidence capture, may open its owning
destination directly.

Shared History is not a questionnaire-answer archive. Proposed observations
are reviewed one at a time during Visit. Only confirmed observations and
explicitly saved moments appear in history; editing and forgetting are
secondary controls behind the per-memory manage action.

Focused work opens from a destination:

- Quests → quest preview → active quest → result
- You → journey questionnaire or daily check-in → result
- Goals → companion-specific goals → goal picker
- Insight remains lightweight destination content; Skins live in You customisation

Back always unwinds one level. An active mini-game asks for confirmation and
then returns to Quests. A questionnaire, check-in, goal picker, or quest preview
returns directly to its owning destination. A destination, More, or Shared
History returns to Visit, and Visit returns to Kingdom.

`CompanionRoute` in `types/companion-interaction.ts` is the source of truth.
Do not add a new `*Open` boolean for a navigable companion subflow. Add a route
case and reducer action instead.

## Ownership

- `features/companion/use-companion-experience-controller.ts` owns navigation
  state and exposes intent-named actions to the renderer.
- `CompanionInteractionSheet` composes the current route. It must not own
  persistence, quest rules, bond calculations, or questionnaire definitions.
- `companion-ui-primitives.tsx` owns shared companion shell, destination chrome,
  actions, cards, sections, back controls, status, and result presentation.
- Questionnaire scenes and quest boards own their immersive artwork and
  mechanics, but use shared chrome and tokens.
- `KatchaUI` and `KatchaSurfacePalette` are the canonical style contract.
  Meadow and Lantern values may remain inside artwork-specific implementations,
  but new reusable UI must not introduce another token family.

## Layout and type rules

- The whole visit is full-screen. The character speaks before navigation is
  offered; do not reintroduce a dashboard, persistent tab, or thread switcher.
- Standard destinations keep the identity header above one scrolling region.
  The day atmosphere remains the page background, and a shared companion
  speech-bubble hero introduces the destination.
- Do not place destination content on one full-page parchment slab. Use cream
  only for individual readable objects such as quest cards, goal rows, and
  focus panels, with the artwork visible between them.
- Full-screen questionnaires keep the background, creature, speech bubble, and
  top progress mounted. Only the answer region scrolls and transitions.
- Mini-games use full bleed only when their execution explicitly requests it.
- Use `KatchaUI.layout.phoneGutter`, semantic spacing, continuous radii, and the
  surface provider rather than copied color or shadow literals.
- Use Fredoka-backed `companionDisplay`, `companionPageTitle`,
  `companionCardTitle`, and `companionSectionTitle` for companion headings.
  Use Manrope-backed `companionBody` and `companionAction` for copy and controls.
- Use transform and opacity for transitions. Respect reduced motion and avoid
  remounting stable artwork to replay entrance animations.

## Component choices

- Use `CompanionPrimaryAction` for the single main action in a view.
- Use `CompanionSecondaryAction` for reversible or less prominent actions.
- Use `CompanionBackAction` for focused subflow navigation.
- Use `CompanionSection` to establish hierarchy without an unnecessary card.
- Use `CompanionCard` only when selection, elevation, or grouping is meaningful.
- Use `CompanionResultNotice` for questionnaire/check-in task creation.
- Use `QuestExperienceHost` with grouped `session`, `history`, and `handlers`
  objects. Keep game-specific configuration inside the session.

## Adding a companion subflow

1. Add a discriminated `CompanionRoute` case and reducer actions.
2. Add pure reducer and back-navigation tests.
3. Expose an intent-named controller action.
4. Render the route using the shared full-screen shell and destination chrome.
5. Add representative default, loading, empty, error, and completion states to
   the UI gallery when they apply.
6. Verify compact phone, standard phone, tablet, enlarged text, and reduced
   motion before release.
