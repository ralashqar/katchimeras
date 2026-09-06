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
  creatureId: 'companion:bedrotte',
  sourceCreatureId: 'hatch-1',
  companionId: 'companion:bedrotte',
  aspectId: 'rest-sleep',
  familyId: 'bedrotte',
  skinId: 'bedrotte',
  name: 'Bedrotte',
  visualKey: 'bedrotte',
  rarity: 'common',
  accentColor: '#F0C9A0',
};

test('production wardrobe shows approved Rest forms without granting ownership', () => {
  const skins = skinsForKingdomCompanion('bedrotte', new Set());
  assert.deepEqual(
    skins.map((skin) => skin.id),
    ['bedrotte', 'snoozle', 'vesperitt', 'duskle', 'twinklet']
  );
  assert.equal(skins.every((skin) => !skin.unlocked), true);
});

test('placeholder forms and newly illustrated parent forms are selectable', () => {
  const commute = skinsForKingdomCompanion('skylo', new Set());
  assert.deepEqual(
    commute.map((skin) => [skin.id, skin.visualKey]),
    [['skylo', 'skylo'], ['neonpoko', 'neonpoko'], ['signalhop', 'neonpoko']]
  );
  assert.deepEqual(
    skinsForKingdomCompanion('kindling', new Set()).map((skin) => skin.id),
    ['kindling']
  );
  assert.deepEqual(
    skinsForKingdomCompanion('feastle', new Set()).map((skin) => [skin.id, skin.visualKey]),
    [
      ['feastle', 'feastle'],
      ['cartle', 'feastle'],
      ['crumbun', 'crumbun'],
      ['hayhorn', 'hayhorn'],
      ['crustling', 'crustling'],
      ['nigirimp', 'nigirimp'],
      ['noodloo', 'noodloo'],
      ['sundael', 'sundael'],
    ]
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
    version: 3,
    equippedByFamily: { bedrotte: 'snoozle', kindling: 'kindling' },
  });
});

test('equipping a skin changes presentation but preserves companion provenance', () => {
  const wardrobe = equipKatchimeraSkin(
    EMPTY_KATCHIMERA_WARDROBE,
    'bedrotte',
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
    'bedrotte',
    'flexel'
  );
  assert.equal(unchanged, EMPTY_KATCHIMERA_WARDROBE);
  assert.equal(
    applyWardrobeToCreature(restCreature, EMPTY_KATCHIMERA_WARDROBE),
    restCreature
  );
});

test('retired Flexel forms disappear from selection and migrate to the anchor form', () => {
  assert.equal(
    skinsForKingdomCompanion('flexel', new Set()).some(
      (skin) => skin.id === 'voltstep' || skin.id === 'pulsepounce'
    ),
    false
  );

  const retiredCreature: KingdomCreature = {
    ...restCreature,
    creatureId: 'companion:flexel',
    companionId: 'companion:flexel',
    aspectId: 'movement-fitness',
    familyId: 'flexel',
    skinId: 'voltstep',
    name: 'Flexel',
    visualKey: 'voltstep',
  };
  const migrated = applyWardrobeToCreature(retiredCreature, EMPTY_KATCHIMERA_WARDROBE);
  assert.equal(migrated.skinId, 'flexel');
  assert.equal(migrated.visualKey, 'flexel');
});
