import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { companionHasPage, SHARED_GARDEN_CREATURE_ID } from '@/features/companion/companion-page-policy';
import { HATCHABLE_COMPANIONS } from '@/constants/hatchable-companions/registry';
import { katchimeraFamilies } from '@/constants/katchimera-skins';
import { createInitialMergeWorldState, normalizeMergeWorldState } from '@/utils/merge-world/engine';
import { withDiscoveredKatchimeras } from '@/utils/discovered-katchimera-availability';
import { deriveKingdom } from '@/utils/kingdom-engine';
import type { CompanionDiscoveryRecord } from '@/types/merge-world';

const NOW = Date.UTC(2026, 8, 14, 9);
const record = (characterId: CompanionDiscoveryRecord['characterId']): CompanionDiscoveryRecord => ({
  characterId, source: 'board_discovery', gateId: `discovery:${characterId}`, pathId: null,
  discoveredAt: NOW, revealSeenAt: NOW, firstOrderCompletedAt: null, permanentFeatureId: null,
});

test('only Mossprout and the hatchable friends have a companion page; every other family is roster and Dex only', () => {
  assert.equal(companionHasPage('mossprout'), true);
  for (const definition of HATCHABLE_COMPANIONS) assert.equal(companionHasPage(definition.companion), true, definition.companion);
  const pageFamilies = new Set(['mossprout', ...HATCHABLE_COMPANIONS.map((definition) => definition.companion)]);
  for (const family of katchimeraFamilies) {
    assert.equal(companionHasPage(family.id), pageFamilies.has(family.id), family.id);
  }
  assert.equal(companionHasPage('feastle'), false);
  assert.equal(companionHasPage(null), false);
  assert.equal(companionHasPage(undefined), false);
  assert.equal(SHARED_GARDEN_CREATURE_ID, 'companion:mossprout');
});

test('a discovery record for a family without a page is dropped durably, and never projected into the roster', () => {
  const world = createInitialMergeWorldState(NOW, ['mossprout']);
  const stale = { ...world, companionDiscovery: { ...world.companionDiscovery, records: [...world.companionDiscovery.records, record('feastle'), record('steppling')] } };
  const normalized = normalizeMergeWorldState(JSON.parse(JSON.stringify(stale)));
  const kept = normalized.companionDiscovery.records.map((entry) => entry.characterId);
  assert.equal(kept.includes('feastle'), false, 'the Feastle record is gone');
  assert.equal(kept.includes('steppling'), true, 'a page family’s record stays');
  assert.equal(normalized.unlockedCharacters.includes('feastle'), false, 'no unlocked character without a record');
  const legacy = normalizeMergeWorldState({ ...JSON.parse(JSON.stringify(world)), companionDiscovery: undefined, unlockedCharacters: ['mossprout', 'bedrotte'] });
  assert.deepEqual(legacy.companionDiscovery.records.map((entry) => entry.characterId), ['mossprout'], 'a legacy unlocked list is filtered the same way');
  const kingdom = withDiscoveredKatchimeras(deriveKingdom([]), [record('feastle'), record('steppling')]);
  assert.deepEqual(kingdom.creatures.map((creature) => creature.familyId), ['steppling'], 'only the page family is projected');
});

test('no route, roster tap, or page fallback reaches the interaction sheet for a family without a page', () => {
  const route = readFileSync('app/katchimera/[creatureId].tsx', 'utf8');
  assert.match(route, /if \(!companionHasPage\(familyIdFromCompanionId\(creatureId\)\)\) return <Redirect href="\/\(tabs\)\/katchimeras" \/>;/, 'a deep link to a roster-only family goes back to the Kingdom');
  const kingdom = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.match(kingdom, /const tappedFamilyId = \(tappedSlot\?\.kind === 'owned' \? tappedSlot\.familyId : null\) \?\? familyIdFromCompanionId\(creatureId\)[^\n]*\n\s*if \(!companionHasPage\(tappedFamilyId\)\) \{ setDetailCreatureId\(creatureId\); return; \}\s*setDetailCreatureId\(null\);/, 'a resident with no page opens the detail sheet, never the interaction; the family is read from the slot, not the haven presentation');
  const routeScreen = readFileSync('components/katchadeck/world/katchimera-companion-route-screen.tsx', 'utf8');
  assert.doesNotMatch(routeScreen, /STEPPLING_HATCHABLE/, 'no Steppling fallback for a friend without a definition');
  assert.match(routeScreen, /gardenLessonFor\(hatchableRuns, hatchable\)/);
  assert.match(routeScreen, /creatureId: hatchable \? SHARED_GARDEN_CREATURE_ID : creatureId/);
  // The closest-form ("ideal skin") questionnaire is gone from every surface.
  for (const file of ['components/katchadeck/world/companion-interaction-sheet.tsx', 'hooks/use-kingdom-quests.ts', 'components/katchadeck/world/kingdom-companion-screen.tsx', 'types/companion-conversation.ts', 'utils/companion-content-storage.ts']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /idealSkin|IdealSkin|IDEAL_SKIN/, file);
  }
});
