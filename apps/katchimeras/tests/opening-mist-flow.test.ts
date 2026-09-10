import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { loadNativeModule } from './helpers/native-motion-harness';
import * as script from '@/features/onboarding/mossprout-ftue-script';
import * as migrationPolicy from '@/features/onboarding/ftue-migration-policy';
import * as navigationPolicy from '@/features/onboarding/ftue-navigation-policy';
import { MOSSPROUT_FTUE_SCRIPT, mossproutFtueStep, mossproutFtueShowsWorldGarden, validateMossproutFtueScript } from '@/features/onboarding/mossprout-ftue-script';
import { MOSSPROUT_FTUE_FLOW } from '@/features/onboarding/mossprout-ftue-flow';
import { activeFtueNavigationPolicy, ftueOwnsOpeningHome } from '@/features/onboarding/ftue-navigation-policy';
import { MOSSPROUT_OPENING_STEP_IDS, OPENING_CAMERA_ENTRY_MS, OPENING_MERGE_REQUIRED, openingMistProgress } from '@/features/onboarding/opening-mist';
import { mossproutWorldUsesEggRenderer } from '@/components/katchadeck/world/world-ftue-subject-presentation';
import { FTUE_HANDLER_REGISTRY } from '@/features/onboarding/ftue-action-registry';

type RunShape = { stepId: string; status: string; scriptVersion: number; receipts: { actionId: string; stepId: string }[]; objectiveProgress: Record<string, number>; mergeInstalled: boolean };

/** The legacy FTUE runtime over a Map, with the journal and relationship side effects stubbed. */
function loadRuntime(stored?: unknown) {
  const storage = new Map<string, unknown>();
  if (stored) storage.set('katchimeras.ftue-run.v4', stored);
  const flowDispatches: string[] = [];
  return { storage, flowDispatches, runtime: loadNativeModule('features/onboarding/ftue-runtime.ts', {
    react: { useSyncExternalStore: () => null },
    './mossprout-ftue-script': script,
    './ftue-migration-policy': migrationPolicy,
    './ftue-navigation-policy': navigationPolicy,
    '@/utils/client-id': { createClientId: (prefix: string) => `${prefix}-test` },
    '@/utils/app-storage': {
      getStoredJson: (key: string, fallback: unknown) => storage.has(key) ? storage.get(key) : fallback,
      setStoredJson: (key: string, value: unknown) => { storage.set(key, JSON.parse(JSON.stringify(value))); },
    },
    '@/features/content-flow/ftue-content-flow-runtime': {
      dismissFtueContentFlow: async () => undefined,
      dispatchFtueActionToContentFlow: async (_run: unknown, actionId: string) => { flowDispatches.push(`action:${actionId}`); },
      dispatchFtueEventToContentFlow: async (_run: unknown, event: { type: string }) => { flowDispatches.push(`event:${event.type}`); },
    },
    '@/game/katchimeras/action-runtime': { completeDayOneLesson: (state: unknown) => state },
    '@/storage/repositories/relationship-progression-repository': { relationshipProgressionRepository: { update() {} } },
    './ftue-sync': { scheduleFtueReceiptSync() {} },
  }, { process: { env: {} }, queueMicrotask }) as unknown as {
    beginFtueRun: (options?: { restart?: boolean }) => RunShape;
    commitFtueAction: (input: { actionId: string; evidenceRef?: string }) => RunShape | null;
    dispatchFtueEvent: (event: unknown) => RunShape | null;
    loadFtueRun: () => RunShape | null;
  } };
}

const merge = (revision: number) => ({ type: 'merge_completed', fromInstanceId: `a${revision}`, targetInstanceId: `b${revision}`, resultDefinitionId: 'nature:garden:2', resultCell: 16 + revision, revision });

