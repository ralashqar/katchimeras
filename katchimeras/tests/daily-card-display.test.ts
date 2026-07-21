import assert from 'node:assert/strict';
import test from 'node:test';

import { compactFacetValue, compactHighlight, formatCardSteps } from '../utils/daily-card-display';
import type { CardFacet } from '../types/home';

function facet(key: CardFacet['key'], value: string): CardFacet {
  return { evidence: [], iconKey: '', key, label: key, value };
}

test('compact facets replace empty states and shorten broad place labels', () => {
  assert.equal(compactFacetValue(facet('social', 'Not noted')), '—');
  assert.equal(compactFacetValue(facet('place', 'Park or green space')), 'Park');
  assert.equal(compactFacetValue(facet('place', 'Somewhere else')), 'Out');
});

test('compact highlights reduce narrative sentences to glanceable titles', () => {
  assert.equal(compactHighlight('Returning to cinema moments is deepening your bond.'), 'Cinema');
  assert.equal(compactHighlight('A long evening walk through the park.'), 'Park walk');
  assert.equal(compactHighlight(''), 'Quiet moment');
});

test('card steps use a large compact counter format', () => {
  assert.equal(formatCardSteps(924), '924');
  assert.equal(formatCardSteps(5000), '5k');
  assert.equal(formatCardSteps(5316), '5.3k');
  assert.equal(formatCardSteps(12_480), '12k');
});
