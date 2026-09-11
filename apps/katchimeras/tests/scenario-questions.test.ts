import assert from 'node:assert/strict';
import test from 'node:test';

import { STEPPLING_SCENARIO_POLLS } from '@/constants/steppling-scenario-polls';
import { companionConversationDefinitionById, companionConversationDefinitionsForFamily } from '@/constants/companion-conversations-v2';
import { scenarioJournalEntry, journalSummary } from '@/utils/companion-life';
import {
  answerConversation,
  CONVERSATION_TRAIT_PHRASES,
  continueConversation,
  conversationTraitPortrait,
  conversationTraitTally,
  createConversationSession,
} from '@/utils/companion-conversation';
import type { ConversationDefinition, ConversationSession } from '@/types/companion-conversation';

const GENERIC_REPLY = /might win you over|loyal little corner|less obvious answer/;

function playThrough(definition: ConversationDefinition, pick: (options: readonly { id: string }[]) => string, dayId = '2026-09-11'): ConversationSession {
  let session = createConversationSession({ definition, formId: definition.familyId, dayId, createdAt: 1 });
  for (let guard = 0; session.status === 'active' && guard < 20; guard += 1) {
    if (session.pendingReply !== undefined) { session = continueConversation(session, definition, guard + 2); continue; }
    const node = definition.nodes.find((candidate) => candidate.id === session.currentNodeId)!;
    if (node.kind === 'choice' || node.kind === 'poll') session = answerConversation(session, definition, pick(node.options), guard + 2).session;
    else if (node.kind === 'insight_game' || node.kind === 'profile_game') {
      const question = node.questions[session.gameQuestionIndex] ?? node.questions[0]!;
      session = answerConversation(session, definition, pick(question.options), guard + 2).session;
    } else session = continueConversation(session, definition, guard + 2);
  }
  return session;
}

test('Steppling’s daily questions are scenarios with authored replies, two to five answers, and a trait behind most answers', () => {
  assert.equal(STEPPLING_SCENARIO_POLLS.length, 51);
  assert.equal(new Set(STEPPLING_SCENARIO_POLLS.map((seed) => seed.id)).size, 51);
  for (const seed of STEPPLING_SCENARIO_POLLS) {
    assert.ok(seed.title && seed.title.split(/\s+/).length <= 6, `${seed.id}: card title stays short`);
    assert.ok(seed.prompt.split(/\s+/).length <= 24, `${seed.id}: prompt under 24 words`);
    assert.ok(seed.labels.length >= 2 && seed.labels.length <= 5, `${seed.id}: two to five answers`);
    assert.equal(seed.replies?.length, seed.labels.length, `${seed.id}: a reply per answer`);
    assert.ok(seed.replies!.every((reply) => reply.length > 0 && !GENERIC_REPLY.test(reply)), `${seed.id}: replies are authored`);
    assert.ok(seed.traits!.filter(Boolean).length >= seed.labels.length - 1, `${seed.id}: nearly every answer tags a trait`);
    assert.ok(seed.ending, `${seed.id}: has a closing line`);
    assert.doesNotMatch(seed.prompt, /how organised|rate yourself|on a scale/i, `${seed.id}: no personality-test phrasing`);
  }
  const polls = companionConversationDefinitionsForFamily('steppling').filter((definition) => definition.format === 'poll');
  assert.equal(polls.length, 51);
  for (const definition of polls) {
    const node = definition.nodes.find((candidate) => candidate.kind === 'poll');
    assert.ok(node && node.kind === 'poll');
    assert.ok(node.options.every((option) => option.villageWeight > 0));
    assert.equal(node.options.length, STEPPLING_SCENARIO_POLLS.find((seed) => definition.id.endsWith(`:${seed.id}`))!.labels.length);
  }
  const deeper = companionConversationDefinitionById.get('steppling:poll:dangerous-sentence')!;
  assert.equal(deeper.minimumBondLevel, 2, 'the deeper question waits for a little bond');
});

