import assert from 'node:assert/strict';
import test from 'node:test';
import { HATCH_PROFILES, LEGACY_HATCH_PROFILES, hatchProfileSummary, makeHatchAnswer } from '../features/onboarding/hatch-profile';
import { hatchableEggProgress, hatchableEggReady, hatchWispClearedCount, normalizeHatchableEgg, reduceHatchableEgg } from '../features/onboarding/hatchable-egg-policy';
import { HATCHABLE_COMPANIONS } from '../constants/hatchable-companions/registry';
import { createInitialMergeWorldState, normalizeMergeWorldState } from '../utils/merge-world/engine';
import { MOSSPROUT_FTUE_FLOW } from '../features/onboarding/mossprout-ftue-flow';
import { validateContentFlowDefinition } from '../features/content-flow/content-flow-compiler';
import { loadNativeModule } from './helpers/native-motion-harness';
import { mossproutFtueConversationDefinitions, resolveMossproutFtueConversation } from '../constants/mossprout-ftue-conversations';
import type { HatchAnswer } from '../features/onboarding/hatch-profile';

const now = Date.UTC(2026, 8, 14, 12);
test('every authored answer supplies one nonclinical evidence unit and its own reaction', () => {
  for (const definition of Object.values(HATCH_PROFILES)) {
    assert.equal(definition.questions.length, 2);
    for (const question of definition.questions) for (const option of question.options) {
      const answer = makeHatchAnswer(definition.katchimeraId, question.id, option.id, now)!;
      assert.equal(answer.confidenceIncrement, 1);
      assert.equal(hatchProfileSummary([answer]).initialInsight, option.reply);
      assert.equal(hatchProfileSummary([answer]).currentAspiration, null);
    }
  }
});
test('each answer clears exactly one wisp; hatch is an explicit command, with retry-safe answers', () => {
  for (const definition of HATCHABLE_COMPANIONS) {
    for (const first of HATCH_PROFILES[definition.companion].questions[0].options) {
      for (const second of HATCH_PROFILES[definition.companion].questions[1].options) {
        let state = createInitialMergeWorldState(now);
        state = { ...state, worldUnlocks: { ...state.worldUnlocks, [definition.tile.unlockId]: { unlockedAt: now, paid: 0, destination: definition.companion, transferredAt: null, hatchedAt: null } } };
        state = reduceHatchableEgg(state, definition, { kind: 'begin', sourceDayId: '2026-09-14' }, now).state;
        assert.equal(reduceHatchableEgg(state, definition, { kind: 'answer', questionId: 'support', answer: second.id }, now).changed, false);
        for (const [index, option] of [first, second].entries()) {
          const action = { kind: 'answer' as const, questionId: index === 0 ? 'friction' : 'support', answer: option.id };
          const result = reduceHatchableEgg(state, definition, action, now + index);
          assert.equal(result.changed, true, `${definition.companion}: ${action.questionId}: ${result.message ?? JSON.stringify(result.state.companionDiscovery.records)}`);
          state = result.state;
          assert.equal(reduceHatchableEgg(state, definition, action, now + index).changed, false);
          state = normalizeMergeWorldState(state, now + index);
          const egg = hatchableEggProgress(state, definition)!;
          assert.equal(hatchWispClearedCount(egg), index + 1);
          assert.equal(hatchableEggReady(definition.egg, egg), index === 1);
          assert.equal(egg.hatchStartedAt, null);
        }
        state = reduceHatchableEgg(state, definition, { kind: 'hatch' }, now + 3).state;
        assert.equal(hatchableEggProgress(state, definition)?.hatchStartedAt, now + 3);
        assert.equal(reduceHatchableEgg(state, definition, { kind: 'hatch' }, now + 4).changed, false);
      }
    }
  }
});
test('legacy progress receives credit without inventing profile evidence', () => {
  for (const definition of HATCHABLE_COMPANIONS) {
    for (const ready of [false, true]) {
      let state = createInitialMergeWorldState(now);
      state = { ...state, worldUnlocks: { ...state.worldUnlocks, [definition.tile.unlockId]: { unlockedAt: now, paid: 0, destination: definition.companion, transferredAt: null, hatchedAt: null } }, hatchableEggs: { [definition.companion]: {
        sourceDayId: '2026-09-14', intent: definition.egg.intent.options[0].id, fedSteps: 0,
        alternative: ready ? definition.egg.alternative.options[0].id : null, hatchStartedAt: null, hatchedAt: null,
      } } };
      state = reduceHatchableEgg(state, definition, { kind: 'begin', sourceDayId: '2026-09-14' }, now).state;
      const egg = hatchableEggProgress(state, definition)!;
      assert.equal(hatchWispClearedCount(egg), ready ? 2 : 1);
      assert.deepEqual(egg.wispAnswers, []);
      assert.equal(hatchableEggReady(definition.egg, egg), ready);
    }
  }
});
test('Mossprout reveals the egg and goes directly to questions', () => {
  assert.deepEqual(validateContentFlowDefinition(MOSSPROUT_FTUE_FLOW), []);
  const ids = MOSSPROUT_FTUE_FLOW.nodes.map((node) => node.id);
  assert.ok(ids.indexOf('world.egg_intro') < ids.indexOf('egg.opening'));
  assert.ok(!ids.includes('egg.wisps') && !ids.includes('egg.listening'));
});

