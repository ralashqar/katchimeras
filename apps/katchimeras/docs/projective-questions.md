# Projective questions and Mossprout's theory of you

Status: built for Mossprout and Steppling, Sept 11, 2026. The other families still use the
older preference polls ("Choose the pace.") and questionnaire-style insight games.

## The idea

A katchimera's daily question should feel like a tiny fantasy prompt or a small social
dilemma, never a personality test. The player learns something about themselves almost by
accident. Underneath, each answer measures one or two things: spontaneity, planning,
curiosity, caution, social energy, rest, making, ambition, resilience, overthinking,
optimism, routine, novelty, avoidance, and how they support a friend.

Rules the content follows (and `tests/scenario-questions.test.ts` enforces):

- The prompt puts the player in a scene or asks one clear thing: "A path off the trail isn't
  on the map." "Which mistake bothers you more?"
- Two to five answers, each a thing you would do or feel, never a rating. Forced choices
  with two answers are welcome; they are fast and revealing.
- Every answer starts with an emoji for the eye and carries a plain `spokenText` for the
  voice and the transcript (`spokenAnswerText` in `utils/companion-conversation.ts` derives it).
- The friend replies to each answer in their own voice, one or two lines, never grading it.
- Nearly every answer carries `traits` (one or two, weighted 1 or 2). See
  `ConversationTraitId` in `types/companion-conversation.ts`.
- No "how organised are you", no "on a scale of", no filler ("based on your answers").
- A few deeper questions wait for bond level two ("Which sentence is most dangerous for you?").

## Where the content lives

| Pool | File | Shape |
| --- | --- | --- |
| Steppling daily polls (51: 47 scenarios, 4 forced choices) | `constants/steppling-scenario-polls.ts` | `ConversationPollSeed`: prompt, short title, labels, replies, traits, ending, optional bond |
| Steppling insight games (3 scenario flows + the existing conditions game) | `constants/companion-insight-conversations.ts` (`scenarioFlow`) | five scenarios, three ways to meet each, three results |
| Mossprout daily questions (34: the original eight rewritten, plus 26) | `constants/mossprout-story-conversations.ts` (`mossproutNatureQuestions`, `mossproutScenarioQuestions`) | fictional polls and two-question narratives; the original ids are unchanged so card art and pins hold; new ids map to existing card art in `game/katchimeras/mossprout-home.ts` |
| Mossprout insight game | same file, `mossproutNatureInsight` | three scenarios, option ids unchanged |
| "Mossprout thinks he knows you" (17) | `constants/mossprout-theory-conversations.ts` from `MOSSPROUT_THEORY_OBSERVATIONS` | one observation, three answers: very me / sometimes / not really |
| First-session questions | `features/onboarding/mossprout-ftue-copy.ts`, `mossprout-ftue-script.ts`, `mossprout-bond-share.ts`, `mossprout-first-grow.ts` | the Egg's five questions, the energy reflection, the Bond questions and the first notice are scenes now ("If today were weather over this garden, what was it?", "Four paths lead off into the Mist. Which one do you take?", "Quick, before the Mist notices. What's one thing near you it would love you to forget?"). Ids unchanged; these options keep their icons instead of emoji. |

The generic poll builder in `constants/companion-conversations-v2.ts` accepts the seed shape
above for any family: authored replies and endings when present, generic ones otherwise, and
village weights for two to five answers.

## What the answers become

- **A fictional village poll**, as before: who in the Haven answered what.
- **A trait tally** (`conversationTraitTally`, `utils/companion-conversation.ts`): every
  answered turn with `traits` adds to a per-player tally. Never shown as a score.
- **A journal entry per answered scenario** (`scenarioJournalEntry`, `utils/companion-life.ts`):
  the question, what the player chose, the friend's reply, and a "noticed" line ("Steppling
  noticed: jumps in, wants to know."). One entry per question per day. Written when the
  conversation completes (`recordScenarioAnswer`) and backfilled when the Journal opens.
- **A "who you are, so far" line** at the top of the Journal
  (`conversationTraitPortrait`): the player's three strongest habits, in plain words.

## Mossprout's theory of you (`utils/companion-theory.ts`)

Not hundreds of tags. `theoryOfYou(tally)` reads a small set of dimensions off the tally:

| Dimension | Runs from … to | Read from |
| --- | --- | --- |
| starting | deliberate ↔ spontaneous | planning vs spontaneity |
| progress | small and steady ↔ bursts | routine + planning vs ambition + spontaneity |
| difficulty | process first ↔ problem-solve | overthinking + rest vs resilience + support_fix |
| risk | security ↔ exploration | caution + routine vs novelty + curiosity + spontaneity |
| selfExpectation | perfectionistic ↔ forgiving | overthinking vs optimism + resilience |
| social | independent ↔ collaborative | solitude vs social + listening + cheering |
| recovery | rest ↔ activity | rest + solitude vs making + ambition |

Plus the **primary reward** (achievement, connection, calm, novelty, creativity), the **common
friction** (starting, consistency, overwhelm, focus, energy, completion) and the **style**
Mossprout should take (gentle, practical, challenging, humorous, companion). An axis stays at
zero until there are three points between its two sides.

**Observations** combine several answers rather than parroting one back. Each has a condition
over the theory and a line in Mossprout's voice, for example "You notice what's unfinished
before you notice how far you've come." and "I think you're quite good at growing things.
Your problem might be planting too many at once."

**The moment.** Once bond is two and at least eight tagged answers are in, the Kingdom's
Mossprout card puts "Mossprout thinks he knows you" first (`nextMossproutTheory`, wired in
`hooks/use-kingdom-quests.ts`). He says the observation; the player answers *That's very me /
Sometimes / Not really*. One a day. The answer is evidence: a "not really" retires that
observation and quiets others about the same thing until six more tagged answers arrive. Both
halves go in the journal.

**Behaviour.** `mossproutNudge(theory, plain)` wraps a suggestion in the style the answers
earned: "I have an idea. You're allowed to ignore it." for the gentle, "I'm not giving you
three things. Pick one." for the practical, "I don't think you'll actually do this one." for
those who rise to a challenge, and "No. One seed." for the overcommitter. It is not yet called
from a live surface; the daily habit offer and the quick-goal suggestions are the natural first
callers.

## Where Steppling asks

Steppling's card row (`components/katchadeck/world/steppling-actions.tsx`) used to serve the four
legacy trail chats ("Pick a pocket adventure"); it now serves the scenario polls, one per day, each
coming back once a fortnight has passed since it was answered. The trail chats remain registered but
are no longer offered from the card.

## Reading everything

The developer page **Question Lab** (Explore → developer tools → Question Lab, route
`/dev-question-lab`) lists every daily question per family, stepped one at a time or all at
once, with each answer's reply, trait tags and village weight, plus insight-game questions and
results.

## Adding a question

Add a `seed(...)` to the Steppling file, or a `naturePoll({...})` to the Mossprout list (a new
Mossprout id gets an entry in `MOSSPROUT_CONVERSATION_ART` mapping to an existing icon, or it
falls back to the generic fun-chat art). Keep the prompt under 24 words and labels under 8
spoken words, give every answer an emoji, a reply and a trait, and run
`tests/scenario-questions.test.ts` and `tests/companion-theory.test.ts`.

## What is next

- Call `mossproutNudge` from the habit offer and quick-goal suggestions so the profile changes
  how he talks, not only what he says he knows.
- Bond-milestone unlocks: hold a few observations back for bond three and four so "Mossprout
  thinks he knows you" is one of the rewards for growing the bond, alongside the secret hexes.
- Steppling's own theory, and the other families' pools in the same shape.
