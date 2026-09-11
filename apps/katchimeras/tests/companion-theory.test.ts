import assert from 'node:assert/strict';
import test from 'node:test';

import { companionConversationDefinitionById, companionConversationDefinitionsForFamily } from '@/constants/companion-conversations-v2';
import { MOSSPROUT_THEORY_TITLE, mossproutTheoryConversationDefinitions } from '@/constants/mossprout-theory-conversations';
import { scenarioJournalEntry, journalSummary } from '@/utils/companion-life';
import { answerConversation, continueConversation, createConversationSession, validateConversationDefinitions } from '@/utils/companion-conversation';
import {
  MOSSPROUT_THEORY_OBSERVATIONS, mossproutNudge, nextMossproutTheory, THEORY_MIN_EVIDENCE, theoryConfirmations, theoryDefinitionId, theoryOfYou,
} from '@/utils/companion-theory';
import type { ConversationDefinition, ConversationSession } from '@/types/companion-conversation';

function complete(definition: ConversationDefinition, optionIndex: number, dayId: string, createdAt: number): ConversationSession {
  let session = createConversationSession({ definition, formId: definition.familyId, dayId, createdAt });
  for (let guard = 0; session.status === 'active' && guard < 12; guard += 1) {
    if (session.pendingReply !== undefined) { session = continueConversation(session, definition, createdAt + guard + 1); continue; }
    const node = definition.nodes.find((candidate) => candidate.id === session.currentNodeId)!;
    if (node.kind === 'choice' || node.kind === 'poll') session = answerConversation(session, definition, node.options[Math.min(optionIndex, node.options.length - 1)]!.id, createdAt + guard + 1).session;
    else session = continueConversation(session, definition, createdAt + guard + 1);
  }
  assert.equal(session.status, 'completed', definition.id);
  return session;
}

