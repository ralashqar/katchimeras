import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolvePresentedAssetStatus,
  settlePresentedAssetResolution,
  type PresentedAssetResolution,
} from '../features/navigation/presented-asset-readiness';

test('a cached display event settles the current focus generation', () => {
  const resolution = settlePresentedAssetResolution(null, {
    generation: 1,
    status: 'displayed',
  });
  assert.equal(resolvePresentedAssetStatus({ active: true, generation: 1, resolution }), 'displayed');
});

test('blur and refocus ignore the previous generation until the new image displays', () => {
  const prior: PresentedAssetResolution = { generation: 1, status: 'displayed' };
  assert.equal(resolvePresentedAssetStatus({ active: false, generation: 1, resolution: prior }), 'inactive');
  assert.equal(resolvePresentedAssetStatus({ active: true, generation: 2, resolution: prior }), 'waiting');

  const current = settlePresentedAssetResolution(prior, { generation: 2, status: 'displayed' });
  const afterStaleCallback = settlePresentedAssetResolution(current, { generation: 1, status: 'fallback' });
  assert.deepEqual(afterStaleCallback, current);
});

test('timeout fallback unblocks readiness and a later display upgrades it', () => {
  const fallback = settlePresentedAssetResolution(null, {
    generation: 3,
    status: 'fallback',
  });
  assert.equal(resolvePresentedAssetStatus({ active: true, generation: 3, resolution: fallback }), 'fallback');

  const displayed = settlePresentedAssetResolution(fallback, {
    generation: 3,
    status: 'displayed',
  });
  assert.equal(resolvePresentedAssetStatus({ active: true, generation: 3, resolution: displayed }), 'displayed');

  const lateError = settlePresentedAssetResolution(displayed, {
    generation: 3,
    status: 'fallback',
  });
  assert.deepEqual(lateError, displayed);
});
