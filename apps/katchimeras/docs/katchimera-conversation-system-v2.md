# Katchimera continuous conversation system

> Goal outcomes and routing were consolidated in August 2026. Focus is no longer a visible destination; current behaviour is documented in [Goals and conversation consolidation](./goals-conversation-consolidation.md).

Status: rich vertical slice implemented for Baristabbit, Steppling, and Flexel.

## Product contract

Visiting one of the first three Katchimeras starts an NPC-style encounter automatically. It is not limited to one conversation per day. An opener routes into one self-contained authored flow. Profile games use three questions; saved-insight assessments use five; goals, quests, polls, and contextual memory paths use only the questions needed for their concrete outcome.

The conversation must feel authored for the Katchimera and the subject. Production definitions do not use a shared reflection question or generic answer-handling fallback. Each answer has its own acknowledgement and routes to a related family-specific beat.

Polls and form games are deliberately different modes. They may be shorter or use a fixed question count because their purpose is play, not a narrative conversation.

Other Katchimera families retain the legacy Visit experience until they receive a reviewed content pack.

## Encounter loop

1. Opening the companion creates a unique encounter with a question budget determined by its outcome class.
2. An unfinished conversation resumes first.
3. A relevant journal, Focus, quest, or bond signal can override the random opening.
4. Otherwise one of eight character-specific openers is selected with recent-repeat avoidance.
5. The player's answer stays visible and highlighted while the Katchimera's bespoke acknowledgement appears. The answer remains editable until Continue is pressed.
6. Continue sits below the stable choices. It commits the current answer and advances within the same authored flow.
7. Only an opener may select a follow-on definition. Completed narrative flows never silently chain into another questionnaire.
8. Every production flow resolves to a meaningful insight, poll result, form match, memory decision, goal proposal, concrete quest, or authored goal fallback before the player can keep talking or leave. There is no ceremonial “finish this thought” result.

There is no daily limiter, conversation quota, or reward farming. Completion count and legacy served-day markers remain readable only for migration compatibility.

## Authored graph model

`ConversationDefinition` is static, versioned, deterministic, and offline. Definitions are classified as:

- `opener`: characterful entry into a subject;
- `narrative`: a bespoke question-and-reply beat in a longer thread;
- `outcome`: an explicit Focus, task, or quest decision;
- `profile_game`: a fixed authored archetype/form game;
- `poll`: a fictional village comparison.

Choice nodes can carry an authored phase: `opening`, `explore`, `deepen`, or `resolve`. The UI presents these as conversational progress language instead of pretending every definition is “2 of 3.”

An answer can continue within a definition. Cross-definition routing is reserved for openers:

- `definition`: open a named authored definition;
- `pool`: select a recent-aware definition tagged for a semantic topic;
- `continuation`: return to the conversational menu after the result.

Narrative answers use explicit branch maps. For example, Baristabbit's first-sip answers route toward ritual, comfort, or preferences; Steppling's route answers can move toward exploration, pace, or headspace; Flexel's practice answers can move toward strength, energy, sport, or recovery. A random selection can occur within the selected topic, but the topic itself is determined by the authored answer branch.

Definitions may also declare `contextualOnly`, `requiresActiveFocus`, `weight`, trigger routes, and evidence references. Contextual journal/debrief material cannot surface as unrelated small talk. Validation checks node links, definition links, and referenced topic pools.

## First content batch

Each launch family contains 53 production definitions:

- eight randomized NPC openers;
- four five-question insight assessments covering the family’s major life-area themes;
- six journal callbacks, four goal/quest debriefs, and three bond-memory moments;
- one form-finder game;
- one four-question branching goal-discovery flow;
- one small-task offer;
- one optional quest handoff;
- twenty-four fictional village polls.

Baristabbit covers rituals, comfort, drink preferences, novelty, and social cafe moments. Steppling covers routes, pace, exploration, headspace, and challenge. Flexel covers practice, energy, strength, sports, and recovery. Every family also supports play, goal discovery, memory, tasks, and quest handoff paths.

Poll comparisons are always labelled “Katchimera village poll — fictional.” Their percentages are deterministic authored fiction and never claim to represent real users.

## Outcomes and consent

Every flow ends in a visible, correctly classified outcome. Saved insights are reserved for authored five-question assessments that combine evidence across the complete flow. Action branches produce goals or a quest. Journal callbacks and companion-support preferences offer explicit Long Memory. Polls remain fictional play, and form games produce a skin match. Short evergreen takeaway cards are not part of the production pack.

An answer such as “try one small change” is action intent and must route to a concrete goal proposal. It must never be stored as an insight or displayed as something learned about the player.

