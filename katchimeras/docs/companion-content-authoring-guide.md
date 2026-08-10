# Companion Content Authoring Guide

Status: Steppling is the reference implementation. Use this guide to move each
remaining companion from modular fallback copy to a fully authored content set.

Batch status and family-specific risk briefs are tracked in
[`companion-editorial-rollout.md`](./companion-editorial-rollout.md).

## Speech-bubble copy budget

Questionnaire prompts and companion questions share a compact speech
bubble above the answer panel. Keep the prompt at or below 80 characters, its
helper text at or below 120 characters, and both together at or below 170
characters. Put nuance into answer choices, later questions, or quest guidance
instead of building one dense bubble. Repository validation rejects content
that exceeds these limits.

The UI also measures the rendered bubble. If wrapping, screen size, or Dynamic
Type makes it taller than its normal footprint, the scrollable answer panel is
pushed down by the exact overflow rather than being covered.

## Product and audience

Katchimeras is a local-first consumer wellbeing and life-reflection product. It
is not a clinician, therapist, fitness coach, diagnostic tool, or habit tracker.
The companion should help a person notice their life, try something small, and
decide what fits without turning ordinary days into a performance.

Write for a broad adult audience, including people who:

- have little time or attention;
- speak English as an additional language;
- are neurodivergent or have cognitive or learning disabilities;
- have changing energy, health, mobility, or access;
- enjoy goals but do not want to be judged by them;
- may use VoiceOver or hear the options read without the visual layout.

The target reading experience is warm and characterful, but immediately clear.
The user should not need to decode a metaphor to answer a question.

## The companion's job

Every companion needs one precise life-area boundary and one emotional job.

Steppling's boundary is everyday walking. It does not own running, gym training,
hiking achievement, or competitive exercise. Its emotional job is to make
walking easier to notice and understand without pressuring the user to do more.

Define these before writing:

1. **Life area:** What real part of life does this companion notice?
2. **Boundary:** Which nearby behaviours belong to another companion?
3. **User benefit:** What should become clearer or easier?
4. **Character voice:** How does the companion feel without becoming a coach?
5. **Pressure risk:** How could this subject make a user feel judged, excluded,
   unsafe, or inadequate?

Steppling's voice is **bright, observant, practical, and pressure-free**. It can
be delighted by a route or small moment. It must not celebrate a step total as a
measure of character.

## Voice layers

Keep three layers distinct.

### Character voice

Use a light touch in titles, invitations, and helper text. Character voice may
add warmth or a point of view: “Keep one detail” or “Find where it fits.”

### Question voice

Questions must be plain, literal, and answerable. Prefer “What made walking
harder today?” over “Where did momentum lose its spark?”

### System voice

Permissions, evidence requirements, errors, safety instructions, progress, and
completion criteria must be direct. Never hide a requirement inside character
language.

## Content architecture

Each fully authored Journey companion currently needs:

- one three-question Focus questionnaire;
- one default daily check-in;
- 12 daily pulses;
- 4 progress reviews;
- 4 return conversations;
- 3 bond moments: Familiar, Devoted, and Kindred;
- 8 quick-goal presets;
- a real-life quest ladder and at least one mini-game where supported;
- 3 honest presentation variants for each repeatable real-life quest.

The daily selector persists one invitation per companion and local day. Its
priority is unfinished quest, unfinished Focus conversation, missing Focus,
new bond moment, due progress review, quest lane, then rotating content.

Do not write any item in isolation. Read it in the state that selects it and in
the three-question check-in that follows it.

## First meeting and companion voice

The old invitation panel is not part of the player-facing experience. The first
ordinary visit to a logical companion family begins a short introduction in the
companion page itself. A direct quest or camera-return route bypasses it.

The introduction has three beats:

1. The companion introduces itself in first person and asks the first Focus
   preference question.
2. The player chooses how they want support: gentle, practical, pattern-led, or
   only when requested.
3. The companion confirms what it will remember and offers an optional handoff
   into Focus. That handoff reuses the first answer; it must not ask it again.

Write companion-owned speech in first person: “I can remember that” and “How
would you like me to help?” Avoid “Steppling will remember that” or “How should
Steppling use this?” Navigation, task criteria, permissions, and system status
remain neutral system language.

