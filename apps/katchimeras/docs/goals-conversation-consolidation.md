# Goals and conversation consolidation

## Product contract

Focus is no longer a player-facing destination or label. Its useful behaviour remains as a journey-backed **goal plan** inside Goals. The Katchimera dashboard now exposes Quests, Goals, Achievements, Insights, and Skins; Chat remains the primary entry into dialogue.

Legacy `open_focus`, `resume_focus`, questionnaire, and check-in intents are compatibility inputs. They route to Goals or Chat and do not create a separate Focus surface.

## Goals experience

Goals combines three layers:

1. The existing goal plan and its retained journey progress.
2. Concrete quick goals that can be completed, paused, or revisited.
3. A four-question branching conversation that discovers a useful direction from the player's desired change, context, friction, and realistic starting shape.

Journey state is normalised to schema version 4. Existing records are preserved and marked as `kind: 'plan'`; the legacy `isPrimary` field remains temporarily for persisted-state compatibility. `activeGoalPlanForFamily` is the preferred selector for new code.

## Conversation outcome contract

The goal-discovery conversation never begins with abstract goal types. It asks, in order:

1. what the player wants this area of life to give them;
2. where that change matters in their actual life;
3. what is getting in the way;
4. what size or shape feels realistic now.

Every answer changes the authored route. The first answer selects a meaningful direction, context changes the next friction question, friction changes the final framing, and the final answer changes which supporting steps are ranked first.

An authored result resolves to a named goal, a personal explanation, and two or three valid quick-goal templates. The first is the authored best match and starts selected. Before confirming, the player can select or deselect any option. Confirmation adds the selected goals immediately and displays:

- a celebratory result state;
- the exact goal titles that were added;
- a direct **View my goals** action;
- optional **Keep talking** and exit actions.

If a journey-backed plan already exists, it is retained; the player can still add any suggested concrete goals. No goal path is hidden merely because a plan exists.

All conversation definitions share a stricter completion contract: they do not auto-chain after completion and must reach a meaningful outcome. Saved-insight assessments use five questions and evidence from across the flow; there is no short takeaway-card outcome. Goal intent resolves to concrete goals, journal and support facts resolve to optional Long Memory, and quest branches preflight real availability before using an authored family-specific goal fallback.

## First content batch

Baristabbit, Steppling, and Flexel each include:

- three-question form games;
- four five-question authored insight assessments;
- one four-question branching goal-discovery conversation;
- four goal-direction outcomes with context- and friction-responsive dialogue;
- two or three selectable goals at each result;
- coverage of all eight canonical quick-goal templates for the family.

The canonical Baristabbit catalogue uses the `coffee-ritual:*` templates. Skin-specific specialist goal catalogues remain separate content packs and can be added to later conversation batches.

## Authoring rules

- A profile/form game contains exactly three questions. A saved-insight assessment contains four to six related questions; launch assessments use five.
- A one- or two-answer conversation cannot create a saved insight or a ceremonial takeaway card; it may continue naturally, offer Long Memory, or route to an action outcome.
- A `goal_proposal` must reference two or three existing quick-goal templates.
- A launch-family goal-discovery path contains exactly four questions with four concrete answers each.
- Desired change, context, and friction must change the authored dialogue; the realistic-shape answer must change supporting-step ranking.
- Every matched goal includes a plain-language explanation of how the result follows from the conversation.
- The first suggested template must be the strongest match for the branch.
- Prompts describe the actual subject and never ask about an abstract “current Focus.”
- Goal suggestions are optional, concrete, and written as actions.
- Every canonical goal template must be reachable through at least one authored branch.
- Chat never opens with a quest-or-conversation mode gate. A quest handoff follows family-specific questions and appears only as an outcome of meaningful dialogue.
- A quest handoff must define a valid goal fallback; “no matching quest” is never a player-facing outcome.
- Only an opener may route into another definition. Narrative and action definitions resolve inside their own graph.

## Verification

Automated coverage checks verify the four-question branching contract, four distinct direction outcomes per family, personal result explanations, all 24 launch templates, valid goal IDs, selectable multi-goal UI wiring, Goals-owned questionnaire routing, migration to schema version 4, and absence of the old dashboard destination.
