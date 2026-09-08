import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { MOSSPROUT_FTUE_COPY } from '@/features/onboarding/mossprout-ftue-copy';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const NOW = Date.parse('2026-09-08T12:00:00Z');

test('Mossprout plants the wish at his farewell and the resting card keeps the garden open', () => {
  const pages = MOSSPROUT_FTUE_COPY.farewell.split('\n\n');
  assert.equal(pages.length, 3);
  assert.match(pages[1]!, /friends/);
  assert.match(pages[1]!, /mist/);
  assert.match(pages[2]!, /Someone is waiting beyond it/);
  assert.equal(mossproutFtueStep('companion.meditating')?.guide?.body, MOSSPROUT_FTUE_COPY.meditationHelp);
});

test('the Kingdom goal is introduced once, its hint acknowledged once, and both survive reload', () => {
  const fresh = createInitialMergeWorldState(NOW, ['mossprout']);
  assert.equal(fresh.kingdomGoal, undefined);
  assert.equal(reduceMergeWorld(fresh, { type: 'ackKingdomGoalCoachmark', now: NOW }).changed, false, 'no hint before the wish');
  const introduced = reduceMergeWorld(fresh, { type: 'introduceKingdomGoal', now: NOW });
  assert.equal(introduced.changed, true);
  assert.deepEqual(introduced.state.kingdomGoal, { introducedAt: NOW, coachmarkSeenAt: null });
  assert.equal(reduceMergeWorld(introduced.state, { type: 'introduceKingdomGoal', now: NOW + 5 }).changed, false);
  const reloaded = normalizeMergeWorldState(JSON.parse(JSON.stringify(introduced.state)), NOW + 1);
  assert.deepEqual(reloaded.kingdomGoal, { introducedAt: NOW, coachmarkSeenAt: null });
  const seen = reduceMergeWorld(reloaded, { type: 'ackKingdomGoalCoachmark', now: NOW + 2 });
  assert.equal(seen.changed, true);
  assert.equal(seen.state.kingdomGoal?.coachmarkSeenAt, NOW + 2);
  assert.equal(reduceMergeWorld(seen.state, { type: 'ackKingdomGoalCoachmark', now: NOW + 3 }).changed, false);
  assert.deepEqual(normalizeMergeWorldState(JSON.parse(JSON.stringify(seen.state)), NOW).kingdomGoal, { introducedAt: NOW, coachmarkSeenAt: NOW + 2 });
  assert.equal(normalizeMergeWorldState({ ...seen.state, kingdomGoal: { introducedAt: 'soon' } }, NOW).kingdomGoal, undefined, 'garbage is dropped');
});

test('the wish waits for Steppling to leave, and the guide never locks the world without its marker', () => {
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  // Two full-screen sheets swapping in one frame can leave the second one
  // unpresented, and Steppling's ordinary greeting would speak over the
  // farewell he just gave. His page closes first; the wish follows.
  assert.match(screen, /const stepplingGoalHandoffPending = Boolean\(kingdomGoalWanted && \(interactionCreatureId \|\| activeInteractionResidentId\)\)/);
  assert.match(screen, /const kingdomGoalPending = kingdomGoalWanted && !stepplingGoalHandoffPending/);
  assert.match(screen, /if \(!stepplingGoalHandoffPending\) return;\s*\n\s*requestResidentInteractionExit\(\)/);
  assert.match(screen, /\{interactionCreatureId && !stepplingGoalHandoffPending \?/);
  // The guide locks the camera and every other control, so it may only start
  // when the one marker it leaves tappable actually exists.
  assert.match(screen, /const goalIslandOffer = goalIslandId[\s\S]*?offer\.id === `nature:\$\{goalIslandId\}` && offer\.eligible/);
  assert.match(screen, /const kingdomGoalGuideActive = Boolean\([\s\S]*?goalIslandOffer/);
  // An active lesson with nothing on screen must not eat Back.
  assert.match(screen, /\(stepplingLesson\.active && Boolean\(interactionCreatureId\)\) \? undefined : <KatchimeraBackButton/);
  // A queued restoration takes several frames to build its presentation. The
  // markers and the panel must not flash back in over that handoff.
  assert.match(screen, /const upgradeHandoffPending = upgradePresentationOperation\.model\.pendingWork\.kind === 'presentation'\s*\n\s*&& upgradePresentationOperation\.model\.pendingWork\.presentationType === STORY_WORLD_UPGRADE_PRESENTATION/);
  assert.match(screen, /upgradeOffers=\{[^\n]*?&& !upgradeHandoffPending/);
  assert.match(screen, /upgradePanel=\{[^\n]*?&& !upgradeHandoffPending/);
});

test('the Journal and Merge shortcuts hide behind an open upgrade panel', () => {
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  // Neither shortcut's max-height accounts for the other's footprint, so a
  // tall panel and these fixed-position buttons used to sit on top of each
  // other. Hide both while `sharedUpgrade` — the same flag the panel itself
  // is gated on — is set, instead of trying to reserve space for them.
  assert.match(screen, /!kingdomGoalGuideActive && !kingdomGoalPending && !sharedUpgrade && \(!ftueStepId \|\| ftueStepId === 'companion\.meditating'\) \? <View style=\{\{ position: 'absolute', left: 16/);
  assert.match(screen, /!kingdomGoalGuideActive && !sharedUpgrade && havenMergeBoardActive && mossproutFtueShowsWorldGarden\(ftueStepId\)/);
});

test('the goal scene tells the wish once and hands over exactly once per tap burst', async () => {
  let introduced = 0;
  let done = 0;
  const module = loadNativeModule('components/katchadeck/onboarding/kingdom-goal-scene.tsx', {
    'react-native': nativeViews,
    'react': React,
    'expo-image': { Image: 'Image' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 40, bottom: 20, right: 0, left: 0 }) },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/katchadeck/ui/katcha-sheet': { KatchaSheet: ({ children, overlay }: { children: React.ReactNode; overlay: React.ReactNode }) => <>{children}{overlay}</> },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/components/katchadeck/world/kingdom-progress-summary': { KingdomProgressSummary: 'Summary' },
    '@/constants/katchimera-skins': { katchimeraSkinById: new Map([['mossprout', { visualKey: 'mossprout' }]]) },
    '@/constants/theme': { AppFontFamilies: { manrope: 'manrope' } },
    '@/features/kingdom-progress/kingdom-progress': { kingdomProgress: () => ({ friends: { home: 1, met: 1, total: 9, entries: [] }, places: { restored: 1, total: 7, entries: [] }, next: { kind: 'clear_mist', label: 'Clear the mist at Bloom Garden' } }) },
    '@/game/days/visuals': { getCreatureVisual: () => ({ source: 7 }) },
    '@/utils/merge-world/repository': {
      introduceStoredKingdomGoal: async () => { introduced += 1; },
      loadMergeWorldState: async () => ({}),
      subscribeMergeWorldSnapshots: () => () => undefined,
    },
  });
  const Scene = module.KingdomGoalScene as React.ComponentType<{ onDone: () => void }>;
  assert.match(module.KINGDOM_GOAL_LINE as unknown as string, /friend home/);
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Scene onDone={() => { done += 1; }} />); });
  const button = tree!.root.findByProps({ label: 'Find the first friend' });
  assert.match(JSON.stringify(tree!.toJSON()), /Clear the mist at Bloom Garden/, 'the next step is shown');
  await act(async () => { button.props.onPress(); button.props.onPress(); });
  assert.equal(introduced, 1, 'the wish is recorded once');
  assert.equal(done, 1, 'the Kingdom takes over once');
  await act(async () => tree!.unmount());
});