test('replayed projections preserve evidence and do not invent aspirations', () => {
  let stored: { hatchProfiles?: Record<string, HatchAnswer[]>; aspirationId: string | null } = { aspirationId: null };
  let writes = 0;
  const storage = loadNativeModule('features/onboarding/hatch-profile-storage.ts', {
    '@/utils/onboarding-state': { loadOnboardingProfile: () => stored, saveOnboardingProfile: (value: typeof stored) => { stored = value; writes++; } },
    './hatch-profile': { hatchProfileSummary },
  });
  const friction = makeHatchAnswer('mossprout', 'friction', 'starting', now)!;
  const support = makeHatchAnswer('mossprout', 'support', 'small_action', now + 1)!;
  storage.recordHatchProfileAnswers('mossprout', [friction]);
  storage.recordHatchProfileAnswers('mossprout', [friction, support]);
  storage.recordHatchProfileAnswers('mossprout', [friction, support]);
  assert.equal(writes, 2);
  assert.equal(stored.hatchProfiles?.mossprout.length, 2);
  assert.equal(stored.aspirationId, null);
  assert.equal(storage.loadHatchProfile('mossprout').supportPreference, 'small_action');
  assert.equal(storage.hatchSupportInvitation('mossprout'), 'Just one tiny thing is enough.');
});

test('first Mossprout dialogue reflects both answers without claiming an unasked aspiration', () => {
  const answers = [makeHatchAnswer('mossprout', 'friction', 'starting', now)!, makeHatchAnswer('mossprout', 'support', 'small_action', now)!];
  const insight = hatchProfileSummary(answers).initialInsight;
  const definition = mossproutFtueConversationDefinitions[0];
  const meeting = resolveMossproutFtueConversation(definition, null, definition.version, insight);
  const hello = meeting.nodes.find((node) => node.id === 'hello');
  assert.ok(hello?.kind === 'choice');
  assert.match(hello.prompt, /beginning gets tangled/);
  assert.match(hello.prompt, /fond of tiny beginnings/);
  const followup = meeting.nodes.find((node) => node.id === 'followup');
  assert.ok(followup?.kind === 'choice');
  assert.doesNotMatch(followup.prompt, /You said a little progress/);
});


test('every current hatch question offers three distinct equally rewarded choices', () => {
  assert.equal(Object.keys(HATCH_PROFILES).length, 7);
  for (const profile of Object.values(HATCH_PROFILES)) {
    assert.equal(profile.version, 2);
    assert.equal(profile.questions.length, 2);
    for (const question of profile.questions) {
      assert.equal(question.options.length, 3, `${profile.katchimeraId}: ${question.id}`);
      assert.equal(new Set(question.options.map((o) => o.id)).size, 3);
      assert.equal(new Set(question.options.map((o) => o.label)).size, 3);
      for (const option of question.options) {
        const answer = makeHatchAnswer(profile.katchimeraId, question.id, option.id, now)!;
        assert.equal(answer.definitionVersion, 2);
        assert.equal(answer.confidenceIncrement, 1);
        assert.ok(hatchProfileSummary([answer]).initialInsight.length > 0);
      }
    }
  }
});

