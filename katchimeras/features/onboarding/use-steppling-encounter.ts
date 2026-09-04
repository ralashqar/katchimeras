import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { MergeWorldState } from '@/types/merge-world';
import { applyStoredStepplingEgg } from '@/utils/merge-world/repository';
import { localDayId } from '@/utils/world-identity';
import { IDLE_TODAY_HATCH_PRESENTATION, type TodayHatchPhase } from '@/utils/today-hatch-presentation';
import { HATCH_PHASE_DELAYS_MS, REDUCED_HATCH_PHASE_DELAYS_MS } from '@/utils/hatch-reveal-timing';
import type { WorldFtueSubjectPresentation } from '@/components/katchadeck/world/world-ftue-subject-presentation';
import { stepplingEggReady, stepplingStepFeedOffer, STEPPLING_INTENT_BOND, STEPPLING_MOVEMENT_BOND, type StepplingEggAction, type StepplingEggProgress } from './steppling-egg-policy';
import { useEggFeedController } from '@/features/today/use-egg-feed-controller';
import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { eggBondFeedPayload } from '@/features/today/egg-bond-feed';
import { createEggHatchHaptics } from '@/features/today/egg-haptics';

export function useStepplingEncounter(world: MergeWorldState) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feeding, setFeeding] = useState(false);
  const [feedingEgg, setFeedingEgg] = useState<StepplingEggProgress>();
  const [feedCompletionKey, setFeedCompletionKey] = useState<string | null>(null);
  const feedCompletionRef = useRef<string | null>(null);
  const feedSequenceRef = useRef(0);
  const feedingRef = useRef(false);
  const feedController = useEggFeedController();
  const { startEggFeed, eggFeedLaunchKey } = feedController;
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<TodayHatchPhase>('idle');
  const [assetsReady, setAssetsReady] = useState(false);
  const [feedback, setFeedback] = useState(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const pending = useRef(false);
  const reduceMotion = useReducedMotion();
  const hatchHaptics = useMemo(() => createEggHatchHaptics(reduceMotion), [reduceMotion]);
  const egg = world.stepplingEgg;
  const hatching = Boolean(open && egg?.hatchStartedAt && !egg.hatchedAt);
  const send = useCallback(async (action: StepplingEggAction, animateFeedback = true) => {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError(null);
    try {
      const result = await applyStoredStepplingEgg(action);
      if (!result.changed && result.message) throw new Error(result.message);
      if (animateFeedback && result.changed && (action.kind === 'intent' || action.kind === 'feed' || action.kind === 'alternative')) setFeedback((value) => value + 1);
      return true;
    } catch { setError('That didn’t save. Please try again.'); return false; }
    finally { pending.current = false; setBusy(false); }
  }, []);
  const enter = useCallback(async () => {
    setOpen(true);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    await send({ kind: 'begin', sourceDayId: localDayId(yesterday) });
  }, [send]);
  const close = useCallback(() => { if (!pending.current && !feedingRef.current && !hatching) { setOpen(false); setPhase('idle'); } }, [hatching]);
  const releaseFeedPanel = useCallback(() => {
    feedCompletionRef.current = null;
    setFeedCompletionKey(null);
    feedingRef.current = false;
    setFeeding(false);
    setFeedingEgg(undefined);
  }, []);
  const finishFeedPanel = useCallback((completionKey: string) => {
    if (feedCompletionRef.current !== completionKey) return;
    releaseFeedPanel();
  }, [releaseFeedPanel]);
  const feed = useCallback(async (action: StepplingEggAction, from: FeedSourceRect) => {
    if (pending.current || feedingRef.current) return;
    // Calculate against the pre-feed snapshot, exactly like the displayed card.
    const bondAmount = action.kind === 'feed'
      ? stepplingStepFeedOffer(egg, action.observedSteps).bond
      : action.kind === 'intent' ? STEPPLING_INTENT_BOND : STEPPLING_MOVEMENT_BOND;
    feedingRef.current = true; setFeeding(true); setFeedingEgg(egg);
    const ok = await send(action, false);
    const arrive = () => {
      if (!ok) { releaseFeedPanel(); return; }
      setFeedback((value) => value + 1);
      // Bond arrival starts the same panel outro as the first Egg. Keep the
      // pre-answer card and interaction lock until its onFinished handoff.
      const completionKey = `steppling:feed:${++feedSequenceRef.current}`;
      feedCompletionRef.current = completionKey;
      setFeedCompletionKey(completionKey);
    };
    if (!ok || reduceMotion || bondAmount <= 0) { arrive(); return; }
    // Same batched Bond flight and launch/arrival Egg effects as question cards.
    startEggFeed(from, eggBondFeedPayload(bondAmount, from), arrive);
  }, [egg, reduceMotion, releaseFeedPanel, send, startEggFeed]);
  const finish = useCallback(async () => {
    const ok = await send({ kind: 'finish' });
    // Keep the revealed subject mounted until the world ownership projection
    // is ready. The host releases it when the normal resident can take over.
    return ok;
  }, [send]);
  const onAssetsReady = useCallback(() => setAssetsReady(true), []);
  const finishAttemptRef = useRef(false);
  useEffect(() => {
    if (!hatching) { finishAttemptRef.current = false; return; }
    if (!active || phase !== 'awaiting_claim' || finishAttemptRef.current) return;
    finishAttemptRef.current = true;
    void finish();
  }, [active, finish, hatching, phase]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (value) => {
      if (value !== 'active') hatchHaptics.stop();
      setActive(value === 'active');
    });
    return () => { subscription.remove(); hatchHaptics.stop(); };
  }, [hatchHaptics]);
  // Keep the shared renderer mounted while preparing; its animated art preloads
  // behind the Egg. A bundled still and watchdog keep asset failure recoverable.
  useEffect(() => {
    if (!hatching || !active) return;
    setPhase('preparing');
    const timeout = setTimeout(onAssetsReady, 8000);
    return () => clearTimeout(timeout);
  }, [active, hatching, onAssetsReady]);
  useEffect(() => {
    if (!hatching || !assetsReady || !active) return;
    const timing = reduceMotion ? REDUCED_HATCH_PHASE_DELAYS_MS : HATCH_PHASE_DELAYS_MS;
    const timers = [
      [timing.shaking, 'shaking'], [timing.cracking, 'cracking'],
      [timing.crossfadingSubject, 'crossfading_subject'], [timing.subjectSettling, 'subject_settling'],
      [timing.awaitClaim, 'awaiting_claim'],
    ].map(([delay, next]) => setTimeout(() => {
      setPhase(next as TodayHatchPhase);
      hatchHaptics.advance(next as TodayHatchPhase);
    }, Number(delay)));
    return () => { timers.forEach(clearTimeout); hatchHaptics.stop(); };
  }, [active, assetsReady, hatchHaptics, hatching, reduceMotion]);
  const presentation = useMemo<WorldFtueSubjectPresentation>(() => ({
    hatchFamilyId: 'steppling', companionVisible: Boolean(open && egg?.hatchedAt),
    preloadHatch: open,
    feedbackKey: feedback, feedExpressionKey: eggFeedLaunchKey, growthProgress: 1, growthStage: 6,
    readyToHatch: stepplingEggReady(feedingEgg ?? egg) && !hatching && !egg?.hatchedAt, rewardPulseKey: 0,
    hatchPresentation: open && (hatching || egg?.hatchedAt) ? { ...IDLE_TODAY_HATCH_PRESENTATION, animationKey: egg?.hatchStartedAt ?? 0, phase, policy: 'ftue_discovery' } : null,
    onHatchAssetsReady: onAssetsReady, onHatchAssetsError: onAssetsReady,
  }), [egg, eggFeedLaunchKey, feedback, feedingEgg, hatching, onAssetsReady, open, phase]);
  return { open, enter, close, finish, egg: feedingEgg ?? egg, busy: busy || feeding, error, send, feed, feedCompletionKey, finishFeedPanel, feedController, hatching, phase, presentation };
}
