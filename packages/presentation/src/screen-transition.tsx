
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// Games augment this open registry in their own TypeScript project.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TransitionTypeRegistry {}
export type GameSurfaceId = TransitionTypeRegistry extends {surface: infer S extends string} ? S : string;

export type GameSurfaceReadiness = {
  data: boolean;
  layout: boolean;
  background: boolean;
  foreground: boolean;
  interaction_target?: boolean;
  route?: boolean;
};

export type GameSurfaceReadinessGate = keyof GameSurfaceReadiness;

type TransitionPhase = 'idle' | 'covering' | 'covered' | 'waiting_ready' | 'failed_recoverable' | 'revealing';

type TransitionRequest = {
  announcement: string;
  createdAt: number;
  id: number;
  navigate: () => void | Promise<void>;
  target: GameSurfaceId;
  expectedPathname?: string;
  navigationKey?: string;
  /** Runs only after the curtain is visually opaque. Use this to keep a
   * source-owned modal or narrative mounted throughout the cover animation. */
  onCovered?: () => void;
  onReady?: () => void;
  onReturn?: () => void;
  requiredReadiness?: readonly GameSurfaceReadinessGate[];
};

type TransitionContextValue = {
  active: boolean;
  covered: boolean;
  phase: TransitionPhase;
  navigationKey: string | null;
  reportReadiness: (surface: GameSurfaceId, readiness: GameSurfaceReadiness, navigationKey?: string | null) => void;
  suppressEntranceMotion: boolean;
  target: GameSurfaceId | null;
  transitionTo: (request: Omit<TransitionRequest, 'createdAt' | 'id'>) => boolean;
};