test('every saved four-choice answer remains readable with its original meaning and reaction', () => {
  for (const profile of Object.values(LEGACY_HATCH_PROFILES)) {
    for (const question of profile.questions) {
      for (const option of question.options) {
        const answer = makeHatchAnswer(profile.katchimeraId, question.id, option.id, now, 1)!;
        assert.equal(answer.definitionVersion, 1);
        assert.equal(answer.value, option.id);
        assert.equal(hatchProfileSummary([answer]).initialInsight, option.reply);
      }
    }
  }
  assert.equal(makeHatchAnswer('steppling', 'support', 'audio', now), null, 'retired options are not accepted as new answers');
});


test('reloading an egg with retired choices preserves cleared wisps and hatch readiness', () => {
  for (const definition of HATCHABLE_COMPANIONS) {
    const old = LEGACY_HATCH_PROFILES[definition.companion];
    const answers = old.questions.map((q) => makeHatchAnswer(definition.companion, q.id, q.options[3].id, now, 1)!);
    const raw = { sourceDayId: '2026-09-14', intent: null, fedSteps: 0, alternative: null,
      hatchStartedAt: now, hatchedAt: null, wispVersion: 1 as const, wispAnswers: answers };
    const restored = normalizeHatchableEgg(definition.egg, raw)!;
    assert.deepEqual(restored.wispAnswers, answers);
    assert.equal(hatchWispClearedCount(restored), 2);
    assert.equal(hatchableEggReady(definition.egg, restored), true);
    assert.equal(restored.hatchStartedAt, now);
  }
});

test('only Steppling can hatch using 300 current-day steps, without bypassing questions', () => {
  for (const definition of HATCHABLE_COMPANIONS) {
    let state = createInitialMergeWorldState(now);
    state = { ...state, worldUnlocks: { ...state.worldUnlocks, [definition.tile.unlockId]: { unlockedAt: now, paid: 0, destination: definition.companion, transferredAt: null, hatchedAt: null } } };
    state = reduceHatchableEgg(state, definition, { kind: 'begin', sourceDayId: '2026-09-14' }, now).state;
    const steps = { dayId: '2026-09-14', observedSteps: 300 };
    assert.equal(reduceHatchableEgg(state, definition, { kind: 'hatch', steps }, now).changed, false);
    for (const question of HATCH_PROFILES[definition.companion].questions) {
      state = reduceHatchableEgg(state, definition, { kind: 'answer', questionId: question.id, answer: question.options[0].id }, now).state;
    }
    assert.equal(reduceHatchableEgg(state, definition, { kind: 'hatch', steps: { ...steps, observedSteps: 299 } }, now).changed, false);
    assert.equal(reduceHatchableEgg(state, definition, { kind: 'hatch', steps: { ...steps, dayId: '2026-09-12' } }, now).changed, false);
    const yesterday = reduceHatchableEgg(state, definition, { kind: 'hatch', steps: { ...steps, dayId: '2026-09-13' } }, now);
    assert.equal(yesterday.changed, definition.companion === 'steppling');
    if (yesterday.changed) assert.equal(hatchableEggProgress(yesterday.state, definition)?.hatchSteps?.dayId, '2026-09-13');
    const result = reduceHatchableEgg(state, definition, { kind: 'hatch', steps }, now);
    assert.equal(result.changed, definition.companion === 'steppling');
    if (result.changed) {
      assert.deepEqual(hatchableEggProgress(result.state, definition)?.hatchSteps, { ...steps, stepsUsed: 300 });
      assert.equal(reduceHatchableEgg(result.state, definition, { kind: 'hatch', steps }, now).changed, false);
    }
    assert.equal(reduceHatchableEgg(state, definition, { kind: 'hatch' }, now).changed, true, 'ordinary hatch always remains available');
  }
});
