import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNativeModule } from './helpers/native-motion-harness';

test('resetting the profile clears all daily water counters and preserves unrelated storage', () => {
  const stored = new Map<string, unknown>([
    ['companion:water-count:2026-09-05', 4],
    ['companion:water-count:2026-09-06', 2],
    ['katchadeck.onboarding-profile', {}],
    ['other-setting', true],
  ]);
  const storage = {
    getStoredKeys: () => [...stored.keys()],
    removeStoredValue: (key: string) => { stored.delete(key); },
  };
  const water = loadNativeModule('utils/companion-water-storage.ts', { '@/utils/app-storage': storage });
  let avatarResets = 0;
  const profile = loadNativeModule('utils/onboarding-state.ts', {
    '@/utils/app-storage': storage,
    '@/utils/companion-water-storage': water,
    '@/utils/egg-avatar-storage': { resetEggAvatarSelection: () => { avatarResets++; } },
  });
  profile.resetOnboardingProfile();
  assert.deepEqual([...stored], [['other-setting', true]]);
  assert.equal(avatarResets, 1);
  water.resetCompanionWaterCounts();
  assert.deepEqual([...stored], [['other-setting', true]], 'repeated resets are harmless');
});
