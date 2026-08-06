import assert from 'node:assert/strict';
import test from 'node:test';

import type { CompanionAchievementDef, CompanionAchievementTier } from '@/types/companion-achievements';
import { orderAchievementCelebrationQueue, pickRandomAchievement } from '@/utils/achievement-celebration';

function achievement(id: string, tier: CompanionAchievementTier): CompanionAchievementDef {
  return {
    id,
    familyId: 'steppling',
    pillar: 'domain',
    sectionId: 'step-days',
    sectionLabel: 'Big step days',
    sectionDescription: 'Step milestones.',
    tier,
    name: id,
    description: 'A test achievement.',
    criterion: 'Reach the test target',
    iconKey: 'steppling.maxSteps',
    metric: { kind: 'signal', signal: 'steppling.maxSteps', target: tier, unit: 'steps', counting: 'peak' },
    reward: { kind: 'trophy_room', label: `${id} trophy`, roomZone: 'step-days', treatment: 'trophy' },
  };
}

test('achievement celebration queue de-duplicates and orders highest tier first', () => {
  const low = achievement('low', 1);
  const highA = achievement('high-a', 4);
  const highB = achievement('high-b', 4);
  assert.deepEqual(
    orderAchievementCelebrationQueue([low, highA, low, highB]).map((item) => item.id),
    ['high-a', 'high-b', 'low'],
  );
});

test('random achievement preview avoids the previous item when alternatives exist', () => {
  const first = achievement('first', 1);
  const second = achievement('second', 2);
  assert.equal(pickRandomAchievement([first, second], 'first', () => 0)?.id, 'second');
  assert.equal(pickRandomAchievement([first], 'first', () => 0)?.id, 'first');
  assert.equal(pickRandomAchievement([], null, () => 0), null);
});
