import assert from 'node:assert/strict';
import test from 'node:test';

import { ENCOUNTERS, ENCOUNTERS_BUNDLED, encounterById } from '@/constants/encounters/registry';
import { HATCHABLE_COMPANIONS } from '@/constants/hatchable-companions/registry';
import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { MISSIONS } from '@/constants/missions/registry';
import { OLD_GROVE_MISSION } from '@/constants/mossprout-arc-one-copy';
import { encounterFromMission, encounterFromRestoration, encounterMechanicHost, restorationEncounterId } from '@/features/encounter/adapt';
import { restorationMechanicHost, restorationStorageKey } from '@/features/island-restoration/island-restoration';
import { resolveMechanic } from '@/features/mission-mechanics/mechanic';
import { validateMissionDefinition } from '@/features/mission-mechanics/validate';
import { CONTENT_SCHEMA_VERSION } from '@/types/content-pack';

test('every shipped mission board reads as an encounter with no budget and plays by its own mechanic', () => {
  assert.ok(MISSIONS.length >= 4);
  for (const mission of MISSIONS) {
    const encounter = encounterFromMission(mission);
    assert.equal(encounter.id, mission.id);
    assert.equal(encounter.storageKey, mission.storageKey, `${mission.id}: a saved board resumes under its own key`);
    assert.equal(encounter.resolve, null, `${mission.id}: a board from before the pivot has no budget`);
    assert.deepEqual(encounter.mist, []);
    assert.deepEqual(encounter.spawners, []);
    assert.equal(encounter.required, mission.required);
    assert.deepEqual(encounter.seed, mission.seed);
    assert.deepEqual(encounter.wisps, mission.wisps);
    assert.deepEqual(resolveMechanic(encounterMechanicHost(encounter)), resolveMechanic(mission), `${mission.id}: the same rules`);
    assert.deepEqual(validateMissionDefinition(encounter as never), validateMissionDefinition(mission), `${mission.id}: the walk sees the same board`);
  }
  const steppling = HATCHABLE_COMPANIONS.find((definition) => definition.companion === 'steppling')!;
  assert.deepEqual(encounterFromMission(steppling.mission).camera, steppling.mission.camera, 'a hatchable mission keeps the camera its tile is framed with');
  assert.equal(encounterFromMission(OLD_GROVE_MISSION).camera, undefined, 'a journey board has no camera of its own');
});

test('every chapter restoration board reads as an encounter whose delivery is now its cache', () => {
  const boards = ISLAND_CAMPAIGNS.flatMap((campaign) => campaign.chapters.flatMap((chapter) => chapter.restoration ? [{ campaign, chapter, definition: chapter.restoration }] : []));
  assert.ok(boards.length >= 8);
  for (const { campaign, chapter, definition } of boards) {
    const order = chapter.choices[0]!.order.requirements;
    const encounter = encounterFromRestoration(definition, campaign.campaignId, chapter.level, restorationStorageKey(campaign.campaignId, chapter.level), order);
    const name = `${campaign.campaignId}:${chapter.level}`;
    assert.equal(encounter.id, restorationEncounterId(campaign.campaignId, chapter.level));
    assert.equal(encounter.storageKey, restorationStorageKey(campaign.campaignId, chapter.level), `${name}: a saved board resumes`);
    assert.equal(encounter.rows, definition.rows);
    assert.equal(encounter.resolve, null);
    assert.equal(encounter.required, definition.merges);
    assert.deepEqual(encounter.seed.items, definition.items);
    assert.deepEqual(encounter.seed.echoes.map((echo) => echo.cell), definition.echoes.map((echo) => echo.cell));
    assert.deepEqual(encounter.seed.veiled, []);
    const host = restorationMechanicHost(definition);
    assert.deepEqual(resolveMechanic(encounterMechanicHost(encounter)), resolveMechanic(host), `${name}: the same rules`);
    assert.deepEqual(encounter.wisps, host.wisps);
    if (definition.rush) {
      assert.equal(encounter.cache, undefined, `${name}: a rush asks for nothing`);
      continue;
    }
    assert.ok(encounter.cache, `${name}: the Main Board delivery became a cache`);
    assert.deepEqual(encounter.cache.landOn, definition.deliveryCells, `${name}: it lands where deliveries landed`);
    if (definition.request) assert.deepEqual(encounter.cache.contents, { kind: 'twins', max: definition.request.max ?? 2 });
    else assert.deepEqual(encounter.cache.contents, { kind: 'items', items: order.map((entry) => ({ definitionId: entry.definitionId, quantity: entry.quantity })) });
    // A chapter board is authored so its local pieces never finish it alone: the walk stops with wisps standing, which is the beat the cache answers.
    if (!definition.mechanic) assert.ok(validateMissionDefinition(encounter as never).every((issue) => issue.includes('nothing to point at') || issue.includes('dead end')), `${name}: the only issue is the one the cache answers`);
  }
  const petalimp = boards.find(({ campaign }) => campaign.campaignId.includes('petalimp'))!;
  assert.equal(encounterFromRestoration(petalimp.definition, 'x', 1, 'k').cache, undefined, 'no request, no twins: nothing to cache');
});

test('the encounters registry holds every mission board by id and takes pack encounters at schema 7', () => {
  assert.equal(CONTENT_SCHEMA_VERSION, 7);
  assert.deepEqual(ENCOUNTERS_BUNDLED.map((encounter) => encounter.id), MISSIONS.map((mission) => mission.id));
  assert.equal(ENCOUNTERS.length >= ENCOUNTERS_BUNDLED.length, true);
  for (const mission of MISSIONS) assert.equal(encounterById(mission.id)?.storageKey, mission.storageKey);
  assert.equal(encounterById('no-such-encounter'), null);
});