- Long Memory requires explicit confirmation and remains editable or forgettable in dialogue.
- A small task is added only after “Add this small task.” Success produces a named in-conversation result card, a brief celebration, and a direct link to the goals list.
- Quest handoff chooses one eligible quest and shows its real title and description inside the conversation. Accepting it produces a named result card before the player chooses whether to open that quest.
- Quest availability is checked before the handoff is shown. If no suggested quest is currently eligible, the same answers resolve to a family-specific goal bundle; the UI never promises a quest and then reports that none exists.
- Goal discovery asks about desired change, personal context, friction, and realistic shape. It produces a named goal with a personal explanation and ranked supporting steps; it never asks the player to select an abstract direction or remember a hidden Focus.
- Confirmed Long Memory also receives a visible saved result instead of dropping directly into an ending menu.
- Successful task, Focus, quest, and memory outcomes show lightweight confetti behind the Katchimera image. Reduced-motion preferences disable the particles.
- Form games calculate a match and may equip an already-owned skin. They never unlock a skin.

Ordinary repeatable conversations grant no bond or economy reward. Dedicated journal, goal, quest, and achievement systems retain their existing idempotent rewards.

## Persistence and migration

Every selected beat is persisted immediately with an encounter ID, encounter turn count, target turn count, and unique session ID. Closing and reopening resumes the active node. Completed sessions remain in history but never prevent another encounter that day.

Old active narrative sessions whose graph version no longer matches are archived safely and replaced with a fresh encounter. V6 content storage upgrades additively to V7 with an `insights` collection. Existing memories and sessions remain intact; generated bond/theme labels are not promoted into user insights.

Preview sessions are isolated from production outcomes, Long Memory, Focus, tasks, telemetry, wardrobe, rewards, and recent-content selection.

## Conversation Lab

## Insight games and About You

An `insight_game` contains four to six related authored questions and always ends at an `insight_reveal`. The launch assessments use five questions so the result reflects a pattern rather than one isolated preference. Authored `promptByPriorOptionId` variants let the next question respond directly to the previous answer without destabilising the assessment length. Every answer must contribute to a result, and every result must draw evidence from at least four questions. Result scoring uses stable option IDs; close scores expose a secondary thread instead of hiding an arbitrary tie-break.

The reveal is provisional. It shows the result title, a specific character reflection, a two-to-three sentence summary, and supporting answer labels. The player may replay the questions, dismiss the result, or confirm it. Only confirmation writes a `CompanionInsightRecord` and triggers the emblem celebration. Preview sessions never write records.

Insights use stable slots such as `baristabbit:drink-compass`. A later confirmed result replaces the active value and moves the former result into revision history. The emblem is reflective collection art, not an achievement, reward, or rarity. Confirmed multi-day journal patterns may also create a journal-backed insight; raw journal text is never displayed.

The form-finder game also writes a confirmed `form-match` insight. It records the closest skin, its authored explanation, the runner-up, and the number of choices used. This is an identity reflection only: it never unlocks or equips a skin. Retaking the form finder updates the same insight slot and preserves the former match in history.

**Your insights** opens the unified About You reader. It defaults to all Katchimeras, supports family filters, and renders the authored summary, supporting answers, provenance, update date, prior result history, and a remove control. Bond themes and role labels are not evidence and must never appear as profile conclusions.

In a development build, open a launch-family companion and expand **Conversation Lab**. It exposes all 53 production definitions and identifies openers, insight assessments, contextual memory paths, form games, polls, and action paths. The **Actions** filter isolates goal creation, small-task, and quest-handoff definitions.

Lab previews follow every answer branch through its result. Preview mode may display the intended authored quest even when production eligibility would exclude it, but it never saves outcomes.

## Manual acceptance test

1. Open Baristabbit, Steppling, or Flexel. A character-specific opener should appear automatically.
2. Choose an answer. The original choices should remain interactive, the selection should be highlighted, and Continue should appear below them. Select a different answer and verify the highlight, acknowledgement, and eventual branch all change.
3. Continue. The answer is now committed. The next question must relate to the selected subject; it must not ask a generic meta-question about “that answer.”
4. Verify an insight assessment asks five related questions and produces a saved-insight confirmation with supporting answers. Mixed answers should show a secondary thread. No path should display “Finish this thought.”
5. Revisit immediately and start another conversation. There must be no daily lock.
6. Use **Choose a topic** and verify that the resulting questions remain specific to that Katchimera and subject.
7. Test goal discovery through each of the four opening answers. Verify that context and friction prompts branch, the fourth answer changes the ranked supporting steps, the matched explanation appears in the proposal card, and **View my goals** opens the goals list after confirmation.
8. Test **Choose one small step**. Accept once and verify its exact title appears in an added card with **View all goals**; decline once and verify nothing is added.
9. Test the quest handoff with an eligible quest. It should show one concrete quest before acceptance. After acceptance, verify the exact quest appears in a success card and **View this quest** opens it. Then make the suggested quests ineligible and verify the flow resolves to its authored goal bundle without displaying an empty-quest message.
10. Test Long Memory confirm, edit, browse, reject, and forget.
11. Close during a reply and during a later branch, then reopen. The exact state should resume.

## Automated checks

Run:

```text
npm run typecheck
npm run lint
npm run test:roles
npm run test:kingdom
```

The conversation tests validate pack counts, graph references, the four-to-six-question insight budget, multi-question evidence, secondary results, mandatory reachable outcomes, outcome-class correctness, opener-only cross-definition routing, quest fallbacks, absence of takeaway filler, repeat avoidance, deterministic fictional polls, preview isolation, goal-plan history, and journal evidence routing.
