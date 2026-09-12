import { EggHeroGuide } from '@/components/katchadeck/onboarding/ftue-guide-copy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { GameSurface } from '@/components/katchadeck/ui/game-surface';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ScriptedActionList } from '@/components/katchadeck/onboarding/scripted-action-list';
import { EggActionDock, EggQuestionPanel } from '@/components/katchadeck/home/today-nurture-experience';
import { eggQuestionAction } from '@/features/onboarding/egg-question-action';
import { eggFeedOffer, hatchableEggReady, type HatchableEggProgress } from '@/features/onboarding/hatchable-egg-policy';
import type { useHatchableEncounter } from '@/features/onboarding/use-steppling-encounter';
import type { FtueActionDefinition, FtueChoiceOption } from '@/features/onboarding/ftue-types';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';

/** Motion access as the Egg sees it. 'should_request' waits for the spoken ask before any system prompt. */
type StepAccess = 'unknown' | 'should_request' | 'available' | 'denied' | 'unsupported';

/**
 * A hatchable companion's Egg panel: the question, the feed the policy names
 * (yesterday's steps read from the pedometer, or an answer alone), and the
 * hatch. Everything on screen comes from the companion's Egg policy.
 */
export function HatchableEncounterPanel({ definition, encounter, egg, cameraReady, onReady }: {
  definition: HatchableCompanionDefinition;
  encounter: ReturnType<typeof useHatchableEncounter>;
  egg?: HatchableEggProgress;
  cameraReady: boolean;
  onReady?: () => void;
}) {
  const policy = definition.egg;
  const stepsFeed = policy.feed.kind === 'steps';
  const intentChoices = useMemo<FtueChoiceOption[]>(() => policy.intent.options.map((option) => ({ ...option, icon: option.icon ?? 'sparkles' })), [policy.intent.options]);
  const alternativeChoices = useMemo<FtueChoiceOption[]>(() => policy.alternative.options.map((option) => ({ ...option, icon: option.icon ?? 'sparkles' })), [policy.alternative.options]);
  const accessActions = useMemo<readonly FtueActionDefinition[]>(() => policy.access ? [
    { ...policy.access.allow, icon: policy.access.allow.icon ?? 'figure.walk', presentation: 'cta_action', handlerId: 'pedometer_steps' },
    { ...policy.access.decline, icon: policy.access.decline.icon ?? 'heart.fill', presentation: 'cta_action', handlerId: 'acknowledgement' },
  ] : [], [policy.access]);
  const [laidOut, setLaidOut] = useState(false);
  useEffect(() => { if (laidOut && cameraReady && egg) onReady?.(); }, [laidOut, cameraReady, egg, onReady]);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const gesture = useMemo(() => Gesture.Pan().enabled(false), []);
  const [steps, setSteps] = useState<number | null>(stepsFeed ? null : 0);
  const [reading, setReading] = useState(stepsFeed);
  const [access, setAccess] = useState<StepAccess>(stepsFeed ? 'unknown' : 'unsupported');
  const [requesting, setRequesting] = useState(false);
  // A declined ask (or a refused system prompt) falls through to the movement
  // question for this visit; the OS decision is re-read on the next one.
  const declinedRef = useRef(false);
  // Camera readiness gates the entrance, not the lifetime of an answering card.
  // A settled notification / app resume must not tear down its native animation.
  const [hasEntered, setHasEntered] = useState(cameraReady);
  useEffect(() => { if (cameraReady) setHasEntered(true); }, [cameraReady]);
  const [answerSteps, setAnswerSteps] = useState<number | null | undefined>();
  const readRevision = useRef(0);
  const sourceDayId = egg?.sourceDayId;
  const readSteps = useCallback(async () => {
    if (!sourceDayId || !stepsFeed) return;
    const revision = ++readRevision.current;
    setReading(true);
    try {
      const { Pedometer } = await import('expo-sensors');
      if (!(await Pedometer.isAvailableAsync())) throw new Error('unavailable');
      const permission = await Pedometer.getPermissionsAsync();
      if (revision !== readRevision.current) return;
      if (!permission.granted) {
        if (permission.canAskAgain === false || declinedRef.current) { setAccess('denied'); setSteps(0); }
        // Keep the count unknown: the movement fallback waits for the spoken ask.
        else setAccess('should_request');
        return;
      }
      setAccess('available');
      const [year, month, day] = sourceDayId.split('-').map(Number);
      const result = await Pedometer.getStepCountAsync(new Date(year, month - 1, day), new Date(year, month - 1, day + 1));
      if (revision !== readRevision.current) return;
      setSteps(Number.isFinite(result.steps) ? Math.max(0, Math.floor(result.steps)) : 0);
    } catch {
      if (revision !== readRevision.current) return;
      setAccess('unsupported');
      setSteps(0);
    } finally { if (revision === readRevision.current) setReading(false); }
  }, [sourceDayId, stepsFeed]);
  useEffect(() => {
    if (!stepsFeed) return;
    void readSteps();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void readSteps(); });
    return () => { readRevision.current += 1; subscription.remove(); };
  }, [readSteps, stepsFeed]);
  const allowSteps = useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const { Pedometer } = await import('expo-sensors');
      const granted = (await Pedometer.requestPermissionsAsync()).granted;
      if (!granted) declinedRef.current = true;
    } catch {
      declinedRef.current = true;
    } finally { setRequesting(false); }
    await readSteps();
  }, [readSteps, requesting]);
  const declineSteps = useCallback(() => {
    declinedRef.current = true;
    setAccess('denied');
    setSteps(0);
  }, []);

  if (!hasEntered && !cameraReady) return null;
  // Freeze *all* inputs selecting the current card, not just the saved Egg.
  // Health permission/step refreshes may resolve while Bond is flying.
  const displayedSteps = encounter.busy && answerSteps !== undefined ? answerSteps : steps;
  const ready = hatchableEggReady(policy, egg);
  const stepOffer = eggFeedOffer(policy, egg, displayedSteps ?? 0);
  const movementFallback = displayedSteps != null && stepOffer.steps === 0;
  const askForSteps = Boolean(egg?.intent) && !ready && access === 'should_request' && displayedSteps == null && accessActions.length > 0;
  const question = egg && (!egg.intent || movementFallback && !ready) ? eggQuestionAction(
    !egg.intent ? policy.intent.actionId : policy.alternative.actionId,
    !egg.intent ? policy.intent.title : policy.alternative.title,
    !egg.intent ? policy.intent.bond : policy.alternative.bond,
    egg.sourceDayId,
  ) : null;
  // No cards or extra claim CTA during the shared hatch choreography.
  if ((encounter.hatching || egg?.hatchedAt) && !encounter.error) return null;
  const guide = !egg?.intent ? policy.guides.intent
    : ready ? policy.guides.ready
      : askForSteps ? policy.guides.permission
      : question ? policy.guides.alternative
        : stepOffer.steps > 0 ? policy.guides.feed : policy.guides.reading;
  return <>
    <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1 }} onLayout={() => setLaidOut(true)} />
    <EggHeroGuide guide={guide} topInset={insets.top} />
    <EggActionDock bottomInset={insets.bottom}>
    {encounter.error ? <GameSurface><ThemedText accessibilityRole="alert">{encounter.error}</ThemedText>
      {encounter.hatching ? <KatchaButton label="Try again" disabled={encounter.busy} onPress={() => void encounter.finish()} /> : null}
    </GameSurface> : null}
    {!egg ? <KatchaButton label="Try again" onPress={() => void encounter.enter()} disabled={encounter.busy} />
      : askForSteps ? <ScriptedActionList actions={accessActions} locked={encounter.busy || requesting || !cameraReady} onAction={(action) => {
        if (action.id === policy.access?.allow.id) void allowSteps();
        else declineSteps();
      }} />
      : question ? <EggQuestionPanel
        key={question.id} action={question}
        completionEvent={encounter.feedCompletionKey ? { action: question, id: encounter.feedCompletionKey } : null}
        onFinished={encounter.finishFeedPanel} enterFromBottom
        interactionLocked={encounter.busy || !cameraReady} onSkip={() => {}} selection={null}
        options={!egg.intent ? intentChoices : alternativeChoices}
        reduceMotion={reduceMotion} swipeExternalGesture={gesture}
        onChoose={(option, _from, currencyFrom) => {
          setAnswerSteps(steps);
          void encounter.feed({ kind: !egg.intent ? 'intent' : 'alternative', answer: option.id }, currencyFrom);
        }}
      /> : encounter.hatching || egg.hatchedAt ? null
        : ready ? <ScriptedActionList actions={[{ id: policy.hatch.actionId, title: policy.hatch.title, description: policy.hatch.description, icon: 'sparkles', presentation: 'cta_action', handlerId: 'discovery_hatch' }]} locked={encounter.busy} onAction={() => void encounter.send({ kind: 'hatch' })} />
          : stepOffer.steps > 0 && policy.feed.kind === 'steps' ? <ScriptedActionList completionKey={encounter.feedCompletionKey} onFinished={encounter.finishFeedPanel} actions={[{ id: 'egg.feed_steps', title: policy.feed.actionTitle, description: '', icon: 'heart.fill', presentation: 'route_action', handlerId: 'pedometer_steps' }]} stepCount={stepOffer.steps} stepEnergy={stepOffer.bond} locked={encounter.busy || reading || !cameraReady} onAction={(_action, from) => {
            setAnswerSteps(steps);
            void encounter.feed({ kind: 'feed', sourceDayId: egg.sourceDayId, observedSteps: steps ?? 0 }, from);
          }} />
            : <ScriptedActionList actions={[{ id: 'egg.read_steps', title: policy.feed.kind === 'steps' ? policy.feed.readingTitle : policy.guides.reading.title, description: '', icon: 'figure.walk', presentation: 'route_action', handlerId: 'pedometer_steps' }]} locked onAction={() => {}} />}
    </EggActionDock>
  </>;
}

/** Steppling's panel, by its old name. */
export function StepplingEncounterPanel(props: Omit<Parameters<typeof HatchableEncounterPanel>[0], 'definition'>) {
  return <HatchableEncounterPanel definition={STEPPLING_HATCHABLE} {...props} />;
}
