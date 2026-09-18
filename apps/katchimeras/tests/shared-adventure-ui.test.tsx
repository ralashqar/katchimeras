import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { ADVENTURE_FLOWS } from '@/features/shared-adventure/definitions';
import { createContentFlowRun, reduceContentFlow } from '@/features/content-flow/content-flow-interpreter';
import type { ContentFlowCommand, ContentFlowDefinition, ContentFlowRun } from '@/types/content-flow';
import { HEARTWOOD_BEDS, HEARTWOOD_CATEGORIES } from '@/features/shared-adventure/heartwood-garden';
import { emptyAdventure, routeRewardDay } from '@/features/shared-adventure/runtime';
import { sharedAdventureReview } from '@/features/shared-adventure/review';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { registerStoryCapability } from '@/features/content-flow/story-capability-registry';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
test('bundled review validates every authored mission', () => assert.deepEqual(sharedAdventureReview().issues, []));
test('every shared story compiles and the finale includes all three friends', () => {
  registerStoryCapability({ id: 'shared.adventure.scene', kind: 'scene' });
  registerStoryCapability({ id: 'shared.adventure.commit', kind: 'effect', idempotent: true });
  for (const flow of ADVENTURE_FLOWS) assert.deepEqual(validateContentFlowDefinition(flow), []);
  const finale = ADVENTURE_FLOWS.at(-1)!;
  assert.equal(new Set(finale.nodes.flatMap(node => node.kind === 'scene' ? [node.payload?.speaker] : [])).size, 3);
});
test('scene resumes its saved line; routes clearly distinguish practice and today’s reward', async () => {
  const now = Date.now();
  let world = createInitialMergeWorldState(now);
  world.kingdomGoal = { introducedAt: now, coachmarkSeenAt: null };
  let saved: ContentFlowRun | null = null;
  let closed = 0;
  const module = loadNativeModule('components/katchadeck/world/shared-adventure-panel.tsx', {
    'react-native': { ...nativeViews, Modal: 'Modal', Text: 'Text', ScrollView: 'ScrollView' },
    'expo-image': { Image: 'Image' },
    './heartwood-vista': { HeartwoodVista: 'HeartwoodVista' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    './kingdom-opening-merge-dock': { MistMissionDock: 'Mission' },
    '@/features/shared-adventure/flows': { ADVENTURE_FLOWS, registerAdventureFlows: () => {} },
    '@/utils/merge-world/repository': { applyStoredAdventure: async () => {} },
    '@/features/content-flow/content-flow-repository': { loadContentFlowRun: async () => saved },
    '@/features/content-flow/content-flow-director': {
      startContentFlow: async (definition: ContentFlowDefinition, input: { runId: string }) => saved = createContentFlowRun(definition, { ...input, now }),
      dispatchContentFlowCommand: async (_id: string, command: ContentFlowCommand) => saved = reduceContentFlow(ADVENTURE_FLOWS[0], saved!, { ...command, now }).run,
    },
  });
  let renderer: ReactTestRenderer;
  const mount = async () => { await act(async () => { renderer = create(React.createElement(module.SharedAdventurePanel as React.ComponentType<any>, { world, onClose: () => closed++, onGarden: () => {}, onFeastle: () => {} })); }); };
  await mount();
  await act(async () => renderer.root.findByProps({ label: 'Continue' }).props.onPress());
  assert.equal((saved as ContentFlowRun | null)?.nodeId, 'road-ahead');
  await act(async () => renderer.unmount());
  await mount();
  assert.ok(JSON.stringify(renderer!.toJSON()).includes('Heartwood has one living root.'));
  await act(async () => renderer.root.findByProps({ label: 'Back to the Kingdom' }).props.onPress());
  assert.equal(closed, 1);
  await act(async () => renderer.unmount());
  // An installed v1 save must render its migrated scene before any input.
  saved = { ...saved!, definitionVersion: 1, nodeId: 'line:1' };
  await mount();
  assert.ok(JSON.stringify(renderer!.toJSON()).includes('Heartwood has one living root.'));
  assert.ok(renderer!.root.findByProps({ label: 'Continue' }));
  await act(async () => renderer.unmount());
  world = { ...world, sharedAdventure: { ...emptyAdventure(), acknowledged: { wish: now, trail: now, hearth: now, welcome: now, post: now, answer: now }, postBuiltAt: now, completedAt: now } };
  // Completed state is authoritative even when an old main-board receipt was compacted.
  await mount();
  assert.ok(JSON.stringify(renderer!.toJSON()).includes('20 Glow today'));
  await act(async () => renderer.unmount());
  world.sharedAdventure!.rewardDays['overgrown-turn'] = routeRewardDay(now);
  await mount();
  assert.ok(JSON.stringify(renderer!.toJSON()).includes('Practice · no Glow'));
  await act(async () => renderer.unmount());
});


test('five-bed UI offers a collected bloom as a free swap with the exact current occupant', async () => {
  const world = createInitialMergeWorldState(Date.now());
  world.haven.plantableMemories = HEARTWOOD_CATEGORIES.map((definitionId, index) => ({
    id: `plant:${index}`, definitionId, status: index < 5 ? 'planted' : 'earned', slotId: HEARTWOOD_BEDS[index] ?? null,
    growthPoints: 3, source: { kind: 'tending', sourceId: 'test' }, earnedAt: 1, plantedAt: 1,
  }));
  const commands: unknown[] = [];
  const module = loadNativeModule('components/katchadeck/world/heartwood-plant-beds.tsx', {
    'react-native': { ...nativeViews, Image: 'Image', Text: 'Text' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'KatchaButton' },
    '@/constants/mossprout-memory-plants': {
      mossproutMemoryPlantStage: (growth: number) => growth >= 3 ? 'bloom' : growth >= 1 ? 'sprout' : 'seed',
      mossproutMemoryPlantById: new Map(HEARTWOOD_CATEGORIES.map(id => [id, { name: `Seed of ${id}`, art: { seed: 1, sprout: 2, bloom: 3 } }])),
    },
    '@/utils/merge-world/repository': { applyStoredAdventure: async (command: unknown) => { commands.push(structuredClone(command)); } },
  });
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(module.HeartwoodPlantBeds as React.ComponentType<any>, { world, selectedBed: 'back-centre' })); });
  assert.match(renderer!.root.findAll(node => String(node.type) === 'Text').map(node => node.children.join('')).join(' '), /5\/5 beds planted/);
  const button = renderer!.root.findByProps({ label: 'Replace momentum · free' });
  await act(async () => button.props.onPress());
  assert.deepEqual(commands, [{ type: 'place_heartwood', category: 'connection', slotId: 'back-centre', expectedOccupantId: 'plant:0' }]);
  await act(async () => renderer!.unmount());
});
