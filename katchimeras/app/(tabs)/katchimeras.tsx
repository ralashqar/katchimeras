import { KatchimeraRosterRouteScreen, type KatchimeraWorldSession } from '@/components/katchadeck/roster/katchimera-roster-route-screen';
import { KatchimeraCompanionRouteScreen } from '@/components/katchadeck/world/katchimera-companion-route-screen';
import { MossproutEggFtueSurface } from '@/components/katchadeck/world/mossprout-egg-ftue-surface';
import type { MossproutWorldInteractionRequest } from '@/components/katchadeck/world/mossprout-world-interaction';
import type { WorldFtueSubjectPresentation } from '@/components/katchadeck/world/world-ftue-subject-presentation';
import { MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID, mossproutFtueConversationDefinitionId } from '@/constants/mossprout-ftue-conversations';
import { ftuePersonalizationKey, useFtueRun } from '@/features/onboarding/ftue-runtime';
import { mossproutFtueStep, mossproutFtueUsesHostedCompanionStage } from '@/features/onboarding/mossprout-ftue-script';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View, type View as ViewType } from 'react-native';

function cameraSnapshotsEqual(left: KatchimeraWorldSession['cameraSnapshot'], right: KatchimeraWorldSession['cameraSnapshot']) {
  if (left === right) return true;
  if (!left || !right) return false;
  return Math.abs(left.tx - right.tx) < 0.01
    && Math.abs(left.ty - right.ty) < 0.01
    && Math.abs(left.scale - right.scale) < 0.0001;
}

function MossproutOpeningSurface({ companionActive, conversationDefinitionId, onWorldSubjectPresentationChange, worldEggTargetRef }: {
  companionActive: boolean;
  conversationDefinitionId?: string;
  onWorldSubjectPresentationChange: (presentation: WorldFtueSubjectPresentation | null) => void;
  worldEggTargetRef: RefObject<ViewType | null>;
}) {
  const [companionVisualReady, setCompanionVisualReady] = useState(false);
  const [rewardPulseKey, setRewardPulseKey] = useState(0);
  useEffect(() => {
    if (!companionActive) setCompanionVisualReady(false);
  }, [companionActive]);
  const handleCompanionVisualReady = useCallback(() => setCompanionVisualReady(true), []);
  const handleCreatureRewardPulse = useCallback(() => setRewardPulseKey((key) => key + 1), []);

  return (
    <View style={styles.openingSurface}>
      <MossproutEggFtueSurface
        companionStageActive={companionActive}
        onCompanionVisualReady={handleCompanionVisualReady}
        onWorldSubjectPresentationChange={onWorldSubjectPresentationChange}
        rewardPulseKey={rewardPulseKey}
        worldEggTargetRef={worldEggTargetRef}
        worldHosted
      />
      {companionActive && companionVisualReady ? (
        <View style={styles.companionOverlay}>
          <KatchimeraCompanionRouteScreen
            creatureId="companion:mossprout"
            ftueConversationDefinitionId={conversationDefinitionId}
            ftueRouteOrigin
            hostedInHaven
            onVisibleCreatureRewardPulse={handleCreatureRewardPulse}
            reuseUnderlyingStage
          />
        </View>
      ) : null}
    </View>
  );
}

