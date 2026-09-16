import assert from 'node:assert/strict';
import test from 'node:test';

import { KINGDOM_HEX_TILE_ALPHA_BOUNDS } from '@/constants/kingdom-hex-tile-bounds.gen';
import { hasHatchableTileArt, hatchableCutoutArt, hatchableTileArt } from '@/constants/hatchable-companions/tile-art';
import { hasStoryTileArt, storyTileArt } from '@/constants/story-tiles/tile-art';
import { alphaBounds, clearAlphaBounds, DEFAULT_HEX_ALPHA_BOUNDS, hexAlphaBounds, isAlphaBounds, registerAlphaBounds } from '@/utils/hex-alpha-bounds';
import { artKeys, artSource, artSourceSet, clearArtSources, hasArtSource, registerArtSources, unregisterArtSources } from '@/utils/art-source';

test('art by key: registered art wins, a string is a file, a set falls back to its full size, and nothing is invented', () => {
  clearArtSources();
  assert.equal(artSource('tile:nowhere:full'), null);
  assert.equal(artSourceSet('tile:nowhere'), null);
  registerArtSources({ 'tile:harvest-grove:full': 'file:///packs/harvest/grove.webp', 'cutout:harvest-hare': { uri: 'file:///packs/harvest/hare.png' }, 'item:harvest:apple:1': 42 });
  assert.deepEqual(artSource(artKeys.tile('harvest-grove', 'full')), { uri: 'file:///packs/harvest/grove.webp' });
  assert.deepEqual(artSourceSet('tile:harvest-grove'), { full: { uri: 'file:///packs/harvest/grove.webp' }, medium: { uri: 'file:///packs/harvest/grove.webp' }, thumb: { uri: 'file:///packs/harvest/grove.webp' } }, 'the smaller sizes fall back to the full one');
  registerArtSources({ 'tile:harvest-grove:thumb': 'file:///packs/harvest/grove-256.webp' });
  assert.deepEqual(artSourceSet('tile:harvest-grove')!.thumb, { uri: 'file:///packs/harvest/grove-256.webp' });
  assert.equal(artSource(artKeys.item('harvest:apple:1')), 42);
  assert.equal(hasArtSource(artKeys.cutout('harvest-hare')), true);
  assert.equal(artKeys.island('harvest-isle', 2, 'medium'), 'island:harvest-isle:level:2:medium');
  assert.equal(artKeys.island('harvest-isle', null, 'full'), 'island:harvest-isle:full');
  assert.equal(artKeys.wisp('sprout', true), 'wisp:sprout:thumb');
  // The bundled tables ask here first.
  assert.equal(hasHatchableTileArt('harvest-grove'), true);
  assert.deepEqual(hatchableTileArt('harvest-grove').full, { uri: 'file:///packs/harvest/grove.webp' });
  assert.deepEqual(hatchableCutoutArt('harvest-hare'), { uri: 'file:///packs/harvest/hare.png' });
  assert.equal(hasStoryTileArt('harvest-grove'), true);
  assert.deepEqual(storyTileArt('harvest-grove').medium, { uri: 'file:///packs/harvest/grove.webp' });
  assert.equal(hasHatchableTileArt('steppling-home'), true, 'bundled art still counts');
  assert.equal(hasStoryTileArt('nowhere'), false);
  assert.throws(() => hatchableTileArt('nowhere'), /No cleared tile art/);
  unregisterArtSources(['cutout:harvest-hare']);
  assert.throws(() => hatchableCutoutArt('harvest-hare'), /No cut-out art/);
  clearArtSources();
  assert.equal(hasHatchableTileArt('harvest-grove'), false);
});

test('alpha bounds by key: registered first, the bundled table second, the plain hex box last; a bad box is refused', () => {
  clearAlphaBounds();
  assert.deepEqual(alphaBounds('default_hex_tile.webp'), KINGDOM_HEX_TILE_ALPHA_BOUNDS['default_hex_tile.webp']);
  assert.deepEqual(DEFAULT_HEX_ALPHA_BOUNDS, KINGDOM_HEX_TILE_ALPHA_BOUNDS['default_hex_tile.webp']);
  assert.equal(alphaBounds('island:harvest-isle'), null);
  assert.deepEqual(hexAlphaBounds('island:harvest-isle'), DEFAULT_HEX_ALPHA_BOUNDS, 'a tile nobody measured is a plain hex');
  registerAlphaBounds({ 'island:harvest-isle': { left: 10, top: 20, right: 900, bottom: 800 }, 'island:bad': { left: 10, top: 20, right: 5, bottom: 800 } as never });
  assert.deepEqual(alphaBounds('island:harvest-isle'), { left: 10, top: 20, right: 900, bottom: 800 });
  assert.equal(alphaBounds('island:bad'), null, 'an inverted box is not registered');
  registerAlphaBounds({ 'default_hex_tile.webp': { left: 1, top: 2, right: 3, bottom: 4 } });
  assert.deepEqual(alphaBounds('default_hex_tile.webp'), { left: 1, top: 2, right: 3, bottom: 4 }, 'a pack may re-measure a bundled key');
  assert.equal(isAlphaBounds({ left: 0, top: 0, right: 1, bottom: 1 }), true);
  assert.equal(isAlphaBounds({ left: 0, top: 0, right: 1 }), false);
  assert.equal(isAlphaBounds(null), false);
  clearAlphaBounds();
  assert.deepEqual(alphaBounds('default_hex_tile.webp'), KINGDOM_HEX_TILE_ALPHA_BOUNDS['default_hex_tile.webp']);
});
