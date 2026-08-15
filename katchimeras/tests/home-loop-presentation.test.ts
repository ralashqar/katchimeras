import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { resolveHomeLoopPresentation } from '../features/today/home-loop-presentation';
import type { HomeDayRecord, HomeTomorrowRecord } from '../types/home';

const today = {
  id: 'day-2026-08-05',
  isoDate: '2026-08-05',
  isToday: true,
  kind: 'day',
  state: 'forming',
} as HomeDayRecord;
const tomorrowDay = {
  ...today,
  id: 'day-2026-08-06',
  isoDate: '2026-08-06',
  isToday: false,
} as HomeDayRecord;
const tomorrow = {
  id: 'tomorrow',
  isoDate: '2026-08-06',
  kind: 'tomorrow',
} as HomeTomorrowRecord;

function resolve(overrides: Partial<Parameters<typeof resolveHomeLoopPresentation>[0]> = {}) {
  return resolveHomeLoopPresentation({
    activeDayPrompt: null,
    availableDayPrompts: [],
    hatchOwnership: 'none',
    isTodayHatched: false,
    selectedDay: today,
    tomorrowActivePrompt: null,
    tomorrowAvailablePrompts: [],
    tomorrowDay,
    ...overrides,
  });
}

test('Today and unlocked Tomorrow resolve to one target-aware forming contract', () => {
  const current = resolve();
  assert.equal(current.mode, 'forming-today');
  assert.equal(current.forming?.day.id, today.id);
  assert.equal(current.forming?.target, 'today');

  const next = resolve({ selectedDay: tomorrow, isTodayHatched: true });
  assert.equal(next.mode, 'forming-tomorrow');
  assert.equal(next.forming?.day.id, tomorrowDay.id);
  assert.equal(next.forming?.target, 'tomorrow');
  assert.equal(next.forming?.isTomorrow, true);
});

test('Tomorrow stays locked and only Daily Hatch owns the whole surface', () => {
  assert.deepEqual(resolve({ selectedDay: tomorrow }), {
    forming: null,
    mode: 'locked-tomorrow',
  });
  assert.deepEqual(resolve({ hatchOwnership: 'daily_surface' }), {
    forming: null,
    mode: 'hatching',
  });
  assert.equal(resolve({ hatchOwnership: 'discovery_in_place' }).mode, 'forming-today');
  assert.equal(resolve({ hatchOwnership: 'discovery_in_place' }).forming?.day.id, today.id);
});

test('the plus button restores the bespoke journal browser before guided capture', () => {
  const journal = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'manual-journal-sheet.tsx'),
    'utf8',
  );
  const todayScreen = fs.readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'), 'utf8');

  assert.match(journal, /manualJournalArt\(flow\.id\)/);
  assert.match(journal, /orderedFlows\.map/);
  assert.doesNotMatch(journal, /SECTION_ORDER|SECTION_LABELS|groupedFlows/);
  assert.match(journal, /if \(onFlowSelect\?\.\(item\.id\)\) return/);
  assert.match(todayScreen, /onAdd=\{\(\) => openManualJournal\(\)\}/);
  assert.match(todayScreen, /onFlowSelect=\{!manualJournalInitialFlowId \? openGuidedCaptureFromJournalBrowser : undefined\}/);
  assert.match(todayScreen, /openGuidedCapture\(flow, 'plus', \{ target \}\)/);
});

test('the top-level journal browser keeps only the title and one compact two-column category grid', () => {
  const journal = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'manual-journal-sheet.tsx'),
    'utf8',
  );

  assert.match(journal, /stage !== 'flow' && dateTarget && onDateTargetChange/);
  assert.match(journal, /stage !== 'flow' && rewardNotice/);
  assert.match(journal, /questFocused \? 'Quest journal' : undefined/);
  assert.match(journal, /style=\{styles\.flowGrid\}/);
  assert.match(journal, /style=\{styles\.flowTileWrap\}/);
  assert.match(journal, /flowTileWrap: \{ width: '48\.5%' \}/);
  assert.match(journal, /minHeight: 132/);
  assert.doesNotMatch(journal, /Everyday|Culture & progress|Milestones/);
  assert.doesNotMatch(journal, /Log something/);
  assert.doesNotMatch(journal, /sectionTabs|sectionTabSelected|jumpToSection/);
});

test('Moments reuse the bespoke top-level journal category artwork', () => {
  const momentList = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'compact-moment-list.tsx'),
    'utf8',
  );

  assert.match(momentList, /manualJournalArt\(item\.categoryFlowId\)/);
  assert.match(momentList, /selectedStateArt \?\? manualJournalArt/);
  assert.match(momentList, /styles\.cardCategoryArt/);
});

test('guided journal actions unlock, refill, and keep their Energy reward chips', () => {
  const todayScreen = fs.readFileSync(path.join(process.cwd(), 'app', '(tabs)', 'today.tsx'), 'utf8');
  const nurture = fs.readFileSync(
    path.join(process.cwd(), 'components', 'katchadeck', 'home', 'today-nurture-experience.tsx'),
    'utf8',
  );
  const guidedBranch = todayScreen.slice(
    todayScreen.indexOf('if (guidedFlow) {'),
    todayScreen.indexOf("if (action.completionMode === 'artifact'"),
  );

  assert.ok(guidedBranch.indexOf('startCareIntent(action, eggFeedRewardRequestKey)') >= 0);
  assert.ok(guidedBranch.indexOf('startCareIntent(action, eggFeedRewardRequestKey)') < guidedBranch.indexOf('markCareDestinationOpen()'));
  assert.ok(guidedBranch.indexOf('markCareDestinationOpen()') < guidedBranch.indexOf("openGuidedCapture(guidedFlow, 'today_suggestion'"));
  assert.doesNotMatch(nurture, /A few things the Egg might like to know/);
  assert.doesNotMatch(nurture, /Anything else worth keeping/);
  assert.match(nurture, /function Reward\([\s\S]*?GameRewardChip[\s\S]*?GAME_CURRENCY_ART\.energy/);
  assert.ok((nurture.match(/<Reward amount=\{action\.growthReward\} \/>/g) ?? []).length >= 3);
  assert.doesNotMatch(nurture, /captureCue/);
});
