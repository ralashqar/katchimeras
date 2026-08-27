import { KatchimeraRosterRouteScreen } from '@/components/katchadeck/roster/katchimera-roster-route-screen';
import { KatchimeraCompanionRouteScreen } from '@/components/katchadeck/world/katchimera-companion-route-screen';
import { MossproutEggFtueSurface } from '@/components/katchadeck/world/mossprout-egg-ftue-surface';
import { mossproutFtueConversationDefinitionId } from '@/constants/mossprout-ftue-conversations';
import { useFtueRun } from '@/features/onboarding/ftue-runtime';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

function MossproutOpeningSurface({ companionActive, conversationDefinitionId }: {
  companionActive: boolean;
  conversationDefinitionId?: string;
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
        rewardPulseKey={rewardPulseKey}
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
  const ftueRun = useFtueRun();
  const ftueStep = ftueRun?.status === 'active' ? mossproutFtueStep(ftueRun.stepId) : null;

  const eggPresentationActive = ftueStep?.id === 'grove.egg_inspect'
    || ftueStep?.id === 'egg.opening'
    || ftueStep?.id === 'egg.context'
    || ftueStep?.id === 'egg.mind'
    || ftueStep?.id === 'egg.ready';

  // The route remains Haven throughout. These are presentation modes of the
  // adjacent Mossprout hex, so neither the retired Today page nor a companion
  // route is pushed during the opening sequence.
  const havenHostedCompanionActive = ftueStep?.id === 'companion.first_meeting'
    || ftueStep?.id === 'companion.day_one_action'
    || ftueStep?.id === 'companion.garden_intro'
    || ftueStep?.id === 'companion.order_preview';
  // Navigation retains tab and root-stack routes for history. Retain only a
  // lightweight shell while Haven is covered by Merge or another full page;
  // no hidden environment, creature animation, or companion controller may
  // continue rendering behind the focused destination.
  if (!isFocused) return <View style={styles.inactiveScreen} />;

  // Keep one Grove host alive across the hatch boundary. Only the subject is
  // exchanged; Companion contributes transparent UI and never mounts another
  // full-screen environment behind or above the Grove compositor.
  if (eggPresentationActive || havenHostedCompanionActive) {
    return (
      <MossproutOpeningSurface
        companionActive={havenHostedCompanionActive}
        conversationDefinitionId={ftueStep?.id === 'companion.first_meeting'
          ? mossproutFtueConversationDefinitionId(ftueRun?.answers['egg.support_style']?.optionId ?? 'default')
          : undefined}
      />
    );
  }

  return <KatchimeraRosterRouteScreen />;
}

const styles = StyleSheet.create({
  companionOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  inactiveScreen: { flex: 1 },
  openingSurface: { flex: 1 },
});
