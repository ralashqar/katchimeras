import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from './helpers/content-fs';
import { loadNativeModule } from './helpers/native-motion-harness';
import * as script from '@/features/onboarding/mossprout-ftue-script';
import * as migrationPolicy from '@/features/onboarding/ftue-migration-policy';
import * as navigationPolicy from '@/features/onboarding/ftue-navigation-policy';
import { MOSSPROUT_FTUE_SCRIPT, mossproutFtueStep, mossproutFtueShowsWorldGarden, validateMossproutFtueScript } from '@/features/onboarding/mossprout-ftue-script';
import { MOSSPROUT_FTUE_FLOW } from '@/features/onboarding/mossprout-ftue-flow';
import { COLD_OPEN_ACTION_ID, COLD_OPEN_LINES, FIRST_BATTLE_ID, GUARDIAN_ACTION_ID, GUARDIAN_STEP_ID, GUARDIAN_TITLE, HEART_TREE_ACTION_ID, HEART_TREE_STEP_ID, SANCTUARY_ACTION_ID, SANCTUARY_STEP_ID, FRONTIER_ACTION_ID, FRONTIER_STEP_ID, LOST_TRACKS_ACTION_ID, LOST_TRACKS_STEP_ID, LOST_TRAIL_TILE_ID, LOST_TRAIL_STONE_STEP_IDS, LOST_TRAIL_STONE_BATTLE_IDS, STEPPLING_RESCUED_STEP_ID, STEPPLING_RESCUED_ACTION_ID, STEPPLING_MEETS_STEP_ID, STEPPLING_MEETS_ACTION_ID, STEPPLING_JOINED_STEP_ID, STEPPLING_JOINED_ACTION_ID, HOME_STEP_ID, HOME_ACTION_ID } from '@/features/onboarding/last-clearing';
import { FIRST_BATTLE } from '@/constants/last-clearing-battle';
import { STORY_TILES } from '@/constants/story-tiles/registry';
import { KINGDOM_HEX_TILE_ALPHA_BOUNDS } from '@/constants/kingdom-hex-tile-bounds.gen';
import { activeFtueNavigationPolicy, ftueOwnsOpeningHome } from '@/features/onboarding/ftue-navigation-policy';
import { MOSSPROUT_OPENING_STEP_IDS, OPENING_CAMERA_ENTRY_MS, OPENING_MERGE_REQUIRED, openingMistProgress } from '@/features/onboarding/opening-mist';
import { mossproutWorldUsesEggRenderer } from '@/components/katchadeck/world/world-ftue-subject-presentation';
import { FTUE_HANDLER_REGISTRY } from '@/features/onboarding/ftue-action-registry';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { heartwoodStage } from '@/features/shared-adventure/heartwood-progression';
import { GLOW } from '@/constants/glow';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';

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
      setStoredJsonDeferred: (key: string, value: unknown) => { storage.set(key, JSON.parse(JSON.stringify(value))); },
      flushDeferredStoredWrites: () => {},
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

