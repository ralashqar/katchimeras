import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';

import { ISLAND_WISP_LINES, OPENING_WISP_LINES, OPENING_WISPS, STEPPLING_WISP_LINES, STEPPLING_WISPS, wispHitPlan, wispLineForFall, wispStates, wispTargetIndex, wispsForClearing } from '@/features/onboarding/corruption-wisps';
import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
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
  // The wisps answer back: a line per fall, the last line for the last, and a fallback that counts what is left.
  assert.equal(wispLineForFall(OPENING_WISP_LINES, 1, 3), 'One gone. Two still hold it.');
  assert.equal(wispLineForFall(OPENING_WISP_LINES, 3, 3), 'Now look.');
  assert.equal(wispLineForFall(STEPPLING_WISP_LINES, 4, 4), 'The last one falls. Look what it was sitting on.');
  assert.equal(wispLineForFall(ISLAND_WISP_LINES, 2, 4), 'Another gone.');
  assert.equal(wispLineForFall({ firstStrike: '', fell: [], last: 'x' }, 1, 4), '3 still hold it.');
  for (const lines of [OPENING_WISP_LINES, STEPPLING_WISP_LINES, ISLAND_WISP_LINES, ...ISLAND_CAMPAIGNS.flatMap((campaign) => campaign.copy.wispLines ? [campaign.copy.wispLines] : [])]) {
    for (const line of [lines.firstStrike, ...lines.fell, lines.last]) assert.doesNotMatch(line, /!/, 'no exclamation marks in the Mist’s presence');
  }
  // A friend's board: three wisps over a short bar, four over a long one, and every authored stage gets a set whose hits sum to its bar.
  assert.equal(wispsForClearing(5), OPENING_WISPS);
  assert.equal(wispsForClearing(7), STEPPLING_WISPS);
  for (const campaign of ISLAND_CAMPAIGNS) {
    for (const chapter of campaign.chapters) {
      if (!chapter.restoration) continue;
      const specs = wispsForClearing(chapter.restoration.merges);
      assert.equal(wispHitPlan(chapter.restoration.merges, specs.length).reduce((sum, hp) => sum + hp, 0), chapter.restoration.merges, `${campaign.campaignId} level ${chapter.level}`);
    }
  }
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
  // A strike on a wisp bursts as light meeting corruption: hot core, magenta ring, a dark puff, sparks and ember shards; the mist's own burst is untouched.
  assert.match(dock, /\{ id, wisp: landed\.key != null, at: \{/);
  assert.match(dock, /impact\.wisp\s*\? <WispStrikeBurst key=\{impact\.id\}[\s\S]*?: <ImpactBurst key=\{impact\.id\}/);
  assert.match(dock, /function WispStrikeBurst\(\{ x, y, onDone \}/);
  assert.match(dock, /const reach = 1 - Math\.pow\(1 - t\.value, 2\.2\);/, 'shards fly out with drag');
  assert.match(dock, /tintColor=\{STRIKE_PUFF\}/, 'the dark puff is the wisp’s own colour');
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.match(screen, /\? \{ key: STEPPLING_MISSION_ID, node: gatewayTileNode, required: STEPPLING_MISSION_MERGE_REQUIRED, merges: stepplingMission\.merges, specs: STEPPLING_WISPS, lines: STEPPLING_WISP_LINES, settled: ftueCameraSettled \}/);
  assert.match(screen, /\? \{ key: 'opening-mist', node: homeTileNode, required: OPENING_MERGE_REQUIRED, merges: openingProgress, specs: OPENING_WISPS, lines: OPENING_WISP_LINES, settled: ftueCameraSettled \}/);
  assert.match(screen, /const wisps = useCorruptionWisps\(wispTarget\);\s*openingGlow\.sinkRef\.current = wisps\.sink;/, 'the screen hands the wisps to the Glow every render');
  assert.match(screen, /specs: STEPPLING_WISPS, lines: STEPPLING_WISP_LINES, settled: ftueCameraSettled \}/);
  assert.match(screen, /specs: OPENING_WISPS, lines: OPENING_WISP_LINES, settled: ftueCameraSettled \}/);
  assert.match(screen, /specs: wispsForClearing\(restorationDefinition\.merges\), lines: restorationWispLines, settled: ftueCameraSettled \}/);
  assert.match(screen, /const restorationWispLines = islandRestoration\?\.campaign\.copy\.wispLines \?\? ISLAND_WISP_LINES;/, 'a friend speaks over their own board when authored');
  const layerSource = readFileSync('components/katchadeck/world/corruption-wisp-layer.tsx', 'utf8');
  // The wisps measure the tile only while the camera is still, and wait a beat for the opening glide to start: no early appearance, no jump when it lands.
  assert.match(layerSource, /const settled = target\?\.settled \?\? true;/);
  assert.match(layerSource, /if \(!key \|\| !node \|\| !settled\) return;/, 'no measurement while the camera moves');
  assert.match(layerSource, /const grace = movedRef\.current \? 0 : SETTLE_GRACE_MS;\s*movedRef\.current = false;\s*const timers = \[setTimeout\(measure, grace\),/, 'a settle after motion is measured at once; a fresh board waits for the glide to begin');
  assert.match(layerSource, /if \(fallenRef\.current === 0 && fallen > 0 && struckCount === 0\) \{ fallenRef\.current = fallen; return; \}/, 'nothing to say for wisps already down when the board came back');
  assert.match(layerSource, /text = lines \? wispLineForFall\(lines, fallen, plan\.length\) : null;/);
  assert.match(layerSource, /\{wisps\.caption \? <Animated\.View key=\{wisps\.caption\.id\} entering=\{FadeInDown/, 'the line shows under the tile and fades');
  // A friend's board: wisps over the island for as long as the board is up, keyed to the stage's run, their hits from the board's saved merges.
  assert.match(screen, /: restorationBoardVisible && restorationDefinition && restorationBoardRunId\s*\? \{ key: restorationBoardRunId, node: restorationTileNode, required: restorationDefinition\.merges, merges: restorationStore\.merges, specs: wispsForClearing\(restorationDefinition\.merges\), lines: restorationWispLines, settled: ftueCameraSettled \}/);
  assert.match(dock, /const aimed = sinkRef\.current\?\.aim\('glow'\) \?\? null;\s*const push = \(to: RewardFlightPoint\) => setFlights\(\(current\) => \[\.\.\.current, \{ id, index: 0, count: 1, from, to, art, size: 44/, 'a restoration merge’s item strikes a wisp too');
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
  assert.match(layer, /if \(target\) \{ setHeld\(true\); setLeaving\(false\); return; \}\s*setLeaving\(true\);\s*const timer = setTimeout\(\(\) => \{ setHeld\(false\); setLeaving\(false\);/);
  assert.match(layer, /visible: Boolean\(shownFrame && specs\.length && \(target \|\| held\)\),/);
  // Put away early (Back): the standing wisps shrink and fade out inside the linger, staggered, and come back if the board does.
  assert.match(layer, /if \(target\) \{ setHeld\(true\); setLeaving\(false\); return; \}\s*setLeaving\(true\);/);
  assert.match(layer, /leaving: !target && leaving,/);
  assert.match(layer, /if \(leaving\) \{\s*leftRef\.current = true;\s*cancelAnimation\(entrance\);\s*entrance\.value = withDelay\(reduceMotion \? 0 : index \* EXIT_STAGGER_MS, withTiming\(0,/);
  assert.match(layer, /\} else if \(leftRef\.current\) \{\s*leftRef\.current = false;\s*cancelAnimation\(entrance\);\s*entrance\.value = withTiming\(1,/);
  assert.match(layer, /const EXIT_MS = 260;\s*const EXIT_STAGGER_MS = 40;/);
  assert.match(layer, /withTiming\(0, \{ duration: reduceMotion \? 120 : EXIT_MS, easing: Easing\.out\(Easing\.cubic\) \}\)/, 'moving from the first frame, with the dock, not after it');
  assert.match(readFileSync('components/katchadeck/world/kingdom-opening-merge-dock.tsx', 'utf8'), /exiting=\{FadeOut\.duration\(260\)\}/, 'the dock fades out over the same 260ms');
  assert.ok(260 + 40 * 3 < 800, 'four wisps leave within the linger');
  assert.doesNotMatch(layer, /setLinger|linger\?\./, 'no second mount for a linger');
  assert.match(layer, /const states = useMemo\(\(\) => wispStates\(plan, landed\), \[landed, plan\]\);/, 'the dead stay dead by the same count that felled them');
});
