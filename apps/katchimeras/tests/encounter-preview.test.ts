import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';

import { HATCHABLE_COMPANIONS } from '@/constants/hatchable-companions/registry';
import { OLD_GROVE_MISSION } from '@/constants/mossprout-arc-one-copy';
import { encounterProfile } from '@/features/encounter/spawner-profile';
import { solveEncounter } from '@/features/encounter/solvability';
import { validateEncounterDefinition } from '@/features/encounter/validate-encounter';
import { ENCOUNTER_LOSS, encounterLine, gradeLabel, KEEP_GOING_RESOLVE, outcomeLine } from '@/features/encounter/encounter-copy';
import { DARK_WISPS_PREVIEW, previewMissionStorageKey, resolveEncounterForPlay, resolveMissionForPlay, resolveRestorationForPlay } from '@/features/mission-mechanics/preview';
import { PETALIMP_BLOOM_CAMPAIGN } from '@/constants/island-campaigns/petalimp-bloom';

const SHIPPED = [...HATCHABLE_COMPANIONS.map((definition) => definition.mission), OLD_GROVE_MISSION];

test('the Dark Wisps preview lays a sound encounter over every shipped mission, under its own key, and the search clears it inside its Resolve', () => {
  for (const mission of SHIPPED) {
    const encounter = resolveEncounterForPlay(mission, 'dark-wisps')!;
    assert.ok(encounter, mission.id);
    assert.equal(encounter.storageKey, previewMissionStorageKey(mission.storageKey, 'dark-wisps'));
    assert.equal(encounter.resolve, DARK_WISPS_PREVIEW.resolve);
    assert.equal(encounter.mechanic?.kind, 'dark-wisps');
    assert.equal(encounter.spawners.length, 1);
    assert.deepEqual(validateEncounterDefinition(encounter), [], `${mission.id}: ${validateEncounterDefinition(encounter).join(' | ')}`);
    const solution = solveEncounter(encounter);
    assert.ok(solution.minActions != null && solution.minActions + 2 <= encounter.resolve!, `${mission.id}: shortest play ${solution.minActions} inside ${encounter.resolve}`);
  }
  assert.equal(resolveEncounterForPlay(SHIPPED[0]!, 'column-shot'), null);
  assert.equal(resolveEncounterForPlay(SHIPPED[0]!, null), null);
  assert.equal(resolveMissionForPlay(SHIPPED[0]!, 'dark-wisps'), SHIPPED[0], 'the mission itself is untouched under the encounter preview');
  const board = PETALIMP_BLOOM_CAMPAIGN.chapters[0]!.restoration!;
  assert.equal(resolveRestorationForPlay(board, 'dark-wisps'), board);
});

test('the copy keeps the lore’s voice: the loss is the Mist being thick, the grade is a label, the friend speaks and the Mist never shouts', () => {
  assert.equal(ENCOUNTER_LOSS.title, 'The Mist is still too thick.');
  assert.doesNotMatch(ENCOUNTER_LOSS.title + ENCOUNTER_LOSS.body, /!/);
  assert.match(ENCOUNTER_LOSS.keepGoing, new RegExp(`\\+${KEEP_GOING_RESOLVE} Resolve`));
  assert.deepEqual(['cleared', 'bright', 'perfect'].map((grade) => gradeLabel(grade as never)), ['Cleared', 'Bright clear', 'Perfect clear']);
  assert.equal(outcomeLine('perfect', { continues: 1, rescued: false }), 'Cleared, eventually. It held on. So did you.');
  assert.equal(encounterLine('lowResolve', { remaining: 2, katchimera: 'mossprout', ability: 'Bloom' }), '2 left. Make them count.');
  assert.equal(encounterLine('abilityReady', { remaining: 9, katchimera: 'steppling', ability: 'Clear Path' }), 'I can clear a path through the Mist. Point me at it.');
  assert.equal(encounterLine('abilityReady', { remaining: 9, katchimera: null, ability: null }), '', 'the Mist has no ability to speak of');
  for (const katchimera of [null, 'mossprout', 'steppling', 'baristabbit'] as const) {
    for (const event of ['enter', 'lowResolve', 'spawnerEmpty', 'stuck'] as const) {
      const line = encounterLine(event, { remaining: 3, katchimera, ability: null });
      assert.ok(line.length > 0, `${katchimera ?? 'mist'} says something on ${event}`);
      if (!katchimera) assert.doesNotMatch(line, /!/, 'the Mist never shouts');
    }
  }
});

test('the Haven’s profile reaches the run and the dock reads the encounter state the hook hands it', () => {
  assert.equal(encounterProfile(null, null).startingResolve, 0);
  const hook = readFileSync('features/onboarding/use-mist-mission.ts', 'utf8');
  const dock = readFileSync('components/katchadeck/world/hatchable-mission-dock.tsx', 'utf8');
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.match(hook, /const encounter = useMemo\(\(\) => authored \?\? \(mission \? resolveEncounterForPlay\(mission, preview\) : null\)/, 'an authored encounter, or the preview laid over the mission');
  assert.match(hook, /encounterRunId\(encounter, attempt, effectiveLoadout\)/, 'a new attempt is a new run');
  assert.match(hook, /if \(!active \|\| !encounter \|\| store\.status !== 'stuck'\) return;[\s\S]*?openCache\(\)/, 'a spent board opens its cache on its own');
  assert.match(hook, /\.\.\.\(mechanic\?\.kind === 'dark-wisps' \|\| mechanic\?\.kind === 'lanes' \? \{ live \} : \{\}\)/, 'Dark Wisps and Lanes reach the layer through a live store');
  assert.match(dock, /encounter\.status === 'failed' \?/, 'the loss lies over the board');
  assert.match(dock, /ENCOUNTER_LOSS\.retry[\s\S]*?ENCOUNTER_LOSS\.keepGoing/, 'with the ways on');
  assert.match(dock, /const pickCells = picking && ability \? ability\.targets : \[\];/, 'a pick lights the ability’s targets');
  assert.match(dock, /pickCells\.map\(\(cell\) =>/);
  assert.match(dock, /accessibilityLabel=\{encounter\.resolveLeft == null \? 'No Resolve budget' : `Resolve \$\{encounter\.resolveLeft\}`\}/, 'the Resolve pill is read out');
  assert.match(screen, /encounter=\{hatchableMist\.encounter\}/);
  assert.match(screen, /encounter=\{journeyMist\.encounter\}/);
});
