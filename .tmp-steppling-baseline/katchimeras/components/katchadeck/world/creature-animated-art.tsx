import { CREATURE_PERF_ENABLED } from '@/constants/diagnostics';
import { useIsFocused } from '@react-navigation/native';
import {
  Image,
  type ImageErrorEventData,
  type ImageLoadEventData,
} from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, type ImageStyle, type StyleProp } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  resolveCreatureIdleAnimationSource,
  resolveCreatureIdleFallbackSource,
} from '@/constants/creature-idle-animation-sources';
import type { HomeVisualKey } from '@/types/home';
import type { QuestionnaireImageSource } from '@/utils/companion-questionnaire-presentation';
import { acquireLifecycleResource } from '@/utils/lifecycle-performance';

const IDLE_LOG_PREFIX = '[creature-idle]';

function logIdleDiagnostic(
  level: 'info' | 'warn',
  event: string,
  details: Record<string, unknown>,
) {
  if (!CREATURE_PERF_ENABLED) return;
  console[level](`${IDLE_LOG_PREFIX} ${event}`, details);
}

export function CreatureAnimatedArt({
  accessibilityLabel,
  allowDownscaling = true,
  fallbackSource,
  forceStatic = false,
  playbackActive = true,
  onLoad,
  style,
  visualKey,
}: {
  accessibilityLabel: string;
  allowDownscaling?: boolean;
  fallbackSource: QuestionnaireImageSource;
  /** Keep the full-resolution still visible while a large parent transform is
   * moving. Animated WebP frames are intentionally smaller and can otherwise
   * be rasterized softly during a camera zoom. */
  forceStatic?: boolean;
  playbackActive?: boolean;
  onLoad?: () => void;
  style: StyleProp<ImageStyle>;
  visualKey: HomeVisualKey;
}) {
  const imageRef = useRef<Image>(null);
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [animationFailed, setAnimationFailed] = useState(false);
  const [animationReady, setAnimationReady] = useState(false);
  const animationSource = resolveCreatureIdleAnimationSource(visualKey);
  const idleFallbackSource = resolveCreatureIdleFallbackSource(visualKey) ?? fallbackSource;
  const shouldAnimate = playbackActive && Boolean(animationSource) && !animationFailed && !forceStatic && !reduceMotion && isFocused && appState === 'active';
  const source = animationSource && !animationFailed && !forceStatic && !reduceMotion ? animationSource : idleFallbackSource;
  useEffect(() => {
    if (!shouldAnimate || !animationReady) return;
    return acquireLifecycleResource('animation_loop', `creature-idle:${visualKey}`);
  }, [animationReady, shouldAnimate, visualKey]);

  useEffect(() => {
    if (!CREATURE_PERF_ENABLED || !animationSource) return;
    logIdleDiagnostic('info', 'state', {
      animationFailed,
      animationReady,
      appState,
      isFocused,
      platform: process.env.EXPO_OS,
      reduceMotion,
      shouldAnimate,
      source: source === animationSource ? 'animated' : 'fallback',
      visualKey,
    });
  }, [
    animationFailed,
    animationReady,
    animationSource,
    appState,
    forceStatic,
    isFocused,
    reduceMotion,
    shouldAnimate,
    source,
    visualKey,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const image = imageRef.current;
    if (!image || !animationSource || !animationReady || animationFailed || forceStatic || reduceMotion) return;
    if (CREATURE_PERF_ENABLED) logIdleDiagnostic('info', 'playback-command', {
      command: shouldAnimate ? 'start' : 'stop',
      visualKey,
    });
    const operation = shouldAnimate ? image.startAnimating() : image.stopAnimating();
    void operation.then(() => {
      if (CREATURE_PERF_ENABLED) logIdleDiagnostic('info', 'playback-command-resolved', {
        command: shouldAnimate ? 'start' : 'stop',
        visualKey,
      });
    }).catch((error: unknown) => {
      if (CREATURE_PERF_ENABLED) logIdleDiagnostic('warn', 'playback-command-failed', {
        command: shouldAnimate ? 'start' : 'stop',
        error: error instanceof Error ? error.message : String(error),
        visualKey,
      });
    });
  }, [animationFailed, animationReady, animationSource, forceStatic, reduceMotion, shouldAnimate, visualKey]);

  const handleLoad = (event: ImageLoadEventData) => {
    const loadedAnimationSource = Boolean(animationSource && source === animationSource);
    if (CREATURE_PERF_ENABLED) {
      logIdleDiagnostic(
        loadedAnimationSource && event.source.isAnimated !== true ? 'warn' : 'info',
        loadedAnimationSource && event.source.isAnimated !== true
          ? 'loaded-source-is-not-animated'
          : 'load',
        {
          cacheType: event.cacheType,
          height: event.source.height,
          isAnimated: event.source.isAnimated ?? null,
          mediaType: event.source.mediaType,
          source: loadedAnimationSource ? 'animated' : 'fallback',
          url: event.source.url,
          visualKey,
          width: event.source.width,
        },
      );
    }
    if (loadedAnimationSource) setAnimationReady(true);
    onLoad?.();
  };

  const handleError = (event: ImageErrorEventData) => {
    if (CREATURE_PERF_ENABLED) logIdleDiagnostic('warn', 'load-failed', {
      error: event.error,
      source: 'animated',
      visualKey,
    });
    setAnimationFailed(true);
  };

  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      allowDownscaling={allowDownscaling}
      autoplay={shouldAnimate}
      cachePolicy="memory-disk"
      contentFit="contain"
      onDisplay={CREATURE_PERF_ENABLED && animationSource && source === animationSource ? () => {
        logIdleDiagnostic('info', 'display', { source: 'animated', visualKey });
      } : undefined}
      onError={animationSource && source === animationSource ? handleError : undefined}
      onLoad={handleLoad}
      onLoadStart={CREATURE_PERF_ENABLED && animationSource && source === animationSource ? () => {
        logIdleDiagnostic('info', 'load-start', { source: 'animated', visualKey });
      } : undefined}
      placeholder={idleFallbackSource}
      placeholderContentFit="contain"
      priority="high"
      ref={imageRef}
      source={source}
      style={style}
      transition={0}
      useAppleWebpCodec={false}
    />
  );
}
