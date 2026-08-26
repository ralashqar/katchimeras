import { KatchimeraRosterRouteScreen } from '@/components/katchadeck/roster/katchimera-roster-route-screen';
import { KatchimeraCompanionRouteScreen } from '@/components/katchadeck/world/katchimera-companion-route-screen';
import { MossproutEggFtueSurface } from '@/components/katchadeck/world/mossprout-egg-ftue-surface';
import { mossproutFtueConversationDefinitionId } from '@/constants/mossprout-ftue-conversations';
import { useFtueRun } from '@/features/onboarding/ftue-runtime';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import { StyleSheet, View } from 'react-native';

function MossproutOpeningSurface({ companionActive, conversationDefinitionId }: {
  companionActive: boolean;
  conversationDefinitionId?: string;
}) {
  return (
    <View style={styles.openingSurface}>
      <MossproutEggFtueSurface companionStageActive={companionActive} />
      {companionActive ? (
        <View style={styles.companionOverlay}>
          <KatchimeraCompanionRouteScreen
            creatureId="companion:mossprout"
            ftueConversationDefinitionId={conversationDefinitionId}
            ftueRouteOrigin
            hostedInHaven
            reuseUnderlyingStage
          />
        </View>
      ) : null}
    </View>
  );
}

export default function KatchimerasScreen() {
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
  openingSurface: { flex: 1 },
});
