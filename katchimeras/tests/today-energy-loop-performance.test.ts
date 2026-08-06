import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  clearTodayEnergyTraces,
  markTodayEnergyPhase,
  startTodayEnergyTrace,
  subscribeTodayEnergyMetrics,
} from '@/utils/today-energy-loop-performance';
import {
  clearTodayEnergyFeedback,
  getTodayEnergyFeedbackSnapshot,
  isRecentFinalTodayEnergyArrival,
  publishTodayEnergyFeedback,
} from '@/features/today/today-energy-feedback';

test('energy loop traces preserve transaction identity and finish cleanly', () => {
  clearTodayEnergyTraces();
  const metrics: string[] = [];
  const unsubscribe = subscribeTodayEnergyMetrics((metric) => metrics.push(`${metric.transactionId}:${metric.phase}`));
  const id = startTodayEnergyTrace('mood');
  markTodayEnergyPhase(id, 'reward_launch');
  markTodayEnergyPhase(id, 'egg_settled');
  markTodayEnergyPhase(id, 'token_arrival');
  unsubscribe();
  assert.deepEqual(metrics, [
    `${id}:action_press`,
    `${id}:reward_launch`,
    `${id}:egg_settled`,
  ]);
});

test('reset clears transient energy arrivals so a remounted meter cannot replay them', () => {
  clearTodayEnergyFeedback();
  const initialKey = getTodayEnergyFeedbackSnapshot().key;
  publishTodayEnergyFeedback(4, 3, 5);
  assert.equal(getTodayEnergyFeedbackSnapshot().index, 3);

  clearTodayEnergyFeedback();
  assert.deepEqual(getTodayEnergyFeedbackSnapshot(), {
    amount: 0,
    count: 0,
    index: -1,
    key: initialKey + 2,
    publishedAt: null,
  });
});

test('a final token landing remains visible to an activation commit in the next render', () => {
  clearTodayEnergyFeedback();
  publishTodayEnergyFeedback(4, 4, 5);
  const arrival = getTodayEnergyFeedbackSnapshot();
  assert.equal(isRecentFinalTodayEnergyArrival(arrival, arrival.publishedAt ?? 0), true);
  assert.equal(isRecentFinalTodayEnergyArrival(arrival, (arrival.publishedAt ?? 0) + 1201), false);
});

test('manual journal action feedback waits until its native sheet is dismissed', () => {
  const todaySource = readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'), 'utf8');
  const journalSource = readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'manual-journal-sheet.tsx'),
    'utf8',
  );
  assert.match(todaySource, /queueCareCompletionAfterJournalDismiss\(completingCareAction\)/);
  assert.match(todaySource, /runAfterNativeModalDismiss\(\(\) => \{[\s\S]*?queueCareCompletion\(action, false\)/);
  assert.match(todaySource, /hapticOnSave=\{!pendingCareIntent\}/);
  assert.match(journalSource, /if \(hapticOnSave\) successHaptic\(\)/);
});