test('the opening is three haven beats before the Egg: look closer, clear the Mist, the veil lifts', () => {
  assert.deepEqual(validateMossproutFtueScript(), []);
  assert.equal(MOSSPROUT_FTUE_SCRIPT.entryStepId, 'world.mist_open');
  assert.equal(MOSSPROUT_FTUE_FLOW.entryNodeId, MOSSPROUT_FTUE_SCRIPT.entryStepId);
  const open = mossproutFtueStep('world.mist_open')!;
  assert.equal(open.surface, 'haven');
  assert.equal(open.camera?.kind === 'focus_target' ? open.camera.durationMs : null, OPENING_CAMERA_ENTRY_MS, 'the glide runs for the length of the captions');
  assert.equal(open.actions[0]?.id, 'world.look_closer');
  assert.equal(open.actions[0]?.nextStepId, 'world.mist_clear');
  assert.equal(open.guide.title, 'Nothing here has been noticed in a long while.');
  assert.equal(open.guide.body, 'Then you arrived.');
  const clear = mossproutFtueStep('world.mist_clear')!;
  assert.equal(clear.surface, 'haven', 'a haven step keeps the docked board ungated and resumes to the Kingdom');
  assert.equal(clear.interaction?.mode, 'none');
  assert.equal(clear.cue?.kind, 'drag');
  assert.equal(clear.spotlight?.targets.length, 2, 'the first pair is spotlit through the ordinary Merge overlay');
  assert.deepEqual(clear.edges?.map((edge) => [edge.event.type, edge.commitActionId, edge.nextStepId, edge.requiredCount]), [['merge_completed', 'world.clear_mist', 'world.mist_lift', OPENING_MERGE_REQUIRED]]);
  assert.equal(clear.actions[0]?.backendEvent, undefined, 'a tutorial objective needs no backend receipt');
  const lift = mossproutFtueStep('world.mist_lift')!;
  assert.equal(lift.actions[0]?.id, 'world.mist_lifted');
  assert.equal(lift.actions[0]?.nextStepId, 'world.egg_intro');
  assert.equal(lift.guide.title, 'The Mist thins where someone is being noticed.');
  assert.equal(mossproutFtueStep('world.egg_intro')?.guide.title, 'And this one heard you.');
  assert.equal(mossproutFtueStep('world.egg_intro')?.actions[0]?.nextStepId, 'egg.opening');
  for (const stepId of MOSSPROUT_OPENING_STEP_IDS) {
    const step = mossproutFtueStep(stepId)!;
    assert.ok(step.navigation?.lock, `${stepId} locks navigation`);
    assert.equal(step.camera?.kind, 'focus_target');
    assert.equal(mossproutFtueShowsWorldGarden(stepId), false);
    assert.equal(ftueOwnsOpeningHome({ status: 'active', stepId }), true, `${stepId} is part of the opening`);
    assert.equal(activeFtueNavigationPolicy({ status: 'active', stepId })?.resume?.kind, 'haven');
    for (const action of step.actions) assert.ok(FTUE_HANDLER_REGISTRY[action.handlerId]);
  }
  const task = MOSSPROUT_FTUE_FLOW.nodes.find((node) => node.id === 'world.mist_clear');
  assert.equal(task?.kind, 'task');
  assert.equal(task?.kind === 'task' ? task.requirements[0]?.count : null, OPENING_MERGE_REQUIRED);
  assert.equal(task?.kind === 'task' ? task.next : null, 'world.mist_lift');
  assert.equal(mossproutWorldUsesEggRenderer('world.mist_clear', null), false, 'no Egg under the veil');
  assert.equal(mossproutWorldUsesEggRenderer('world.mist_lift', null), true, 'the lift reveals the Egg');
});

