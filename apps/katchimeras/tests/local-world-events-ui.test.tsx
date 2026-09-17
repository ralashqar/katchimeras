import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { createLocalEventPilot, DEFAULT_HARMONY } from '@/features/live-ops/local-catalog';
import { reduceLocalEvent } from '@/features/live-ops/local-runtime';
import type { LocalEventCommand } from '@/types/local-live-ops';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('event overview routes adventures into the world without rendering a board', async () => {
  const now = Date.now();
  const events = createLocalEventPilot(new Date(now - 86400000).toISOString()).liveEvents!.map(e => ({ ...e, enabled: true }));
  const harmony = { version: 1 as const, points: 100, milestones: {} };
  let world = createInitialMergeWorldState(now);
  world.haven.tileStages.mossprout = 1;
  let openedMerge = 0;
  let explored = '';
  const module = loadNativeModule('components/katchadeck/world/local-world-events.tsx', {
    './garden-event-adornment': { subscribeGardenEventOpen: () => () => {} },
    '@/features/live-ops/source-outbox': { drainGameplaySourceOutboxes: async () => {}, subscribeGameplayOutbox: () => () => {} },
    '@/features/live-ops/local-catalog': { availableLocalEvents: () => events, harmonyDefinition: () => DEFAULT_HARMONY },
    '@/utils/merge-world/repository': {
      loadMergeWorldState: async () => world, loadHarmonyProgress: async () => harmony,
      subscribeMergeWorldSnapshots: () => () => {},
      applyStoredLocalEvent: async (command: LocalEventCommand) => { world = reduceLocalEvent(world, command, harmony, events, now).world; return { state: world, changed: true }; },
    },
    '@/constants/merge-world-art': { mergeWorldItemArt: () => null },
    'react-native': { ...nativeViews, Pressable: 'Pressable' },
    'expo-image': { Image: 'Image' },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/components/katchadeck/ui/katcha-sheet': { KatchaSheet: 'Sheet' },
    '@/components/katchadeck/progress-bar': { ProgressBar: 'Progress' },
  });
  let renderer: ReactTestRenderer;
  const mount = async () => { await act(async () => { renderer = create(React.createElement(module.LocalWorldEvents as React.ComponentType<{ world: typeof world; onMerge: () => void; onExplore: (id: string) => void }>, { world, onMerge: () => openedMerge++, onExplore: id => { explored = id; } })); }); };
  const press = async (label: string) => { await act(async () => { renderer.root.findAllByProps({ label })[0].props.onPress(); }); };
  world.haven.tileStages.mossprout = 0;
  await mount();
  await press('World events · 2');
  assert.ok(JSON.stringify(renderer!.toJSON()).includes('Restore Mossprout'));
  assert.equal(renderer!.root.findAllByProps({ label: 'Visit Mossprout' }).length, 0);
  await act(async () => renderer.unmount());
  world.haven.tileStages.mossprout = 1;
  await mount();
  await press('World events · 2');
  await press('Visit Mossprout');
  assert.equal(explored, events[0].id);
  assert.equal(world.activeOrders.some(o => o.id.startsWith('local-event:')), false);
  assert.equal(openedMerge, 0);
  await act(async () => renderer.unmount());
  await mount();
  await press('World events · 2');
  assert.equal(renderer!.root.findAllByProps({ label: 'Make the supplies' }).length, 0);
  assert.equal(renderer!.root.findAllByType('Image' as any).length, 0);
  await act(async () => renderer.unmount());
});