test('the theory reads a few dimensions off the tally and stays silent until there is enough on both sides', () => {
  const empty = theoryOfYou({});
  assert.equal(empty.evidence, 0);
  assert.deepEqual(Object.values(empty.axes), [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(empty.reward, null);
  assert.equal(empty.friction, null);
  assert.equal(empty.style, 'gentle');

  const deliberate = theoryOfYou({ planning: 6, spontaneity: 1, avoidance: 4, overthinking: 3, ambition: 2, rest: 1 });
  assert.ok(deliberate.axes.starting < -0.3, 'plans first');
  assert.equal(deliberate.friction, 'starting');
  assert.ok(deliberate.axes.selfExpectation < 0, 'notices the unfinished first');

  const explorer = theoryOfYou({ novelty: 5, curiosity: 3, spontaneity: 3, caution: 1, social: 4, rest: 4, solitude: 1, making: 0 });
  assert.ok(explorer.axes.risk > 0.4);
  assert.equal(explorer.reward, 'novelty');
  assert.ok(explorer.axes.recovery < -0.3, 'rests to recover');
  assert.ok(explorer.axes.social > 0.2);

  assert.equal(theoryOfYou({ support_fix: 3, planning: 2 }).style, 'practical');
  assert.equal(theoryOfYou({ support_cheer: 3 }).style, 'humorous');
  assert.equal(theoryOfYou({ ambition: 4, resilience: 4 }).style, 'challenging');
});

test('every observation is a registered, valid confirmation conversation in Mossprout’s voice', () => {
  assert.equal(mossproutTheoryConversationDefinitions.length, MOSSPROUT_THEORY_OBSERVATIONS.length);
  assert.deepEqual(validateConversationDefinitions(mossproutTheoryConversationDefinitions), []);
  for (const observation of MOSSPROUT_THEORY_OBSERVATIONS) {
    const definition = companionConversationDefinitionById.get(theoryDefinitionId(observation.id));
    assert.ok(definition, observation.id);
    assert.equal(definition.title, MOSSPROUT_THEORY_TITLE);
    assert.ok(definition.contextualOnly && definition.repeatPolicy === 'once_ever' && definition.minimumBondLevel === 2);
    const confirm = definition.nodes.find((node) => node.id === 'confirm');
    assert.ok(confirm && confirm.kind === 'choice');
    assert.deepEqual(confirm.options.map((option) => option.id), ['very_me', 'sometimes', 'not_really']);
    assert.match(confirm.prompt, /^I think I’ve figured something out about you\.\n\n/);
    assert.ok(observation.text.length <= 220, `${observation.id} is one or two sentences`);
    assert.doesNotMatch(observation.text, /based on your answers|personality|assessment/i);
  }
  assert.equal(new Set(MOSSPROUT_THEORY_OBSERVATIONS.map((observation) => observation.id)).size, MOSSPROUT_THEORY_OBSERVATIONS.length);
  // Never served from a pool: the Kingdom offers it deliberately.
  assert.ok(companionConversationDefinitionsForFamily('mossprout').filter((definition) => definition.tags?.includes('theory')).every((definition) => definition.contextualOnly));
});

test('Mossprout says what he thinks only after bond and evidence, one a day, and a “not really” quiets that topic for a while', () => {
  const definitions = companionConversationDefinitionById;
  const path = definitions.get('mossprout:conversation:nature-question:suspicious-path')!;
  const idea = definitions.get('mossprout:conversation:nature-question:huge-thing')!;
  const trouble = definitions.get('mossprout:conversation:nature-question:most-trouble')!;
  const weed = definitions.get('mossprout:conversation:nature-question:tiny-weed')!;
  // A deliberate starter who finds starting hardest: plans first, checks first, sees the weed.
  const sessions = [
    complete(path, 1, '2026-09-01', 10), complete(idea, 1, '2026-09-02', 20), complete(trouble, 0, '2026-09-03', 30),
    complete(weed, 0, '2026-09-04', 40), complete(idea, 1, '2026-09-05', 50), complete(trouble, 0, '2026-09-06', 60), complete(trouble, 0, '2026-08-31', 5),
  ];
  const base = { sessions, definitions, bondLevel: 2, dayId: '2026-09-07' };
  assert.ok(theoryOfYou(Object.fromEntries([])).evidence === 0);
  assert.equal(nextMossproutTheory({ ...base, bondLevel: 1 }), null, 'not before bond two');
  const offered = nextMossproutTheory(base);
  assert.ok(offered, 'enough evidence to say something');
  assert.ok(offered.theory.evidence >= THEORY_MIN_EVIDENCE);
  assert.equal(offered.observation.id, 'start-line');
  assert.equal(offered.definitionId, 'mossprout:theory:start-line');

  // The player says "not really": that observation is done, and nothing else about starting is offered until more evidence lands.
  const theoryDefinition = definitions.get(offered.definitionId)!;
  const denied = complete(theoryDefinition, 2, '2026-09-07', 70);
  assert.equal(theoryConfirmations([...sessions, denied]).get('start-line')?.answer, 'not_really');
  assert.equal(nextMossproutTheory({ ...base, sessions: [...sessions, denied] }), null, 'one a day');
  const next = nextMossproutTheory({ ...base, sessions: [...sessions, denied], dayId: '2026-09-08' });
  assert.ok(!next || next.observation.about !== 'starting', 'starting is quiet after a not really');

  // The exchange goes in the journal, both halves.
  const entry = scenarioJournalEntry(denied, theoryDefinition)!;
  assert.ok(entry);
  assert.equal(entry.id, 'theory:mossprout:theory:start-line');
  assert.match(journalSummary(entry), /Mossprout said: “I think you’re better at keeping things going/);
  assert.match(journalSummary(entry), /You said “Not really”\./);

  // Confirmed instead: it stays confirmed and the next observation can follow on another day.
  const confirmed = complete(theoryDefinition, 0, '2026-09-07', 70);
  assert.equal(theoryConfirmations([...sessions, confirmed]).get('start-line')?.answer, 'very_me');
  const after = nextMossproutTheory({ ...base, sessions: [...sessions, confirmed], dayId: '2026-09-08' });
  assert.notEqual(after?.observation.id, 'start-line');
});

test('once he has a theory, Mossprout puts nudges the way the answers earned', () => {
  const plain = 'One thing outside today.';
  assert.equal(mossproutNudge(theoryOfYou({}), plain), plain, 'no theory, no style');
  const gentle = theoryOfYou({ support_listen: 4, rest: 4, planning: 2 });
  assert.match(mossproutNudge(gentle, plain), /^I have an idea\. You’re allowed to ignore it\./);
  const challenging = theoryOfYou({ ambition: 6, resilience: 4, novelty: 2 });
  assert.equal(challenging.friction, 'completion');
  assert.match(mossproutNudge(challenging, plain), /^No\. One seed\./, 'overcommitters get one seed');
  const practical = theoryOfYou({ support_fix: 5, planning: 4, routine: 2 });
  assert.match(mossproutNudge(practical, plain), /^I’m not giving you three things\. Pick one\./);
});
