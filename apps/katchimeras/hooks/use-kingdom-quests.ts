import { loadHatchProfile } from '@/features/onboarding/hatch-profile-storage';
import { hatchableByCompanion } from '@/constants/hatchable-companions/registry';
import { conversationTranscript, rememberConversationLine } from '@/utils/conversation-transcript';
import { legacyMossproutPondConversation } from '@/constants/mossprout-campaign-conversations';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import { homeRepository } from '@/storage/repositories/home-repository';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { completeMossproutFocusAction, completeMossproutJourneyGoalPlan, mossproutJourneyForDay, mossproutJourneyRuntimeDayId, recordMossproutMatchedCard } from '@/game/katchimeras/relationship-progression';
import { commitKatchimeraActionCompletion, reconcilePendingActionRewards } from '@/game/katchimeras/action-completion';
import type { HomeDayRecord } from '@/types/home';
import type { KingdomCreature, KingdomState } from '@/types/kingdom';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { CompanionChatStarter, CompanionDestination } from '@/types/companion-interaction';
import { loadCompanionQuests } from '@/utils/katchimera-quests';
import {
  acknowledgeCompanionBondCelebration,
  COMPANION_BOND_REWARDS,
  companionBondProgress,
  companionFriendshipProgress,
  recordCompanionBondEvent,
  syncCompanionBondEvent,
  type CompanionBondEventKind,
} from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState, subscribeCompanionBondState } from '@/utils/companion-bond-storage';
import { completeAuthoredCohortConversation, isAuthoredCohortFamily } from '@/utils/companion-story-storage';
import { companionJourneyByFamilyId } from '@/constants/companion-journeys';
import {
  companionConversationDefinitionById,
  companionConversationDefinitionsForFamily,
} from '@/constants/companion-conversations-v2';
import { resolveMossproutCampaignConversation } from '@/constants/mossprout-campaign-conversations';
import { companionIdForFamily, katchimeraSkinById } from '@/constants/katchimera-skins';
import { isJourneyQuickModeEnabled } from '@/utils/dev-settings';
import { companionQuickGoalTemplateById } from '@/constants/companion-quick-goals';
import { activateStoredResidentCardDiscovery, loadMergeWorldState, subscribeMergeWorldSnapshots } from '@/utils/merge-world/repository';
import type { ConversationDefinition, ConversationMode, ConversationNode, ConversationOutcomePresentation, ConversationSession } from '@/types/companion-conversation';
import type { KatchimeraActionOrigin } from '@/types/relationship-progression';
import { isConversationV2Family } from '@/types/companion-conversation';
import {
  activeConversationForFamily,
  answerJourneyConversation,
  createJourneyGoalFromProposal,
  currentJourneyConversationNode,
  goalsForJourneyFamily,
  primaryGoalForFamily,
  renameJourneyGoal,
  setJourneyGoalStatus,
  startJourneyConversation,
} from '@/utils/companion-journey';
import {
  activeConversationSessionForFamily,
  memoriesForFamily,
  recordConversationTelemetry,
  updateCompanionMemoryStatus,
  upsertCompanionMemory,
  upsertCompanionInsight,
  upsertConversationSession,
  previewConversationSessionForFamily,
  type CompanionContentState,
} from '@/utils/companion-content';
import {
  answerConversation,
  archiveConversationSession,
  continueConversation,
  conversationNode,
  createConversationSession,
  conversationQuestionCount,
  recordConversationOutcome,
  selectConversationForMode,
  selectConversationFromPool,
  finishConversationAfterOutcome,
} from '@/utils/companion-conversation';
import { loadCompanionContentState, saveCompanionContentState, subscribeCompanionContentResets } from '@/utils/companion-content-storage';
import { resolveMossproutFtueConversation } from '@/constants/mossprout-ftue-conversations';
import { legacyStepplingDayOneConversation, legacyStepplingDayOneConversationV2 } from '@/constants/steppling-day-one-conversation';
import { recordLifeConversation, recordScenarioAnswer } from '@/utils/companion-life-recording';
import { nextMossproutTheory } from '@/utils/companion-theory';
import { MOSSPROUT_THEORY_TITLE } from '@/constants/mossprout-theory-conversations';
import { loadOnboardingProfile as loadLifeOnboardingProfile } from '@/utils/onboarding-state';
import { loadCompanionJourneyState, saveCompanionJourneyState } from '@/utils/companion-journey-storage';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import type { KingdomResident } from '@/utils/kingdom-residents';
import { localDayId } from '@/utils/world-identity';

/**
 * The companion page's state: which resident is open, their Bond, the
 * conversation they are in (day one, a daily question, a theory, a story
 * chapter, an island chapter), Mossprout's daily cards and nature-direction
 * questionnaire, and the small-goal suggestions a conversation leaves behind.
 * Nothing here knows about quests, visits, or the retired chat lobby.
 */

type SelectedResident = {
  creature: KingdomCreature;
  resident: KingdomResident;
  destination: CompanionDestination | null;
};

type Args = {
  kingdom: KingdomState;
  residents: KingdomResident[];
  today: HomeDayRecord | null;
};

const NO_STATUS_GLYPHS: Partial<Record<string, 'offer' | 'active' | 'ready'>> = {};

function loadIdentityAwareCompanionBondState() {
  const homeState = homeRepository.load();
  const resolveCompanionId = companionIdResolverForHomeState(homeState);
  const quests = loadCompanionQuests(resolveCompanionId);
  return loadCompanionBondState(quests, resolveCompanionId, homeState);
}

function settleMossproutJourneyBond(dayId: string) {
  const relationships = relationshipProgressionRepository.load();
  const journey = mossproutJourneyForDay(relationships, dayId);
  const receipt = journey?.status === 'complete' ? journey.completionReceipt : null;
  if (!journey || !receipt) return;
  // The first Journey Day deliberately settles after the player chooses one
  // optional action card. This makes the visible action the cause of the Bond
  // reward and avoids turning all three cards into a checklist.
  if (journey.beatId === 'quiet-patch:first-flower'
    && !journey.actions.some((action) => action.kind !== 'journey' && action.status === 'completed')) return;
  const current = loadIdentityAwareCompanionBondState();
  const individuallyAwarded = relationships.actionCompletions.reduce((total, event) => {
    if (event.owner.kind !== 'journey' || event.owner.journeyId !== journey.id || event.kind === 'story_chat' || !event.rewardEventId) return total;
    return total + (current.events.find((bondEvent) => bondEvent.id === event.rewardEventId)?.points ?? 0);
  }, 0);
  const result = syncCompanionBondEvent(current, {
    id: receipt.id,
    creatureId: companionIdForFamily('mossprout'),
    kind: 'journey_day_completed',
    points: Math.max(0, receipt.bondPoints - individuallyAwarded),
    occurredAt: receipt.createdAt,
    dayId: receipt.dayId,
  }, { queueCelebration: true });
  if (result.awarded) saveCompanionBondState(result.state);
}

function settleActionConversationCompletion(
  session: ConversationSession,
  definition: ConversationDefinition | null | undefined,
) {
  if (!definition
    || (definition.tags?.includes('island-campaign') && !session.actionOrigin)
    || (session.dialoguePresentation && (!session.dialogueAcknowledgedAt || session.outcomePresentation))
    || (definition.familyId !== 'mossprout' && !session.actionOrigin)) return;
  commitKatchimeraActionCompletion({ session, definition });
}

function conversationHasIndependentBond(definitionId: string, dayId?: string | null) {
  if (definitionId.startsWith('steppling:trail-chat:')) return false;
  if (!definitionId.startsWith('mossprout:') || !dayId) return true;
  const relationships = relationshipProgressionRepository.load();
  const runtimeDayId = mossproutJourneyRuntimeDayId(relationships, dayId, isJourneyQuickModeEnabled());
  const journey = mossproutJourneyForDay(relationships, runtimeDayId)
    ?? [...relationships.journeyDays].reverse().find((candidate) => (
      candidate.familyId === 'mossprout'
      && candidate.actions.some((action) => action.definitionId === definitionId)
    ));
  return !journey?.actions.some((action) => action.definitionId === definitionId);
}

function mossproutConversationCompletionDayId(dayId: string): string {
  const relationships = relationshipProgressionRepository.load();
  return mossproutJourneyRuntimeDayId(relationships, dayId, isJourneyQuickModeEnabled());
}

function independentConversationBondPoints(definitionId: string) {
  return definitionId.startsWith('mossprout:') ? 4 : COMPANION_BOND_REWARDS.conversation_completed;
}