test('a fresh run counts the opening merges into the bar, lifts, and resumes at every boundary', () => {
  const { runtime, flowDispatches } = loadRuntime();
  const run = runtime.beginFtueRun({ restart: true });
  assert.equal(run.stepId, 'world.mist_open');
  assert.equal(run.mergeInstalled, false, 'the persistent board is installed later, at the first meeting, as before');
  assert.equal(runtime.commitFtueAction({ actionId: 'world.look_closer' })?.stepId, 'world.mist_clear');
  for (let count = 1; count < OPENING_MERGE_REQUIRED; count++) {
    const next = runtime.dispatchFtueEvent(merge(count))!;
    assert.equal(next.stepId, 'world.mist_clear', `merge ${count} keeps the beat`);
    assert.equal(openingMistProgress(next as never), count, 'the bar reads the checkpoint');
  }
  // A relaunch here sees the same count: the runtime persists partial progress.
  const resumed = loadRuntime(runtime.loadFtueRun()).runtime.loadFtueRun()!;
  assert.equal(resumed.stepId, 'world.mist_clear');
  assert.equal(openingMistProgress(resumed as never), OPENING_MERGE_REQUIRED - 1);
  const lifted = runtime.dispatchFtueEvent(merge(OPENING_MERGE_REQUIRED))!;
  assert.equal(lifted.stepId, 'world.mist_lift');
  assert.equal(openingMistProgress(lifted as never), OPENING_MERGE_REQUIRED, 'the bar stays full while the veil lifts');
  assert.equal(runtime.dispatchFtueEvent(merge(99))?.stepId, 'world.mist_lift', 'an extra merge during the lift is harmless');
  assert.equal(runtime.commitFtueAction({ actionId: 'world.mist_lifted', evidenceRef: 'mossprout-world:veil-lifted' })?.stepId, 'world.egg_intro');
  assert.equal(runtime.commitFtueAction({ actionId: 'world.mist_lifted' })?.stepId, 'world.egg_intro', 'a second lift commit is a no-op');
  assert.equal(runtime.commitFtueAction({ actionId: 'world.inspect_mossprout_egg' })?.stepId, 'egg.opening');
  assert.equal(flowDispatches.filter((entry) => entry === 'event:merge_completed').length, OPENING_MERGE_REQUIRED, 'the stray merge matched no edge, so the flow never heard it');
  assert.equal(flowDispatches.filter((entry) => entry === 'action:world.look_closer').length, 1);
  assert.equal(flowDispatches.filter((entry) => entry === 'action:world.mist_lifted').length, 1);
});

test('a v48 run that never saw the Egg restarts under the Mist; anyone further along keeps their step', () => {
  const stored = (stepId: string, receipts: { actionId: string; stepId: string }[]) => ({
    schemaVersion: 6, runId: 'run-48', scriptId: 'mossprout-first-session', scriptVersion: 48, stepId, status: 'active',
    startedAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', completedAt: null,
    answers: {}, receipts, mergeInstalled: false, awardedMergeEnergy: null, objectiveProgress: {},
  });
  const fresh = loadRuntime(stored('world.egg_intro', [])).runtime.loadFtueRun()!;
  assert.equal(fresh.stepId, 'world.mist_open');
  assert.equal(fresh.scriptVersion, MOSSPROUT_FTUE_SCRIPT.version);
  const inspected = loadRuntime(stored('world.egg_intro', [{ actionId: 'world.inspect_mossprout_egg', stepId: 'world.egg_intro' }])).runtime.loadFtueRun()!;
  assert.equal(inspected.stepId, 'world.egg_intro');
  const questions = loadRuntime(stored('egg.opening', [{ actionId: 'world.inspect_mossprout_egg', stepId: 'world.egg_intro' }])).runtime.loadFtueRun()!;
  assert.equal(questions.stepId, 'egg.opening');
  const current = loadRuntime({ ...stored('world.egg_intro', []), scriptVersion: MOSSPROUT_FTUE_SCRIPT.version }).runtime.loadFtueRun()!;
  assert.equal(current.stepId, 'world.egg_intro', 'a current-version run parked on the Egg is left alone');
});

