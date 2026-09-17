import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule } from './helpers/native-motion-harness';
import { hatchableByCompanion } from '@/constants/hatchable-companions/registry';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('Feastle has only the requested food photo daily activity', () => {
  const daily = hatchableByCompanion('feastle')!.daily!;
  assert.equal(daily.photo?.category, 'food');
  assert.equal(daily.moment, undefined);
  assert.equal(daily.notice, undefined);
});

test('validated delivery deep link opens the closing narrative on the companion route', async () => {
  const note = 'chat-note:journey-delivery:feastle:day-2';
  const module = loadNativeModule('app/katchimera/[creatureId].tsx', {
    'expo-router': { useLocalSearchParams: () => ({ creatureId: 'companion:feastle', source: 'merge-world', story: 'return', journeyDelivery: note }), Redirect: 'Redirect' },
    '@/components/katchadeck/world/katchimera-companion-route-screen': { KatchimeraCompanionRouteScreen: 'CompanionScreen' },
    '@/features/onboarding/ftue-runtime': { useFtueRun: () => null },
    '@/features/companion/companion-page-policy': { companionHasPage: () => true },
    '@/constants/katchimera-skins': { familyIdFromCompanionId: () => 'feastle' },
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { load: () => ({}) } },
    '@/utils/merge-world/repository': { loadMergeWorldState: async () => ({}) },
    '@/features/companion/journey-garden-orders': { journeyGardenReturnNotes: () => [{ id: note, characterId: 'feastle', conversationId: 'feastle:journey:day-2-return' }] },
  });
  const Route = module.default as React.ComponentType;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Route />); });
  assert.equal(tree!.root.findByType('CompanionScreen' as React.ElementType).props.journeyReturnConversationDefinitionId, 'feastle:journey:day-2-return');
  await act(async () => tree!.unmount());
});