test('Steppling’s insight games are scenario flows with three results supported by every question', () => {
  const games = companionConversationDefinitionsForFamily('steppling').filter((definition) => definition.format === 'insight_game' && !definition.contextualOnly);
  assert.deepEqual(games.map((definition) => definition.id).sort(), ['steppling:insight:free-day', 'steppling:insight:outside-conditions', 'steppling:insight:setting-out', 'steppling:insight:when-it-goes-wrong']);
  for (const id of ['steppling:insight:setting-out', 'steppling:insight:free-day', 'steppling:insight:when-it-goes-wrong']) {
    const definition = companionConversationDefinitionById.get(id)!;
    const game = definition.nodes.find((node) => node.kind === 'insight_game')!;
    const reveal = definition.nodes.find((node) => node.kind === 'insight_reveal')!;
    assert.ok(game.kind === 'insight_game' && reveal.kind === 'insight_reveal');
    assert.equal(game.questions.length, 5);
    assert.ok(game.questions.every((question) => question.prompt.split(/\s+/).length <= 16 && question.options.length === 3), `${id}: short scenarios, three ways to meet each`);
    assert.equal(reveal.results.length, 3);
    for (const result of reveal.results) assert.equal(result.matchOptionIds.length, 5, `${id}:${result.id} is supported by all five scenarios`);
  }
});

test('Mossprout’s daily questions are scenarios too, with the same ids so their card art and pins hold', () => {
  const daily = companionConversationDefinitionsForFamily('mossprout').filter((definition) => definition.tags?.includes('nature-question'));
  const original = ['cloud-job', 'garden-guests', 'garden-rule', 'outdoor-luxury', 'pocket-expedition', 'suspicious-path', 'tree-neighbour', 'weather-committee'];
  const ids = daily.map((definition) => definition.id.split(':').at(-1)!);
  assert.ok(original.every((id) => ids.includes(id)), 'the original eight keep their ids');
  assert.equal(daily.length, 34, 'eight originals and twenty-six more');
  assert.equal(new Set(daily.map((definition) => definition.actionTitle)).size, 34, 'every card title is distinct');
  for (const definition of daily) {
    const first = definition.nodes.find((node) => node.kind === 'choice' || node.kind === 'poll')!;
    assert.ok(first.kind === 'choice' || first.kind === 'poll');
    assert.ok(/\b(you|your|we)\b/i.test(first.prompt) || /[?…]$/.test(first.prompt.trim()), `${definition.id}: the first prompt puts the player in a scene or asks one clear thing`);
    assert.doesNotMatch(first.prompt, /how organised|rate yourself|on a scale|based on your answers/i, `${definition.id}: no questionnaire phrasing`);
    assert.ok(first.options.length >= 2 && first.options.length <= 5, `${definition.id}: two to five answers`);
    assert.ok(first.options.every((option) => option.traits && Object.keys(option.traits).length > 0), `${definition.id}: every first answer tags a trait`);
    if (first.kind === 'poll') assert.ok(first.options.every((option) => option.villageWeight > 0), `${definition.id}: village weights cover every answer`);
  }
  const insight = companionConversationDefinitionById.get('mossprout:insight:nature-connection')!;
  const game = insight.nodes.find((node) => node.kind === 'insight_game')!;
  assert.ok(game.kind === 'insight_game');
  assert.match(game.questions[0]!.prompt, /free afternoon/);
  assert.deepEqual(game.questions[0]!.options.map((option) => option.id), ['calm-arrival', 'curious-arrival', 'care-arrival'], 'option ids are unchanged, so results still resolve');
});

