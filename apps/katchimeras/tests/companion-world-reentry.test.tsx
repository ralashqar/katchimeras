import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { loadNativeModule } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
for (const family of ['mossprout', 'steppling', 'feastle']) test(`${family} re-entry preserves the world map and journey handoff`, async () => {
  const creatureId = `companion:${family}`;
  const module = loadNativeModule('app/katchimera/[creatureId].tsx', {
    react: React,
    'expo-router': { Redirect: 'Redirect', useLocalSearchParams: () => ({ creatureId, source: 'merge-world', journeyDelivery: 'delivery-1' }) },
    '@/utils/merge-world/repository': { loadMergeWorldState: async () => ({}) },
    '@/features/companion/journey-garden-orders': { journeyGardenReturnNotes: () => [{ id: 'delivery-1', characterId: family, conversationId: 'return-story' }] },
    '@/constants/katchimera-skins': { familyIdFromCompanionId: () => family },
    '@/features/companion/companion-page-policy': { companionHasPage: () => true },
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { load: () => ({ journeyDays: [] }) } },
  });
  const Route = module.default as React.ComponentType;
  let tree: ReturnType<typeof create>;
  await act(async () => { tree = create(<Route />); });
  const href = tree!.root.findByType('Redirect' as any).props.href;
  assert.equal(href.pathname, '/(tabs)/katchimeras');
  assert.equal(href.params.interactionCreature, creatureId);
  assert.equal(href.params.interactionSource, 'merge-world');
  assert.equal(href.params.interactionConversation, 'return-story');
  await act(async () => { tree!.unmount(); });
});
