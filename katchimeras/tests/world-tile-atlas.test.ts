import assert from 'node:assert/strict';
import test from 'node:test';

import {
  packWorldTileAtlasDescriptors,
  WORLD_TILE_ATLAS_INNER_SIZE,
  WORLD_TILE_ATLAS_MAX_ENTRIES,
} from '../utils/world-tile-atlas';

function descriptors(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `tile-${index}`,
    // Metro module IDs are numbers at runtime, so numeric fixtures also test
    // the production source-key path without importing image files in Node.
    source: index + 1,
  }));
}

test('packs twelve medium tiles into one 2048 atlas page', () => {
  const packing = packWorldTileAtlasDescriptors(descriptors(12));
  assert.equal(packing.pageCount, 1);
  assert.equal(packing.entries.length, 12);
  assert.equal(packing.overflow.length, 0);
  assert.equal(WORLD_TILE_ATLAS_INNER_SIZE, 504);
});

test('packs seventeen tiles over two stable pages', () => {
  const packing = packWorldTileAtlasDescriptors(descriptors(17));
  assert.equal(packing.pageCount, 2);
  assert.equal(packing.entries[15].pageIndex, 0);
  assert.equal(packing.entries[16].pageIndex, 1);
});

test('keeps the thirty-third unique source on the native fallback path', () => {
  const packing = packWorldTileAtlasDescriptors(descriptors(33));
  assert.equal(packing.entries.length, WORLD_TILE_ATLAS_MAX_ENTRIES);
  assert.equal(packing.overflow.length, 1);
  assert.equal(packing.overflow[0].id, 'tile-32');
});

test('deduplicates a shared environment bitmap without changing first-seen order', () => {
  const packing = packWorldTileAtlasDescriptors([
    { id: 'home', source: 7 },
    { id: 'resident-a', source: 8 },
    { id: 'resident-b', source: 7 },
  ]);
  assert.deepEqual(
    packing.entries.map((entry) => entry.descriptor.id),
    ['home', 'resident-a'],
  );
});
