import assert from 'node:assert/strict';
import { readFileSync } from './helpers/content-fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { stepplingStepFeedOffer, STEPPLING_INTENT_BOND, STEPPLING_MOVEMENT_BOND, type StepplingEggProgress } from '@/features/onboarding/steppling-egg-policy';

const controller = readFileSync('features/onboarding/use-steppling-encounter.ts', 'utf8');
const source = ts.createSourceFile('controller.ts', controller, ts.ScriptTarget.Latest, true);
function loadCallback(name: string, context: Record<string, unknown>) {
  let callback: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callback);
  const code = ts.transpileModule(`(${callback.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return runInNewContext(code, context);
}

function harness(reduced = false, saveOk = true) {
  const egg: StepplingEggProgress = { sourceDayId: '2026-09-03', intent: null, fedSteps: 0, alternative: null, hatchStartedAt: null, hatchedAt: null };
  const view = { feeding: false, egg: undefined as StepplingEggProgress | undefined, completion: null as string | null, feedback: 0 };
  const feedingRef = { current: false };
  const completionRef = { current: null as string | null };
  let arrival: (() => void) | undefined;
  let saves = 0;
  const context: Record<string, unknown> = {
    egg, pending: { current: false }, feedingRef,
    feedCompletionRef: completionRef, feedSequenceRef: { current: 0 },
    reduceMotion: reduced, stepplingStepFeedOffer, STEPPLING_INTENT_BOND, STEPPLING_MOVEMENT_BOND,
    setFeeding: (value: boolean) => { view.feeding = value; },
    setFeedingEgg: (value: StepplingEggProgress | undefined) => { view.egg = value; },
    setFeedCompletionKey: (value: string | null) => { view.completion = value; },
    setFeedback: (update: (value: number) => number) => { view.feedback = update(view.feedback); },
    send: async () => { saves++; return saveOk; },
    eggBondFeedPayload: () => ({}),
    startEggFeed: (_from: unknown, _payload: unknown, arrive: () => void) => { arrival = arrive; },
  };
  context.releaseFeedPanel = loadCallback('releaseFeedPanel', context);
  const finish = loadCallback('finishFeedPanel', context) as (key: string) => void;
  const feed = loadCallback('feed', context) as (action: unknown, from: unknown) => Promise<void>;
  return { egg, view, feed, finish, arrive: () => { assert.ok(arrival); arrival(); }, saves: () => saves };
}

test('intent, steps and fallback cards stay mounted through Bond flight and release only after slide-out', async () => {
  for (const action of [{ kind: 'intent', answer: 'own-pace' }, { kind: 'feed', observedSteps: 500, sourceDayId: '2026-09-03' }, { kind: 'alternative', answer: 'rest' }]) {
    const h = harness();
    await h.feed(action, {});
    assert.equal(h.view.egg, h.egg);
    assert.equal(h.view.feeding, true);
    assert.equal(h.view.completion, null, 'outro cannot begin before Bond arrives');
    await h.feed(action, {});
    assert.equal(h.saves(), 1, 'double taps are blocked during the flight');
    h.arrive();
    const key = h.view.completion!;
    assert.ok(key);
    assert.equal(h.view.feedback, 1);
    assert.equal(h.view.egg, h.egg, 'keep the answered card after the saved egg changes');
    assert.equal(h.view.feeding, true);
    await h.feed(action, {});
    assert.equal(h.saves(), 1, 'double taps are blocked during the outro too');
    h.finish('stale-panel');
    assert.equal(h.view.feeding, true);
    h.finish(key);
    assert.equal(h.view.feeding, false);
    assert.equal(h.view.egg, undefined);
    assert.equal(h.view.completion, null);
    h.finish(key);
    assert.equal(h.view.feedback, 1, 'duplicate finish does not replay reward feedback');
  }
});

test('reduced motion still hands off through panel completion; failed saves release immediately', async () => {
  const reduced = harness(true);
  await reduced.feed({ kind: 'intent' }, {});
  assert.equal(reduced.view.feeding, true);
  assert.ok(reduced.view.completion);
  reduced.finish(reduced.view.completion!);
  assert.equal(reduced.view.feeding, false);
  const failed = harness(false, false);
  await failed.feed({ kind: 'intent' }, {});
  assert.equal(failed.view.feeding, false);
  assert.equal(failed.view.egg, undefined);
  assert.equal(failed.view.completion, null);
  assert.equal(failed.view.feedback, 0);
});

test('original Egg, Steppling questions and steps all use the same panel lifecycle', () => {
  const panel = readFileSync('components/katchadeck/world/steppling-encounter-panel.tsx', 'utf8');
  const nurture = readFileSync('components/katchadeck/home/today-nurture-experience.tsx', 'utf8');
  const steps = readFileSync('components/katchadeck/onboarding/scripted-action-list.tsx', 'utf8');
  assert.match(panel, /<EggHeroGuide guide=\{guide\} topInset=\{insets.top\}/);
  assert.match(nurture, /<EggHeroGuide guide=\{onboardingGuide\} topInset=\{topInset\}/);
  for (const stage of ['intent', 'movement', 'steps', 'reading', 'ready']) assert.ok(panel.includes(`STEPPLING_EGG_GUIDES.${stage}`));
  const lifecycle = readFileSync('features/today/use-shared-action-panel-lifecycle.ts', 'utf8');
  for (const content of [nurture, steps]) assert.match(content, /import \{ useSharedActionPanelLifecycle \} from '@\/features\/today\/use-shared-action-panel-lifecycle'/);
  assert.match(panel, /completionEvent=\{encounter.feedCompletionKey \? \{ action: question, id: encounter.feedCompletionKey \} : null\}/);
  assert.match(panel, /onFinished=\{encounter.finishFeedPanel\} enterFromBottom/);
  assert.match(panel, /ScriptedActionList completionKey=\{encounter.feedCompletionKey\} onFinished=\{encounter.finishFeedPanel\}/);
  assert.match(lifecycle, /withTiming\(windowWidth \+ 24/);
  assert.match(lifecycle, /if \(finished\) runOnJS\(onFinished\)\(completionKey\)/);
  assert.match(lifecycle, /enterFromBottom \? FadeInDown : FadeInUp/);
});