Introduction copy belongs to a logical family, not a skin. A newly equipped
skin may acknowledge its form in one line, but it must not repeat the full
introduction or reset preferences. Leaving the introduction stores a deferred
state and exposes a manual **Meet [Name]** action under **You**; it must not
automatically reopen. After fourteen days away, use one warm return line with
no guilt, absence count, catch-up demand, or blocking questionnaire.

Keep each introduction bubble within the same mobile budget as other companion
speech. The greeting must name the life area plainly, state the companion’s
role without making therapeutic claims, and avoid promising adaptation the
system cannot provide.

## Questionnaire model

The Focus questionnaire should move through three different decisions:

1. **Meaning:** What does the user want from this part of life?
2. **Fit:** Where or how could it work in the user's real circumstances?
3. **Experiment:** What small direction would they like to try?

Do not ask the same underlying question three times. Each answer should narrow
the next decision or improve the resulting Focus.

### Question rules

- Ask one thing at a time.
- Use the user's present reality, not an ideal future self.
- Prefer “could”, “would”, and “what fits” to “should” and “must”.
- Keep a question under 20 words where possible.
- Keep helper text to one or two short sentences.
- Explain why an answer matters when the connection is not obvious.
- Never claim personalisation that the implementation does not perform.
- Never promise that an answer can be edited unless an edit path exists.

### Answer rules

Use four or five options for ordinary single-choice questions. Three options can
work for a narrow decision. More than five needs a strong reason.

Every option must:

- directly answer the exact question;
- represent one idea, not two choices joined together;
- be meaningfully different from the other options;
- use a consistent grammatical form;
- make sense when read aloud after the question;
- avoid implying that one answer is morally better;
- include “not sure”, “none”, “not today”, or a pause when that is a plausible
  and useful state.

Run the **question-plus-answer test** on every option:

> Question: What made walking harder today?
>
> Answer: My body needed rest.

This is coherent. By contrast:

> Question: What should Steppling understand about you?
>
> Answer: It felt mixed.

This fails because the answer belongs to a different question.

Do not rely on a generic answer set merely because it is grammatically valid.
The option must provide useful information for this prompt.

## Daily pulses

A daily pulse should take little effort and yield one useful observation. Across
12 items, cover different lenses rather than paraphrasing the same question:

1. what happened;
2. where or when it fitted;
3. the after-effect;
4. what helped;
5. what made it difficult;
6. one concrete detail;
7. what would suit the next few days;
8. comfort, pace, or intensity where relevant;
9. what makes returning easier;
10. an emerging pattern;
11. what is worth keeping;
12. what should become kinder, smaller, or more flexible.

The first six should work at New bond. Later prompts can ask for comparison or
pattern recognition, but higher bond must not simply mean more demanding goals.

The shared check-in currently follows a non-bond content question with:

1. the authored question;
2. “How did that affect [Focus]?”;
3. an appropriate next step.

Author the first question and answers so “that” has a clear referent. If a
content type needs a fundamentally different follow-up, add a typed flow rather
than forcing it through the generic effect question.

## Progress reviews and return conversations

A progress review asks what the user learned from several moments. It is not a
score and should never reduce the week to completion counts.

Across four reviews, cover what supported the experience, what changed, what
would make the Focus more realistic, and what should carry forward.

A return conversation checks whether an earlier choice still applies. Its
answers must match its specific subject. A question about a barrier cannot reuse
answers about whether a goal “still fits.” Across four returns, check the Focus,
the underlying reason, the original barrier, and the next status.

Earlier answers are not wrong when life changes. Say this plainly, without
anthropomorphising memory beyond what the app actually stores.

## Bond moments

Bond content represents a changing relationship, not increasing difficulty.

- **Familiar:** ask how the user wants the companion to support them.
- **Devoted:** ask what the user has learned or noticed.
- **Kindred:** ask what is worth carrying into the future.

Bond questions use a dedicated three-question flow. The follow-ups ask why the
choice matters and how the companion should use it. The stored preference is
guidance, not a rule.

Avoid relationship claims the system cannot support. Do not say the companion
“knows exactly”, “understands everything”, or will always adapt perfectly.

