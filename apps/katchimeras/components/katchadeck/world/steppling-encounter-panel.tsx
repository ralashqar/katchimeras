import { useEffect, useMemo, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EggHeroGuide } from '@/components/katchadeck/onboarding/ftue-guide-copy';
import { ThemedText } from '@/components/themed-text';
import { GameSurface } from '@/components/katchadeck/ui/game-surface';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { EggActionDock, EggQuestionPanel } from '@/components/katchadeck/home/today-nurture-experience';
import { eggQuestionAction } from '@/features/onboarding/egg-question-action';
import { hatchableEggReady, hatchWispClearedCount, type HatchableEggProgress } from '@/features/onboarding/hatchable-egg-policy';
import { HATCH_PROFILES, HATCH_ANSWER_BOND } from '@/features/onboarding/hatch-profile';
import type { useHatchableEncounter } from '@/features/onboarding/use-steppling-encounter';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';

/** Main companion eggs ask two equal-value questions. Sensor activities stay in daily care. */
export function HatchableEncounterPanel({ definition, encounter, egg, cameraReady, onReady }: {
  definition: HatchableCompanionDefinition;
  encounter: ReturnType<typeof useHatchableEncounter>;
  egg?: HatchableEggProgress;
  cameraReady: boolean;
  onReady?: () => void;
}) {
  const [entered, setEntered] = useState(cameraReady);
  useEffect(() => { if (cameraReady) setEntered(true); }, [cameraReady]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const gesture = useMemo(() => Gesture.Tap().enabled(false), []);
  useEffect(() => { if (cameraReady && egg) onReady?.(); }, [cameraReady, egg, onReady]);
  const cleared = hatchWispClearedCount(egg);
  const question = HATCH_PROFILES[definition.companion]?.questions[cleared];
  const ready = hatchableEggReady(definition.egg, egg);
  const action = question && egg ? eggQuestionAction(`egg.${definition.companion}.wisp.${question.id}`, question.title, HATCH_ANSWER_BOND, egg.sourceDayId) : null;
  if ((!cameraReady && !entered) || (encounter.hatching || egg?.hatchedAt) && !encounter.error) return null;
  return <>
    <EggHeroGuide topInset={insets.top} guide={{ eyebrow: `${definition.displayName}’s Egg`, title: ready ? 'The Mist has let go.' : cleared ? 'That reached it. One little wisp remains.' : 'The egg is listening.', body: ready ? '' : 'The Mist gathers around things that feel tangled. There’s no wrong answer.' }} />
    <EggActionDock bottomInset={insets.bottom}>
      {encounter.error ? <GameSurface><ThemedText accessibilityRole="alert">{encounter.error}</ThemedText>{encounter.hatching ? <KatchaButton label="Try again" onPress={() => void encounter.finish()} /> : null}</GameSurface> : null}
      {!egg ? <KatchaButton label="Try again" onPress={() => void encounter.enter()} /> : ready ?
        <KatchaButton label="Hatch" disabled={encounter.busy} onPress={() => void encounter.send({ kind: 'hatch' })} /> : action && question ?
        <EggQuestionPanel key={question.id} action={action} options={question.options.map((option) => ({ ...option, icon: 'sparkles' }))}
          completionEvent={encounter.feedCompletionKey ? { action, id: encounter.feedCompletionKey } : null}
          onFinished={encounter.finishFeedPanel} enterFromBottom interactionLocked={encounter.busy} onSkip={() => {}} selection={null}
          reduceMotion={reduced} swipeExternalGesture={gesture}
          onChoose={(option, _from, currencyFrom) => void encounter.feed({ kind: 'answer', questionId: question.id, answer: option.id }, currencyFrom)} /> : null}
    </EggActionDock>
  </>;
}
export function StepplingEncounterPanel(props: Omit<Parameters<typeof HatchableEncounterPanel>[0], 'definition'>) {
  return <HatchableEncounterPanel definition={STEPPLING_HATCHABLE} {...props} />;
}
