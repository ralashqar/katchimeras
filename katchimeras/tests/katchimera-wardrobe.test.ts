import assert from 'node:assert/strict';
import test from 'node:test';

import type { KingdomCreature } from '@/types/kingdom';
import {
  EMPTY_KATCHIMERA_WARDROBE,
  applyWardrobeToCreature,
  equipKatchimeraSkin,
  normalizeKatchimeraWardrobe,
  skinsForKingdomCompanion,
} from '@/utils/katchimera-wardrobe';

const restCreature: KingdomCreature = {
  dayId: 'day-1',
  isoDate: '2026-07-25',
  creatureId: 'companion:sleep-rest',
  sourceCreatureId: 'hatch-1',
  companionId: 'companion:sleep-rest',
  aspectId: 'rest-sleep',
  familyId: 'sleep-rest',
  skinId: 'bedrotte',
  name: 'Bedrotte',
  visualKey: 'bedrotte',
  rarity: 'common',
  accentColor: '#F0C9A0',
};

test('testing wardrobe unlocks only the approved Rest family', () => {
  const skins = skinsForKingdomCompanion('sleep-rest', new Set());
  assert.deepEqual(
    skins.map((skin) => skin.id),
    ['bedrotte', 'snoozle']
  );
  assert.equal(skins.every((skin) => skin.unlocked), true);
});

test('playable placeholder forms appear while artless planned forms stay hidden', () => {
  const commute = skinsForKingdomCompanion('signalhop', new Set());
  assert.deepEqual(
    commute.map((skin) => [skin.id, skin.visualKey]),
    [['signalhop', 'neonpoko']]
  );
  assert.equal(
    skinsForKingdomCompanion('kindling', new Set()).length,
    0
  );
});

test('wardrobe normalization drops cross-aspect and missing-art selections', () => {
  const normalized = normalizeKatchimeraWardrobe({
    version: 1,
    equippedByAspect: {
      'rest-sleep': 'snoozle',
      'movement-fitness': 'bedrotte',
      'contribution-community': 'kindling',
      'not-an-aspect': 'snoozle',
    },
  });
  assert.deepEqual(normalized, {
    version: 2,
    equippedByFamily: { 'sleep-rest': 'snoozle' },
  });
});

test('equipping a skin changes presentation but preserves companion provenance', () => {
  const wardrobe = equipKatchimeraSkin(
    EMPTY_KATCHIMERA_WARDROBE,
    'sleep-rest',
    'snoozle'
  );
  const presented = applyWardrobeToCreature(restCreature, wardrobe);

  assert.equal(presented.skinId, 'snoozle');
  assert.equal(presented.visualKey, 'snoozle');
  assert.equal(presented.creatureId, restCreature.creatureId);
  assert.equal(presented.sourceCreatureId, restCreature.sourceCreatureId);
  assert.equal(presented.dayId, restCreature.dayId);
});

test('invalid equipment cannot cross companion boundaries', () => {
  const unchanged = equipKatchimeraSkin(
    EMPTY_KATCHIMERA_WARDROBE,
    'sleep-rest',
    'flexel'
  );
  assert.equal(unchanged, EMPTY_KATCHIMERA_WARDROBE);
  assert.equal(
    applyWardrobeToCreature(restCreature, EMPTY_KATCHIMERA_WARDROBE),
    restCreature
  );
});