test('the Last Clearing opens with four haven beats and no Egg: the cold open, the guardian, the first battle, the Mist pulling back', () => {
  const kingdomScreen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.doesNotMatch(kingdomScreen, /hideWorldTiles=/, 'dialogue must not hide the island supporting Mossprout');
  assert.match(kingdomScreen, /ftueStepId === OPENING_MIST_OPEN_STEP_ID && ftueStep && screenFocused \? <LastClearingColdOpen onDone=\{advanceOpening\} \/>/, 'the cold open plays over the misted world');
  assert.match(kingdomScreen, /ftueStepId === GUARDIAN_STEP_ID && ftueStep && screenFocused \? <LastClearingGuardian onContinue=\{advanceOpening\} \/>/, 'then the guardian');
  const reward = kingdomScreen.slice(kingdomScreen.indexOf('// Keep the earned Glow'), kingdomScreen.indexOf('// The repair:'));
  assert.match(reward, /ensureStoredOpeningGlow/);
  assert.deepEqual(validateMossproutFtueScript(), []);
  assert.equal(MOSSPROUT_FTUE_SCRIPT.entryStepId, 'world.mist_open');
  assert.equal(MOSSPROUT_FTUE_FLOW.entryNodeId, MOSSPROUT_FTUE_SCRIPT.entryStepId);
  const open = mossproutFtueStep('world.mist_open')!;
  assert.equal(open.surface, 'haven');
  assert.equal(open.camera?.kind === 'focus_target' ? open.camera.durationMs : null, OPENING_CAMERA_ENTRY_MS, 'the camera sinks toward the clearing under the lore');
  assert.equal(open.actions[0]?.id, COLD_OPEN_ACTION_ID);
  assert.equal(open.actions[0]?.nextStepId, GUARDIAN_STEP_ID);
  assert.equal(open.guide.title, COLD_OPEN_LINES[0]);
  const guardian = mossproutFtueStep(GUARDIAN_STEP_ID)!;
  assert.equal(guardian.surface, 'haven');
  assert.equal(guardian.guide.title, GUARDIAN_TITLE);
  assert.equal(guardian.actions[0]?.id, GUARDIAN_ACTION_ID);
  assert.equal(guardian.actions[0]?.nextStepId, 'world.mist_clear');
  const clear = mossproutFtueStep('world.mist_clear')!;
  assert.equal(clear.surface, 'haven', 'a haven step keeps the docked board ungated and resumes to the Kingdom');
  assert.equal(clear.interaction?.mode, 'none');
  assert.equal(clear.cue?.kind, 'drag');
  assert.equal(clear.spotlight?.targets.length, 2, 'the first pair is spotlit through the ordinary Merge overlay');
  assert.deepEqual(clear.edges?.map((edge) => [edge.event.type, edge.commitActionId, edge.nextStepId, edge.requiredCount ?? 1]), [['battle_won', 'world.clear_mist', 'world.mist_lift', 1]], 'the first battle is won, not counted in merges');
  assert.equal(clear.actions[0]?.backendEvent, undefined, 'a tutorial objective needs no backend receipt');
  const lift = mossproutFtueStep('world.mist_lift')!;
  assert.equal(lift.actions[0]?.id, 'world.mist_lifted');
  assert.equal(lift.actions[0]?.nextStepId, HEART_TREE_STEP_ID, 'the Mist pulls back, and the Heart Tree is next');
  assert.equal(mossproutFtueStep(HEART_TREE_STEP_ID)?.actions[0]?.nextStepId, SANCTUARY_STEP_ID);
  assert.equal(mossproutFtueStep(SANCTUARY_STEP_ID)?.actions[0]?.nextStepId, FRONTIER_STEP_ID);
  assert.equal(mossproutFtueStep(FRONTIER_STEP_ID)?.camera?.kind, 'fit_targets', 'the frontier pulls out over the whole world');
  assert.equal(mossproutFtueStep(LOST_TRACKS_STEP_ID)?.cue?.kind, 'tap', 'the trail itself is tapped');
  assert.equal(mossproutFtueStep(LOST_TRACKS_STEP_ID)?.actions[0]?.nextStepId, LOST_TRAIL_STONE_STEP_IDS[0], 'the tap on the trail opens the Lost Trail (FTUE v2: no separate mission card)');

  for (const stepId of MOSSPROUT_OPENING_STEP_IDS) {
    const step = mossproutFtueStep(stepId)!;
    assert.ok(step.navigation?.lock, `${stepId} locks navigation`);
    assert.equal(step.camera?.kind, 'focus_target');
    assert.equal(mossproutFtueShowsWorldGarden(stepId), false);
    assert.equal(ftueOwnsOpeningHome({ status: 'active', stepId }), true, `${stepId} is part of the opening`);
    assert.equal(activeFtueNavigationPolicy({ status: 'active', stepId })?.resume?.kind, 'haven');
    for (const action of step.actions) assert.ok(FTUE_HANDLER_REGISTRY[action.handlerId]);
    assert.equal(mossproutWorldUsesEggRenderer(stepId, null), false, `${stepId}: no Egg, Mossprout is there`);
  }
  const task = MOSSPROUT_FTUE_FLOW.nodes.find((node) => node.id === 'world.mist_clear');
  assert.equal(task?.kind, 'task');
  assert.equal(task?.kind === 'task' ? task.requirements[0]?.event.type : null, 'ftue.battle_won');
  assert.equal(task?.kind === 'task' ? task.next : null, 'world.mist_lift');
  // The first battle is a scripted Lanes battle that cannot be lost, docked in place of the old board.
  assert.equal(FIRST_BATTLE.mechanic?.kind, 'lanes');
  assert.ok(FIRST_BATTLE.mechanic?.kind === 'lanes' && FIRST_BATTLE.mechanic.forgiving, 'the first battle cannot be lost');
  assert.match(kingdomScreen, /dispatchFtueEvent\(\{ type: 'battle_won', battleId: FIRST_BATTLE_ID, revision: 1 \}, FIRST_BATTLE_ID\)/);
  // Mossprout stands in its clearing under the Mist: the veiled home tile still draws its owned resident.
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  assert.match(canvas, /homeVeil !== 'none' && tile\.id === scene\.centerTile\.id && tile\.companion\.kind !== 'owned'/);
  // And its record is in the world from the first frame of a fresh session.
  const host = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  assert.match(host, /ftueRun\.mergeInstalled[\s\S]*?installMossproutOnboardingMergeWorld\([\s\S]*?updateFtueRun\(\{ mergeInstalled: true \}\)/);
});

test('a fresh run walks the Last Clearing: the cold open, the guardian, the first battle won, the lift, and resumes at every boundary', () => {
  const { runtime, flowDispatches } = loadRuntime();
  const run = runtime.beginFtueRun({ restart: true });
  assert.equal(run.stepId, 'world.mist_open');
  assert.equal(run.mergeInstalled, false, 'the Kingdom host installs Mossprout on the first frame');
  assert.equal(runtime.commitFtueAction({ actionId: COLD_OPEN_ACTION_ID })?.stepId, GUARDIAN_STEP_ID);
  assert.equal(runtime.commitFtueAction({ actionId: GUARDIAN_ACTION_ID })?.stepId, 'world.mist_clear');
  // Merges during the battle move nothing: the battle is won when every wisp is down.
  assert.equal(runtime.dispatchFtueEvent(merge(1))?.stepId, 'world.mist_clear');
  assert.equal(runtime.dispatchFtueEvent({ type: 'battle_won', battleId: 'someone-else', revision: 1 } as never)?.stepId, 'world.mist_clear', 'only the first battle counts');
  const resumed = loadRuntime(runtime.loadFtueRun()).runtime.loadFtueRun()!;
  assert.equal(resumed.stepId, 'world.mist_clear', 'a relaunch mid-battle stays in the battle');
  const won = runtime.dispatchFtueEvent({ type: 'battle_won', battleId: FIRST_BATTLE_ID, revision: 1 } as never)!;
  assert.equal(won.stepId, 'world.mist_lift');
  const lifted = runtime.commitFtueAction({ actionId: 'world.mist_lifted', evidenceRef: 'mossprout-world:veil-lifted' })!;
  assert.equal(lifted.stepId, HEART_TREE_STEP_ID);
  assert.equal(loadRuntime(runtime.loadFtueRun()).runtime.loadFtueRun()!.stepId, HEART_TREE_STEP_ID, 'a relaunch at the Tree stays at the Tree');
  assert.equal(runtime.commitFtueAction({ actionId: HEART_TREE_ACTION_ID, evidenceRef: 'mossprout-world:heart-tree' })?.stepId, SANCTUARY_STEP_ID);
  assert.equal(runtime.commitFtueAction({ actionId: SANCTUARY_ACTION_ID, evidenceRef: 'mossprout-world:sanctuary-founded' })?.stepId, FRONTIER_STEP_ID);
  assert.equal(runtime.commitFtueAction({ actionId: FRONTIER_ACTION_ID, evidenceRef: 'mossprout-world:frontier-seen' })?.stepId, LOST_TRACKS_STEP_ID);
  assert.equal(loadRuntime(runtime.loadFtueRun()).runtime.loadFtueRun()!.stepId, LOST_TRACKS_STEP_ID, 'a relaunch at the tracks stays at the tracks');
  assert.equal(runtime.commitFtueAction({ actionId: LOST_TRACKS_ACTION_ID, evidenceRef: 'shared-world:lost-trail' })?.stepId, LOST_TRAIL_STONE_STEP_IDS[0]);
  // The Lost Trail: each stone is won by its own battle, and no other.
  for (const [index, stepId] of LOST_TRAIL_STONE_STEP_IDS.entries()) {
    assert.equal(runtime.dispatchFtueEvent({ type: 'battle_won', battleId: FIRST_BATTLE_ID, revision: 2 } as never)?.stepId, stepId, 'an old battle does not count');
    const next = runtime.dispatchFtueEvent({ type: 'battle_won', battleId: LOST_TRAIL_STONE_BATTLE_IDS[index]!, revision: 1 } as never)!;
    assert.equal(next.stepId, LOST_TRAIL_STONE_STEP_IDS[index + 1] ?? STEPPLING_RESCUED_STEP_ID);
  }
  assert.equal(runtime.commitFtueAction({ actionId: STEPPLING_RESCUED_ACTION_ID, evidenceRef: 'shared-world:lost-trail' })?.stepId, STEPPLING_MEETS_STEP_ID);
  assert.equal(loadRuntime(runtime.loadFtueRun()).runtime.loadFtueRun()!.stepId, STEPPLING_MEETS_STEP_ID, 'a relaunch meeting Steppling stays there');
  assert.equal(runtime.commitFtueAction({ actionId: STEPPLING_MEETS_ACTION_ID, evidenceRef: 'shared-world:steppling-home' })?.stepId, STEPPLING_JOINED_STEP_ID);
  assert.equal(runtime.commitFtueAction({ actionId: STEPPLING_JOINED_ACTION_ID, evidenceRef: 'mossprout-world:steppling-joined' })?.stepId, HOME_STEP_ID);
  const done = runtime.commitFtueAction({ actionId: HOME_ACTION_ID, evidenceRef: 'mossprout-world:home' })!;
  assert.equal(done.stepId, 'complete', 'the first session ends at home');
  assert.equal(flowDispatches.filter((entry) => entry === 'event:battle_won').length, 2, 'the flow hears the first battle and the Lost Trail rescue');
  assert.equal(flowDispatches.filter((entry) => entry === `action:${COLD_OPEN_ACTION_ID}`).length, 1);
  assert.equal(flowDispatches.filter((entry) => entry === `action:${GUARDIAN_ACTION_ID}`).length, 1);
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

test('the Kingdom wires the Last Clearing: the cold open, the first battle docked with its finger, one lift commit after it', () => {
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  const route = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  const dock = readFileSync('components/katchadeck/world/kingdom-opening-merge-dock.tsx', 'utf8');
  assert.match(screen, /\{ftueStepId === OPENING_MIST_OPEN_STEP_ID \? <FtueOpeningFade \/> : null\}/);
  assert.doesNotMatch(screen, /ftueStepId === 'world\.egg_intro' \? <FtueOpeningFade/);
  assert.match(screen, /<LastClearingColdOpen onDone=\{advanceOpening\} \/>/);
  assert.match(screen, /const battle = firstBattleStepActive \? firstBattle : trailBattle;/, 'the docked board at the clear beat is the first battle; on the Lost Trail, the stone under way');
  assert.match(screen, /const openingBoardActive = Boolean\(battle\?\.store\.state\);/);
  // The lift beat waits for the final item: the Kingdom presents the clear beat until it has landed and burst.
  assert.match(screen, /ftueStepId: routeFtueStepId,/, 'the route step is renamed so the presented step can be held');
  assert.match(screen, /const openingFinaleHeld = openingGlow\.finaleActive \|\| openingGlow\.finaleHoldRef\.current;\s*const ftueStepId = routeFtueStepId === OPENING_MIST_LIFT_STEP_ID && openingFinaleHeld \? OPENING_MIST_CLEAR_STEP_ID : routeFtueStepId;/, 'the clear beat is held while the finale flies, from the instant it launches');
  assert.match(dock, /finaleIdRef\.current = id;\s*finaleHoldRef\.current = true;\s*setFinaleActive\(true\);/, 'the hold is a ref set before any state renders, so the run store’s own sync render never sees the lift step unheld');
  assert.match(dock, /if \(finale\) \{\s*setFinaleLanded\(true\);\s*setFinaleLandedId\(id\);[\s\S]*?setTimeout\(\(\) => \{ finaleHoldRef\.current = false; setFinaleActive\(false\); \}, OPENING_FINALE_SETTLE_MS\);\s*\}/, 'the hold lifts on the impact’s clock: the mission is over when the last wisp has fallen');
  assert.match(dock, /const OPENING_FINALE_SETTLE_MS = 520;/);
  assert.doesNotMatch(dock, /if \(id === finaleIdRef\.current\) setTimeout/, 'not after the burst has finished and a further beat');
  assert.match(screen, /\(ftueRun\.stepId === routeFtueStepId \|\| \(ftueRun\.stepId === OPENING_MIST_LIFT_STEP_ID && routeFtueStepId === OPENING_MIST_CLEAR_STEP_ID\)\)\s*\? ftueRun : null/, 'the run is matched against the real step, and kept through the frame the route lags the store, so the mission board stays alive through the hold');
  assert.match(dock, /finaleIdRef\.current = id;\s*finaleHoldRef\.current = true;\s*setFinaleActive\(true\);/, 'the finale flag is raised synchronously at launch, before the flight is measured');
  assert.match(dock, /if \(landed && !miss && \(finale \|\| landed\.shot \|\| landed\.direct \|\| landed\.index % 2 === 0\)\)/, 'the finale always bursts (and every Glow shot or lane bolt that hits)');
  assert.match(screen, /const openingGuidanceVisible = Boolean\(openingBoardStep && \(openingBoardStep\.cue \|\| openingBoardStep\.spotlight\)\)/);
  assert.match(screen, /const worldOffers = storyHold \? NO_UPGRADE_OFFERS : homeSoloForStep\(ftueStepId\) \? NO_UPGRADE_OFFERS : restorationHandoff \? NO_UPGRADE_OFFERS : missionBoardDocked \? NO_UPGRADE_OFFERS : chapterOpeningPhase \|\| rescueRevealing \? NO_UPGRADE_OFFERS : visibleWorldUpgradeOffers/, 'no markers at all until the hatch, nor while a board hands off to its story');
  assert.doesNotMatch(screen, /MOSSPROUT_SLEEPING_OFFER/, 'the silhouette marker is gone from the opening');
  assert.match(screen, /openingWeather=\{homeVeil !== 'none'\}/, 'rain and sparkles while the veil is up');
  assert.match(screen, /openingGuidanceVisible && ftueCameraSettled && openingDockSettled \?/, 'the spotlight waits for the dock to settle');
  assert.match(screen, /onEntranceSettled=\{markOpeningDockSettled\}/);
  const overlay = readFileSync('components/katchadeck/games/merge-ftue-overlay.tsx', 'utf8');
  assert.match(overlay, /spotlightOpacity: spotlight \? spotlight\.dimOpacity \?\? 0\.64 : 0,/, 'a finger-only beat never dims the screen');
  assert.match(canvas, /const openingWeatherStyle = useAnimatedStyle\(\(\) => \(\{ opacity: \(1 - homeVeilProgress\.value\) \* openingWeatherPresence\.value \}\)\);/, 'weather thins on the lift clock, and steps aside for a docked board');
  assert.match(canvas, /<\/GestureDetector>\s*\{openingWeatherShown \? <Animated\.View[\s\S]*?<AtmosphereLayer plane="foreground" settings=\{openingRainSettings\} \/>/, 'rain in front of the world, until a board docks');
  assert.doesNotMatch(canvas, /<AtmosphereLayer plane="background" settings=\{OPENING_RAIN\}/, 'one rain plane: the second halved the headroom for nothing visible');
  assert.match(screen, /const NO_UPGRADE_OFFERS: WorldUpgradeOffer\[\] = \[\];[\s\S]*?homeSoloForStep\(ftueStepId\) \? NO_UPGRADE_OFFERS :/, 'a stable empty offers prop while solo');
  assert.match(canvas, /layer\.id === scene\.centerTile\.id && openingWeatherShown \? \([\s\S]*?<HavenAmbientEmbers area=\{\{ left: 0, top: 0, width: layer\.frame\.width, height: layer\.frame\.height \}\}/, 'the reveal’s own embers loop over the veiled tile');
  const effects = readFileSync('../../packages/environments/src/upgrade-effects.tsx', 'utf8');
  assert.match(effects, /const AMBIENT_EMBERS = RISING_PARTICLES\.filter/, 'the ambient embers are the reveal particles themselves');
  assert.match(effects, /withRepeat\(withTiming\(1, \{ duration: particle\.duration \* 2\.4/, 'looping, slower than the reveal');
  assert.match(effects, /ambientEmber: \{ borderRadius: 999, position: 'absolute' \}/, 'ambient embers carry no blurred shadow');
  assert.match(route, /const openingSky = ftueRun\?\.status === 'active' && homeSoloForStep\(ftueRun\.stepId\);[\s\S]*?openingSky \? todayAtmosphereBackgroundForScene\(OPENING_SKY_SCENE_ID\)/, 'twilight sky until the hatch');
  assert.match(screen, /\{openingBoardActive && battle\?\.mission && battle\.store\.state \? <HatchableMissionDock key=\{`battle-dock:\$\{battleEncounter\?\.id \?\? 'none'\}`\} mission=\{battle\.mission\}[\s\S]*?encounter=\{battle\.encounter\}/, 'the scripted battle docks as a real battle');
  // The finale flag goes up before the run advances: no frame ever renders the lift step (and its camera) without it.
  assert.match(dock, /const finale = openingMistProgress\(runRef\.current\) \+ 1 >= OPENING_MERGE_REQUIRED;/, 'the board counts the merge the run has not advanced on yet');
  assert.match(dock, /onBlocked: onBlockedInteraction, onBeforeAdvance: handleEvent,/, 'the dock launches Glow and the finale before the advance');
  const dispatchSource = readFileSync('features/onboarding/use-ftue-merge-dispatch.ts', 'utf8');
  assert.match(dispatchSource, /const advance = \(\) => \{\s*if \(result\) onBeforeAdvance\?\.\(event, result\);\s*const nextRun = dispatchFtueEvent\(event,/, 'onBeforeAdvance runs first, in the same frame as the advance');
  assert.match(screen, /routeFtueStepId === OPENING_MIST_LIFT_STEP_ID && openingFinaleHeld/, 'the dock, camera and caption all wait for the final item to reach the mist and burst');
  // Phase two: once the run is at the lift and the board is fading, the camera and the Egg's subject
  // presentation wait a further beat. The presentation's arrival changes the canvas's tutorial camera key
  // and would otherwise re-apply the clear step's camera against the revealed-Egg tile mid-fall.
  assert.match(screen, /const OPENING_CLEAR_CAMERA = mossproutFtueStep\(OPENING_MIST_CLEAR_STEP_ID\)\?\.camera \?\? null;/, 'one stable directive, so its key never changes while held');
  assert.match(screen, /worldSubjectPresentation=\{openingLiftCameraHeld \? null : worldSubjectPresentation\}/, 'the Egg presentation reaches the canvas only once the board is gone');
  // The run store advances a frame before the route's step id: the board must not unmount (and replay its entrance) in between.
  assert.match(screen, /\(ftueRun\.stepId === routeFtueStepId \|\| \(ftueRun\.stepId === OPENING_MIST_LIFT_STEP_ID && routeFtueStepId === OPENING_MIST_CLEAR_STEP_ID\)\)/, 'the opening run survives the frame between the store and the route');
  assert.match(dock, /const finale = openingMistProgress\(runRef\.current\) \+ 1 >= OPENING_MERGE_REQUIRED;[\s\S]*?setHiddenItemIds[\s\S]*?onFinale\?\.\(from, event\.resultDefinitionId\);/, 'the last merge’s item leaves the board for the mist');
  // The flights live in the Glow's own store: the layer that draws them subscribes, the screen does not.
  assert.match(screen, /<MissionGlowLayer store=\{openingGlow\.store\} screenRef=\{screenRef\} \/>/, 'landed Glow bursts where it hits the mist');
  assert.match(dock, /export const MissionGlowLayer = memo\(function MissionGlowLayer[\s\S]*?useSyncExternalStore\(store\.subscribe, store\.getFlights, store\.getFlights\);[\s\S]*?<OpeningGlowLayer flights=\{flights\} impacts=\{impacts\} onArrive=\{store\.arrive\} onImpactDone=\{store\.impactDone\}/);
  assert.match(dock, /const finale = useSyncExternalStore\(store\.subscribe, store\.getFinale, store\.getFinale\);/, 'the screen subscribes to the finale alone');
  assert.match(dock, /if \(next\.flights !== state\.flights \|\| next\.impacts !== state\.impacts\) flightsSnapshot = /, 'snapshots keep their identity unless their own fields moved');
  assert.match(dock, /const arrive = \(id: number\) => batch\(\(\) => \{/, 'a landing notifies once');
  assert.doesNotMatch(screen, /openingGlow\.(flights|impacts|landed)\b/, 'nothing per landing reaches the screen');
  assert.match(dock, /<GlowTokenArt art=\{flight\.art\} size=\{flight\.size\} \/>[\s\S]*?<Image source=\{art \?\? GAME_CURRENCY_ART\.coins\}/, 'merges send Glow, not wisps; the finale sends the item itself');
  assert.match(dock, /const timer = setTimeout\(\(\) => \{\s*timers\.delete\(timer\);\s*setShownProgress\(\(shown\) => Math\.max\(shown, progress\)\);\s*\}, OPENING_GLOW_FLIGHT_MS\);\s*timers\.add\(timer\);/, 'every merge schedules its own bar step; rapid merges never cancel an earlier one');
  assert.doesNotMatch(dock, /return \(\) => clearTimeout\(timer\);\s*\}, \[progress, shownProgress\]\);/, 'no single cancel-and-restart timer for the bar');
  assert.match(dock, /if \(landed && !miss && \(finale \|\| landed\.shot \|\| landed\.direct \|\| landed\.index % 2 === 0\)\) setImpacts\(/, 'the first and third landings burst, and the finale always; the others only tap');
  assert.match(dock, /export const OPENING_GLOWS_PER_MERGE = 4;/, 'a burst of Glow per merge');
  assert.match(dock, /Array\.from\(\{ length: OPENING_GLOWS_PER_MERGE \}, \(_, index\) => \(\{ id: \+\+nextId\.current, index, from, to, group, key: aimed\?\.key \}\)\)/, 'the burst peels off one Glow per index, all at the wisp the sink named');
  assert.match(dock, /count=\{flight\.count \?\? OPENING_GLOWS_PER_MERGE\} index=\{flight\.index\}/, 'the flight staggers by index');
  assert.match(dock, /setLanded\(\(count\) => count \+ 1\);[\s\S]*?if \(process\.env\.EXPO_OS === 'ios' && !landed\?\.direct && \(finale \|\| landed\?\.index === 0\)\) void Haptics\.impactAsync/, 'every impact flashes the bar; the phone taps once per burst and once for the finale (never for a Lanes bolt)');
  assert.match(screen, /landings=\{openingGlow\.store\}/);
  assert.match(dock, /const impactKey = useSyncExternalStore\(landings\?\.subscribe \?\? subscribeToNothing, landings\?\.getLanded \?\? noLandings, landings\?\.getLanded \?\? noLandings\);/, 'the bar flashes on its own subscription');
  assert.match(dock, /const grew = progress > previous\.current;[\s\S]*?scale\.value = withSequence\(/, 'the bar swells once per landed Glow');
  assert.match(screen, /<MergeFtueOverlay blockedPulseNonce=\{openingBlockedNonce\}[\s\S]*?guide=\{openingBoardStep\?\.guide\?\.title \? openingBoardStep\.guide : null\}[\s\S]*?spotlight=\{openingBoardStep\?\.spotlight \?\? null\}/);
  // The caption uses the cleared dock space during the reveal; the camera
  // still waits until the crossblend and reading beat finish.
  assert.match(screen, /if \(presentation\.veilLift\) \{[\s\S]*?setOpeningRevealComplete\(true\)/);
  assert.match(screen, /!openingRevealComplete \|\| openingLiftCameraHeld \|\| !ftueCameraSettled \|\| !screenFocused/);
  assert.match(screen, /setLiftCaptionVisible\(true\), REVEAL_CAPTION_DELAY_MS/);
  assert.match(screen, /ftueStepId !== OPENING_MIST_LIFT_STEP_ID \|\| liftCaptionVisible/);

  assert.match(screen, /const LIFT_CAPTION_MIN_MS = 2_200;/, "FTUE v2: the lift breathes before the Heart Tree");
  assert.match(screen, /if \(homeVeil !== 'lifting'\) return;[\s\S]*?veilLiftKeyRef\.current = key;[\s\S]*?veilLift: true/, 'the crossblend starts when the veil enters lifting, not when the step changes');
  // The mist clears on the frame the final item strikes the tile; the camera, caption and dock still wait for the burst to settle.
  assert.match(screen, /const homeVeil = routeFtueStepId === OPENING_MIST_LIFT_STEP_ID && openingFinaleHeld && !openingGlow\.finaleLanded \? 'veiled' : homeVeilForStep\(routeFtueStepId\);/);
  assert.match(dock, /if \(finale\) \{\s*setFinaleLanded\(true\);\s*setFinaleLandedId\(id\);/, 'the landing flag is raised at impact, by id too');
  assert.match(screen, /Boolean\(upgradePresentation && !upgradePresentation\.veilLift\)/, 'the HUD stays hidden while the veil lifts');
  assert.match(screen, /homeVeil=\{homeVeil\}\s*homeSolo=\{homeSoloForStep\(ftueStepId\)\}/);
  assert.match(canvas, /return buildMossproutHexNeighborhoodScene\(fromSlots, fromNatureLevels, fromGarden, fromReveals, \{ homeVeiled: homeVeil === 'veiled' \|\| homeVeil === 'lifting', homeSolo, revealWorldWithHome \}\);/, 'the lift’s from-scene stays veiled and solo, so the world never flashes in during the crossblend');
  assert.match(canvas, /const joinedLater = layerJoinedLater\(layer\.id\);[\s\S]*?<Animated\.View entering=\{joinedLater \? FadeIn\.duration\(reduceMotion \? 120 : 720\) : undefined\}[\s\S]*?<KingdomTileArt/, 'tiles that join after mount fade in rather than snap');
  assert.match(screen, /: ftueStepId === OPENING_MIST_OPEN_STEP_ID\s*\? OPENING_CAMERA_ENTRY_ZOOM/, 'the first beat mounts further out and glides in');
  assert.match(canvas, /const revealingVeiledHome = Boolean\(upgradePresentation\?\.veilLift\);\s*const homeVeilProgress = useSharedValue\(0\);/, 'the lift owns one reveal clock, like the Steppling reveal');
  assert.match(canvas, /transitionLayers\.toLayer\.id === scene\.centerTile\.id && \(upgradeOwnsLayer \? revealingVeiledHome : settlingUpgrade\?\.nonce === veilLiftNonceRef\.current\)\s*\? homeVeilProgress : undefined/, 'the mist crossblend drives that clock');
  assert.match(canvas, /eggSkinId=\{revealedEggProjection\.eggSkinId\}\s*revealProgress=\{homeVeil !== 'none' \|\| settlingUpgrade\?\.nonce === veilLiftNonceRef\.current \? homeVeilProgress : undefined\}/, 'the Egg fades in with the tile, never ahead of it');
  assert.match(route, /if \(ftueRun\?\.status !== 'active' \|\| ftueRun\.mergeInstalled \|\| installingMossproutRef\.current\) return;/, 'the Last Clearing brings Mossprout into the world once, at the start of the run');
  assert.match(screen, /const mission = useOpeningMissionBoard\(missionRunId\);/, 'the Kingdom owns the mission board');
  assert.match(screen, /if \(ftueStepId === 'world\.egg_intro'\) clearOpeningMission\(\);/, 'the mission store goes with the mist');
  assert.match(screen, /state=\{battle\.store\.state\} send=\{battle\.store\.send\}/, 'the dock plays the battle’s own board, not the provider');
  assert.doesNotMatch(dock, /useMergeWorldState|useMergeWorldActions/, 'the dock has no link to the persistent board');
  const surface = readFileSync('components/katchadeck/games/merge-play-surface.tsx', 'utf8');
  assert.match(surface, /const state = override \?\? subscribed;/, 'the surface renders an explicit board over the provider one');
  assert.match(route, /if \(stepId === 'world\.mist_open'\) \{\s*commitFtueAction\(\{ actionId: 'world\.look_closer'/);
  const tab = readFileSync('app/(tabs)/katchimeras.tsx', 'utf8');
  assert.match(tab, /const eggPresentationActive = mossproutFtueUsesEggStage\(ftueStep\?\.id\)/);
  const egg = readFileSync('components/katchadeck/world/mossprout-egg-ftue-surface.tsx', 'utf8');
  assert.match(egg, /const scriptedActions = stepId === 'world\.egg_intro' \|\| stepId === 'world\.mist_lift'/);
  const caption = readFileSync('components/katchadeck/world/kingdom-opening-caption.tsx', 'utf8');
  assert.match(caption, /setTimeout\(\(\) => setPage\(1\), reduceMotion \? 1_200 : OPENING_CAPTION_PAGE_MS\)/);
  assert.match(caption, /disabled=\{page === 1 \|\| single\}[\s\S]*?onPress=\{\(\) => setPage\(1\)\}/, 'a two-line caption can be tapped through; a one-line one has nothing to skip');
});


test('retired wisp introductions resume at question one without losing progress', () => {
  const { runtime } = loadRuntime();
  const run = runtime.beginFtueRun({ restart: true });
  for (const stepId of ['egg.wisps', 'egg.listening']) {
    const resumed = loadRuntime({ ...run, stepId }).runtime.loadFtueRun()!;
    assert.equal(resumed.stepId, 'egg.opening');
    assert.equal(resumed.status, 'active');
    assert.equal(JSON.stringify(resumed.receipts), JSON.stringify(run.receipts));
  }
});

test('the Heart Tree wakes once, with the first light, and stirs the Heartwood', () => {
  const now = 1_000;
  let world = createInitialMergeWorldState(now);
  assert.equal(heartwoodStage(world), 'dormant');
  const short = reduceMergeWorld({ ...world, coins: GLOW.firstRestorationCost - 1 }, { type: 'restoreHeartTree', receiptId: 'run:heart-tree', cost: GLOW.firstRestorationCost, now });
  assert.equal(short.changed, false, 'short of the light, nothing is spent');
  world = { ...world, coins: GLOW.firstRestorationCost + 5 };
  const woken = reduceMergeWorld(world, { type: 'restoreHeartTree', receiptId: 'run:heart-tree', cost: GLOW.firstRestorationCost, now });
  assert.equal(woken.changed, true);
  assert.equal(woken.state.coins, 5);
  assert.equal(heartwoodStage(woken.state), 'stirring', 'the Tree stirs once it is woken');
  const again = reduceMergeWorld(woken.state, { type: 'restoreHeartTree', receiptId: 'run:heart-tree', cost: GLOW.firstRestorationCost, now: now + 1 });
  assert.equal(again.changed, false, 'woken once; a relaunch pays nothing twice');
  assert.equal(normalizeMergeWorldState(JSON.parse(JSON.stringify(woken.state)), now).heartTree?.receiptId, 'run:heart-tree', 'the woken Tree survives a reload');
});

test('the Lost Trail is Steppling\u2019s own tile under the Mist: its misted art, and him lost inside', () => {
  assert.equal(LOST_TRAIL_TILE_ID, STEPPLING_HATCHABLE.tile.id, 'the trail battles dock under his own tile');
  assert.ok(!STORY_TILES.some((tile) => tile.id === 'lost-trail'), 'no separate Lost Trail tile on the map');
  assert.equal(STEPPLING_HATCHABLE.tile.lostSkinId, 'steppling', 'Steppling is the silhouette in its Mist');
  assert.equal(STEPPLING_HATCHABLE.tile.mistedAlphaBoundsKey, 'shared_world_steppling_misted_hex_tile_v1.webp', 'his own misted trailhead, not the shared mist tile');
  for (const key of [STEPPLING_HATCHABLE.tile.alphaBoundsKey, STEPPLING_HATCHABLE.tile.mistedAlphaBoundsKey!, 'mossprout_veiled_main_hex_tile_v1.webp', 'shared_world_hollow_tree_hex_tile_v1.webp']) {
    assert.ok(key in KINGDOM_HEX_TILE_ALPHA_BOUNDS, `${key} has generated bounds (the art went through the hex pipeline)`);
  }
});

test('Steppling is rescued from the Mist, free and once: his tile open and him home, no Egg, no ticket', () => {
  const now = 5_000;
  const world = { ...createInitialMergeWorldState(now), coins: 7 };
  const rescued = reduceMergeWorld(world, { type: 'rescueWorldFriend', targetId: STEPPLING_HATCHABLE.tile.unlockId, now });
  assert.equal(rescued.changed, true);
  assert.equal(rescued.state.coins, 7, 'a rescue costs nothing');
  const unlock = rescued.state.worldUnlocks?.[STEPPLING_HATCHABLE.tile.unlockId];
  assert.ok(unlock?.transferredAt != null && unlock.hatchedAt != null, 'open, carried and hatched in one write');
  assert.ok(rescued.state.companionDiscovery.records.some((record) => record.characterId === 'steppling'), 'Steppling is home');
  assert.ok(rescued.state.unlockedCharacters.includes('steppling'));
  assert.equal(reduceMergeWorld(rescued.state, { type: 'rescueWorldFriend', targetId: STEPPLING_HATCHABLE.tile.unlockId, now: now + 1 }).changed, false, 'once home, asking again changes nothing');
});
