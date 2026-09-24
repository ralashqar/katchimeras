import { gameNow } from '@/utils/game-clock';
import { registerLanternFlows } from '@/features/wisps/lantern-flows';
import { registerAdventureFlows } from '@/features/shared-adventure/flows';
import { packEntries } from '@/features/content-packs/active-pack';
import { HATCHABLE_COMPANIONS } from '@/constants/hatchable-companions/registry';
import { hatchableFlows } from '@/features/onboarding/hatchable-flows';
import { LEGACY_STEPPLING_DAY_ONE_FLOW_V2 } from './legacy/steppling-day-one-flow-v2';
import { completeMossproutHavenUpgrade } from '@/utils/companion-story-storage';
import { LEGACY_WORLD_UPGRADE_FLOWS, WORLD_UPGRADE_FLOWS } from '@/features/world-upgrades/world-upgrade-flows';
import { MOSSPROUT_JOURNEY_CAMPAIGN } from '@/constants/mossprout-journey-campaign';
import { registerCompanionJourneyFlows } from '@/features/companion/companion-journey-service';
import { nextUnearnedMossproutResident } from '@/constants/resident-card-discovery';
import { MOSSPROUT_FTUE_VARIANTS } from '@/features/onboarding/mossprout-ftue-flow';
import { LEGACY_STEPPLING_DAY_ONE_FLOW } from './legacy/steppling-day-one-flow-v1';
import { startGlowDiscovery } from '@/features/onboarding/glow-discovery-runtime';
import { GLOW_GATEWAY_ID } from '@/utils/merge-world/glow-discovery-policy';
import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';
import type { StoryWorldUpgradeEffectPayload } from '@/types/content-flow';
import { applyStoredGlowDiscovery, grantStoredGeneratorParcel, reconcileStoredHavenStory, activateStoredResidentCardDiscovery, ensureStoredFirstSpringBuilt, wakeStoredFirstSpring, loadMergeWorldState, revealStoredHaven, revealStoredMovementEgg, seedStoredMossproutGardenAfterFtue, upgradeStoredHavenFeature, upgradeStoredStoryWorldTarget, ensureStoredOpeningGlow, restoreStoredHeartTree } from '@/utils/merge-world/repository';
import { GLOW } from '@/constants/glow';
import { heartwoodBuildingById } from '@/constants/heartwood-buildings';
import { FIRST_SEED_BUILDING_ID } from '@/features/heartwood-buildings/buildings-world';
import { completeDayOneLesson } from '@/game/katchimeras/action-runtime';
import { beginKatchimeraMeditation, completeMossproutJourneyResolution, katchimeraMeditationRecord } from '@/game/katchimeras/relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET, MOSSPROUT_FTUE_NAME_BOND_TARGET } from '@/features/onboarding/mossprout-bond-share';
import { localDayId } from '@/utils/world-identity';
import { keepMossproutFirstSeed } from '@/features/onboarding/mossprout-profile';
import { companionIdForFamily } from '@/constants/katchimera-skins';
import { companionBondProgress, recordCompanionBondEvent } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests } from '@/utils/katchimera-quests';
import { homeRepository } from '@/storage/repositories/home-repository';
import { loadCompanionContentState } from '@/utils/companion-content-storage';
import { grantStoredJourneyWisp, loadWispState } from '@/utils/wisp-storage';
import { resolveJourneyWisp } from '@/utils/journey-wisp-affinity';
import type { WispId } from '@/types/wisp';

import { registerContentFlowEffect } from './content-flow-capabilities';
import { registerContentFlowDefinition } from './content-flow-catalog';
import { compileJourneyCampaignFlows } from './journey-flow-compiler';
import { STORY_WORLD_UPGRADE_EFFECT } from './story-world-operations';
import { registerStoryVariantSet } from './story-variant-registry';

let bootstrapped = false;

