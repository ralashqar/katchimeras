import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(__dirname, '..');
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf8');

test('preview explicitly enables developer tools while production stays fail-closed', () => {
  const eas = JSON.parse(read('eas.json')) as {
    build: Record<string, { env?: Record<string, string> }>;
  };

  assert.equal(eas.build.preview.env?.EXPO_PUBLIC_ENABLE_DEV_TOOLS, 'true');
  assert.notEqual(eas.build.production.env?.EXPO_PUBLIC_ENABLE_DEV_TOOLS, 'true');
});

test('developer navigation and tool implementations share the preview-safe gate', () => {
  const devContract = read('constants/dev.ts');
  assert.match(devContract, /EXPO_PUBLIC_ENABLE_DEV_TOOLS === 'true'/);
  assert.match(devContract, /DEV_DEBUG_NAV_ENABLED = DEV_TOOLS_ENABLED/);

  for (const relative of [
    'utils/dev-settings.ts',
    'utils/dev-subscription-simulator.ts',
    'utils/dev-atmosphere-settings.ts',
    'utils/dev-note-analysis.ts',
    'utils/dev-photo-analysis.ts',
    'utils/dev-asset-overrides.ts',
    'utils/katchimera-hex-tiles.ts',
    'utils/dev-profile-sandbox.ts',
    'utils/dev-profile-snapshot-storage.ts',
    'utils/player-profile-snapshots.ts',
  ]) {
    const implementation = read(relative);
    assert.match(implementation, /DEV_TOOLS_ENABLED/, `${relative} must use the shared gate`);
    assert.doesNotMatch(implementation, /if \([^\n]*!?__DEV__/, `${relative} must not reject preview builds via __DEV__`);
  }
});

test('a global four-finger emergency gesture can escape an FTUE soft lock only in dev builds', () => {
  const rootLayout = read('app/_layout.tsx');
  assert.match(rootLayout, /event\.nativeEvent\.touches\.length < 4/);
  assert.match(rootLayout, /DEV_TOOLS_ENABLED \? captureEmergencyDevGesture : undefined/);
  assert.match(rootLayout, /router\.push\('\/dev-tools'\)/);
  assert.match(rootLayout, /Stack\.Screen name="dev-tools"/);
  const ftueNavigation = read('features/onboarding/ftue-navigation-reconciler.tsx');
  assert.match(ftueNavigation, /ftueNavigationYieldsToDevRecovery\(pathnameRef\.current\)/);
  assert.match(read('features/onboarding/ftue-dev-recovery.ts'), /'\/dev-'/);
  assert.match(read('app/dev-tools.tsx'), /export \{ default \} from '\.\/\(tabs\)\/explore'/);
});

test('Journey developer tools expose scoped reset, quick mode, and full reset controls', () => {
  const devPage = read('app/(tabs)/explore.tsx');
  const settings = read('utils/dev-settings.ts');
  const journeyTools = read('features/mossprout/journey-dev-tools.ts');
  const fullReset = read('utils/reset-katchimera-progress-for-debug.ts');
  const snapshots = read('utils/player-profile-snapshots.ts');

  assert.match(devPage, /Reset current Journey Day/);
  assert.match(devPage, /Journey quick mode/);
  assert.match(devPage, /Reset all Journey \+ Merge progress/);
  assert.match(journeyTools, /resetLastMossproutJourneyForDebug/);
  assert.match(settings, /JOURNEY_QUICK_MODE_KEY/);
  assert.match(fullReset, /setJourneyQuickModeEnabled\(false\)/);
  assert.match(snapshots, /setJourneyQuickModeEnabled\(false\)/);
  assert.match(devPage, /await resetKatchimeraProgressForDebug\(\{ resetAt: Date\.now\(\) \}\);[\s\S]*?resetOnboardingProfile\(\)/);
});

test('developer tools can fill every empty Haven order tray without mutating real orders', () => {
  const devPage = read('app/(tabs)/explore.tsx');
  const settings = read('utils/dev-settings.ts');
  const haven = read('components/katchadeck/roster/katchimera-kingdom-screen.tsx');
  const canvas = read('components/katchadeck/world/kingdom-hex-canvas.tsx');
  const fillers = read('utils/merge-world/dev-haven-order-fillers.ts');

  assert.match(devPage, /Fill empty Haven order trays/);
  assert.match(devPage, /setHavenOrderFillersEnabled/);
  assert.match(settings, /HAVEN_ORDER_FILLERS_KEY/);
  assert.match(settings, /HAVEN_ORDER_FILLER_SEED_KEY/);
  assert.match(settings, /HAVEN_ORDER_FILLER_SLOT_SEEDS_KEY/);
  assert.match(settings, /HAVEN_ORDER_FILLER_BOARD_SLOT_SEEDS_KEY/);
  assert.match(haven, /devHavenOrderFillersForSlots/);
  assert.match(haven, /devHavenOrderFillersForFamilySlots\([\s\S]*?'steppling'/);
  assert.match(haven, /devHavenOrderFillerSlot\(command\.order\)/);
  assert.match(haven, /itemReadiness\.every\(Boolean\)/);
  assert.match(haven, /advanceHavenOrderFillerSlotSeed\(slotIndex, 'mossprout'\)/);
  assert.match(haven, /advanceHavenOrderFillerSlotSeed\(slotIndex, 'steppling'\)/);
  assert.match(canvas, /isDevHavenOrderFiller/);
  assert.match(canvas, /type: 'serveDevHavenOrder'/);
  assert.match(canvas, /mergeOrderReady\(state, activeOrder\.order\)/);
  assert.doesNotMatch(canvas, /previewOnly/);
  assert.match(fillers, /skin\.familyId === characterId/);
  assert.match(fillers, /skin\.id !== characterId/);
  assert.match(fillers, /recipientSkinId: skin\.id/);
  assert.doesNotMatch(fillers, /ownedKatchimeraCards|mossproutResidentSkinIds/);
});