test('progress opens events inside the same sheet and keeps a working close action', async () => {
  let closed = 0;
  const module = loadNativeModule('components/katchadeck/world/kingdom-progress-sheet.tsx', {
    '@/constants/theme': { AppFontFamilies: { manrope: 'Manrope' } },
    './local-world-events': { LocalWorldEvents: 'Events' },
    './kingdom-progress-summary': { KingdomProgressSummary: 'Summary' },
    '@/features/live-ops/use-harmony-progress': { useHarmonyProgress: () => ({ points: 790 }) },
    '@/features/live-ops/local-catalog': { harmonyDefinition: () => DEFAULT_HARMONY },
    '@/constants/katchimera-skins': { katchimeraSkinById: new Map() },
    '@/constants/mossprout-nature-islands': { mossproutNatureIslandById: new Map() },
    '@/game/days/visuals': { getCreatureVisual: () => null },
    'react-native': nativeViews,
    'expo-image': { Image: 'Image' },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/components/katchadeck/ui/katcha-sheet': { KatchaSheet: 'Sheet' },
    '@/components/katchadeck/progress-bar': { ProgressBar: 'Progress' },
  });
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(module.KingdomProgressSheet as React.ComponentType<any>, {
    progress: { places: { entries: [] }, next: { kind: 'complete', label: 'Done' } },
    world: createInitialMergeWorldState(Date.now()), onMerge: () => {}, onNext: () => {}, onClose: () => closed++,
  })); });
  const sheet = renderer!.root.findByType('Sheet' as any);
  const harmonyText = renderer!.root.findAllByType('Text' as any).find(node => node.props.children?.[0] === 'HARMONY · ');
  assert.equal(harmonyText?.props.darkColor, '#8E7130');
  await act(async () => renderer!.root.findByProps({ label: 'World events' }).props.onPress());
  assert.equal(renderer!.root.findByType('Sheet' as any), sheet);
  assert.equal(renderer!.root.findByType('Events' as any).props.embedded, true);
  await act(async () => sheet.props.onRequestClose());
  assert.equal(closed, 1);
  await act(async () => renderer!.unmount());
});


test('world mission uses the existing dock and serializes moves through durable event commands', async () => {
  const now = Date.now();
  const event = createLocalEventPilot(new Date(now - 1000).toISOString()).liveEvents![0];
  const { createMissionState } = await import('@/features/onboarding/steppling-mission');
  const { missionWindow } = await import('@/features/mission-mechanics/board-window');
  const cells = missionWindow(3).cellIndices;
  const board = createMissionState({ items: cells.slice(0, 8).map(cell => ({ cell, definitionId: 'nature:garden:1' })), echoes: [], veiled: [] }, 'mossprout', now);
  const commands: LocalEventCommand[] = [];
  let finish: () => void = () => {};
  const module = loadNativeModule('components/katchadeck/world/local-event-mission-dock.tsx', {
    './kingdom-opening-merge-dock': { MistMissionDock: 'Dock' },
    '@/components/themed-text': { ThemedText: 'Text' },
    'react-native': nativeViews,
    '@/utils/merge-world/repository': { applyStoredLocalEvent: (command: LocalEventCommand) => { commands.push(command); return new Promise<void>(resolve => { finish = resolve; }); } },
  });
  let renderer: ReactTestRenderer;
  let closed = false;
  await act(async () => { renderer = create(React.createElement(module.LocalEventMissionDock as React.ComponentType<any>, {
    action: { event, encounter: event.encounters![0], phase: 'board', state: { phase: 'board', merges: 0, board } },
    width: 390, bottomInset: 24, onClose: () => { closed = true; },
  })); });
  const dock = renderer!.root.findByType('Dock' as any);
  assert.equal(dock.props.layout.rows, 3);
  assert.deepEqual(dock.props.layout.cellIndices, cells);
  await act(async () => {
    const move = { type: 'move', from: cells[0], to: cells[1], now };
    assert.ok(dock.props.onCommand(move)?.changed);
    assert.equal(dock.props.onCommand(move), null);
    finish();
  });
  assert.equal(commands.length, 1);
  assert.equal(commands[0].type, 'move');
  await act(async () => dock.props.onClose());
  assert.equal(closed, true);
  await act(async () => renderer!.unmount());
});