test('answers tally into a trait portrait, and each scenario answered becomes a journal entry', () => {
  const path = companionConversationDefinitionById.get('steppling:poll:unmapped-path')!;
  const box = companionConversationDefinitionById.get('steppling:poll:sealed-box')!;
  const garden = companionConversationDefinitionById.get('mossprout:conversation:nature-question:garden-guests')!;
  const sessions = [
    playThrough(path, (options) => options[0]!.id),          // halfway down it: spontaneity 2, curiosity 1
    playThrough(box, (options) => options[0]!.id),           // open immediately: spontaneity 2
    playThrough(garden, (options) => options[0]!.id),        // whoever's nearest: social 2, then freedom: solitude 2
  ];
  assert.ok(sessions.every((session) => session.status === 'completed'));
  const tally = conversationTraitTally(sessions, companionConversationDefinitionById);
  assert.equal(tally.spontaneity, 4);
  assert.equal(tally.curiosity, 1);
  assert.equal(tally.social, 2);
  assert.equal(tally.solitude, 2);
  assert.deepEqual(conversationTraitPortrait(tally), ['jumps in', 'likes company', 'likes their own company']);
  assert.deepEqual(conversationTraitPortrait({}), []);
  assert.ok(Object.values(CONVERSATION_TRAIT_PHRASES).every((phrase) => phrase.length > 0 && phrase === phrase.toLowerCase()), 'phrases read inside a sentence');

  const entry = scenarioJournalEntry(sessions[0]!, path)!;
  assert.ok(entry);
  assert.equal(entry.id, 'answer:steppling:poll:unmapped-path:2026-09-11', 'one entry per question per day');
  assert.equal(entry.familyId, 'steppling');
  assert.equal(entry.title, 'A path not on the map');
  assert.equal(entry.kind, 'conversation');
  assert.match(journalSummary(entry), /You chose “👀 I’m already halfway down it”\. Halfway down already\./);
  assert.match(entry.facts.noticed!, /^Steppling noticed: jumps in, wants to know\.$/);

  const gardenEntry = scenarioJournalEntry(sessions[2]!, garden)!;
  assert.equal(Object.keys(gardenEntry.facts).length, 3, 'both answers of a two-question scenario, plus what was noticed');
  assert.match(gardenEntry.facts.noticed!, /^Mossprout noticed: /);

  // Previews and unfinished sessions never reach the journal; a question without trait tags is not a scenario.
  assert.equal(scenarioJournalEntry({ ...sessions[0]!, preview: true }, path), null);
  assert.equal(scenarioJournalEntry({ ...sessions[0]!, status: 'active' }, path), null);
  const plain = companionConversationDefinitionById.get('flexel:poll:start')!;
  assert.equal(scenarioJournalEntry(playThrough(plain, (options) => options[0]!.id), plain), null);
});

test('answers carry an emoji for the eye and a plain spoken form for the voice and transcript', () => {
  const path = companionConversationDefinitionById.get('steppling:poll:unmapped-path')!;
  const poll = path.nodes.find((node) => node.kind === 'poll')!;
  assert.ok(poll.kind === 'poll');
  assert.equal(poll.options[0]!.label, '👀 I’m already halfway down it');
  assert.equal(poll.options[0]!.spokenText, 'I’m already halfway down it');
  for (const family of ['steppling', 'mossprout'] as const) {
    for (const definition of companionConversationDefinitionsForFamily(family)) {
      if (!(definition.format === 'poll' || definition.tags?.includes('nature-question') || ['steppling:insight:setting-out', 'steppling:insight:free-day', 'steppling:insight:when-it-goes-wrong', 'mossprout:insight:nature-connection'].includes(definition.id))) continue;
      if (definition.contextualOnly) continue;
      for (const node of definition.nodes) {
        const options = node.kind === 'choice' || node.kind === 'poll' ? node.options : node.kind === 'insight_game' ? node.questions.flatMap((question) => question.options) : [];
        for (const option of options) {
          assert.ok(option.spokenText && !/^[A-Za-z“]/.test(option.label) && /^[A-Za-z“]/.test(option.spokenText), `${definition.id}:${node.id}:${option.id} has an emoji label and a plain spoken form`);
        }
      }
    }
  }
});
