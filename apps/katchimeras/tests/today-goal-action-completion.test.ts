import assert from 'node:assert/strict';
import fs from './helpers/content-fs';
import path from 'node:path';
import test from 'node:test';

test('Today quick-goal rewards always release the shared interaction lock', () => {
  const energyLoop = fs.readFileSync(
    path.join(process.cwd(), 'features', 'today', 'use-today-energy-loop.ts'),
    'utf8',
  );

  assert.match(energyLoop, /const finishRewardOnly = useCallback\(\(\) => \{[\s\S]*?finishRewardHandoff\(\)/);
  assert.match(energyLoop, /const REWARD_LOCK_TIMEOUT_MS = 5_000/);
  assert.match(energyLoop, /reason: 'reward_timeout'[\s\S]*?setCompletionEvent\(null\)[\s\S]*?setStatus\('idle'\)/);
});

test('first rotating journal completion is queued after its native sheet dismisses', () => {
  const today = fs.readFileSync(
    path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'),
    'utf8',
  );

  assert.match(today, /const completingCareAction = pendingCareIntent/);
  assert.match(today, /queueCareCompletionAfterJournalDismiss\(completingCareAction\)/);
  assert.match(today, /addManualJournalEntry\(submission, [^)]+\);[\s\S]*?closeManualJournal\(\)/);
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
