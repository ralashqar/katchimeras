import assert from 'node:assert/strict';
import test from 'node:test';
import { stepplingDayOneConversation, legacyStepplingDayOneConversation, legacyStepplingDayOneConversationV2 } from '@/constants/steppling-day-one-conversation';
import { STEPPLING_DAY_ONE_FLOW } from '@/features/content-flow/steppling-day-one-flow';
import { LEGACY_STEPPLING_DAY_ONE_FLOW_V2 } from '@/features/content-flow/steppling-day-one-flow-v2';
import { LEGACY_STEPPLING_DAY_ONE_FLOW } from '@/features/content-flow/steppling-day-one-flow-v1';
import { createConversationSession, answerConversation } from '@/utils/companion-conversation';
import { migrateStepplingDayOneSession, stepplingGardenHandoffPending } from '@/utils/steppling-day-one-session';
import { normalizeSpeechText } from '@/utils/speech-text';
import { ftueDialoguePages } from '@/features/onboarding/ftue-dialogue-pages';
import { createContentFlowRun, reduceContentFlow, contentFlowEffectKey } from '@/features/content-flow/content-flow-interpreter';
import type { ContentFlowRun } from '@/types/content-flow';
import { loadNativeModule } from './helpers/native-motion-harness';
import { clearContentFlowCatalogForTests, registerContentFlowDefinition, contentFlowDefinition } from '@/features/content-flow/content-flow-catalog';

const session = () => createConversationSession({ definition: stepplingDayOneConversation, formId: 'steppling' as never, dayId: '2026-09-05', createdAt: 100 });

test('startup registers Steppling v1, v2 and v3 with migrations for every removed released node', () => {
  clearContentFlowCatalogForTests();
  try {
    for (const definition of [LEGACY_STEPPLING_DAY_ONE_FLOW, LEGACY_STEPPLING_DAY_ONE_FLOW_V2, STEPPLING_DAY_ONE_FLOW]) {
      assert.doesNotThrow(() => registerContentFlowDefinition(definition));
      assert.equal(contentFlowDefinition(definition.id, definition.version), definition);
    }
    const destinations = new Set(STEPPLING_DAY_ONE_FLOW.nodes.map((node) => node.id));
    const migrations: Record<string, string> = STEPPLING_DAY_ONE_FLOW.migrations;
    for (const legacy of [LEGACY_STEPPLING_DAY_ONE_FLOW, LEGACY_STEPPLING_DAY_ONE_FLOW_V2]) {
      for (const node of legacy.nodes) {
        if (!destinations.has(node.id)) assert.ok(destinations.has(migrations[node.id]), `Missing valid migration for v${legacy.version} ${node.id}`);
      }
    }
    assert.doesNotThrow(() => registerContentFlowDefinition(STEPPLING_DAY_ONE_FLOW));
  } finally {
    clearContentFlowCatalogForTests();
  }
});
function completed(choice = 'walk') {
  const chosen = answerConversation(session(), stepplingDayOneConversation, choice, 101).session;
  return answerConversation(chosen, stepplingDayOneConversation, 'garden', 102).session;
}

test('every Day 1 path takes exactly a preference and Tend garden; no reply acknowledgement or habit setup', () => {
  for (const choice of ['walk', 'adapted', 'rest']) {
    const start = session();
    assert.equal(start.currentNodeId, 'reflection');
    const chosen = answerConversation(start, stepplingDayOneConversation, choice, 101).session;
    assert.equal(chosen.currentNodeId, `handoff.${choice}`);
    assert.equal(chosen.pendingReply, undefined);
    const done = answerConversation(JSON.parse(JSON.stringify(chosen)), stepplingDayOneConversation, 'garden', 102).session;
    assert.equal(done.status, 'completed');
    assert.equal(done.turns.length, 2);
    assert.equal(done.pendingReply, undefined);
    assert.equal(stepplingGardenHandoffPending(done), true);
    assert.equal(stepplingGardenHandoffPending({ ...done, gardenHandoffAt: 103 }), false);
    assert.equal(stepplingGardenHandoffPending({ ...done, preview: true }), false);
  }
  for (const node of stepplingDayOneConversation.nodes) {
    if (node.kind !== 'choice') continue;
    assert.ok(typeof node.prompt === 'string' && node.prompt.length <= 120);
    assert.ok(node.options.every((option) => option.label !== 'Continue'));
    assert.ok(!node.id.startsWith('habit.') && !node.id.startsWith('cue.'));
  }
});

test('old active sessions preserve answers and accepted habit turns, with no restart or migration of completed sessions', () => {
  for (const definition of [legacyStepplingDayOneConversation, legacyStepplingDayOneConversationV2]) {
    const old = createConversationSession({ definition, formId: 'steppling' as never, dayId: '2026-09-05', createdAt: 100 });
    assert.equal(migrateStepplingDayOneSession(old).currentNodeId, 'reflection');
    for (const choice of ['walk', 'adapted', 'rest']) {
      const answered = { ...old, currentNodeId: 'habit.added', pendingReply: 'An old reply', pendingNextNodeId: 'closing',
        turns: [{ id: 'choice', nodeId: 'reflection', optionId: choice, answeredAt: 101 },
          { id: 'habit', nodeId: 'habit.steppling:ten-minute-walk', optionId: 'add', answeredAt: 102 }] };
      const migrated = migrateStepplingDayOneSession(answered);
      assert.equal(migrated.definitionVersion, 3);
      assert.equal(migrated.currentNodeId, `handoff.${choice}`);
      assert.equal(migrated.pendingReply, undefined);
      assert.deepEqual(migrated.turns, answered.turns);
      assert.equal(migrateStepplingDayOneSession(migrated), migrated);
      const done = { ...answered, status: 'completed' as const };
      assert.equal(migrateStepplingDayOneSession(done), done);
      assert.equal(stepplingGardenHandoffPending(done), false);
    }
  }
});