export function createGameScreenTransitions(DIAGNOSTICS_ENABLED = false) {
const READY: GameSurfaceReadiness = { background: true, data: true, foreground: true, interaction_target: true, layout: true, route: true };
const NOT_READY: GameSurfaceReadiness = { background: false, data: false, foreground: false, interaction_target: false, layout: false, route: false };
const DEFAULT_READINESS: readonly GameSurfaceReadinessGate[] = ['data', 'layout', 'background', 'foreground'];
const COVER_DURATION_MS = 240;
const REVEAL_DURATION_MS = 280;
const REDUCED_MOTION_DURATION_MS = 120;
const MINIMUM_COVERED_MS = 120;
const READINESS_TIMEOUT_MS = 8_000;

const TransitionContext = createContext<TransitionContextValue | null>(null);

function readinessComplete(readiness: GameSurfaceReadiness, required: readonly GameSurfaceReadinessGate[] = DEFAULT_READINESS) {
  return required.every((gate) => readiness[gate] === true);
}

function missingReadiness(readiness: GameSurfaceReadiness, required: readonly GameSurfaceReadinessGate[]) {
  return required.filter((gate) => readiness[gate] !== true);
}

function GameScreenTransitionProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [request, setRequest] = useState<TransitionRequest | null>(null);
  const [readiness, setReadiness] = useState<GameSurfaceReadiness>(READY);
  const requestRef = useRef<TransitionRequest | null>(null);
  const readinessRef = useRef<GameSurfaceReadiness>(READY);
  const phaseRef = useRef<TransitionPhase>('idle');
  const sequenceRef = useRef(0);
  const navigationFrameRef = useRef<number | null>(null);
  const coveredAtRef = useRef(0);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const readyAcknowledgedRef = useRef(false);
  const pathnameRef = useRef(pathname);

  phaseRef.current = phase;
  requestRef.current = request;
  readinessRef.current = readiness;
  pathnameRef.current = pathname;

  const clearTimers = useCallback(() => {
    if (navigationFrameRef.current !== null) cancelAnimationFrame(navigationFrameRef.current);
    if (revealTimerRef.current !== null) clearTimeout(revealTimerRef.current);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    navigationFrameRef.current = null;
    revealTimerRef.current = null;
    timeoutRef.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const commitPhase = useCallback((next: TransitionPhase) => {
    // Readiness can arrive in the same frame as sibling-tab navigation. Keep
    // the imperative guard in lockstep with React state so that report is not
    // discarded while a render still says `covering`.
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const transitionTo = useCallback((next: Omit<TransitionRequest, 'createdAt' | 'id'>) => {
    if (phaseRef.current !== 'idle') return false;
    clearTimers();
    const created = { ...next, createdAt: Date.now(), id: ++sequenceRef.current };
    requestRef.current = created;
    readinessRef.current = NOT_READY;
    setRequest(created);
    setReadiness(NOT_READY);
    retryCountRef.current = 0;
    readyAcknowledgedRef.current = false;
    commitPhase('covering');
    void AccessibilityInfo.announceForAccessibility(next.announcement);
    return true;
  }, [clearTimers, commitPhase]);

  const beginReveal = useCallback(() => {
    if (phaseRef.current !== 'waiting_ready' && phaseRef.current !== 'covered') return;
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    const remaining = Math.max(0, MINIMUM_COVERED_MS - (Date.now() - coveredAtRef.current));
    if (revealTimerRef.current !== null) clearTimeout(revealTimerRef.current);
    const current = requestRef.current;
    if (current && !readyAcknowledgedRef.current) {
      readyAcknowledgedRef.current = true;
      current.onReady?.();
    }
    revealTimerRef.current = setTimeout(() => {
      revealTimerRef.current = null;
      commitPhase('revealing');
    }, remaining);
  }, [commitPhase]);

  const reportReadiness = useCallback((surface: GameSurfaceId, next: GameSurfaceReadiness, navigationKey?: string | null) => {
    const currentRequest = requestRef.current;
    if (!currentRequest || currentRequest.target !== surface) return;
    if (currentRequest.navigationKey && navigationKey !== currentRequest.navigationKey) return;
    const correlated = {
      ...next,
      route: currentRequest.expectedPathname ? pathnameRef.current === currentRequest.expectedPathname : next.route ?? true,
    };
    const previous = readinessRef.current;
    const changed = DIAGNOSTICS_ENABLED && (!previous || previous.background !== correlated.background
      || previous.data !== correlated.data || previous.foreground !== correlated.foreground
      || previous.interaction_target !== correlated.interaction_target
      || previous.layout !== correlated.layout || previous.route !== correlated.route);
    readinessRef.current = correlated;
    if (DIAGNOSTICS_ENABLED && changed) {
      console.info('[screen-transition] Destination readiness changed', {
        pathname: pathnameRef.current,
        navigationKey: currentRequest.navigationKey,
        readiness: correlated,
        surface,
        transitionId: currentRequest.id,
      });
    }
    setReadiness((current) => {
      if (
        current.background === correlated.background
        && current.data === correlated.data
        && current.foreground === correlated.foreground
        && current.interaction_target === correlated.interaction_target
        && current.layout === correlated.layout
        && current.route === correlated.route
      ) return current;
      return correlated;
    });
    if (readinessComplete(correlated, currentRequest.requiredReadiness ?? DEFAULT_READINESS)) beginReveal();
  }, [beginReveal]);

  const handleCovered = useCallback(() => {
    const current = requestRef.current;
    if (!current || phaseRef.current !== 'covering') return;
    coveredAtRef.current = Date.now();
    commitPhase('covered');
    // This callback is intentionally tied to the animation completion rather
    // than the React phase render. Consumers can safely release source-owned
    // UI here without exposing the page beneath it for even one frame.
    current.onCovered?.();
    navigationFrameRef.current = requestAnimationFrame(async () => {
      navigationFrameRef.current = null;
      try {
        // Durable ownership changes can run here without exposing an
        // intermediate source screen: the curtain is already fully covered.
        // Readiness begins only after the destination was actually mounted.
        await current.navigate();
      } catch (error) {
        console.warn('[screen-transition] Navigation failed', error);
        commitPhase('failed_recoverable');
        return;
      }
      commitPhase('waiting_ready');
      timeoutRef.current = setTimeout(() => {
        const activeRequest = requestRef.current;
        if (!activeRequest || activeRequest.id !== current.id) return;
        console.warn('[screen-transition] Destination readiness timed out', {
          elapsedMs: Date.now() - activeRequest.createdAt,
          missing: missingReadiness(readinessRef.current, activeRequest.requiredReadiness ?? DEFAULT_READINESS),
          navigationKey: activeRequest.navigationKey,
          pathname: pathnameRef.current,
          target: activeRequest.target,
          transitionId: activeRequest.id,
        });
        if (retryCountRef.current === 0) {
          retryCountRef.current = 1;
          readinessRef.current = NOT_READY;
          setReadiness(NOT_READY);
          try { activeRequest.navigate(); } catch (error) {
            console.warn('[screen-transition] Recovery navigation failed', error);
            commitPhase('failed_recoverable');
            return;
          }
          timeoutRef.current = setTimeout(() => {
            if (requestRef.current?.id === current.id && phaseRef.current === 'waiting_ready') commitPhase('failed_recoverable');
          }, READINESS_TIMEOUT_MS);
          return;
        }
        commitPhase('failed_recoverable');
      }, READINESS_TIMEOUT_MS);
      if (readinessComplete(readinessRef.current, current.requiredReadiness ?? DEFAULT_READINESS)) beginReveal();
    });
  }, [beginReveal, commitPhase]);

  const retryRecovery = useCallback(() => {
    const current = requestRef.current;
    if (!current || phaseRef.current !== 'failed_recoverable') return;
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    readinessRef.current = NOT_READY;
    setReadiness(NOT_READY);
    commitPhase('waiting_ready');
    try { current.navigate(); } catch (error) {
      console.warn('[screen-transition] Manual retry failed', error);
      commitPhase('failed_recoverable');
      return;
    }
    timeoutRef.current = setTimeout(() => {
      if (requestRef.current?.id === current.id && phaseRef.current === 'waiting_ready') commitPhase('failed_recoverable');
    }, READINESS_TIMEOUT_MS);
  }, [commitPhase]);

  const returnFromRecovery = useCallback(() => {
    const current = requestRef.current;
    if (!current || phaseRef.current !== 'failed_recoverable') return;
    current.onReturn?.();
    commitPhase('revealing');
  }, [commitPhase]);

  const handleRevealed = useCallback(() => {
    clearTimers();
    requestRef.current = null;
    readinessRef.current = READY;
    setRequest(null);
    setReadiness(READY);
    retryCountRef.current = 0;
    readyAcknowledgedRef.current = false;
    commitPhase('idle');
  }, [clearTimers, commitPhase]);

  useEffect(() => {
    if (!pathname.startsWith('/dev-') || !requestRef.current) return;
    clearTimers();
    requestRef.current = null;
    readinessRef.current = READY;
    setRequest(null);
    setReadiness(READY);
    commitPhase('idle');
  }, [clearTimers, commitPhase, pathname]);

  const value = useMemo<TransitionContextValue>(() => ({
    active: phase !== 'idle',
    covered: phase === 'covered' || phase === 'waiting_ready',
    navigationKey: request?.navigationKey ?? null,
    phase,
    reportReadiness,
    suppressEntranceMotion: phase !== 'idle',
    target: request?.target ?? null,
    transitionTo,
  }), [phase, reportReadiness, request?.navigationKey, request?.target, transitionTo]);

  return (
    <TransitionContext value={value}>
      {children}
      {request ? (
        <GameScreenTransitionOverlay
          announcement={request.announcement}
          onCovered={handleCovered}
          onRevealed={handleRevealed}
          onRetry={retryRecovery}
          onReturn={returnFromRecovery}
          phase={phase}
        />
      ) : null}
    </TransitionContext>
  );
}

function useGameScreenTransition() {
  const context = use(TransitionContext);
  if (!context) throw new Error('useGameScreenTransition must be used inside GameScreenTransitionProvider.');
  return context;
}

function useGameSurfaceReadiness(
  surface: GameSurfaceId,
  readiness: GameSurfaceReadiness,
  active = true,
) {
  const { navigationKey, reportReadiness, target } = useGameScreenTransition();
  const background = readiness.background;
  const data = readiness.data;
  const foreground = readiness.foreground;
  const interactionTarget = readiness.interaction_target;
  const layout = readiness.layout;
  const route = readiness.route;
  useEffect(() => {
    if (!active || target !== surface) return;
    reportReadiness(surface, { background, data, foreground, interaction_target: interactionTarget, layout, route }, navigationKey);
  }, [active, background, data, foreground, interactionTarget, layout, navigationKey, reportReadiness, route, surface, target]);
}

function TransitionAwareStatusBar({ defaultStyle }: { defaultStyle: 'dark' | 'light' }) {
  const { active } = useGameScreenTransition();
  return <StatusBar style={active ? 'light' : defaultStyle} />;
}

function GameScreenTransitionOverlay({
  announcement,
  onCovered,
  onRevealed,
  onRetry,
  onReturn,
  phase,
}: {
  announcement: string;
  onCovered: () => void;
  onRevealed: () => void;
  onRetry: () => void;
  onReturn: () => void;
  phase: TransitionPhase;
}) {
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (phase === 'covering') {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: reducedMotion ? REDUCED_MOTION_DURATION_MS : COVER_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      }, (finished) => {
        if (finished) runOnJS(onCovered)();
      });
      return () => cancelAnimation(progress);
    }
    if (phase === 'revealing') {
      progress.value = withTiming(0, {
        duration: reducedMotion ? REDUCED_MOTION_DURATION_MS : REVEAL_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
      }, (finished) => {
        if (finished) runOnJS(onRevealed)();
      });
      return () => cancelAnimation(progress);
    }
  }, [onCovered, onRevealed, phase, progress, reducedMotion]);

  const curtainStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? progress.value : 1,
    transform: [{ translateY: reducedMotion ? 0 : -(height + 44) * (1 - progress.value) }],
  }), [height, reducedMotion]);
  return (
    <Animated.View
      accessibilityLabel={announcement}
      accessibilityLiveRegion="polite"
      accessibilityViewIsModal
      importantForAccessibility="yes"
      pointerEvents="auto"
      style={[styles.overlay, curtainStyle]}>
      <LinearGradient
        colors={['#338DCB', '#5DAFE0', '#7A9EDB']}
        end={{ x: 0.85, y: 1 }}
        start={{ x: 0.12, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {CURTAIN_BANDS.map((opacity, index) => (
          <View
            key={index}
            style={[
              styles.band,
              {
                backgroundColor: `rgba(218,242,255,${opacity})`,
                left: `${index * 16.67}%`,
                width: '8.4%',
              },
            ]}
          />
        ))}
      </View>
      {phase === 'failed_recoverable' ? (
        <View accessibilityRole="alert" style={styles.recoveryPanel}>
          <Text selectable style={styles.recoveryTitle}>This page is taking longer than expected</Text>
          <Text selectable style={styles.recoveryBody}>Your story progress is safe. Retry the page, or return and continue it later.</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.recoveryPrimary}><Text style={styles.recoveryPrimaryLabel}>Retry</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={onReturn} style={styles.recoverySecondary}><Text style={styles.recoverySecondaryLabel}>Return</Text></Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

const CURTAIN_BANDS = [0.13, 0.08, 0.12, 0.07, 0.14, 0.09] as const;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#4C9ED8',
    overflow: 'visible',
    zIndex: 100_000,
  },
  band: { bottom: 0, position: 'absolute', top: 0 },
  recoveryBody: { color: '#DDEDFC', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  recoveryPanel: { alignSelf: 'center', backgroundColor: 'rgba(22,57,86,0.94)', borderColor: 'rgba(255,255,255,0.28)', borderCurve: 'continuous', borderRadius: 24, borderWidth: 1, gap: 12, left: 24, padding: 22, position: 'absolute', right: 24, top: '34%' },
  recoveryPrimary: { alignItems: 'center', backgroundColor: '#F6C958', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 13 },
  recoveryPrimaryLabel: { color: '#3C2A16', fontSize: 16, fontWeight: '800' },
  recoverySecondary: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.35)', borderRadius: 16, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 12 },
  recoverySecondaryLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  recoveryTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center' },
});

return { readinessComplete, GameScreenTransitionProvider, useGameScreenTransition, useGameSurfaceReadiness, TransitionAwareStatusBar };
}
