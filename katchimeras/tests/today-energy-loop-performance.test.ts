import assert from 'node:assert/strict';
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
  });
});