export function bootstrapContentFlowCatalog() {
  if (bootstrapped) return;
  registerAdventureFlows();
  registerLanternFlows();
  registerCompanionJourneyFlows();
  [...LEGACY_WORLD_UPGRADE_FLOWS, ...WORLD_UPGRADE_FLOWS].forEach(registerContentFlowDefinition);
  registerStoryVariantSet(MOSSPROUT_FTUE_VARIANTS);
  MOSSPROUT_FTUE_VARIANTS.variants.forEach((variant) => registerContentFlowDefinition(variant.definition));
  // Every hatchable companion's discovery, day one and garden lesson, generated from its definition.
  for (const definition of HATCHABLE_COMPANIONS) {
    const flows = hatchableFlows(definition);
    registerContentFlowDefinition(flows.discovery);
    registerContentFlowDefinition(flows.dayOne);
    registerContentFlowDefinition(flows.gardenLesson);
  }
  registerContentFlowDefinition(LEGACY_STEPPLING_DAY_ONE_FLOW);
  registerContentFlowDefinition(LEGACY_STEPPLING_DAY_ONE_FLOW_V2);
  // Flows a content pack brought, validated before the pack was accepted.
  packEntries('flows').forEach(registerContentFlowDefinition);
  registerContentFlowEffect('journey.grant_generator_parcel', async ({ run, payload }) => {
    const generatorId = String(payload.generatorId);
    const rewardId = String(payload.rewardId);
    const result = await grantStoredGeneratorParcel(generatorId, rewardId, String(run.variables.dayId ?? localDayId()));
    if (!result.changed && !result.state.generators[generatorId] && !result.state.arrivals.some((arrival) => arrival.id === rewardId)) throw new Error('The Garden parcel could not be delivered. Please try again.');
    return { rewardId, generatorId };
  });
  registerContentFlowEffect('haven.start_glow_discovery', async ({ effectKey }) => {
    await seedStoredMossproutGardenAfterFtue(localDayId());
    await startGlowDiscovery();
    return { effectKey };
  });
  for (const [capability, type] of [
    ['glow.lesson.prepare', 'prepareGlowDiscoveryLesson'],
  ] as const) {
    registerContentFlowEffect(capability, async () => {
      const result = await applyStoredGlowDiscovery({ type, now: gameNow() });
      if (!result.changed && result.message) throw new Error(result.message);
      return { targetId: GLOW_GATEWAY_ID, revision: result.state.revision };
    });
  }
  compileJourneyCampaignFlows(MOSSPROUT_JOURNEY_CAMPAIGN).forEach(registerContentFlowDefinition);
  registerContentFlowEffect('resident.grant_parcel', async ({ run, effectKey, payload }) => {
    const world = await loadMergeWorldState();
    const earned = world.ownedKatchimeraCards.filter((card) => card.familyId === 'mossprout').map((card) => card.cardId);
    const selection = payload.selection;
    const preferred = selection === 'matched'
      ? run.variables.matchedCardId as KatchimeraSkinId | null
      : typeof selection === 'string' && selection !== 'next_unearned'
        ? selection as KatchimeraSkinId
        : null;
    const residentId = nextUnearnedMossproutResident(earned, preferred);
    if (!residentId) throw new Error('No unearned Mossprout resident is available for this flow');
    const dayId = typeof run.variables.dayId === 'string' ? run.variables.dayId : run.runId;
    const result = await activateStoredResidentCardDiscovery('mossprout:journey', dayId, residentId);
    if (!result.changed && !result.state.residentCardDiscovery.records.some((record) => record.journeyDayId === dayId && record.residentId === residentId)) {
      throw new Error('The resident parcel could not be granted');
    }
    return { effectKey, residentId, dayId };
  });
  registerContentFlowEffect('journey.wisp_reward', async ({ effectKey, payload }) => {
    const rewardId = String(payload.rewardId ?? effectKey);
    const existing = loadWispState().journeyRewards?.[rewardId];
    if (existing) return existing;
    const candidateWispIds = Array.isArray(payload.candidateWispIds) ? payload.candidateWispIds.filter((id): id is WispId => typeof id === 'string') : [];
    const fallbackWispId = String(payload.fallbackWispId ?? candidateWispIds[0] ?? 'sprout') as WispId;
    if (!candidateWispIds.length) throw new Error('Journey Wisp reward has no candidates');
    const priorRewards = Object.values(loadWispState().journeyRewards ?? {});
    const after = priorRewards.reduce((latest, receipt) => Math.max(latest, receipt.grantedAt), 0);
    const profile = loadOnboardingProfile();
    const extraOptionIds = after === 0
      ? Object.values(profile.mossproutAnswers).filter((value): value is string => typeof value === 'string' && Boolean(value))
      : [];
    const resolved = resolveJourneyWisp({
      candidateWispIds,
      fallbackWispId,
      sessions: loadCompanionContentState().conversationSessions,
      after,
      extraOptionIds,
    });
    return grantStoredJourneyWisp({ rewardId, wispId: resolved.wispId, choiceIds: resolved.choiceIds }).receipt;
  });
  registerContentFlowEffect('optional_action.publish', async ({ effectKey, payload }) => ({ effectKey, action: payload.action }));
  registerContentFlowEffect('relationship.complete_day_one_lesson', async ({ run, effectKey }) => {
    const completedAt = gameNow();
    relationshipProgressionRepository.update((state) => completeDayOneLesson(state, { completedAt, flowRunId: run.runId }));
    const homeState = homeRepository.load();
    const resolveCompanionId = companionIdResolverForHomeState(homeState);
    const bondState = loadCompanionBondState(loadCompanionQuests(resolveCompanionId), resolveCompanionId, homeState);
    const creatureId = companionIdForFamily('mossprout');
    const points = Math.max(0, MOSSPROUT_FTUE_NAME_BOND_TARGET - companionBondProgress(bondState, creatureId).totalPoints);
    if (points > 0) {
      const result = recordCompanionBondEvent(bondState, { id: `ftue-bond-share:${String(run.variables.ftueRunId ?? run.runId)}`, creatureId, kind: 'check_in_completed', points, occurredAt: completedAt });
      if (result.awarded) saveCompanionBondState(result.state);
    }
    keepMossproutFirstSeed();
    return { effectKey, completedAt, flowRunId: run.runId };
  });
  registerContentFlowEffect('haven.prepare_merge_handoff', async ({ effectKey }) => {
    await seedStoredMossproutGardenAfterFtue(localDayId());
    return { effectKey };
  });
  registerContentFlowEffect('relationship.first_bloom_bond', async ({ effectKey }) => {
    relationshipProgressionRepository.update((state) => {
      const journey = [...state.journeyDays].reverse().find((day) => day.familyId === 'mossprout' && day.beatId === 'quiet-patch:first-flower');
      return journey ? completeMossproutJourneyResolution(state, journey.dayId) : state;
    });
    const homeState = homeRepository.load();
    const resolveCompanionId = companionIdResolverForHomeState(homeState);
    const questState = loadCompanionQuests(resolveCompanionId);
    const bondState = loadCompanionBondState(questState, resolveCompanionId, homeState);
    const creatureId = companionIdForFamily('mossprout');
    const points = Math.max(0, MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET - companionBondProgress(bondState, creatureId).totalPoints);
    if (points > 0) {
      const result = recordCompanionBondEvent(bondState, {
        id: effectKey,
        creatureId,
        kind: 'check_in_completed',
        points,
        occurredAt: gameNow(),
      }, { queueCelebration: true });
      if (result.awarded) saveCompanionBondState(result.state);
    }
    return { effectKey, target: MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET, points };
  });
  registerContentFlowEffect('relationship.begin_meditation', async ({ run, effectKey, payload }) => {
    const familyId = payload.familyId as KatchimeraFamilyId;
    const durationMs = Number(payload.durationMs);
    const sourceId = `ftue:${String(run.variables.ftueRunId ?? run.runId)}:first-rest`;
    const startedAt = gameNow();
    relationshipProgressionRepository.update((state) => beginKatchimeraMeditation(
      state,
      familyId,
      startedAt,
      durationMs,
      sourceId,
    ));
    const meditation = katchimeraMeditationRecord(relationshipProgressionRepository.load(), familyId);
    if (!meditation) throw new Error('The companion meditation could not be started');
    return { effectKey, familyId, sourceId, startedAt: meditation.startedAt, availableAt: meditation.availableAt };
  });
  // The three first-memory capabilities keep their ids (they are save data) but no longer deal in memory seeds: the
  // first thing at Heartwood is the Dew Spring. Nothing is granted ahead of time, "place" digs the Spring out dormant,
  // and "grow" wakes it with the garden.
  registerContentFlowEffect('haven.grant_first_memory', async ({ effectKey }) => (
    { effectKey, buildingId: FIRST_SEED_BUILDING_ID }
  ));
  registerContentFlowEffect('haven.opening_glow', async ({ run, effectKey }) => {
    const sourceId = typeof run.variables.ftueRunId === 'string' ? run.variables.ftueRunId : run.runId;
    const result = await ensureStoredOpeningGlow(`${sourceId}:opening-glow`);
    if (!result.state.openingGlow) throw new Error('The first light could not be kept');
    return { effectKey, amount: result.state.openingGlow.amount, receiptId: result.state.openingGlow.receiptId };
  });
  // The Kingdom wakes the Tree with its coins and light before the story moves on; this is the story's own guarantee
  // (a relaunch between the two): the first light kept, a short profile topped up once, and the Tree restored.
  registerContentFlowEffect('haven.restore_heart_tree', async ({ run, effectKey }) => {
    const sourceId = typeof run.variables.ftueRunId === 'string' ? run.variables.ftueRunId : run.runId;
    const lit = await ensureStoredOpeningGlow(`${sourceId}:opening-glow`);
    if (!lit.state.heartTree && lit.state.coins < GLOW.firstRestorationCost) {
      await ensureStoredOpeningGlow(`${sourceId}:heart-tree-light`, GLOW.firstRestorationCost - lit.state.coins);
    }
    const result = await restoreStoredHeartTree(`${sourceId}:heart-tree`);
    if (!result.restored) throw new Error(result.message ?? 'The Heart Tree could not be woken');
    return { effectKey, receiptId: result.state.heartTree!.receiptId };
  });
  registerContentFlowEffect('haven.place_first_memory', async ({ effectKey }) => {
    const built = await ensureStoredFirstSpringBuilt();
    if (!built.placed) throw new Error('The Dew Spring could not be built');
    return { effectKey, buildingId: FIRST_SEED_BUILDING_ID, slotId: heartwoodBuildingById.get(FIRST_SEED_BUILDING_ID)!.slotId };
  });
  registerContentFlowEffect('haven.grow_first_memory', async ({ effectKey }) => {
    const woken = await wakeStoredFirstSpring();
    if (!woken.awake) throw new Error('The Dew Spring could not be woken');
    return { effectKey, buildingId: FIRST_SEED_BUILDING_ID, level: woken.state.heartwoodBuildings?.[FIRST_SEED_BUILDING_ID]?.level ?? 1 };
  });
  registerContentFlowEffect('haven.feature.upgrade', async ({ effectKey, payload }) => {
    const featureId = payload.featureId === 'path' ? 'path' : 'spring';
    const result = await upgradeStoredHavenFeature(featureId, Number(payload.toLevel ?? 1), effectKey);
    if (!result.changed && !result.state.haven.mutationReceipts.some((receipt) => receipt.id === effectKey)) throw new Error(result.message ?? 'Garden feature could not be restored');
    return { effectKey, featureId, level: result.state.haven.structures.mossproutGarden.featureLevels[featureId] };
  });
  registerContentFlowEffect('haven.movement_egg.reveal', async ({ effectKey }) => revealStoredMovementEgg(effectKey));
  registerContentFlowEffect('haven.reveal', async ({ effectKey }) => {
    const result = await revealStoredHaven();
    return { effectKey, revealState: result.state.haven.revealState };
  });
  registerContentFlowEffect(STORY_WORLD_UPGRADE_EFFECT, async ({ effectKey, payload }) => {
    const result = await upgradeStoredStoryWorldTarget(effectKey, payload as StoryWorldUpgradeEffectPayload);
    if (!result.storyWorldMutationReceipt) throw new Error(result.message ?? 'The authored world upgrade could not be applied');
    // Reconcile on receipt replay too: a crash may happen after spending Glow
    // but before the completed island tier advances the companion story.
    const receipt = result.storyWorldMutationReceipt;
    if (receipt.target.kind === 'haven_nature_island' && receipt.toLevel >= 2
      && (result.state.haven.tileStages.mossprout ?? 0) >= receipt.toLevel) {
      const story = completeMossproutHavenUpgrade(receipt.toLevel);
      await reconcileStoredHavenStory('mossprout', story.currentLevel);
    }
    return receipt;
  });
  bootstrapped = true;
}
