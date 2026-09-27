import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';
import { readFileSync } from './helpers/content-fs';
import { sharedResidentAnchor } from '@/components/katchadeck/world/shared-resident-presentation';
import type { BattleSource } from '@/features/encounter/battle-session';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;

test('battle resolves the same authored tile for home, trail, rescue and island sources, including old sessions', () => {
  const file = 'components/katchadeck/world/mossprout-hex-neighborhood-scene.ts';
  const art = (id: string) => ({ full: `${id}:full`, medium: `${id}:512`, thumb: `${id}:256` });
  const mocks: Record<string, unknown> = {
    '@/constants/heartwood-art': { HEARTWOOD_ART: Object.fromEntries(['dormant', 'stirring', 'rooted', 'blooming', 'awakened'].map(stage => [stage, art(stage)])) },
    './shared-resident-presentation': { sharedResidentAnchor },
    '@/constants/mossprout-memory-plants': { mossproutMemoryPlantById: new Map() },
    '@/constants/hatchable-companions/tile-art': { hatchableTileArt: art, hatchableMistedTileArt: (id: string) => art(`${id}:misted`) },
    '@/constants/hero-building-art': { heroTileLook: () => null },
    '@/constants/story-tiles/tile-art': { storyTileArt: art, storyTileMistedArt: art },
    '@/components/katchadeck/world/kingdom-hex-scene': { tileVisibleBounds: (x: number, y: number) => ({ left: x - 200, top: y - 200, right: x + 200, bottom: y + 200 }) },
  };
  for (const match of readFileSync(file, 'utf8').matchAll(/require\('([^']+)'\)/g)) mocks[match[1]] = match[1];
  const scene = loadNativeModule(file, mocks);
  const tile = loadNativeModule('features/encounter/battle-tile.ts', {
    '@/components/katchadeck/world/mossprout-hex-neighborhood-scene': scene,
  }) as unknown as typeof import('@/features/encounter/battle-tile');
  const cases: [BattleSource, string][] = [
    [{ kind: 'first', run: 'one' }, 'family:mossprout'],
    [{ kind: 'trail', run: 'one', index: 0 }, 'structure:steppling-home'],
    [{ kind: 'rescue', companion: 'steppling', run: 'one' }, 'structure:steppling-home'],
    [{ kind: 'island', context: { islandId: 'bloom-garden' } } as BattleSource, 'nature:mossprout:bloom-garden'],
    [{ kind: 'island', context: { structureId: 'hollow-tree' } } as BattleSource, 'structure:hollow-tree'],
  ];
  for (const [source, id] of cases) {
    const layer = tile.resolveBattleTile(source);
    assert.equal(layer.id, id);
    const frame = tile.defaultBattleTileFrame(layer, source, 390, 844);
    const scale = frame.width / layer.frame.width;
    assert.ok(Math.abs(frame.left + (layer.focusPoint.x - layer.frame.left) * scale - 195) < 0.001);
    assert.ok(Math.abs(frame.top + (layer.focusPoint.y - layer.frame.top) * scale - 844 * 0.36) < 0.001);
  }
  assert.equal(tile.resolveBattleTile(cases[1]![0]).source, 'steppling-home:misted:full');
});

test('tile readiness waits for base and overlay; repeated board renders retain the native images', async () => {
  let resolutions = 0, ready = 0;
  const module = loadNativeModule('components/katchadeck/games/battle-tile.tsx', {
    'react-native': nativeViews,
    'expo-image': { Image: host('Image') },
    '@/features/encounter/battle-tile': { resolveBattleTile: () => { resolutions++; return {}; }, defaultBattleTileFrame: () => ({ left: 0, top: 0, width: 200, height: 180 }) },
    '@/utils/world-visuals': { kingdomHexTileSourceForLod: () => 1, kingdomHexTileOverlaySourceForLod: () => 2 },
  });
  const Tile = module.BattleTile as React.ComponentType<any>;
  const frame = { left: -127, top: 24, width: 644, height: 520 };
  const props = { session: { source: { kind: 'first' }, tileFraming: { frame, viewport: { width: 390, height: 844 } } },
    width: 390, height: 844, onReady: () => ready++, onError() {} };
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<Tile {...props} />); });
  assert.deepEqual({ ...tree.root.findByType(nativeViews.View).props.style }, { position: 'absolute', ...frame });
  const images = tree.root.findAllByType(host('Image'));
  await act(async () => images[0]!.props.onLoad());
  assert.equal(ready, 0);
  await act(async () => images[1]!.props.onLoad());
  assert.equal(ready, 1);
  await act(async () => { tree.update(<Tile {...props} />); });
  assert.equal(resolutions, 1);
  assert.equal(tree.root.findAllByType(host('Image'))[0], images[0]);
  await act(async () => tree.unmount());
});