export default function KatchimerasScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();
  const {
    interactionFtue,
    interactionResidentResume,
    interactionSource,
    interactionStory,
    mossproutInteraction,
  } = useLocalSearchParams<{
    interactionFtue?: string;
    interactionResidentResume?: string;
    interactionSource?: string;
    interactionStory?: string;
    mossproutInteraction?: string;
  }>();
  const ftueRun = useFtueRun();
  const ftueStep = ftueRun?.status === 'active' ? mossproutFtueStep(ftueRun.stepId) : null;
  const [worldSession, setWorldSession] = useState<KatchimeraWorldSession>({
    activeWorldFamilyId: null,
    cameraSnapshot: null,
  });
  const worldEggTargetRef = useRef<ViewType | null>(null);
  const [worldSubjectPresentation, setWorldSubjectPresentation] = useState<WorldFtueSubjectPresentation | null>(null);
  const handleWorldSessionChange = useCallback((next: KatchimeraWorldSession) => {
    setWorldSession((current) => (
      current.activeWorldFamilyId === next.activeWorldFamilyId
      && cameraSnapshotsEqual(current.cameraSnapshot, next.cameraSnapshot)
        ? current
        : next
    ));
  }, []);
  const requestedWorldInteraction = useMemo<MossproutWorldInteractionRequest | null>(() => {
    const meditationFtue = ftueRun?.status === 'active' && ftueRun.stepId === 'companion.meditating';
    if (mossproutInteraction !== '1' && !meditationFtue) return null;
    const firstMeeting = ftueRun?.status === 'active' && ftueRun.stepId === 'companion.first_meeting';
    const chapterZeroReturn = ftueRun?.status === 'active' && ftueRun.stepId === 'companion.chapter_zero_return';
    const ftueConversationDefinitionId = interactionFtue === '1' && firstMeeting
      ? mossproutFtueConversationDefinitionId(ftuePersonalizationKey())
      : interactionFtue === 'chapter-zero-return' && chapterZeroReturn
        ? MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID
        : undefined;
    const journeyReturnConversationDefinitionId = interactionSource === 'merge-world' && interactionStory === 'return'
      ? [...relationshipProgressionRepository.load().journeyDays].reverse().find((journey) => (
          journey.familyId === 'mossprout' && journey.status === 'resolution_ready'
        ))?.returnConversationId ?? undefined
      : undefined;
    return {
      creatureId: 'companion:mossprout',
      ftueConversationDefinitionId,
      journeyReturnConversationDefinitionId,
      key: [interactionFtue, interactionResidentResume, interactionSource, interactionStory, meditationFtue ? 'meditation' : ftueRun?.stepId].join(':'),
      residentStoryResumeRequested: interactionResidentResume === '1',
      source: interactionSource === 'merge-world' ? 'merge-world' : undefined,
    };
  }, [ftueRun?.status, ftueRun?.stepId, interactionFtue, interactionResidentResume, interactionSource, interactionStory, mossproutInteraction]);
  const consumeWorldInteractionRequest = useCallback(() => {
    router.setParams({
      interactionFtue: undefined,
      interactionResidentResume: undefined,
      interactionSource: undefined,
      interactionStory: undefined,
      mossproutInteraction: undefined,
    });
  }, [router]);

  const eggPresentationActive = ftueStep?.id === 'world.egg_intro'
    || ftueStep?.id === 'egg.opening'
    || ftueStep?.id === 'egg.context'
    || ftueStep?.id === 'egg.mind'
    || ftueStep?.id === 'egg.ready';

  // The route remains Haven throughout. These are presentation modes of the
  // adjacent Mossprout hex, so neither the retired Today page nor a companion
  // route is pushed during the opening sequence.
  // Most dialogue uses the companion surface. The first meeting deliberately
  // remains a Haven node so the hatch never changes routes, but its authored
  // conversation handler still transfers renderer ownership to this stage.
  const havenHostedCompanionActive = mossproutFtueUsesHostedCompanionStage(ftueStep?.id);
  // Navigation retains tab and root-stack routes for history. Retain only a
  // lightweight shell while Haven is covered by Merge or another full page;
  // no hidden environment, creature animation, or companion controller may
  // continue rendering behind the focused destination.
  if (!isFocused) return <View style={styles.inactiveScreen} />;

  // Keep one transparent interaction host alive across the hatch boundary.
  // Mossprout's world remains the sole environment and camera owner.
  const worldInteractionActive = eggPresentationActive || havenHostedCompanionActive;
  return (
    <View style={styles.routeHost}>
      <KatchimeraRosterRouteScreen
        interactionRequest={requestedWorldInteraction}
        onInteractionRequestConsumed={consumeWorldInteractionRequest}
        onWorldSessionChange={handleWorldSessionChange}
        worldEggTargetRef={worldEggTargetRef}
        worldSession={worldSession}
        worldSubjectPresentation={worldSubjectPresentation}
      />
      {worldInteractionActive ? (
        <View style={styles.worldInteractionLayer}>
          <MossproutOpeningSurface
            companionActive={havenHostedCompanionActive}
            conversationDefinitionId={ftueStep?.id === 'companion.first_meeting'
              ? mossproutFtueConversationDefinitionId(ftueRun?.answers['egg.day_texture']?.optionId ?? 'default')
              : ftueStep?.id === 'companion.chapter_zero_return'
                ? MOSSPROUT_CHAPTER_ZERO_RETURN_CONVERSATION_ID
                : undefined}
            onWorldSubjectPresentationChange={setWorldSubjectPresentation}
            worldEggTargetRef={worldEggTargetRef}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  companionOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  worldInteractionLayer: { ...StyleSheet.absoluteFillObject, zIndex: 40 },
  inactiveScreen: { flex: 1 },
  openingSurface: { flex: 1 },
  routeHost: { flex: 1 },
});
