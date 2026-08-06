import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('Today goal popup returns completion to its originating action row', () => {
  const modal = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'goals', 'quick-goal-action-modal.tsx'),
    'utf8',
  );
  const nurture = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'today-nurture-experience.tsx'),
    'utf8',
  );
  const today = fs.readFileSync(
    path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'),
    'utf8',
  );

  assert.match(modal, /onCompleteFromOrigin\?: \(\) => void/);
  assert.match(modal, /if \(onCompleteFromOrigin\) \{[\s\S]*dismiss\(onCompleteFromOrigin\)/);
  assert.match(nurture, /onOpenQuickGoal\(goalId, handleComplete\)/);
  assert.match(today, /selectedCareGoalCompletionRef/);
  assert.match(today, /requestAnimationFrame\(\(\) => completeFromOrigin\?\.\(\)\)/);
});

test('Today holds replacement actions until the completed row exits', () => {
  const nurture = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'today-nurture-experience.tsx'),
    'utf8',
  );

  assert.match(nurture, /settledRemainingActionsRef/);
  assert.match(nurture, /displayedRemainingActions\.map/);
  assert.match(nurture, /onFinished=\{onCompletionAnimationEnd\}/);
  assert.doesNotMatch(
    nurture,
    /<View style=\{styles\.goalTickComplete\}>\s*<View style=\{styles\.completedTick\}>/,
  );
});

test('first rotating journal completion is queued synchronously after check-ins', () => {
  const today = fs.readFileSync(
    path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'),
    'utf8',
  );

  assert.match(today, /const completingCareAction = pendingCareIntent/);
  assert.match(today, /queueCareCompletion\(completingCareAction, false\)/);
  assert.match(today, /setPendingCareIntent\(null\)/);
});

test('mood and sleep fly frameless artwork to the egg', () => {
  const writers = fs.readFileSync(
    path.join(process.cwd(), 'features', 'today', 'use-today-memory-writers.ts'),
    'utf8',
  );
  const feedOverlay = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'egg-feed-overlay.tsx'),
    'utf8',
  );

  assert.equal(writers.match(/framelessImage: true/g)?.length, 2);
  assert.match(feedOverlay, /isFramelessIcon/);
  assert.match(feedOverlay, /styles\.framelessIconMote/);
});