export function useKingdomQuests({ kingdom, residents, today }: Args) {
  // Island friends only guest-star in Mossprout's journey once they are home.
  const [homeResidentSkinIds, setHomeResidentSkinIds] = useState<readonly KatchimeraSkinId[]>([]);
  useEffect(() => {
    let live = true;
    const apply = (world: { mossproutResidentSkinIds: readonly KatchimeraSkinId[] }) => {
      if (!live) return;
      setHomeResidentSkinIds((previous) => previous.length === world.mossproutResidentSkinIds.length
        && previous.every((id, index) => id === world.mossproutResidentSkinIds[index]) ? previous : [...world.mossproutResidentSkinIds]);
    };
    void loadMergeWorldState().then(apply).catch(() => undefined);
    const unsubscribe = subscribeMergeWorldSnapshots(apply);
    return () => { live = false; unsubscribe(); };
  }, []);
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<SelectedResident | null>(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [companionBondState, setCompanionBondState] = useState(loadIdentityAwareCompanionBondState);
  const [companionJourneyState, setCompanionJourneyState] = useState(loadCompanionJourneyState);
  const [companionContentState, setCompanionContentState] = useState<CompanionContentState>(loadCompanionContentState);
  const companionContentStateRef = useRef(companionContentState);
  companionContentStateRef.current = companionContentState;
  const commitConversationState = useCallback((update: (current: CompanionContentState) => CompanionContentState) => {
    const next = update(companionContentStateRef.current);
    companionContentStateRef.current = next;
    setCompanionContentState(next);
  }, []);
  useEffect(() => {
    const reconcile = () => {
      for (const journey of relationshipProgressionRepository.load().journeyDays) {
        if (journey.familyId === 'mossprout' && journey.status === 'complete' && journey.completionReceipt) {
          settleMossproutJourneyBond(journey.dayId);
        }
      }
    };
    reconcile();
    const unsubscribe = relationshipProgressionRepository.subscribe(reconcile);
    return () => { unsubscribe(); };
  }, []);
  const [quickGoalSuggestions, setQuickGoalSuggestions] = useState<{
    familyId: string;
    templateIds: readonly string[];
  } | null>(null);
  const residentById = useMemo(() => new Map(residents.map((resident) => [resident.creatureId, resident])), [residents]);
  const creatureById = useMemo(
    () => {
      const map = new Map<string, KingdomCreature>();
      // Kingdom creatures are newest first; retain the equipped/latest skin for
      // each logical companion rather than letting an older hatch overwrite it.
      for (const creature of kingdom.creatures) {
        if (!map.has(creature.creatureId)) map.set(creature.creatureId, creature);
      }
      return map;
    },
    [kingdom.creatures]
  );

  // Appearance can change while the interaction sheet is open. Refresh its
  // presentation record without changing the stable companion selection.
  useEffect(() => {
    setSelectedResident((current) => {
      if (!current) return current;
      const creature = creatureById.get(current.creature.creatureId);
      const resident = residentById.get(current.resident.creatureId);
      if (!creature || !resident) return null;
      if (creature === current.creature && resident === current.resident) return current;
      return { ...current, creature, resident };
    });
  }, [creatureById, residentById]);

  useFocusEffect(
    useCallback(() => {
      setCompanionBondState(loadIdentityAwareCompanionBondState());
      setCompanionJourneyState(loadCompanionJourneyState());
      setCompanionContentState(loadCompanionContentState());
    }, [])
  );

  useEffect(() => {
    if (!microcopy) return;
    const timeout = setTimeout(() => setMicrocopy(null), 2300);
    return () => clearTimeout(timeout);
  }, [microcopy]);

  const selectedFamilyId = selectedResident?.creature.familyId ?? null;
  // Mossprout's nature direction is the one journey questionnaire left: three questions, then ideas to keep.
  const selectedJourneyDefinition = selectedFamilyId === 'mossprout' ? companionJourneyByFamilyId.get('mossprout') ?? null : null;
  const selectedJourneyGoals = useMemo(
    () => selectedFamilyId ? goalsForJourneyFamily(companionJourneyState, selectedFamilyId) : [],
    [companionJourneyState, selectedFamilyId]
  );
  const selectedJourneyConversation = useMemo(
    () => selectedFamilyId ? activeConversationForFamily(companionJourneyState, selectedFamilyId) : null,
    [companionJourneyState, selectedFamilyId]
  );
  const selectedJourneyNode = useMemo(
    () => currentJourneyConversationNode(selectedJourneyConversation),
    [selectedJourneyConversation]
  );
  const selectedBondProgress = useMemo(
    () => companionBondProgress(companionBondState, selectedResident?.creature.creatureId ?? ''),
    [companionBondState, selectedResident?.creature.creatureId]
  );
  const bondProgressForCreature = useCallback(
    (creatureId: string) => companionBondProgress(companionBondState, creatureId),
    [companionBondState]
  );
  const selectedFriendshipProgress = useMemo(
    () => companionFriendshipProgress(companionBondState, selectedResident?.creature.creatureId ?? ''),
    [companionBondState, selectedResident?.creature.creatureId]
  );
  const selectedPendingBondCelebration = useMemo(
    () => selectedResident
      ? (companionBondState.pendingCelebrations ?? []).find(
          (receipt) => receipt.creatureId === selectedResident.creature.creatureId
        ) ?? null
      : null,
    [companionBondState.pendingCelebrations, selectedResident]
  );

  useEffect(
    () => subscribeCompanionContentResets(() => setCompanionContentState(loadCompanionContentState())),
    [],
  );
  useEffect(
    () => subscribeCompanionBondState(() => setCompanionBondState(loadIdentityAwareCompanionBondState())),
    [],
  );
  const selectedMemories = useMemo(
    () => selectedFamilyId
      ? memoriesForFamily(companionContentState, selectedFamilyId, { includeProvisional: true })
      : [],
    [companionContentState, selectedFamilyId]
  );
  const selectedConversationSession = useMemo(() => {
    if (!selectedFamilyId || !isConversationV2Family(selectedFamilyId)) return null;
    const preview = DEV_TOOLS_ENABLED
      ? previewConversationSessionForFamily(companionContentState, selectedFamilyId)
      : null;
    return preview
      ?? activeConversationSessionForFamily(companionContentState, selectedFamilyId)
      ?? [...companionContentState.conversationSessions]
        .reverse()
        .find((session) => session.familyId === selectedFamilyId && !session.preview && session.status !== 'archived')
      ?? null;
  }, [companionContentState, selectedFamilyId]);
  const selectedConversationDefinition = useMemo(() => {
    if (!selectedConversationSession) return null;
    const definition = companionConversationDefinitionById.get(selectedConversationSession.definitionId) ?? null;
    if (definition?.id === 'steppling:journey:day-one' && selectedConversationSession.definitionVersion < 2) return legacyStepplingDayOneConversation;
    if (definition?.id === 'steppling:journey:day-one' && selectedConversationSession.definitionVersion === 2) return legacyStepplingDayOneConversationV2;
    if (definition && definition.id === hatchableByCompanion(definition.familyId)?.dayOne.conversationId) {
      const insight = loadHatchProfile(definition.familyId).initialInsight;
      if (insight) return { ...definition, nodes: definition.nodes.map((node) => node.id === definition.entryNodeId && node.kind === 'choice' ? { ...node, prompt: `${insight}\n\n${node.prompt}` } : node) };
    }
    if (!definition || definition.familyId !== 'mossprout') return definition;
    if (definition.id.startsWith('mossprout:ftue:first-meeting:')) return resolveMossproutFtueConversation(definition, loadLifeOnboardingProfile().mossproutAnswers.growthIntentId, selectedConversationSession.definitionVersion, loadHatchProfile('mossprout').initialInsight);
    return resolveMossproutCampaignConversation(
      selectedConversationSession.definitionVersion < 5 ? legacyMossproutPondConversation(definition.id) ?? definition : definition,
      relationshipProgressionRepository.load().stories.mossprout,
      selectedConversationSession.turns,
      homeResidentSkinIds,
    );
  }, [homeResidentSkinIds, selectedConversationSession]);
  useEffect(() => {
    if (selectedConversationSession && selectedConversationDefinition) {
      recordLifeConversation(selectedConversationSession, selectedConversationDefinition);
      recordScenarioAnswer(selectedConversationSession, selectedConversationDefinition);
    }
  }, [selectedConversationSession, selectedConversationDefinition]);
  useEffect(() => {
    if (!selectedConversationSession || selectedConversationSession.preview || selectedConversationSession.status !== 'completed') return;
    const completedAt = selectedConversationSession.completedAt ?? selectedConversationSession.updatedAt;
    settleActionConversationCompletion(selectedConversationSession, selectedConversationDefinition);
    const authoredMatch = /^(baristabbit|steppling):story:(\d+)$/.exec(selectedConversationSession.definitionId);
    if (authoredMatch && isAuthoredCohortFamily(authoredMatch[1])) completeAuthoredCohortConversation(authoredMatch[1], Number(authoredMatch[2]), completedAt);
  }, [selectedConversationDefinition, selectedConversationSession]);
  useEffect(() => {
    if (!selectedConversationSession || selectedConversationSession.preview || selectedConversationSession.status !== 'active') return;
    const definition = companionConversationDefinitionById.get(selectedConversationSession.definitionId);
    if (definition && definition.version === selectedConversationSession.definitionVersion && definition.nodes.some((node) => node.id === selectedConversationSession.currentNodeId)) return;
    setCompanionContentState((current) => {
      const stale = current.conversationSessions.find((session) => session.id === selectedConversationSession.id);
      if (!stale || stale.status !== 'active') return current;
      const next = upsertConversationSession(current, { ...archiveConversationSession(stale), encounterId: undefined });
      saveCompanionContentState(next);
      return next;
    });
  }, [selectedConversationSession]);
  const selectedMossproutActionCandidates = useMemo<CompanionChatStarter[]>(() => {
    if (selectedFamilyId !== 'mossprout' || !today?.isoDate) return [];
    // Dashboard actions belong to the resident and the current day, not to a
    // transient visit encounter. The resident route can legitimately clear or
    // recreate selectedEncounterId while FTUE hands ownership back to normal
    // play. Gating the pool on that value left only the two seeded Garden
    // orders after FTUE, so the completed tutorial row had no replacement.
    const actionSelectionSeed = `mossprout-actions:${selectedResident?.creature.creatureId ?? 'mossprout'}:${today.isoDate}`;
    const allDefinitions = companionConversationDefinitionsForFamily('mossprout');
    const definitions = allDefinitions.filter((definition) => definition.format !== 'profile_game');
    const collectPool = (poolId: string) => {
      const selected: ConversationDefinition[] = [];
      while (true) {
        const next = selectConversationFromPool({
          familyId: 'mossprout',
          poolId,
          definitions,
          sessions: companionContentState.conversationSessions,
          seed: `${actionSelectionSeed}:${poolId}`,
          excludeDefinitionIds: selected.map((definition) => definition.id),
          dayId: today.isoDate,
          bondLevel: selectedBondProgress.level,
          friendshipLevel: selectedFriendshipProgress.level,
          // Daily conversation cards respect authored cooldowns; an exhausted
          // pool leaves the tracker and Garden cards available.
          allowCooldownFallback: false,
        });
        if (!next) return selected;
        selected.push(next);
      }
    };
    const collectMode = (mode: ConversationMode) => {
      const selected: ConversationDefinition[] = [];
      while (true) {
        const next = selectConversationForMode({
          familyId: 'mossprout',
          mode,
          definitions,
          sessions: companionContentState.conversationSessions,
          seed: `${actionSelectionSeed}:${mode}`,
          excludeDefinitionIds: selected.map((definition) => definition.id),
          dayId: today.isoDate,
          bondLevel: selectedBondProgress.level,
          friendshipLevel: selectedFriendshipProgress.level,
          allowCooldownFallback: false,
        });
        if (!next) return selected;
        selected.push(next);
      }
    };
    const questions = collectPool('nature-question');
    // Once the scenario answers add up to something, Mossprout says what he thinks first, and asks if he is right.
    const theory = nextMossproutTheory({ sessions: companionContentState.conversationSessions, definitions: companionConversationDefinitionById, bondLevel: selectedBondProgress.level, dayId: today.isoDate });
    const theoryRows = theory ? [{ mode: 'talk' as const, definitionId: theory.definitionId, title: MOSSPROUT_THEORY_TITLE, questionCount: 1, label: MOSSPROUT_THEORY_TITLE, description: 'He has put a few of your answers together.' }] : [];
    const insights = collectMode('discover');
    const journals = collectPool('nature-journal');
    const focusDirection = {
      mode: 'plan' as const,
      actionKind: 'journey_focus' as const,
      definitionId: 'mossprout-nearby-nature',
      title: 'Grow a nearby-nature rhythm',
      questionCount: 3,
      label: 'Find a nature direction',
      description: 'Three practical questions, then keep up to three small ideas.',
    };
    return [
      ...theoryRows,
      ...questions.map((question) => ({ mode: 'talk' as const, definitionId: question.id, title: question.title, questionCount: conversationQuestionCount(question), label: question.actionTitle ?? question.title, description: 'A short garden scene—one or two choices.' })),
      ...journals.map((journal) => ({ mode: 'talk' as const, actionKind: 'journal_prompt' as const, definitionId: journal.id, title: journal.title, questionCount: conversationQuestionCount(journal), label: journal.actionTitle ?? journal.title, description: 'Two quick choices become an editable field note.' })),
      ...insights.map((insight) => ({ mode: 'discover' as const, definitionId: insight.id, title: insight.title, questionCount: conversationQuestionCount(insight), label: 'Find your outside instinct', description: 'Three questions, then a result you can keep or leave.' })),
      focusDirection,
    ];
  }, [companionContentState.conversationSessions, selectedBondProgress.level, selectedFamilyId, selectedFriendshipProgress.level, selectedResident?.creature.creatureId, today?.isoDate]);
  const awardBond = useCallback((event: { id: string; creatureId: string; kind: CompanionBondEventKind; points?: number; occurredAt: number; dayId?: string | null }) => {
    const current = loadIdentityAwareCompanionBondState();
    const result = recordCompanionBondEvent(current, event, { queueCelebration: true });
    if (result.awarded) saveCompanionBondState(result.state);
    setCompanionBondState(result.state);
  }, []);
  /** Re-reads the Bond after something outside this page (a small goal, the Garden) changed it. */
  const refreshBondState = useCallback(() => {
    setCompanionBondState(loadIdentityAwareCompanionBondState());
  }, []);

  const selectResident = useCallback(
    (creatureId: string) => {
      const resident = residentById.get(creatureId);
      const creature = creatureById.get(creatureId);
      if (resident && creature) {
        // The dedicated companion route may race this initial selection with a
        // just-completed camera return. Never replace a restored destination
        // with the same creature's generic home destination.
        setSelectedResident((current) =>
          current?.creature.creatureId === creatureId
            ? current
            : { resident, creature, destination: null }
        );
        setSelectedEncounterId(`encounter:${creatureId}:${Date.now()}`);
      }
    },
    [creatureById, residentById]
  );
  const selectDestination = useCallback((destination: CompanionDestination | null) => {
    setSelectedResident((current) => (current ? { ...current, destination } : current));
  }, []);
  const closeSelectedResident = useCallback(() => {
    setSelectedResident(null);
    setSelectedEncounterId(null);
    setQuickGoalSuggestions(null);
  }, []);

  // ---------------------------------------------------------------- Mossprout's nature direction
  const startSelectedJourneyConversation = useCallback((actionOrigin?: KatchimeraActionOrigin) => {
    if (!selectedFamilyId || !selectedJourneyDefinition) return;
    setCompanionJourneyState((current) => {
      const next = startJourneyConversation(current, selectedFamilyId, Date.now(), undefined, actionOrigin);
      if (next !== current) saveCompanionJourneyState(next);
      return next;
    });
  }, [selectedFamilyId, selectedJourneyDefinition]);
  const answerSelectedJourneyConversation = useCallback((sessionId: string, value: string) => {
    if (!selectedResident || !selectedFamilyId || !selectedJourneyDefinition) return [];
    const result = answerJourneyConversation(companionJourneyState, sessionId, value);
    if (result.state === companionJourneyState) return [];
    saveCompanionJourneyState(result.state);
    setCompanionJourneyState(result.state);
    if (result.completed && result.suggestedQuickGoalIds.length) {
      setQuickGoalSuggestions({ familyId: selectedFamilyId, templateIds: result.suggestedQuickGoalIds });
    }
    if (result.createdGoalId) setMicrocopy('Nature direction chosen');
    return result.completed ? result.suggestedQuickGoalIds : [];
  }, [companionJourneyState, selectedFamilyId, selectedJourneyDefinition, selectedResident]);
  const completeSelectedJourneyQuestionnaire = useCallback((sessionId: string | null) => {
    if (selectedFamilyId !== 'mossprout' || !today?.isoDate || !sessionId) return;
    const session = companionJourneyState.conversations.find((candidate) => candidate.id === sessionId);
    if (!session?.completedAt) return;
    const completedAt = Date.now();
    relationshipProgressionRepository.update((current) => session.actionOrigin
      ? completeMossproutFocusAction(current, today.isoDate, session.actionOrigin, completedAt)
      : completeMossproutJourneyGoalPlan(current, today.isoDate, completedAt));
    reconcilePendingActionRewards();
    settleMossproutJourneyBond(today.isoDate);
  }, [companionJourneyState.conversations, selectedFamilyId, today?.isoDate]);

  // ---------------------------------------------------------------- the conversation
  const answerSelectedConversation = useCallback((optionId: string) => {
    if (!selectedConversationSession || !selectedConversationDefinition) return;
    const occurredAt = Date.now();
    commitConversationState((current) => {
      const currentSession = current.conversationSessions.find((session) => session.id === selectedConversationSession.id);
      if (!currentSession || currentSession.pendingReply !== undefined) return current;
      const revisingPendingAnswer = currentSession.pendingReply !== undefined;
      const activeNode = selectedConversationDefinition.nodes.find((node) => node.id === currentSession.currentNodeId);
      const result = answerConversation({ ...currentSession, dialoguePresentation: true }, selectedConversationDefinition, optionId, occurredAt);
      if (result.session === currentSession) return current;
      let resolvedSession = result.session;
      if (activeNode?.kind === 'poll' && resolvedSession.pollResult) {
        if (!resolvedSession.dialoguePresentation) resolvedSession = continueConversation(resolvedSession, selectedConversationDefinition, occurredAt);
        const selectedLabel = activeNode.options.find((option) => option.id === resolvedSession.pollResult?.selectedOptionId)?.label ?? 'Your answer';
        resolvedSession = withConversationOutcome(resolvedSession, {
          kind: 'insight',
          eyebrow: 'THE HAVEN VOTED',
          title: selectedLabel,
          message: 'A fictional poll from visitors to the Haven. Your answer is highlighted below.',
          items: activeNode.options.map((option) => `${option.id === resolvedSession.pollResult?.selectedOptionId ? 'You · ' : ''}${option.label} · ${resolvedSession.pollResult?.percentages[option.id] ?? 0}%`),
          celebrate: !resolvedSession.preview,
        }, occurredAt);
      }
      const turn = resolvedSession.turns.at(-1);
      let next = upsertConversationSession(current, resolvedSession);
      if (turn && !result.session.preview) {
        const telemetryId = `${turn.id}:answered`;
        const telemetry = {
          id: telemetryId,
          familyId: result.session.familyId,
          sessionId: result.session.id,
          definitionId: result.session.definitionId,
          kind: 'turn_answered',
          nodeId: turn.nodeId,
          optionId: turn.optionId,
          occurredAt,
        } as const;
        next = revisingPendingAnswer
          ? {
              ...next,
              conversationTelemetry: next.conversationTelemetry.map((event) => event.id === telemetryId ? telemetry : event),
            }
          : recordConversationTelemetry(next, telemetry);
      }
      if (result.completedGame && !result.session.preview) next = recordConversationTelemetry(next, {
        id: `${result.session.id}:game-completed`,
        familyId: result.session.familyId,
        sessionId: result.session.id,
        definitionId: result.session.definitionId,
        kind: 'game_completed',
        nodeId: result.session.currentNodeId,
        occurredAt,
      });
      saveCompanionContentState(next);
      return next;
    });
  }, [commitConversationState, selectedConversationDefinition, selectedConversationSession]);

  const continueSelectedConversation = useCallback(() => {
    if (!selectedConversationSession || !selectedConversationDefinition || !selectedResident) return;
    const occurredAt = Date.now();
    const nextSession = continueConversation({ ...selectedConversationSession, dialoguePresentation: true }, selectedConversationDefinition, occurredAt);
    if (nextSession === selectedConversationSession) return;
    const completedNow = nextSession.status === 'completed' && selectedConversationSession.status !== 'completed';
    const enteredNode = selectedConversationDefinition.nodes.find((node) => node.id === nextSession.currentNodeId);
    commitConversationState((current) => {
      let next = upsertConversationSession(current, nextSession);
      if (!nextSession.preview && enteredNode?.kind === 'insight_reveal' && selectedConversationSession.currentNodeId !== nextSession.currentNodeId) {
        next = recordConversationTelemetry(next, {
          id: `${nextSession.id}:${enteredNode.id}:revealed`,
          familyId: nextSession.familyId,
          sessionId: nextSession.id,
          definitionId: nextSession.definitionId,
          kind: 'insight_revealed',
          nodeId: enteredNode.id,
          occurredAt,
        });
      }
      if (!nextSession.preview && completedNow) {
        next = recordConversationTelemetry(next, {
          id: `${nextSession.id}:completed`,
          familyId: nextSession.familyId,
          sessionId: nextSession.id,
          definitionId: nextSession.definitionId,
          kind: 'conversation_completed',
          occurredAt,
        });
      }
      const transition = nextSession.exitTransition;
      if (nextSession.status === 'completed' && selectedConversationDefinition.isOpener && transition && transition.kind !== 'continuation') {
        const definition = transition.kind === 'definition'
          ? companionConversationDefinitionById.get(transition.definitionId) ?? null
          : selectConversationFromPool({
              familyId: nextSession.familyId,
              poolId: transition.poolId,
              definitions: companionConversationDefinitionsForFamily(nextSession.familyId),
              sessions: next.conversationSessions,
              seed: `${nextSession.id}:${transition.poolId}:${occurredAt}`,
              hasActiveFocus: Boolean(primaryGoalForFamily(companionJourneyState, nextSession.familyId)),
              hasActiveQuest: false,
              dayId: nextSession.servedDayId,
              bondLevel: selectedBondProgress.level,
              friendshipLevel: selectedFriendshipProgress.level,
            }) ?? selectConversationFromPool({
              familyId: nextSession.familyId,
              definitions: companionConversationDefinitionsForFamily(nextSession.familyId),
              sessions: next.conversationSessions,
              seed: `${nextSession.id}:fallback:${occurredAt}`,
              hasActiveFocus: Boolean(primaryGoalForFamily(companionJourneyState, nextSession.familyId)),
              hasActiveQuest: false,
              dayId: nextSession.servedDayId,
              bondLevel: selectedBondProgress.level,
              friendshipLevel: selectedFriendshipProgress.level,
            });
        if (definition && definition.familyId === nextSession.familyId) {
          const followUp = createConversationSession({
            definition,
            formId: nextSession.formId,
            dayId: nextSession.servedDayId,
            createdAt: occurredAt + 1,
            encounterId: nextSession.encounterId,
            encounterTargetTurns: nextSession.encounterTargetTurns,
            encounterTurns: nextSession.encounterTurns,
            evidenceRefs: nextSession.evidenceRefs,
            preview: nextSession.preview,
            actionOrigin: nextSession.actionOrigin,
            sessionId: `companion-conversation-v2:${nextSession.familyId}:${occurredAt + 1}:${next.conversationSessions.length}`,
          });
          next = upsertConversationSession(next, { ...followUp, dialoguePresentation: true, transcriptPrefix: conversationTranscript(nextSession, selectedConversationDefinition) });
          if (!followUp.preview) next = recordConversationTelemetry(next, {
            id: `${followUp.id}:started`, familyId: followUp.familyId, sessionId: followUp.id,
            definitionId: followUp.definitionId, kind: 'conversation_started', occurredAt: occurredAt + 1,
          });
        }
      }
      saveCompanionContentState(next);
      return next;
    });
    if (completedNow) settleActionConversationCompletion(nextSession, selectedConversationDefinition);
    if (!nextSession.preview && !nextSession.actionOrigin && completedNow && selectedConversationDefinition.familyId !== 'mossprout' && conversationHasIndependentBond(selectedConversationDefinition.id, nextSession.servedDayId)) awardBond({
      id: `conversation-thread:${selectedResident.creature.creatureId}:${selectedConversationDefinition.id}`,
      creatureId: selectedResident.creature.creatureId,
      kind: 'conversation_completed',
      points: independentConversationBondPoints(selectedConversationDefinition.id),
      occurredAt,
      dayId: nextSession.servedDayId,
    });
  }, [commitConversationState, awardBond, companionJourneyState, selectedBondProgress.level, selectedConversationDefinition, selectedConversationSession, selectedFriendshipProgress.level, selectedResident]);

  const startSelectedConversation = useCallback((input: {
    definitionId?: string;
    mode?: ConversationMode;
    poolId?: string;
    actionOrigin?: KatchimeraActionOrigin;
  } = {}) => {
    if (!selectedResident || !selectedFamilyId || !isConversationV2Family(selectedFamilyId)) return;
    const occurredAt = Date.now();
    const calendarConversationDayId = today?.isoDate ?? localDayId(new Date(occurredAt));
    const conversationDayId = selectedFamilyId === 'mossprout'
      ? mossproutConversationCompletionDayId(calendarConversationDayId)
      : calendarConversationDayId;
    commitConversationState((current) => {
      const definitions = companionConversationDefinitionsForFamily(selectedFamilyId)
        .filter((definition) => definition.format !== 'profile_game'
          || (selectedFamilyId === 'mossprout' && input.definitionId === 'mossprout:game:form-finder'));
      const definition = input.definitionId
        ? definitions.find((candidate) => candidate.id === input.definitionId) ?? null
        : input.mode
          ? selectConversationForMode({
              familyId: selectedFamilyId,
              mode: input.mode,
              definitions,
              sessions: current.conversationSessions,
              seed: `${selectedEncounterId ?? 'encounter'}:${input.mode}:${occurredAt}`,
              hasActiveFocus: Boolean(primaryGoalForFamily(companionJourneyState, selectedFamilyId)),
              hasActiveQuest: false,
              dayId: conversationDayId,
              bondLevel: selectedBondProgress.level,
              friendshipLevel: selectedFriendshipProgress.level,
            })
          : selectConversationFromPool({
              familyId: selectedFamilyId,
              ...(input.poolId ? { poolId: input.poolId } : {}),
              definitions,
              sessions: current.conversationSessions,
              excludeDefinitionIds: selectedConversationSession ? [selectedConversationSession.definitionId] : [],
              seed: `${selectedEncounterId ?? 'encounter'}:${input.poolId ?? 'anything'}:${occurredAt}:${current.conversationSessions.length}`,
              hasActiveFocus: Boolean(primaryGoalForFamily(companionJourneyState, selectedFamilyId)),
              hasActiveQuest: false,
              dayId: conversationDayId,
              bondLevel: selectedBondProgress.level,
              friendshipLevel: selectedFriendshipProgress.level,
            });
      if (!definition) return current;
      if (input.definitionId && definition.repeatPolicy === 'once_ever' && current.conversationSessions.some((session) =>
        !session.preview
        && session.familyId === selectedFamilyId
        && session.definitionId === definition.id
        && session.definitionVersion === definition.version
        && session.status === 'completed'
      )) return current;
      const existingExplicitSession = input.definitionId
        ? [...current.conversationSessions].reverse().find((session) =>
            !session.preview
            && session.familyId === selectedFamilyId
            && session.definitionId === definition.id
            && session.definitionVersion === definition.version
            && session.status === 'active'
            && definition.nodes.some((node) => node.id === session.currentNodeId)
          )
        : null;
      if (existingExplicitSession) {
        if (!input.actionOrigin || existingExplicitSession.actionOrigin?.instanceId === input.actionOrigin.instanceId) return current;
        const next = upsertConversationSession(current, {
          ...existingExplicitSession,
          actionOrigin: input.actionOrigin,
          updatedAt: occurredAt,
        });
        saveCompanionContentState(next);
        return next;
      }
      const encounterId = `${selectedEncounterId ?? `encounter:${selectedResident.creature.creatureId}`}:${occurredAt}`;
      const session = createConversationSession({
        definition,
        formId: (selectedResident.creature.skinId ?? selectedResident.creature.visualKey) as KatchimeraSkinId,
        dayId: conversationDayId,
        evidenceRefs: [],
        createdAt: occurredAt,
        encounterId,
        encounterTargetTurns: conversationTurnTarget(definition),
        sessionId: `companion-conversation-v2:${selectedFamilyId}:${occurredAt}:${current.conversationSessions.length}`,
        actionOrigin: input.actionOrigin,
      });
      const withoutActiveThread = {
        ...current,
        conversationSessions: current.conversationSessions.map((item) => item.familyId === selectedFamilyId && item.status === 'active'
          ? archiveConversationSession(item, occurredAt)
          : item),
      };
      let next = upsertConversationSession(withoutActiveThread, session);
      next = recordConversationTelemetry(next, {
        id: `${session.id}:started`, familyId: session.familyId, sessionId: session.id,
        definitionId: session.definitionId, kind: 'conversation_started', occurredAt,
      });
      saveCompanionContentState(next);
      return next;
    });
  }, [commitConversationState, companionJourneyState, selectedBondProgress.level, selectedConversationSession, selectedEncounterId, selectedFamilyId, selectedFriendshipProgress.level, selectedResident, today?.isoDate]);
  const keepTalkingSelectedConversation = useCallback((poolId?: string) => {
    startSelectedConversation(poolId ? { poolId } : {});
  }, [startSelectedConversation]);
  const decideSelectedConversationMemory = useCallback((remember: boolean, summary: string) => {
    if (!selectedConversationSession || !selectedConversationDefinition || !selectedFamilyId || !selectedResident) return;
    const node = selectedConversationDefinition.nodes.find((candidate) => candidate.id === selectedConversationSession.currentNodeId);
    if (node?.kind !== 'memory_proposal') return;
    const occurredAt = Date.now();
    const formResult = selectedConversationSession.formResult;
    const formReveal = selectedConversationDefinition.nodes.find((candidate) => candidate.kind === 'form_reveal');
    const isFormInsight = Boolean(node.memoryKey.includes(':form-match') && formResult && formReveal?.kind === 'form_reveal');
    const topFormId = formResult?.topFormId;
    const topFormName = topFormId ? katchimeraSkinById.get(topFormId)?.displayName ?? topFormId : null;
    const runnerUpName = formResult?.runnerUpFormId ? katchimeraSkinById.get(formResult.runnerUpFormId)?.displayName ?? formResult.runnerUpFormId : null;
    const formSummary = topFormId && formReveal?.kind === 'form_reveal'
      ? formReveal.descriptions[topFormId] ?? summary.trim()
      : summary.trim();
    const journeyFinder = !selectedConversationSession.preview
      && selectedFamilyId === 'mossprout'
      && (selectedConversationDefinition.id === 'mossprout:game:form-finder'
        || selectedConversationDefinition.id === 'mossprout:campaign-v2:returning-pond:place-for-rain:opening')
      && ['opening', 'profile_available'].includes(
        mossproutJourneyForDay(relationshipProgressionRepository.load(), selectedConversationSession.servedDayId)?.status ?? '',
      );
    let outcomeSession = recordConversationOutcome(
      selectedConversationSession,
      `${remember ? 'memory-confirmed' : 'memory-rejected'}:${node.memoryKey}`,
      occurredAt
    );
    outcomeSession = continueConversation(outcomeSession, selectedConversationDefinition, occurredAt);
    if (remember) {
      outcomeSession = withConversationOutcome(outcomeSession, {
        kind: isFormInsight ? 'insight' : 'memory',
        eyebrow: selectedConversationSession.preview ? 'PREVIEW OUTCOME' : isFormInsight ? 'FORM INSIGHT ADDED' : 'SAVED TO LONG MEMORY',
        title: isFormInsight && topFormName ? `Your closest form: ${topFormName}` : summary.trim(),
        message: selectedConversationSession.preview
          ? `This is how the saved ${isFormInsight ? 'form insight' : 'memory'} outcome will look. Nothing was changed.`
          : isFormInsight
            ? `${formSummary} This does not unlock or equip the skin.`
            : 'I will keep this with the context that helped us learn it. You can edit or forget it anytime.',
        celebrate: !selectedConversationSession.preview,
      }, occurredAt);
    }
    settleActionConversationCompletion(outcomeSession, selectedConversationDefinition);
    commitConversationState((current) => {
      let next = current;
      if (!selectedConversationSession.preview) next = recordConversationTelemetry(next, {
        id: `${selectedConversationSession.id}:${node.id}:proposed`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: 'memory_proposed',
        nodeId: node.id,
        occurredAt,
      });
      if (remember && !selectedConversationSession.preview) next = upsertCompanionMemory(next, {
        id: `companion-memory:${selectedFamilyId}:${node.memoryKey}`,
        scope: 'family',
        familyId: selectedFamilyId,
        kind: node.memoryKind ?? 'preference',
        key: node.memoryKey,
        summary: summary.trim(),
        evidenceRefs: [
          ...selectedConversationSession.evidenceRefs,
          { sourceType: 'conversation', sourceId: selectedConversationSession.id, dayId: selectedConversationSession.servedDayId },
        ],
        confidence: 1,
        status: 'confirmed',
        sensitivity: node.sensitivity,
        firstRecordedAt: occurredAt,
        lastConfirmedAt: occurredAt,
      });
      if (remember && isFormInsight && topFormId && topFormName && !selectedConversationSession.preview) next = upsertCompanionInsight(next, {
        familyId: selectedConversationSession.familyId,
        insightKey: 'form-match',
        category: 'Katchimera form',
        resultId: topFormId,
        title: `Your closest form: ${topFormName}`,
        summary: formSummary,
        emblemId: `form-match:${topFormId}`,
        supportingTraits: [
          `Closest match: ${topFormName}`,
          ...(runnerUpName ? [`Runner-up: ${runnerUpName}`] : []),
          `Based on ${selectedConversationSession.turns.filter((turn) => turn.questionId).length} choices`,
        ],
        evidenceRefs: [
          ...selectedConversationSession.evidenceRefs,
          { sourceType: 'conversation', sourceId: selectedConversationSession.id, dayId: selectedConversationSession.servedDayId },
        ],
        sourceDefinitionId: selectedConversationDefinition.id,
        sourceSessionId: selectedConversationSession.id,
        recordedAt: occurredAt,
      });
      if (!selectedConversationSession.preview) next = recordConversationTelemetry(next, {
        id: `${selectedConversationSession.id}:${node.id}:${remember ? 'confirmed' : 'rejected'}`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: remember ? 'memory_confirmed' : 'memory_rejected',
        nodeId: node.id,
        occurredAt,
      });
      next = upsertConversationSession(next, outcomeSession);
      if (!outcomeSession.preview && outcomeSession.status === 'completed') next = recordConversationTelemetry(next, {
        id: `${outcomeSession.id}:completed`,
        familyId: outcomeSession.familyId,
        sessionId: outcomeSession.id,
        definitionId: outcomeSession.definitionId,
        kind: 'conversation_completed',
        occurredAt,
      });
      saveCompanionContentState(next);
      return next;
    });
    if (journeyFinder && topFormId) {
      relationshipProgressionRepository.update((current) => recordMossproutMatchedCard(
        current,
        selectedConversationSession.servedDayId,
        topFormId,
      ));
      void activateStoredResidentCardDiscovery('mossprout:journey', selectedConversationSession.servedDayId, topFormId, occurredAt);
    }
    if (!selectedConversationSession.preview && outcomeSession.status === 'completed' && selectedConversationDefinition.familyId !== 'mossprout' && conversationHasIndependentBond(selectedConversationDefinition.id, selectedConversationSession.servedDayId)) {
      awardBond({
        id: `conversation-thread:${selectedResident.creature.creatureId}:${selectedConversationDefinition.id}`,
        creatureId: selectedResident.creature.creatureId,
        kind: 'conversation_completed',
        points: independentConversationBondPoints(selectedConversationDefinition.id),
        occurredAt,
        dayId: selectedConversationSession.servedDayId,
      });
    }
    setMicrocopy(selectedConversationSession.preview
      ? 'Preview only — memory was not changed'
      : remember ? isFormInsight ? 'Form match saved' : 'Saved to Long Memory' : 'Not remembered');
  }, [commitConversationState, awardBond, selectedConversationDefinition, selectedConversationSession, selectedFamilyId, selectedResident]);
  const decideSelectedConversationInsight = useCallback((accept: boolean, node: Extract<ConversationNode, { kind: 'insight_reveal' }>) => {
    if (!selectedConversationSession || !selectedConversationDefinition || !selectedConversationSession.insightResult || !selectedResident) return;
    const occurredAt = Date.now();
    const result = selectedConversationSession.insightResult;
    const displayOnly = node.persistence === 'display_only';
    if (!selectedConversationSession.preview
      && selectedConversationDefinition.id === 'mossprout:ftue:chapter-zero-return') {
      const firstResidentByResult: Record<string, string> = {
        'quiet-clearing': 'fernip',
        'curious-grove': 'petalimp',
        'shared-patch': 'blossle',
      };
      const residentId = firstResidentByResult[result.resultId];
      if (residentId) relationshipProgressionRepository.update((current) => recordMossproutMatchedCard(
        current,
        selectedConversationSession.servedDayId,
        residentId,
      ));
    }
    let outcomeSession = recordConversationOutcome(selectedConversationSession, `${accept ? 'insight-confirmed' : 'insight-dismissed'}:${node.insightKey}`, occurredAt);
    outcomeSession = continueConversation(outcomeSession, selectedConversationDefinition, occurredAt);
    if (accept) {
      outcomeSession = withConversationOutcome(outcomeSession, {
        kind: 'insight',
        eyebrow: selectedConversationSession.preview ? 'PREVIEW OUTCOME' : displayOnly ? 'YOUR NATURE RESULT' : 'INSIGHT ADDED',
        title: result.title,
        message: selectedConversationSession.preview
          ? 'This is how the insight celebration will look. Nothing was saved.'
          : result.summary,
        celebrate: !selectedConversationSession.preview,
      }, occurredAt);
    }
    if (accept && !selectedConversationSession.preview && selectedFamilyId !== 'mossprout' && !selectedConversationSession.actionOrigin) {
      outcomeSession = { ...outcomeSession, pendingInsightReward: {
        id: `${displayOnly ? 'conversation-thread' : 'insight-saved'}:${selectedResident.creature.creatureId}:${selectedConversationSession.id}:${node.id}`,
        creatureId: selectedResident.creature.creatureId,
        kind: displayOnly ? 'conversation_completed' as const : 'insight_saved' as const,
        occurredAt, dayId: selectedConversationSession.servedDayId,
      } };
    }
    settleActionConversationCompletion(outcomeSession, selectedConversationDefinition);
    commitConversationState((current) => {
      let next = current;
      if (accept && !displayOnly && !selectedConversationSession.preview) next = upsertCompanionInsight(next, {
        familyId: selectedConversationSession.familyId,
        insightKey: result.insightKey,
        category: result.category,
        resultId: result.resultId,
        title: result.title,
        summary: result.summary,
        emblemId: result.emblemId,
        supportingTraits: [...result.supportingTraits],
        ...(result.secondaryResultId ? { secondaryResultId: result.secondaryResultId } : {}),
        ...(result.secondaryTitle ? { secondaryTitle: result.secondaryTitle } : {}),
        confidence: result.confidence,
        scoreMargin: result.scoreMargin,
        evidenceRefs: [
          ...selectedConversationSession.evidenceRefs,
          { sourceType: 'conversation', sourceId: selectedConversationSession.id, dayId: selectedConversationSession.servedDayId },
        ],
        sourceDefinitionId: selectedConversationDefinition.id,
        sourceSessionId: selectedConversationSession.id,
        recordedAt: occurredAt,
      });
      if (!selectedConversationSession.preview) next = recordConversationTelemetry(next, {
        id: `${selectedConversationSession.id}:${node.id}:${accept ? 'confirmed' : 'dismissed'}`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: accept ? 'insight_confirmed' : 'insight_dismissed',
        nodeId: node.id,
        occurredAt,
      });
      next = upsertConversationSession(next, outcomeSession);
      saveCompanionContentState(next);
      return next;
    });
  }, [commitConversationState, selectedConversationDefinition, selectedConversationSession, selectedFamilyId, selectedResident]);

  useEffect(() => {
    const session = selectedConversationSession;
    if (session?.status !== 'completed' || !session.dialogueAcknowledgedAt || session.outcomePresentation || !session.pendingInsightReward) return;
    // awardBond deduplicates the persisted event ID, including after relaunch.
    awardBond(session.pendingInsightReward);
  }, [awardBond, selectedConversationSession]);

  const acknowledgeBondCelebration = useCallback((receiptId: string) => {
    const current = loadIdentityAwareCompanionBondState();
    const next = acknowledgeCompanionBondCelebration(current, receiptId);
    if (next !== current) saveCompanionBondState(next);
    setCompanionBondState(next);
  }, []);

  const decideSelectedConversationGoal = useCallback((selectedTemplateIds: readonly string[] | null, node: Extract<ConversationNode, { kind: 'goal_proposal' }>, addedTemplateIds: readonly string[]) => {
    if (!selectedConversationSession || !selectedConversationDefinition || !selectedFamilyId || !selectedResident) return;
    const occurredAt = Date.now();
    const accept = selectedTemplateIds !== null;
    let accepted = false;
    let bondGoal: { id: string; kind: 'goal_created' | 'goal_completed' } | null = null;
    if (accept && !selectedConversationSession.preview) {
      const action = node.action ?? 'create';
      const currentGoal = primaryGoalForFamily(companionJourneyState, selectedFamilyId);
      let nextJourneyState = companionJourneyState;
      if ((action === 'rename' || action === 'pause' || action === 'complete') && !currentGoal) {
        setMicrocopy('There is no current goal plan to change');
      } else if (action === 'rename' && currentGoal) {
        nextJourneyState = renameJourneyGoal(nextJourneyState, currentGoal.id, node.goalTitle, occurredAt);
        accepted = nextJourneyState !== companionJourneyState;
        setMicrocopy('Goal plan renamed');
      } else if ((action === 'pause' || action === 'complete') && currentGoal) {
        nextJourneyState = setJourneyGoalStatus(nextJourneyState, currentGoal.id, action === 'pause' ? 'paused' : 'completed', occurredAt);
        accepted = nextJourneyState !== companionJourneyState;
        if (accepted && action === 'complete') bondGoal = { id: currentGoal.id, kind: 'goal_completed' };
        setMicrocopy(action === 'pause' ? 'Goal plan paused' : 'Goal plan completed');
      } else {
        if (selectedFamilyId === 'mossprout') {
          accepted = addedTemplateIds.length > 0;
          setMicrocopy(accepted ? `${addedTemplateIds.length} nature goal${addedTemplateIds.length === 1 ? '' : 's'} added` : 'Those nature goals are already active');
        } else {
          if (action === 'replace' && currentGoal) nextJourneyState = setJourneyGoalStatus(nextJourneyState, currentGoal.id, 'paused', occurredAt);
          const result = createJourneyGoalFromProposal(nextJourneyState, {
            familyId: selectedFamilyId,
            goalTypeId: node.goalTypeId,
            title: node.goalTitle,
            suggestedQuickGoalIds: selectedTemplateIds ?? [],
            createdAt: occurredAt,
          });
          nextJourneyState = result.state;
          accepted = !result.blockedReason;
          if (accepted && result.createdGoalId) bondGoal = { id: result.createdGoalId, kind: 'goal_created' };
          if (result.blockedReason) {
            setMicrocopy(currentGoal ? 'Your goal plan was kept and the selected steps were added' : 'The goal plan could not be changed');
          } else {
            setMicrocopy(action === 'replace' && currentGoal ? 'Previous goal plan paused; new plan added' : 'Goal plan added');
          }
        }
      }
      if (accepted) {
        accepted = true;
        saveCompanionJourneyState(nextJourneyState);
        setCompanionJourneyState(nextJourneyState);
      }
    }
    if (bondGoal && selectedConversationDefinition.familyId !== 'mossprout' && conversationHasIndependentBond(selectedConversationDefinition.id, selectedConversationSession.servedDayId)) awardBond({
      id: `${bondGoal.kind}:${selectedResident.creature.creatureId}:${bondGoal.id}`,
      creatureId: selectedResident.creature.creatureId,
      kind: bondGoal.kind,
      points: selectedFamilyId === 'mossprout' ? 4 : undefined,
      occurredAt,
      dayId: today?.isoDate,
    });
    if (selectedConversationSession.preview) setMicrocopy('Preview only — goals were not changed');
    let outcomeSession = recordConversationOutcome(
      selectedConversationSession,
      `${accepted ? 'goal-accepted' : accept ? 'goal-small-step' : 'goal-declined'}:${node.goalTypeId}`,
      occurredAt
    );
    outcomeSession = continueConversation(outcomeSession, selectedConversationDefinition, occurredAt);
    if (accept && (accepted || selectedTemplateIds.length || selectedConversationSession.preview)) {
      const resultTemplateIds = addedTemplateIds.length ? addedTemplateIds : selectedTemplateIds;
      const addedTitles = resultTemplateIds
        .map((id) => companionQuickGoalTemplateById.get(id)?.title)
        .filter((title): title is string => Boolean(title));
      outcomeSession = withConversationOutcome(outcomeSession, {
        kind: 'goal',
        eyebrow: selectedConversationSession.preview ? 'PREVIEW OUTCOME' : addedTitles.length > 1 ? 'GOALS ADDED' : 'GOAL ADDED',
        title: selectedConversationSession.preview ? node.goalTitle : addedTitles.length > 1 ? `${addedTitles.length} steps are ready` : addedTitles[0] ?? node.goalTitle,
        message: selectedConversationSession.preview
          ? 'This is how the selected goals would be confirmed. Nothing was changed.'
          : accepted
            ? selectedFamilyId === 'mossprout'
              ? 'I added the nature goals you chose to Today.'
              : 'I saved the direction from our conversation and added the concrete steps you chose.'
            : 'Those goals are already on your list, so I left them as they are.',
        items: addedTitles,
        celebrate: !selectedConversationSession.preview,
      }, occurredAt);
    } else if (!accept) {
      outcomeSession = withConversationOutcome(outcomeSession, {
        kind: 'goal',
        eyebrow: 'NOTHING ADDED',
        title: 'Your goals stayed as they are',
        message: 'Mossprout leaves the ideas here without turning them into a commitment.',
        celebrate: false,
      }, occurredAt);
    }
    settleActionConversationCompletion(outcomeSession, selectedConversationDefinition);
    commitConversationState((current) => {
      let next = selectedConversationSession.preview ? current : recordConversationTelemetry(current, {
        id: `${selectedConversationSession.id}:${node.id}:proposed`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: 'goal_proposed',
        nodeId: node.id,
        occurredAt,
      });
      if (accepted && !selectedConversationSession.preview) next = recordConversationTelemetry(next, {
        id: `${selectedConversationSession.id}:${node.id}:accepted`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: 'goal_accepted',
        nodeId: node.id,
        occurredAt,
      });
      next = upsertConversationSession(next, outcomeSession);
      if (!outcomeSession.preview && outcomeSession.status === 'completed') next = recordConversationTelemetry(next, {
        id: `${outcomeSession.id}:completed`,
        familyId: outcomeSession.familyId,
        sessionId: outcomeSession.id,
        definitionId: outcomeSession.definitionId,
        kind: 'conversation_completed',
        occurredAt,
      });
      saveCompanionContentState(next);
      return next;
    });
  }, [commitConversationState, awardBond, companionJourneyState, selectedConversationDefinition, selectedConversationSession, selectedFamilyId, selectedResident, today?.isoDate]);
  const decideSelectedConversationQuickGoal = useCallback((accept: boolean, added: boolean, node: Extract<ConversationNode, { kind: 'quick_goal_proposal' }>) => {
    if (!selectedConversationSession || !selectedConversationDefinition || !selectedResident) return;
    const occurredAt = Date.now();
    let outcomeSession = recordConversationOutcome(
      selectedConversationSession,
      `${accept && added ? 'quick-goal-added' : accept ? 'quick-goal-unavailable' : 'quick-goal-declined'}:${node.templateId}`,
      occurredAt
    );
    outcomeSession = continueConversation(outcomeSession, selectedConversationDefinition, occurredAt);
    if (accept && !node.storyDaily) {
      outcomeSession = withConversationOutcome(outcomeSession, {
        kind: 'task',
        eyebrow: selectedConversationSession.preview
          ? 'PREVIEW OUTCOME'
          : added ? 'ADDED TO YOUR GOALS' : 'ALREADY IN YOUR GOALS',
        title: node.title,
        message: selectedConversationSession.preview
          ? 'This is how the added-task confirmation will look. Nothing was changed.'
          : added
            ? 'It is on your goals list now. Nothing else was added.'
            : 'This task is already active, so I left your list unchanged.',
        celebrate: added && !selectedConversationSession.preview,
      }, occurredAt);
    }
    settleActionConversationCompletion(outcomeSession, selectedConversationDefinition);
    commitConversationState((current) => {
      const next = upsertConversationSession(current, outcomeSession);
      saveCompanionContentState(next);
      return next;
    });
    setMicrocopy(selectedConversationSession.preview
      ? 'Preview only — task was not changed'
      : accept && added ? 'Task added' : accept ? 'That task is already active' : 'No task added');
    if (accept && added && !selectedConversationSession.preview && selectedConversationDefinition.familyId !== 'mossprout' && conversationHasIndependentBond(selectedConversationDefinition.id, selectedConversationSession.servedDayId)) awardBond({
      id: `goal-created-daily:${selectedResident.creature.creatureId}:${today?.isoDate ?? localDayId()}`,
      creatureId: selectedResident.creature.creatureId,
      kind: 'goal_created',
      occurredAt,
      dayId: today?.isoDate,
    });
  }, [commitConversationState, awardBond, selectedConversationDefinition, selectedConversationSession, selectedResident, today?.isoDate]);
  const recordSelectedConversationJournalHandoffOpened = useCallback((node: Extract<ConversationNode, { kind: 'journal_handoff' }>) => {
    if (!selectedConversationSession || selectedConversationSession.currentNodeId !== node.id || selectedConversationSession.preview) return;
    const occurredAt = Date.now();
    commitConversationState((current) => {
      const next = recordConversationTelemetry(current, {
        id: `${selectedConversationSession.id}:${node.id}:opened`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: 'journal_handoff_opened',
        nodeId: node.id,
        occurredAt,
      });
      if (next !== current) saveCompanionContentState(next);
      return next;
    });
  }, [commitConversationState, selectedConversationSession]);
  const decideSelectedConversationJournalHandoff = useCallback((
    saved: boolean,
    node: Extract<ConversationNode, { kind: 'journal_handoff' }>,
    journalRecordId: string | null = null,
  ) => {
    if (!selectedConversationSession || !selectedConversationDefinition || selectedConversationSession.currentNodeId !== node.id) return;
    const occurredAt = Date.now();
    let nextSession = recordConversationOutcome(
      selectedConversationSession,
      `journal-handoff:${saved ? 'saved' : 'skipped'}:${journalRecordId ?? node.id}`,
      occurredAt,
    );
    nextSession = continueConversation(nextSession, selectedConversationDefinition, occurredAt);
    if (
      nextSession.status === 'active'
      && conversationNode(selectedConversationDefinition, nextSession.currentNodeId)?.kind === 'end'
    ) {
      nextSession = continueConversation(nextSession, selectedConversationDefinition, occurredAt);
    }
    settleActionConversationCompletion(nextSession, selectedConversationDefinition);
    commitConversationState((current) => {
      let next = current;
      if (!selectedConversationSession.preview) next = recordConversationTelemetry(next, {
        id: `${selectedConversationSession.id}:${node.id}:${saved ? 'saved' : 'skipped'}`,
        familyId: selectedConversationSession.familyId,
        sessionId: selectedConversationSession.id,
        definitionId: selectedConversationSession.definitionId,
        kind: saved ? 'journal_handoff_saved' : 'journal_handoff_skipped',
        nodeId: node.id,
        occurredAt,
      });
      if (!nextSession.preview && nextSession.status === 'completed' && selectedConversationSession.status !== 'completed') {
        next = recordConversationTelemetry(next, {
          id: `${nextSession.id}:completed`, familyId: nextSession.familyId, sessionId: nextSession.id,
          definitionId: nextSession.definitionId, kind: 'conversation_completed', occurredAt,
        });
      }
      next = upsertConversationSession(next, nextSession);
      saveCompanionContentState(next);
      return next;
    });
    if (
      !nextSession.preview
      && nextSession.status === 'completed'
      && selectedConversationSession.status !== 'completed'
      && selectedResident
      && selectedConversationDefinition.familyId !== 'mossprout'
      && conversationHasIndependentBond(selectedConversationDefinition.id, nextSession.servedDayId)
    ) awardBond({
      id: `conversation-thread:${selectedResident.creature.creatureId}:${selectedConversationDefinition.id}`,
      creatureId: selectedResident.creature.creatureId,
      kind: 'conversation_completed',
      points: independentConversationBondPoints(selectedConversationDefinition.id),
      occurredAt,
      dayId: nextSession.servedDayId,
    });
    setMicrocopy(selectedConversationSession.preview
      ? 'Preview only — journal was not changed'
      : saved
        ? selectedConversationSession.familyId === 'mossprout'
          ? 'Field note saved with Mossprout'
          : 'Saved to Today'
        : 'Nothing was saved');
  }, [commitConversationState, awardBond, selectedConversationDefinition, selectedConversationSession, selectedResident]);
  const dismissSelectedConversationOutcome = useCallback(() => {
    if (!selectedConversationSession?.outcomePresentation) return;
    const occurredAt = Date.now();
    const dismissOutcome = (session: ConversationSession) => {
      const history = session.outcomePresentation ? rememberConversationLine(session, session.outcomePresentation.id,
        `${session.outcomePresentation.title}. ${session.outcomePresentation.message}`) : session;
      let acknowledged: ConversationSession = { ...history, outcomePresentation: undefined, updatedAt: occurredAt };
      if (session.outcomeCompletionPending) return { ...acknowledged, outcomeCompletionPending: undefined,
        status: 'completed' as const, completedAt: occurredAt, dialogueAcknowledgedAt: occurredAt };
      // Only the ending may follow an outcome (a poll's village result replaces its reply and
      // closing line): finish here, so the action card completes and pays before the route exits.
      if (selectedConversationDefinition && acknowledged.status === 'active') acknowledged = finishConversationAfterOutcome(acknowledged, selectedConversationDefinition, occurredAt);
      return acknowledged;
    };
    const dismissedSelectedSession = dismissOutcome(selectedConversationSession);
    commitConversationState((current) => {
      const session = current.conversationSessions.find((candidate) => candidate.id === selectedConversationSession.id);
      if (!session?.outcomePresentation) return current;
      const acknowledged = dismissOutcome(session);
      let next = upsertConversationSession(current, acknowledged);
      if (!acknowledged.preview && acknowledged.status === 'completed' && session.status !== 'completed') next = recordConversationTelemetry(next, {
        id: `${acknowledged.id}:completed`, familyId: acknowledged.familyId, sessionId: acknowledged.id,
        definitionId: acknowledged.definitionId, kind: 'conversation_completed', occurredAt,
      });
      saveCompanionContentState(next);
      return next;
    });
    if (!selectedConversationSession.preview && !selectedConversationSession.actionOrigin && selectedConversationSession.status !== 'completed'
      && dismissedSelectedSession.status === 'completed' && selectedResident && selectedConversationDefinition
      && selectedConversationDefinition.familyId !== 'mossprout'
      && conversationHasIndependentBond(selectedConversationDefinition.id, dismissedSelectedSession.servedDayId)) {
      awardBond({
        id: `conversation-thread:${selectedResident.creature.creatureId}:${selectedConversationDefinition.id}`,
        creatureId: selectedResident.creature.creatureId, kind: 'conversation_completed',
        points: independentConversationBondPoints(selectedConversationDefinition.id), occurredAt,
        dayId: dismissedSelectedSession.servedDayId,
      });
    }
    if (selectedConversationDefinition) {
      // Publish completion before the focused conversation route returns. A
      // post-render effect is too late when the route immediately unmounts.
      settleActionConversationCompletion(dismissedSelectedSession, selectedConversationDefinition);
    }
    const authoredMatch = selectedConversationDefinition?.id.match(/^(baristabbit|steppling):story:(\d+)$/);
    if (authoredMatch && isAuthoredCohortFamily(authoredMatch[1])) completeAuthoredCohortConversation(authoredMatch[1], Number(authoredMatch[2]));
  }, [commitConversationState, awardBond, selectedConversationDefinition, selectedConversationSession, selectedResident]);
  const updateSelectedMemory = useCallback((input: {
    memoryId: string;
    status: 'confirmed' | 'rejected' | 'forgotten';
    summary?: string;
  }) => {
    if (!selectedFamilyId || !today?.isoDate) return;
    setCompanionContentState((current) => {
      const next = updateCompanionMemoryStatus(current, {
        ...input,
        familyId: selectedFamilyId,
        dayId: today.isoDate,
      });
      if (next !== current) saveCompanionContentState(next);
      return next;
    });
  }, [selectedFamilyId, today?.isoDate]);

  return {
    bondProgressForCreature,
    closeSelectedResident,
    microcopy,
    residentStatusGlyphs: NO_STATUS_GLYPHS,
    selectResident,
    selectDestination,
    selectedResident,
    selectedBondProgress,
    selectedPendingBondCelebration,
    acknowledgeBondCelebration,
    refreshBondState,
    selectedConversationSession,
    selectedConversationDefinition,
    selectedMossproutActionCandidates,
    selectedMemories,
    answerSelectedConversation,
    continueSelectedConversation,
    startSelectedConversation,
    keepTalkingSelectedConversation,
    decideSelectedConversationMemory,
    decideSelectedConversationInsight,
    decideSelectedConversationGoal,
    decideSelectedConversationQuickGoal,
    recordSelectedConversationJournalHandoffOpened,
    decideSelectedConversationJournalHandoff,
    dismissSelectedConversationOutcome,
    updateSelectedMemory,
    selectedJourneyDefinition,
    selectedJourneyGoals,
    selectedJourneyConversation,
    selectedJourneyNode,
    startSelectedJourneyConversation,
    answerSelectedJourneyConversation,
    completeSelectedJourneyQuestionnaire,
    selectedQuickGoalSuggestionIds: quickGoalSuggestions?.familyId === selectedFamilyId
      ? quickGoalSuggestions.templateIds
      : [],
    dismissQuickGoalSuggestions: () => setQuickGoalSuggestions(null),
  };
}

function conversationTurnTarget(definition?: ConversationDefinition): number {
  if (definition?.id.endsWith(':goal-discovery')) return 4;
  return 3;
}

function withConversationOutcome(
  session: ReturnType<typeof continueConversation>,
  presentation: Omit<ConversationOutcomePresentation, 'id' | 'createdAt'>,
  createdAt: number
) {
  return {
    ...session,
    ...(session.dialoguePresentation && session.status === 'completed' ? {
      status: 'active' as const, completedAt: undefined, dialogueAcknowledgedAt: undefined, outcomeCompletionPending: true,
    } : {}),
    outcomePresentation: {
      ...presentation,
      id: `conversation-outcome:${session.id}:${createdAt}`,
      createdAt,
    },
  };
}