test('speech normalizes forced breaks before pagination while preserving punctuation and emoji', () => {
  assert.equal(normalizeSpeechText('  Hello!\r\n\r\nA little\t path.\u2028 Your pace.\u2029🌱 👩‍🦽 '), 'Hello! A little path. Your pace. 🌱 👩‍🦽');
  assert.equal(normalizeSpeechText('  Glow\n', false), ' Glow ');
  assert.deepEqual(ftueDialoguePages('A little path.\n\nYour pace.'), ['A little path. Your pace.']);
  const long = Array(12).fill('A small path with room to pause.').join('\n');
  const pages = ftueDialoguePages(long);
  assert.ok(pages.length > 1);
  assert.ok(pages.every((page) => page.length <= 120 && !/[\r\n\u2028\u2029]/u.test(page)));
  assert.equal(pages.join(' '), normalizeSpeechText(long));
});

function settlement(initial?: ContentFlowRun) {
  let run = initial ?? null;
  let state = { conversationSessions: [completed()] };
  let grants = 0;
  let fail = false;
  const definitions = [LEGACY_STEPPLING_DAY_ONE_FLOW, LEGACY_STEPPLING_DAY_ONE_FLOW_V2, STEPPLING_DAY_ONE_FLOW];
  const effect = () => {
    if (run?.nodeId !== 'parcel') return run;
    if (fail) throw new Error('Interrupted save');
    grants++;
    const definition = definitions.find((candidate) => candidate.version === run!.definitionVersion)!;
    run = reduceContentFlow(definition, run, { type: 'effect_completed', effectKey: contentFlowEffectKey(run, 'parcel'), result: {} }).run;
    return run;
  };
  const module = loadNativeModule('features/companion/use-steppling-day-one.ts', {
    '@/features/onboarding/steppling-garden-runtime': { ensureStepplingGardenLesson: async () => {} },
    '@/utils/steppling-day-one-session': { stepplingGardenHandoffPending },
    '@/features/content-flow/steppling-day-one-flow-v2': { LEGACY_STEPPLING_DAY_ONE_FLOW_V2 },
    '@/utils/companion-life-recording': { recordLifeFlow() {} },
    '@/constants/steppling-day-one-conversation': { STEPPLING_DAY_ONE_CONVERSATION_ID: stepplingDayOneConversation.id },
    '@/utils/companion-content-storage': { loadCompanionContentState: () => state, saveCompanionContentState: (next: typeof state) => { state = next; } },
    '@/utils/merge-world/repository': {},
    '@/utils/world-identity': { localDayId: () => '2026-09-05' },
    '@/features/content-flow/content-flow-bootstrap': { bootstrapContentFlowCatalog() {} },
    '@/features/content-flow/content-flow-director': {
      startContentFlow: async () => { run = createContentFlowRun(STEPPLING_DAY_ONE_FLOW, { runId: 'journey:steppling:day-1', now: 100 }); return run; },
      dispatchContentFlowCommand: async (_id: string, command: Parameters<typeof reduceContentFlow>[2]) => {
        const definition = definitions.find((candidate) => candidate.version === run!.definitionVersion)!;
        run = reduceContentFlow(definition, run!, command).run;
        return effect();
      },
    },
    '@/features/content-flow/content-flow-repository': {
      loadContentFlowRun: async () => run,
      reduceContentFlowRunAtomically: async ({ reduce }: { reduce: (current: ContentFlowRun) => ContentFlowRun }) => { run = reduce(run!); return { run }; },
    },
    '@/features/content-flow/steppling-day-one-flow': { STEPPLING_DAY_ONE_FLOW, STEPPLING_DAY_ONE_RUN_ID: 'journey:steppling:day-1' },
    '@/features/content-flow/steppling-day-one-flow-v1': { LEGACY_STEPPLING_DAY_ONE_FLOW },
    '@/features/content-flow/content-flow-catalog': { contentFlowDefinition: (_id: string, version: number) => definitions.find((candidate) => candidate.version === version) },
  });
  return { module, grants: () => grants, pending: () => stepplingGardenHandoffPending(state.conversationSessions[0]), fail: (value: boolean) => { fail = value; } };
}

test('a saved final answer settles one parcel and keeps Garden handoff pending until Garden acknowledges', async () => {
  const state = settlement();
  state.fail(true);
  await assert.rejects(state.module.settleStepplingDayOne(), /Interrupted save/);
  assert.equal(state.grants(), 0);
  assert.equal(state.pending(), true);
  state.fail(false);
  assert.equal(await state.module.settleStepplingDayOne(), true);
  assert.equal(await state.module.settleStepplingDayOne(), true);
  assert.equal(state.grants(), 1);
  assert.equal(state.pending(), true);
  state.module.acknowledgeStepplingDayOneGarden();
  assert.equal(state.pending(), false);
  state.module.acknowledgeStepplingDayOneGarden();
  assert.equal(state.grants(), 1);
});

test('an old unfinished journal follows migrated answers without replaying old habit or reply scenes', async () => {
  const old = { ...createContentFlowRun(LEGACY_STEPPLING_DAY_ONE_FLOW_V2, { runId: 'journey:steppling:day-1', now: 100 }), nodeId: 'cue.walk' };
  const state = settlement(old);
  assert.equal(await state.module.settleStepplingDayOne(), true);
  assert.equal(state.grants(), 1);
});
