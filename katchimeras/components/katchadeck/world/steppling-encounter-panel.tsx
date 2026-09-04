import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { GameSurface } from '@/components/katchadeck/ui/game-surface';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ScriptedActionList } from '@/components/katchadeck/onboarding/scripted-action-list';
import { EggActionDock, EggQuestionPanel } from '@/components/katchadeck/home/today-nurture-experience';
import { eggQuestionAction } from '@/features/onboarding/egg-question-action';
import { STEPPLING_INTENT_OPTIONS, STEPPLING_MOVEMENT_OPTIONS, STEPPLING_INTENT_BOND, STEPPLING_MOVEMENT_BOND, stepplingEggReady, stepplingStepFeedOffer, type StepplingEggProgress } from '@/features/onboarding/steppling-egg-policy';
import type { useStepplingEncounter } from '@/features/onboarding/use-steppling-encounter';
import type { FtueChoiceOption } from '@/features/onboarding/ftue-types';

const movementChoices = (options: readonly { id: string; label: string }[]): FtueChoiceOption[] => options.map((option) => ({
  ...option, icon: option.id === 'rest' || option.id === 'own-pace' ? 'heart.fill' : 'figure.walk',
  domainChoiceId: option.id === 'rest' || option.id === 'own-pace' ? 'rest' : option.id === 'exploring' ? 'outdoors' : 'full',
}));
const INTENT_CHOICES = movementChoices(STEPPLING_INTENT_OPTIONS);
const MOVEMENT_CHOICES = movementChoices(STEPPLING_MOVEMENT_OPTIONS);

export function StepplingEncounterPanel({ encounter, egg, cameraReady }: {
  encounter: ReturnType<typeof useStepplingEncounter>;
  egg?: StepplingEggProgress;
  cameraReady: boolean;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const gesture = useMemo(() => Gesture.Pan().enabled(false), []);
  const [steps, setSteps] = useState<number | null>(null);
  const [reading, setReading] = useState(true);
  // Camera readiness gates the entrance, not the lifetime of an answering card.
  // A settled notification / app resume must not tear down its native animation.
  const [hasEntered, setHasEntered] = useState(cameraReady);
  useEffect(() => { if (cameraReady) setHasEntered(true); }, [cameraReady]);
  const [answerSteps, setAnswerSteps] = useState<number | null | undefined>();
  const readRevision = useRef(0);
  const sourceDayId = egg?.sourceDayId;
  const readSteps = useCallback(async () => {
    if (!sourceDayId) return;
    const revision = ++readRevision.current;
    setReading(true);
    try {
      const { Pedometer } = await import('expo-sensors');
      const permission = await Pedometer.getPermissionsAsync();
      if (!permission.granted || !(await Pedometer.isAvailableAsync())) throw new Error('unavailable');
      const [year, month, day] = sourceDayId.split('-').map(Number);
      const result = await Pedometer.getStepCountAsync(new Date(year, month - 1, day), new Date(year, month - 1, day + 1));
      if (revision !== readRevision.current) return;
      setSteps(Number.isFinite(result.steps) ? Math.max(0, Math.floor(result.steps)) : 0);
    } catch {
      if (revision !== readRevision.current) return;
      setSteps(0);
    } finally { if (revision === readRevision.current) setReading(false); }
  }, [sourceDayId]);
  useEffect(() => {
    void readSteps();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void readSteps(); });
    return () => { readRevision.current += 1; subscription.remove(); };
  }, [readSteps]);

  if (!hasEntered && !cameraReady) return null;
  // Freeze *all* inputs selecting the current card, not just the saved Egg.
  // Health permission/step refreshes may resolve while Bond is flying.
  const displayedSteps = encounter.busy && answerSteps !== undefined ? answerSteps : steps;
  const ready = stepplingEggReady(egg);
  const stepOffer = stepplingStepFeedOffer(egg, displayedSteps ?? 0);
  const movementFallback = displayedSteps != null && stepOffer.steps === 0;
  const question = egg && (!egg.intent || movementFallback && !ready) ? eggQuestionAction(
    !egg.intent ? 'egg.steppling.intent' : 'egg.steppling.movement',
    !egg.intent ? 'What would you like more of?' : 'What movement suits you today?',
    !egg.intent ? STEPPLING_INTENT_BOND : STEPPLING_MOVEMENT_BOND,
    egg.sourceDayId,
  ) : null;
  // No cards or extra claim CTA during the shared hatch choreography.
  if ((encounter.hatching || egg?.hatchedAt) && !encounter.error) return null;
  return <EggActionDock bottomInset={insets.bottom}>
    {encounter.error ? <GameSurface><ThemedText accessibilityRole="alert">{encounter.error}</ThemedText>
      {encounter.hatching ? <KatchaButton label="Try again" disabled={encounter.busy} onPress={() => void encounter.finish()} /> : null}
    </GameSurface> : null}
    {!egg ? <KatchaButton label="Try again" onPress={() => void encounter.enter()} disabled={encounter.busy} />
      : question ? <EggQuestionPanel
        key={question.id} action={question}
        completionEvent={encounter.feedCompletionKey ? { action: question, id: encounter.feedCompletionKey } : null}
        onFinished={encounter.finishFeedPanel} enterFromBottom
        interactionLocked={encounter.busy || !cameraReady} onSkip={() => {}} selection={null}
        options={!egg.intent ? INTENT_CHOICES : MOVEMENT_CHOICES}
        reduceMotion={reduceMotion} swipeExternalGesture={gesture}
        onChoose={(option, _from, currencyFrom) => {
          setAnswerSteps(steps);
          void encounter.feed({ kind: !egg.intent ? 'intent' : 'alternative', answer: option.id }, currencyFrom);
        }}
      /> : encounter.hatching || egg.hatchedAt ? null
        : ready ? <ScriptedActionList actions={[{ id: 'egg.steppling.hatch', title: 'Hatch', description: 'Your little friend is ready.', icon: 'sparkles', presentation: 'cta_action', handlerId: 'discovery_hatch' }]} locked={encounter.busy} onAction={() => void encounter.send({ kind: 'hatch' })} />
          : stepOffer.steps > 0 ? <ScriptedActionList completionKey={encounter.feedCompletionKey} onFinished={encounter.finishFeedPanel} actions={[{ id: 'egg.feed_steps', title: 'Feed steps', description: '', icon: 'heart.fill', presentation: 'route_action', handlerId: 'pedometer_steps' }]} stepCount={stepOffer.steps} stepEnergy={stepOffer.bond} locked={encounter.busy || reading || !cameraReady} onAction={(_action, from) => {
            setAnswerSteps(steps);
            void encounter.feed({ kind: 'feed', sourceDayId: egg.sourceDayId, observedSteps: steps ?? 0 }, from);
          }} />
            : <ScriptedActionList actions={[{ id: 'egg.read_steps', title: 'Reading yesterday’s steps…', description: '', icon: 'figure.walk', presentation: 'route_action', handlerId: 'pedometer_steps' }]} locked onAction={() => {}} />}
  </EggActionDock>;
}