## Wellness and inclusion rules

### Preserve autonomy

- Companion conversations are optional.
- Leaving an introduction or check-in must remain non-destructive.
- Continuing, changing, pausing, and completing are all valid.
- Do not use guilt, streak anxiety, loss framing, or fear of disappointing the
  companion.

### Avoid moralising

Do not use “good”, “bad”, “lazy”, “failed”, “earned”, or “deserved” to describe
a body, mood, day, meal, relationship, or amount of activity. “Complete” can
describe a game state; it must not judge the person.

### Do not prescribe or diagnose

Use subjective reflection: “What did you notice?” Do not infer a condition,
promise a health outcome, prescribe treatment, or tell a user to push through
pain, fatigue, distress, or physical limits.

If pain, discomfort, low energy, limited mobility, or rest is relevant, allow it
as a valid answer. The product can reflect it but must not interpret it
clinically.

### Be honest about physical activity

Any amount of movement can matter. A tracked threshold is an optional game rule,
not the definition of a walk that “counts.” State the exact threshold before the
user accepts. Add “if it suits you” where a physical challenge may not fit every
body or day.

For time trials and live movement:

- tell the user to choose a clear, safe place;
- use “a pace that feels safe”;
- do not ask users to multitask in ways that reduce awareness;
- use neutral retry language;
- distinguish sensor limitations from user performance.

### Respect different lives

Do not assume access to safe outdoor space, money, equipment, transport, a
supportive household, conventional work hours, or another person. Avoid making
company, weather, location, or schedule sound universally controllable.

## Plain-language and accessibility rules

- Use common words, short sentences, simple tense, and active voice.
- Prefer literal language in questions and instructions.
- Aim to split sentences longer than 25 words.
- Avoid double negatives, nested clauses, idioms, and unexplained abbreviations.
- Put the important distinction near the start of each option.
- Do not make colour, emoji, or icon the only source of meaning.
- Read every screen aloud. The question, helper, options, progress, and action
  should make sense in that order without relying on visual position.
- Keep repeated interface terms stable: **conversation**, **Focus**, **quest**,
  **quick goal**, **pause**, and **complete**.

These rules follow the W3C guidance to use understandable words, short
sentences, simple tense, short blocks, and unambiguous labels; GOV.UK's guidance
to use plain English and split sentences over 25 words; and NHS guidance to use
positive, non-labelling language.

## Quest writing

Every quest has three separate pieces of copy:

1. **Title:** the invitation or memorable activity name.
2. **Hint:** the complete user-facing requirement before acceptance.
3. **Evidence contract:** the exact condition used to verify completion.

The hint and evidence contract must describe the same activity. Never say “beat
your recent average” when the code checks a fixed number. Never ask for a new
detail when a tracked step-count quest cannot collect one.

Each repeat variant must preserve the same evidence type, threshold, safety
boundary, Journey contribution, and effort range. Vary the lens, not the
contract. Reflection variants can vary a sensory detail, comparison, or
after-effect. Tracked-threshold variants can vary how the steps build, but every
variant must state the threshold.

Retry copy should say what is missing and how to fix it. Do not blame the user
or call their evidence poor. Distinguish “the app could not verify this” from
“you did not do this.”

## Quick goals

A quick goal should be one small, observable action. Use a verb first and keep
the title short enough to scan in a list.

Avoid vague goals such as “make room for movement” when the intended action is a
short walk. Avoid unsafe combinations such as walking while handling an
attention-heavy call. Use “before or after” when combining activities is not
necessary. Cadence is a schedule setting, not a streak promise.

## Writing goal-discovery conversations

Goal discovery is a short planning conversation, not a category picker and not an insight assessment. The launch-family contract is four questions:

1. desired change;
2. personal context;
3. real friction;
4. realistic starting shape.

Offer four literal, specific answers at each step. Context must change the friction prompt, friction must change the final framing, and starting shape must change the ranked supporting steps. Finish with a named goal, a short explanation grounded in the conversation, and two or three existing quick-goal templates. Do not show or mention Focus, ask the player to diagnose a goal type, or save planning intent as an insight.

## Implementation and migration

