import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act, createContext, use, useSyncExternalStore } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import type { MergePlaySurfaceProps } from '@/components/katchadeck/games/merge-play-surface';
import type { MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';
import { createSelectorStore } from '@/utils/merge-world/selector-store';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;

function fixture() {
  const world = createInitialMergeWorldState(1000, ['mossprout']);
  const mission = createInitialMergeWorldState(2000, ['mossprout']);
  const store = createSelectorStore({ state: world as MergeWorldState | null });
  const Context = createContext<typeof store | null>(null);
  let selectorCalls = 0;
  let boardRenders = 0;
  const module = loadNativeModule('components/katchadeck/games/merge-play-surface.tsx', {
    'react-native': nativeViews,
    '@/features/encounter/combat-profile': { CombatProfileBoundary: ({ children }: React.PropsWithChildren) => children },
    './feastle-persistent-merge-board': { FeastlePersistentMergeBoard: (props: Record<string, unknown>) => {
      boardRenders++;
      return React.createElement(host('Board'), props);
    } },
    './merge-cell-inspector': { MergeCellInspector: () => null },
    './merge-order-rail': { MergeOrderRail: () => null },
    '@/features/merge-world/merge-world-provider': {
      useMergeWorldSelector(select: (snapshot: { state: MergeWorldState | null }) => MergeWorldState | null) {
        selectorCalls++;
        const current = use(Context);
        if (!current) throw new Error('useMergeWorldSelector must be used inside MergeWorldProvider.');
        return select(useSyncExternalStore(current.subscribe, current.getSnapshot, current.getSnapshot));
      },
    },
  });
  const Surface = module.MergePlaySurface as React.ComponentType<MergePlaySurfaceProps>;
  const props: MergePlaySurfaceProps = {
    state: world, selectedCell: null, inspectedCell: null, width: 400,
    sessionId: 'surface-test' as MergePlaySurfaceProps['sessionId'],
    railHidden: true, counterHidden: true, inspectorHidden: true,
    trayEntries: [], parcelTargetRef: { current: null }, onCommand: () => null,
    onSelect() {}, onOpenChat() {}, onOpenParcel() {}, onReroll() {}, onServe: () => false, onUseGrovelight() {},
  };
  const layout = async (tree: ReactTestRenderer) => {
    const stage = tree.root.findAllByType(host('View')).find((view) => view.props.onLayout && view.props.pointerEvents === undefined)!;
    await act(async () => stage.props.onLayout({ nativeEvent: { layout: { height: 500, width: 400 } } }));
  };
  return { Surface, Context, props, store, mission, world, layout, selectorCalls: () => selectorCalls, boardRenders: () => boardRenders };
}

test('combat mounts and updates its supplied board after layout without a world provider', async () => {
  const f = fixture();
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<f.Surface {...f.props} boardState={f.mission} />); });
  await f.layout(tree!);
  assert.equal(tree!.root.findByType(host('Board')).props.state, f.mission);
  const moved = { ...f.mission, updatedAt: 3000 };
  await act(async () => tree!.update(<f.Surface {...f.props} boardState={moved} />));
  assert.equal(tree!.root.findByType(host('Board')).props.state, moved);
  assert.equal(f.selectorCalls(), 0, 'an independent board never subscribes to the world');
  await act(async () => tree!.unmount());
});

test('parent UI updates skip the board with equivalent gates, but changed tutorial gates and commands stay live', async () => {
  const f = fixture();
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<f.Surface {...f.props} boardState={f.mission} boardInteractionGate={{ kind: 'open' }} />); });
  await f.layout(tree!);
  const before = f.boardRenders();
  for (let i = 0; i < 12; i++) {
    await act(async () => tree!.update(<f.Surface {...f.props} boardState={f.mission} boardInteractionGate={{ kind: 'open' }} trayEntries={[]} onOpenChat={() => {}} />));
  }
  assert.equal(f.boardRenders(), before, 'cosmetic parent updates must not render the board');
  await act(async () => tree!.update(<f.Surface {...f.props} boardState={f.mission} boardInteractionGate={{ kind: 'locked' }} />));
  assert.equal(f.boardRenders(), before + 1);
  assert.equal(tree!.root.findByType(host('Board')).props.interactionGate.kind, 'locked');
  const onCommand = () => null;
  await act(async () => tree!.update(<f.Surface {...f.props} boardState={f.mission} boardInteractionGate={{ kind: 'locked' }} onCommand={onCommand} />));
  assert.equal(f.boardRenders(), before + 2);
  assert.equal(tree!.root.findByType(host('Board')).props.onCommand, onCommand);
  await act(async () => tree!.unmount());
});

test('an explicitly empty mission board never falls back to world state', async () => {
  const f = fixture();
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<f.Surface {...f.props} boardState={null} />); });
  await f.layout(tree!);
  assert.equal(tree!.root.findAllByType(host('Board')).length, 0);
  assert.equal(f.selectorCalls(), 0);
  await act(async () => tree!.unmount());
});

test('ordinary merge pages still follow their provider and can switch to an independent board', async () => {
  const f = fixture();
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<f.Context value={f.store}><f.Surface {...f.props} /></f.Context>); });
  await f.layout(tree!);
  assert.equal(tree!.root.findByType(host('Board')).props.state, f.world);
  const nextWorld = { ...f.world, board: [...f.world.board] };
  await act(async () => f.store.publish({ state: nextWorld }));
  assert.equal(tree!.root.findByType(host('Board')).props.state, nextWorld);
  await act(async () => tree!.update(<f.Context value={f.store}><f.Surface {...f.props} boardState={f.mission} /></f.Context>));
  const calls = f.selectorCalls();
  await act(async () => f.store.publish({ state: null }));
  assert.equal(tree!.root.findByType(host('Board')).props.state, f.mission);
  assert.equal(f.selectorCalls(), calls, 'world changes stop waking the independent board');
  await act(async () => tree!.unmount());
});