test('the Kingdom wires the opening: fade on the first beat, dock and finger on the second, one lift commit on the third', () => {
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  const route = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  const dock = readFileSync('components/katchadeck/world/kingdom-opening-merge-dock.tsx', 'utf8');
  assert.match(screen, /\{ftueStepId === OPENING_MIST_OPEN_STEP_ID \? <FtueOpeningFade \/> : null\}/);
  assert.doesNotMatch(screen, /ftueStepId === 'world\.egg_intro' \? <FtueOpeningFade/);
  assert.match(screen, /<KingdomOpeningCaption[\s\S]*?onLookCloser=\{advanceOpening\}/);
  assert.match(screen, /const openingBoardActive = Boolean\(mission\.state\) && ftueStepId === OPENING_MIST_CLEAR_STEP_ID;/);
  // The lift beat waits for the final item: the Kingdom presents the clear beat until it has landed and burst.
  assert.match(screen, /ftueStepId: routeFtueStepId,/, 'the route step is renamed so the presented step can be held');
  assert.match(screen, /const ftueStepId = routeFtueStepId === OPENING_MIST_LIFT_STEP_ID && openingGlow\.finaleActive \? OPENING_MIST_CLEAR_STEP_ID : routeFtueStepId;/, 'the clear beat is held while the finale flies');
  assert.match(screen, /ftueRun\.stepId === routeFtueStepId \? ftueRun : null/, 'the run is matched against the real step, so the mission board stays alive through the hold');
  assert.match(dock, /finaleIdRef\.current = id;\s*setFinaleActive\(true\);/, 'the finale flag is raised synchronously at launch, before the flight is measured');
  assert.match(dock, /if \(id === finaleIdRef\.current\) setTimeout\(\(\) => setFinaleActive\(false\), OPENING_FINALE_SETTLE_MS\);/, 'and lowered only after the burst has finished and settled');
  assert.match(dock, /if \(landed && \(finale \|\| landed\.index % 2 === 0\)\)/, 'the finale always bursts');
  assert.match(screen, /const openingGuidanceVisible = Boolean\(openingBoardStep && \(openingBoardStep\.cue \|\| openingBoardStep\.spotlight\)\)/);
  assert.match(screen, /const visibleUpgradeOffers = homeSoloForStep\(ftueStepId\) \? NO_UPGRADE_OFFERS : visibleWorldUpgradeOffers/, 'no markers at all until the hatch');
  assert.doesNotMatch(screen, /MOSSPROUT_SLEEPING_OFFER/, 'the silhouette marker is gone from the opening');
  assert.match(screen, /openingWeather=\{homeVeil !== 'none'\}/, 'rain and sparkles while the veil is up');
  assert.match(screen, /openingGuidanceVisible && ftueCameraSettled && openingDockSettled \?/, 'the spotlight waits for the dock to settle');
  assert.match(screen, /onEntranceSettled=\{markOpeningDockSettled\}/);
  const overlay = readFileSync('components/katchadeck/games/merge-ftue-overlay.tsx', 'utf8');
  assert.match(overlay, /spotlightOpacity: spotlight \? spotlight\.dimOpacity \?\? 0\.64 : 0,/, 'a finger-only beat never dims the screen');
  assert.match(canvas, /const openingWeatherStyle = useAnimatedStyle\(\(\) => \(\{ opacity: 1 - homeVeilProgress\.value \}\)\);/, 'weather thins on the lift clock');
  assert.match(canvas, /<\/GestureDetector>\s*\{openingWeather \? <Animated\.View[\s\S]*?<AtmosphereLayer plane="foreground" settings=\{OPENING_RAIN\} \/>/, 'rain in front of the world');
  assert.doesNotMatch(canvas, /<AtmosphereLayer plane="background" settings=\{OPENING_RAIN\}/, 'one rain plane: the second halved the headroom for nothing visible');
  assert.match(screen, /const NO_UPGRADE_OFFERS: WorldUpgradeOffer\[\] = \[\];[\s\S]*?homeSoloForStep\(ftueStepId\) \? NO_UPGRADE_OFFERS :/, 'a stable empty offers prop while solo');
  assert.match(canvas, /layer\.id === scene\.centerTile\.id && openingWeather \? \([\s\S]*?<HavenAmbientEmbers area=\{\{ left: 0, top: 0, width: layer\.frame\.width, height: layer\.frame\.height \}\}/, 'the reveal’s own embers loop over the veiled tile');
  const effects = readFileSync('../../packages/environments/src/upgrade-effects.tsx', 'utf8');
  assert.match(effects, /const AMBIENT_EMBERS = RISING_PARTICLES\.filter/, 'the ambient embers are the reveal particles themselves');
  assert.match(effects, /withRepeat\(withTiming\(1, \{ duration: particle\.duration \* 2\.4/, 'looping, slower than the reveal');
  assert.match(effects, /ambientEmber: \{ borderRadius: 999, position: 'absolute' \}/, 'ambient embers carry no blurred shadow');
  assert.match(route, /const openingSky = ftueRun\?\.status === 'active' && homeSoloForStep\(ftueRun\.stepId\);[\s\S]*?openingSky \? todayAtmosphereBackgroundForScene\(OPENING_SKY_SCENE_ID\)/, 'twilight sky until the hatch');
  assert.match(screen, /<KingdomOpeningMergeDock[\s\S]*?onGlow=\{openingGlow\.launch\} onFinale=\{openingGlow\.launchFinale\}/);
  assert.match(screen, /routeFtueStepId === OPENING_MIST_LIFT_STEP_ID && openingGlow\.finaleActive/, 'the dock, camera and caption all wait for the final item to reach the mist and burst');
  assert.match(dock, /const finale = openingMistProgress\(runRef\.current\) >= OPENING_MERGE_REQUIRED;[\s\S]*?setHiddenItemIds[\s\S]*?onFinale\?\.\(from, event\.resultDefinitionId\);/, 'the last merge’s item leaves the board for the mist');
  assert.match(screen, /<OpeningGlowLayer flights=\{openingGlow\.flights\} impacts=\{openingGlow\.impacts\}/, 'landed Glow bursts where it hits the mist');
  assert.match(dock, /<Image source=\{flight\.art \?\? GAME_CURRENCY_ART\.coins\}/, 'merges send Glow, not wisps; the finale sends the item itself');
  assert.match(dock, /const timer = setTimeout\(\(\) => \{\s*timers\.delete\(timer\);\s*setShownProgress\(\(shown\) => Math\.max\(shown, progress\)\);\s*\}, OPENING_GLOW_FLIGHT_MS\);\s*timers\.add\(timer\);/, 'every merge schedules its own bar step; rapid merges never cancel an earlier one');
  assert.doesNotMatch(dock, /return \(\) => clearTimeout\(timer\);\s*\}, \[progress, shownProgress\]\);/, 'no single cancel-and-restart timer for the bar');
  assert.match(dock, /if \(landed && \(finale \|\| landed\.index % 2 === 0\)\) setImpacts\(/, 'the first and third landings burst, and the finale always; the others only tap');
  assert.match(dock, /export const OPENING_GLOWS_PER_MERGE = 4;/, 'a burst of Glow per merge');
  assert.match(dock, /Array\.from\(\{ length: OPENING_GLOWS_PER_MERGE \}, \(_, index\) => \(\{ id: \+\+nextId\.current, index, from, to \}\)\)/, 'the burst peels off one Glow per index');
  assert.match(dock, /count=\{flight\.count \?\? OPENING_GLOWS_PER_MERGE\} index=\{flight\.index\}/, 'the flight staggers by index');
  assert.match(dock, /setLanded\(\(count\) => count \+ 1\);\s*if \(process\.env\.EXPO_OS === 'ios'\) void Haptics\.impactAsync/, 'every impact flashes the bar and taps the phone');
  assert.match(screen, /impactKey=\{openingGlow\.landed\}/);
  assert.match(dock, /const grew = progress > previous\.current;[\s\S]*?scale\.value = withSequence\(/, 'the bar swells once per landed Glow');
  assert.match(screen, /<MergeFtueOverlay blockedPulseNonce=\{openingBlockedNonce\}[\s\S]*?guide=\{openingBoardStep\?\.guide \?\? null\}[\s\S]*?spotlight=\{openingBoardStep\?\.spotlight \?\? null\}/);
  assert.match(screen, /if \(presentation\.veilLift\) \{[\s\S]*?commitFtueAction\(\{ actionId: OPENING_LIFTED_ACTION_ID, evidenceRef: 'mossprout-world:veil-lifted' \}\);\s*return;\s*\}\s*if \(tutorialUpgradeNonceRef\.current === presentation\.nonce\)/);
  assert.match(screen, /if \(homeVeil !== 'lifting'\) return;[\s\S]*?veilLiftKeyRef\.current = key;[\s\S]*?veilLift: true/, 'the crossblend starts when the veil enters lifting, not when the step changes');
  // The mist clears on the frame the final item strikes the tile; the camera, caption and dock still wait for the burst to settle.
  assert.match(screen, /const homeVeil = routeFtueStepId === OPENING_MIST_LIFT_STEP_ID && openingGlow\.finaleActive && !openingGlow\.finaleLanded \? 'veiled' : homeVeilForStep\(routeFtueStepId\);/);
  assert.match(dock, /if \(finale\) \{ setFinaleLanded\(true\); setFinaleLandedId\(id\); \}/, 'the landing flag is raised at impact, by id too');
  assert.match(screen, /Boolean\(upgradePresentation && !upgradePresentation\.veilLift\)/, 'the HUD stays hidden while the veil lifts');
  assert.match(screen, /homeVeil=\{homeVeil\}\s*homeSolo=\{homeSoloForStep\(ftueStepId\)\}/);
  assert.match(canvas, /return buildMossproutHexNeighborhoodScene\(fromSlots, fromNatureLevels, fromGarden, fromReveals, \{ homeVeiled: homeVeil === 'veiled' \|\| homeVeil === 'lifting', homeSolo \}\);/, 'the lift’s from-scene stays veiled and solo, so the world never flashes in during the crossblend');
  assert.match(canvas, /const joinedLater = layerJoinedLater\(layer\.id\);[\s\S]*?<Animated\.View entering=\{joinedLater \? FadeIn\.duration\(reduceMotion \? 120 : 720\) : undefined\}[\s\S]*?<KingdomTileArt/, 'tiles that join after mount fade in rather than snap');
  assert.match(screen, /: ftueStepId === OPENING_MIST_OPEN_STEP_ID\s*\? OPENING_CAMERA_ENTRY_ZOOM/, 'the first beat mounts further out and glides in');
  assert.match(canvas, /const revealingVeiledHome = Boolean\(upgradePresentation\?\.veilLift\);\s*const homeVeilProgress = useSharedValue\(0\);/, 'the lift owns one reveal clock, like the Steppling reveal');
  assert.match(canvas, /transitionLayers\.toLayer\.id === scene\.centerTile\.id && \(upgradeOwnsLayer \? revealingVeiledHome : settlingUpgrade\?\.nonce === veilLiftNonceRef\.current\)\s*\? homeVeilProgress : undefined/, 'the mist crossblend drives that clock');
  assert.match(canvas, /eggSkinId=\{revealedEggProjection\.eggSkinId\}\s*revealProgress=\{homeVeil !== 'none' \|\| settlingUpgrade\?\.nonce === veilLiftNonceRef\.current \? homeVeilProgress : undefined\}/, 'the Egg fades in with the tile, never ahead of it');
  assert.doesNotMatch(route, /installMossproutOnboardingMergeWorld/, 'the opening never touches the persistent board');
  assert.match(screen, /const mission = useOpeningMissionBoard\(missionRunId\);/, 'the Kingdom owns the mission board');
  assert.match(screen, /if \(ftueStepId === 'world\.egg_intro'\) clearOpeningMission\(\);/, 'the mission store goes with the mist');
  assert.match(screen, /<KingdomOpeningMergeDock[\s\S]*?state=\{mission\.state\} send=\{mission\.send\}/, 'the dock plays the mission board, not the provider');
  assert.doesNotMatch(dock, /useMergeWorldState|useMergeWorldActions/, 'the dock has no link to the persistent board');
  const surface = readFileSync('components/katchadeck/games/merge-play-surface.tsx', 'utf8');
  assert.match(surface, /const state = override \?\? subscribed;/, 'the surface renders an explicit board over the provider one');
  assert.match(route, /if \(stepId === 'world\.mist_open'\) \{\s*commitFtueAction\(\{ actionId: 'world\.look_closer'/);
  const tab = readFileSync('app/(tabs)/katchimeras.tsx', 'utf8');
  assert.match(tab, /const eggPresentationActive = ftueStep\?\.id === 'world\.mist_lift'/);
  const egg = readFileSync('components/katchadeck/world/mossprout-egg-ftue-surface.tsx', 'utf8');
  assert.match(egg, /const scriptedActions = stepId === 'world\.egg_intro' \|\| stepId === 'world\.mist_lift'/);
  const caption = readFileSync('components/katchadeck/world/kingdom-opening-caption.tsx', 'utf8');
  assert.match(caption, /setTimeout\(\(\) => setPage\(1\), reduceMotion \? 1_200 : OPENING_CAPTION_PAGE_MS\)/);
  assert.match(caption, /disabled=\{page === 1\}[\s\S]*?onPress=\{\(\) => setPage\(1\)\}/, 'the first caption can be tapped through');
});