## Writing insight outcomes

Insight games are coherent self-discovery conversations, not a stack of unrelated preference questions. Write four to six questions that explore one named theme from different angles; the launch standard is five. Every option must answer the visible question literally and contribute to a known result family. Each result must be supported by options across at least four separate questions.

Each result requires:

- a concrete, memorable title that does not rank the player;
- a Katchimera reflection grounded in what the answers actually imply;
- a two-to-three sentence summary explaining the pattern in everyday language;
- a stable emblem ID and stable insight key;
- explicit matching option IDs.

Do not use shared endings such as “What would you like to do with that answer?”, generic personality praise, clinical language, fake certainty, or unverified claims. Prefer “You told Baristabbit…” for direct answers and “Across several recorded days…” for journal evidence. Never expose raw journal text on an insight card.

Casual dialogue and fictional polls stay conversational; neither earns an insight emblem or a ceremonial completion card. Action intent routes to a goal or quest rather than becoming an identity claim. A single journal callback may offer explicit Long Memory, while a journal-backed insight needs evidence from at least three distinct recorded days and explicit confirmation. A changed result updates its existing slot and preserves history rather than creating contradictory cards. Close assessment scores should expose a secondary thread rather than pretending the leading result is absolute.

Reference files:

- `constants/steppling-companion-content.ts` — fully authored reference pack;
- `constants/companion-introductions.ts` — first-meeting and return copy;
- `constants/companion-content.ts` — catalogue assembly and fallback generator;
- `constants/companion-journeys.ts` — Focus questionnaire and Journey copy;
- `constants/companion-quick-goals.ts` — quick-goal labels;
- `utils/quests/definitions.ts` — quest, evidence, retry, and variant copy;
- `utils/companion-check-in.ts` — shared follow-up questions;
- `utils/companion-content.ts` — introduction, visit, and rotating-content state;
- `utils/companion-journey.ts` — persisted Journey migration.

When changing a Focus questionnaire:

1. keep stable node and option IDs when the meaning remains compatible;
2. increment the Journey version;
3. migrate old system-generated goal titles;
4. do not rewrite custom user text;
5. refresh unfinished authored check-ins when prompts or answers changed;
6. preserve completed history.

Retain a content ID for an editorial correction to the same question. Use a new
ID when a question measures a different idea, so memory and cooldown history
remain meaningful.

## Editorial workflow for each companion

1. Inventory every visible string by screen and state.
2. Write the life-area boundary, emotional job, voice, and pressure risks.
3. Rewrite the three-question Focus from meaning to fit to experiment.
4. Write 12 distinct daily pulses with bespoke answers.
5. Write four reviews, four returns, and three bond moments.
6. Audit quick goals for clarity, safety, accessibility, and cadence.
7. Audit every quest title, hint, evidence rule, retry, and repeat variant.
8. Read each question with every answer aloud.
9. Run the content and Journey tests.
10. Review the screens on a small device and with a screen reader.

## Release checklist

A companion is ready only when all answers are yes.

- Does every answer directly answer its question?
- Are the 12 pulses genuinely distinct?
- Can the user say no, not today, not sure, or pause where appropriate?
- Does higher bond deepen reflection without increasing pressure?
- Do quest hints exactly match evidence checks?
- Do repeat variants remain valid for the same evidence contract?
- Are thresholds and permissions stated before commitment?
- Is rest, discomfort, or a changed circumstance treated without judgement?
- Are claims limited to what the product records and does?
- Are sentences short, literal, and understandable when read aloud?
- Are stable IDs, versions, and migrations handled?
- Have automated tests and device-level content review passed?

## Reference guidance

- [W3C: Use clear and understandable content](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/)
- [W3C: Labels or instructions](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html)
- [GOV.UK: Use clear language](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)
- [NHS: Inclusive content for disabilities and conditions](https://service-manual.nhs.uk/content/inclusive-content/disabilities-and-conditions)
- [WHO: Physical activity](https://www.who.int/news-room/fact-sheets/detail/physical-activity)

The WHO guidance says that any amount of physical activity is better than none
and that all physical activity counts. Katchimeras should reflect that principle
without turning public-health recommendations into personalised medical advice.
