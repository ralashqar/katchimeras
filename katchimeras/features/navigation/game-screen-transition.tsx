import { LinearGradient } from 'expo-linear-gradient';
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
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export type GameSurfaceId = 'today' | 'merge' | 'katchimeras' | 'companion' | 'quest-game';

export type GameSurfaceReadiness = {
  data: boolean;
  layout: boolean;
  background: boolean;
  foreground: boolean;
};

type TransitionPhase = 'idle' | 'covering' | 'covered' | 'waiting_ready' | 'revealing';

type TransitionRequest = {
  announcement: string;
  id: number;
  navigate: () => void;
  target: GameSurfaceId;
};

type TransitionContextValue = {
  active: boolean;
  covered: boolean;
  phase: TransitionPhase;
  reportReadiness: (surface: GameSurfaceId, readiness: GameSurfaceReadiness) => void;
  suppressEntranceMotion: boolean;
  target: GameSurfaceId | null;
  transitionTo: (request: Omit<TransitionRequest, 'id'>) => boolean;
};

const READY: GameSurfaceReadiness = { background: true, data: true, foreground: true, layout: true };
const NOT_READY: GameSurfaceReadiness = { background: false, data: false, foreground: false, layout: false };
const COVER_DURATION_MS = 240;
const REVEAL_DURATION_MS = 280;
const REDUCED_MOTION_DURATION_MS = 120;
const MINIMUM_COVERED_MS = 120;
const READINESS_TIMEOUT_MS = 8_000;

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function readinessComplete(readiness: GameSurfaceReadiness) {
  return readiness.background && readiness.data && readiness.foreground && readiness.layout;
}

function missingReadiness(readiness: GameSurfaceReadiness) {
  return (Object.entries(readiness) as [keyof GameSurfaceReadiness, boolean][])
    .filter(([, ready]) => !ready)
    .map(([key]) => key);
}

export function GameScreenTransitionProvider({ children }: PropsWithChildren) {
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

  phaseRef.current = phase;
  requestRef.current = request;
  readinessRef.current = readiness;

  const clearTimers = useCallback(() => {
    if (navigationFrameRef.current !== null) cancelAnimationFrame(navigationFrameRef.current);
    if (revealTimerRef.current !== null) clearTimeout(revealTimerRef.current);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    navigationFrameRef.current = null;
    revealTimerRef.current = null;
    timeoutRef.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const transitionTo = useCallback((next: Omit<TransitionRequest, 'id'>) => {
    if (phaseRef.current !== 'idle') return false;
    clearTimers();
    const created = { ...next, id: ++sequenceRef.current };
    requestRef.current = created;
    readinessRef.current = NOT_READY;
    setRequest(created);
    setReadiness(NOT_READY);
    setPhase('covering');
    void AccessibilityInfo.announceForAccessibility(next.announcement);
    return true;
  }, [clearTimers]);

  const beginReveal = useCallback(() => {
    if (phaseRef.current !== 'waiting_ready' && phaseRef.current !== 'covered') return;
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    const remaining = Math.max(0, MINIMUM_COVERED_MS - (Date.now() - coveredAtRef.current));
    if (revealTimerRef.current !== null) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      revealTimerRef.current = null;
      setPhase('revealing');
    }, remaining);
  }, []);

  const reportReadiness = useCallback((surface: GameSurfaceId, next: GameSurfaceReadiness) => {
    const currentRequest = requestRef.current;
    if (!currentRequest || currentRequest.target !== surface) return;
    readinessRef.current = next;
    setReadiness((current) => {
      if (
        current.background === next.background
        && current.data === next.data
        && current.foreground === next.foreground
        && current.layout === next.layout
      ) return current;
      return next;
    });
    if (readinessComplete(next)) beginReveal();
  }, [beginReveal]);

  const handleCovered = useCallback(() => {
    const current = requestRef.current;
    if (!current || phaseRef.current !== 'covering') return;
    coveredAtRef.current = Date.now();
    setPhase('covered');
    navigationFrameRef.current = requestAnimationFrame(() => {
      navigationFrameRef.current = null;
      try {
        current.navigate();
      } catch (error) {
        console.warn('[screen-transition] Navigation failed', error);
        readinessRef.current = READY;
        setReadiness(READY);
      }
      setPhase('waiting_ready');
      timeoutRef.current = setTimeout(() => {
        const activeRequest = requestRef.current;
        if (!activeRequest || activeRequest.id !== current.id) return;
        console.warn('[screen-transition] Destination readiness timed out', {
          missing: missingReadiness(readinessRef.current),
          target: activeRequest.target,
        });
        beginReveal();
      }, READINESS_TIMEOUT_MS);
      if (readinessComplete(readinessRef.current)) beginReveal();
    });
  }, [beginReveal]);

  const handleRevealed = useCallback(() => {
    clearTimers();
    requestRef.current = null;
    readinessRef.current = READY;
    setRequest(null);
    setReadiness(READY);
    setPhase('idle');
  }, [clearTimers]);

  const value = useMemo<TransitionContextValue>(() => ({
    active: phase !== 'idle',
    covered: phase === 'covered' || phase === 'waiting_ready',
    phase,
    reportReadiness,
    suppressEntranceMotion: phase !== 'idle',
    target: request?.target ?? null,
    transitionTo,
  }), [phase, reportReadiness, request?.target, transitionTo]);

  return (
    <TransitionContext value={value}>
      {children}
      {request ? (
        <GameScreenTransitionOverlay
          announcement={request.announcement}
          onCovered={handleCovered}
          onRevealed={handleRevealed}
          phase={phase}
        />
      ) : null}
    </TransitionContext>
  );
}

export function useGameScreenTransition() {
  const context = use(TransitionContext);
  if (!context) throw new Error('useGameScreenTransition must be used inside GameScreenTransitionProvider.');
  return context;
}

export function useGameSurfaceReadiness(
  surface: GameSurfaceId,
  readiness: GameSurfaceReadiness,
  active = true,
) {
  const { reportReadiness, target } = useGameScreenTransition();
  const background = readiness.background;
  const data = readiness.data;
  const foreground = readiness.foreground;
  const layout = readiness.layout;
  useEffect(() => {
    if (!active || target !== surface) return;
    reportReadiness(surface, { background, data, foreground, layout });
  }, [active, background, data, foreground, layout, reportReadiness, surface, target]);
}

export function TransitionAwareStatusBar({ defaultStyle }: { defaultStyle: 'dark' | 'light' }) {
  const { active } = useGameScreenTransition();
  return <StatusBar style={active ? 'light' : defaultStyle} />;
}

function GameScreenTransitionOverlay({
  announcement,
  onCovered,
  onRevealed,
  phase,
}: {
  announcement: string;
  onCovered: () => void;
  onRevealed: () => void;
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
});
