import assert from 'node:assert/strict';
import test from 'node:test';

import { encounterLiveCast } from '@/constants/encounter-cast';
import { lifeAspects } from '@/constants/life-aspects';
import type { HomeDayRecord, LocalCreatureRecord, StoredHomeDayRecord } from '@/types/home';
import { buildDex } from '@/utils/dex';
import { identityForEncounter } from '@/utils/katchimera-identity';
import { deriveKingdom } from '@/utils/kingdom-engine';

function creature(
  id: string,
  name: string,
  visualKey: LocalCreatureRecord['visualKey'],
  encounterProfileId: string
): LocalCreatureRecord {
  return {
    id,
    name,
    primaryTrait: 'calm',
    secondaryTrait: 'focus',
    rarity: 'common',
    visualKey,
    accentColor: '#fff',
    highlightMomentId: null,
    highlight: 'A day.',
    reflection: 'A reflection.',
    motifTags: [],
    encounterProfileId,
    repeatDepth: 0,
    ...identityForEncounter(encounterProfileId, visualKey),
  };
}

function day(
  id: string,
  isoDate: string,
  resident: LocalCreatureRecord
): StoredHomeDayRecord {
  return {
    id,
    isoDate,
    state: 'hatched',
    stepsCount: 0,
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    locationSampleCount: 0,
    shareReadyAt: null,
    moments: [],
    locations: [],
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: null,
    promptAnswers: [],
    heroPhoto: null,
    creature: resident,
    card: null,
  };
}

test('every live encounter resolves to a logical aspect and skin', () => {
  const unresolved = encounterLiveCast.filter(
    (entry) => !identityForEncounter(entry.profileId, entry.visualKey)
  );
  assert.deepEqual(unresolved, []);

  const liveAspectIds = new Set(
    encounterLiveCast.flatMap((entry) => {
      const identity = identityForEncounter(entry.profileId, entry.visualKey);
      return identity ? [identity.aspectId] : [];
    })
  );
  assert.equal(liveAspectIds.size, lifeAspects.filter((aspect) => aspect.status === 'live').length);
});

test('Bedrotte and Snoozle are skins of one rest companion', () => {
  const bedrotte = identityForEncounter('location_home_evening_bedrotte', 'bedrotte');
  const snoozle = identityForEncounter('state_well_rested_snoozle', 'snoozle');
  assert.equal(bedrotte?.aspectId, 'rest-sleep');
  assert.equal(snoozle?.aspectId, 'rest-sleep');
  assert.equal(bedrotte?.companionId, snoozle?.companionId);
  assert.equal(bedrotte?.familyId, 'sleep-rest');
  assert.notEqual(bedrotte?.skinId, snoozle?.skinId);
});

test('Creamalume is a Tasklet skin rather than a duplicate work-focus role', () => {
  const tasklet = identityForEncounter('activity_focus_block_tasklet', 'tasklet');
  const creamalume = identityForEncounter('onboarding_reveal_creamalume', 'creamalume');
  assert.equal(tasklet?.familyId, 'tasklet');
  assert.equal(creamalume?.familyId, 'tasklet');
  assert.equal(tasklet?.companionId, creamalume?.companionId);
  assert.notEqual(tasklet?.skinId, creamalume?.skinId);
});

test('Kingdom keeps both hatch records under one logical resident id', () => {
  const days = [
    day('day-1', '2026-07-20', creature('legacy-bed', 'Bedrotte', 'bedrotte', 'location_home_evening_bedrotte')),
    day('day-2', '2026-07-21', creature('legacy-snooze', 'Snoozle', 'snoozle', 'state_well_rested_snoozle')),
  ];
  const kingdom = deriveKingdom(days as HomeDayRecord[]);
  assert.equal(kingdom.creatures.length, 2, 'day provenance remains intact');
  assert.equal(kingdom.creatures[0]?.creatureId, 'companion:sleep-rest');
  assert.equal(kingdom.creatures[1]?.creatureId, 'companion:sleep-rest');
  assert.equal(new Set(kingdom.creatures.map((entry) => entry.creatureId)).size, 1);
});

test('Dex is family-first and exposes Bedrotte and Snoozle as unlocked forms', () => {
  const days = [
    day('day-1', '2026-07-20', creature('legacy-bed', 'Bedrotte', 'bedrotte', 'location_home_evening_bedrotte')),
    day('day-2', '2026-07-21', creature('legacy-snooze', 'Snoozle', 'snoozle', 'state_well_rested_snoozle')),
  ];
  const dex = buildDex(
    { 'sleep-rest': { count: 2, lastSeenIsoDate: '2026-07-21' } },
    days
  );
  const rest = dex.entries.find((entry) => entry.familyId === 'sleep-rest');
  assert.equal(dex.total, 56);
  assert.equal(rest?.totalHatches, 2);
  assert.deepEqual(
    rest?.forms.filter((form) => form.unlocked).map((form) => form.skinId).sort(),
    ['bedrotte', 'snoozle']
  );
});

test('broad life categories do not merge distinct companions', () => {
  const pairs = [
    [
      identityForEncounter('subject_feast_feastle', 'feastle'),
      identityForEncounter('location_bakery_crumbun', 'crumbun'),
    ],
    [
      identityForEncounter('subject_gym_day_flexel', 'flexel'),
      identityForEncounter('activity_run_session_sprintail', 'sprintail'),
    ],
    [
      identityForEncounter('subject_dog_companion_waglet', 'waglet'),
      identityForEncounter('subject_cat_companion_whiskit', 'whiskit'),
    ],
    [
      identityForEncounter('state_night_owl_vesperitt', 'vesperitt'),
      identityForEncounter('state_first_light_dawnle', 'dawnle'),
    ],
  ];
  for (const [left, right] of pairs) {
    assert.notEqual(left?.familyId, right?.familyId);
    assert.notEqual(left?.companionId, right?.companionId);
  }
});
