import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';

import { OPENING_WISPS, STEPPLING_WISPS, wispHitPlan, wispStates, wispTargetIndex } from '@/features/onboarding/corruption-wisps';
import { OPENING_MERGE_REQUIRED } from '@/features/onboarding/opening-mist';
import { STEPPLING_MISSION_MERGE_REQUIRED } from '@/features/onboarding/steppling-mission';

test('the clearing is dealt across the wisps in order: each takes its share, they fall one after another, the last on the final merge', () => {
  assert.deepEqual(wispHitPlan(7, 3), [3, 2, 2]);
  assert.deepEqual(wispHitPlan(12, 4), [3, 3, 3, 3]);
  assert.deepEqual(wispHitPlan(5, 0), []);
  assert.equal(wispHitPlan(OPENING_MERGE_REQUIRED, OPENING_WISPS.length).reduce((sum, hp) => sum + hp, 0), OPENING_MERGE_REQUIRED);
  assert.equal(wispHitPlan(STEPPLING_MISSION_MERGE_REQUIRED, STEPPLING_WISPS.length).reduce((sum, hp) => sum + hp, 0), STEPPLING_MISSION_MERGE_REQUIRED);
  const plan = wispHitPlan(7, 3);
  assert.deepEqual(wispStates(plan, 0).map((wisp) => wisp.alive), [true, true, true]);
  assert.deepEqual(wispStates(plan, 3).map((wisp) => [wisp.hits, wisp.alive]), [[3, false], [0, true], [0, true]], 'the first falls on its third hit');
  assert.deepEqual(wispStates(plan, 6).map((wisp) => wisp.alive), [false, false, true]);
  assert.deepEqual(wispStates(plan, 7).map((wisp) => wisp.alive), [false, false, false], 'the last falls on the final merge');
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((assigned) => wispTargetIndex(plan, assigned)), [0, 0, 0, 1, 1, 2, 2], 'every merge strikes the first wisp still standing');
  assert.equal(wispTargetIndex(plan, 99), 2, 'with every hit spoken for, the last wisp takes the rest');
  assert.equal(wispTargetIndex([], 0), null);
  for (const spec of [...OPENING_WISPS, ...STEPPLING_WISPS]) {
    assert.ok(spec.fx > 0.15 && spec.fx < 0.85 && spec.fy >= 0.1 && spec.fy <= 0.5, `${spec.id} hangs over the upper half of the tile, clear of the bar and board`);
    assert.ok(spec.size >= 0.15 && spec.size <= 0.22, `${spec.id} is small against the tile`);
  }
});

test('the Glow aims at the wisps: every burst at the first standing, the finale at the last, one hit per burst, a flinch per token', () => {
  const dock = readFileSync('components/katchadeck/world/kingdom-opening-merge-dock.tsx', 'utf8');
  assert.match(dock, /export type GlowSink = \{\s*aim: \(kind: 'glow' \| 'finale'\) => \{ point: RewardFlightPoint; key: number \} \| null;\s*struck: \(key: number\) => void;\s*landed: \(key: number, kind: 'glow' \| 'finale'\) => void;\s*\};/);
  assert.match(dock, /const aimed = targetNode \? null : sinkRef\.current\?\.aim\('glow'\) \?\? null;[\s\S]*?if \(aimed\) \{ push\(aimed\.point\); return; \}/, 'a burst goes to the wisp the sink names');
  assert.match(dock, /const aimed = sinkRef\.current\?\.aim\('finale'\) \?\? null;[\s\S]*?if \(aimed\) \{ push\(aimed\.point\); return id; \}/, 'the finale item strikes the last wisp');
  assert.match(dock, /if \(struck\?\.key != null\) \{\s*sinkRef\.current\?\.struck\(struck\.key\);\s*if \(struck\.group != null && !landedGroups\.current\.has\(struck\.group\)\) \{\s*landedGroups\.current\.add\(struck\.group\);\s*sinkRef\.current\?\.landed\(struck\.key, finale \? 'finale' : 'glow'\);/, 'a flinch per token, a hit per burst');
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.match(screen, /\? \{ key: STEPPLING_MISSION_ID, node: gatewayTileNode, required: STEPPLING_MISSION_MERGE_REQUIRED, merges: stepplingMission\.merges, specs: STEPPLING_WISPS \}/);
  assert.match(screen, /\? \{ key: 'opening-mist', node: homeTileNode, required: OPENING_MERGE_REQUIRED, merges: openingProgress, specs: OPENING_WISPS \}/);
  assert.match(screen, /const wisps = useCorruptionWisps\(wispTarget\);\s*openingGlow\.sinkRef\.current = wisps\.sink;/, 'the screen hands the wisps to the Glow every render');
  assert.match(screen, /\{wisps\.visible \? <CorruptionWispLayer wisps=\{wisps\} screenRef=\{screenRef\} \/> : null\}\s*\{openingGlow\.flights\.length/, 'the wisps sit under the Glow flights');
  const layer = readFileSync('components/katchadeck/world/corruption-wisp-layer.tsx', 'utf8');
  assert.match(layer, /const WISP_ART = require\('@incubator\/art-cutouts\/corruption-wisp\.png'\);/);
  assert.match(layer, /assignedRef\.current = target\.merges;\s*setLanded\(target\.merges\);/, 'a resumed board starts with the wisps its merges already felled');
  assert.match(layer, /withSequence\(\s*withTiming\(1, \{ duration: 40 \}\),\s*withTiming\(-1, \{ duration: 60 \}\)/, 'a struck wisp flinches');
  assert.match(layer, /death\.value = withTiming\(1, \{ duration: reduceMotion \? 160 : DEATH_MS, easing: Easing\.in\(Easing\.cubic\) \}\);/, 'a felled wisp shrinks away');
  assert.match(layer, /\{!alive \? <DeathBurst size=\{size\} reduceMotion=\{reduceMotion\} \/> : null\}/, 'and throws its embers');
  assert.match(layer, /const LINGER_MS = 800;/, 'the layer stays for the last death to play');
  // A wisp arrives: it swells up from nothing with an overshoot, staggered after the one before, and shivers into place; one already felled never appears.
  assert.match(layer, /entrance\.value = withDelay\(delay, withTiming\(1, \{ duration: ENTRANCE_MS, easing: Easing\.out\(Easing\.back\(1\.6\)\) \}\)\);/);
  assert.match(layer, /const delay = index \* ENTRANCE_STAGGER_MS;/);
  assert.match(layer, /shake\.value = withDelay\(delay \+ ENTRANCE_MS - 80, withSequence\(/, 'a small shake as it settles');
  assert.match(layer, /const \[gone, setGone\] = useState\(\(\) => !alive\);/);
  assert.match(layer, /\{ scale: arriving \* \(1 \+ Math\.abs\(shake\.value\) \* 0\.06\) \* \(1 - dying \* 0\.85\) \},/);
  // Never unmounted between the mission's last frame and the lift: a felled wisp stays gone instead of replaying its death.
  assert.match(layer, /if \(target\) \{ setHeld\(true\); return; \}\s*const timer = setTimeout\(\(\) => \{ setHeld\(false\);/);
  assert.match(layer, /visible: Boolean\(shownFrame && specs\.length && \(target \|\| held\)\),/);
  assert.doesNotMatch(layer, /setLinger|linger\?\./, 'no second mount for a linger');
  assert.match(layer, /const states = useMemo\(\(\) => wispStates\(plan, landed\), \[landed, plan\]\);/, 'the dead stay dead by the same count that felled them');
});
