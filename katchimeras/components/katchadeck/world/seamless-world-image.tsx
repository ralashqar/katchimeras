import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';
import { SceneImagePerformanceTrace } from '@/hooks/use-scene-performance-probe';

type Candidate = {
  fallback: boolean;
  key: string;
  source: ImageSourcePropType;
};

type Props = {
  allowDownscaling?: boolean;
  fallbackSource?: ImageSourcePropType | null;
  onFailure?: () => void;
  onReady?: () => void;
  /** Called after the outgoing native image has actually been retired. */
  onSettled?: () => void;
  transitionDuration?: number;
  priority?: 'low' | 'normal' | 'high';
  source: ImageSourcePropType;
};

export function worldImageSourceKey(source: ImageSourcePropType): string {
  if (typeof source === 'number') return `module:${source}`;
  try {
    return `source:${JSON.stringify(source)}`;
  } catch {
    return `source:${String(source)}`;
  }
}

export const SeamlessWorldImage = memo(function SeamlessWorldImage({
  allowDownscaling = true,
  fallbackSource,
  onFailure,
  onReady,
  onSettled,
  transitionDuration = KINGDOM_RENDERING.imageCrossfadeMs,
  priority = 'normal',
  source,
}: Props) {
  const sourceKey = useMemo(() => worldImageSourceKey(source), [source]);
  const fallbackKey = useMemo(() => (fallbackSource ? worldImageSourceKey(fallbackSource) : null), [fallbackSource]);
  const [displayed, setDisplayed] = useState<Candidate | null>(null);
  const [paintedKey, setPaintedKey] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(() => ({ fallback: false, key: sourceKey, source }));
  const failedPrimaryRef = useRef<string | null>(null);
  const fade = useSharedValue(0);
  const candidateRef = useRef(candidate);
  candidateRef.current = candidate;
  const requestedKeyRef = useRef(sourceKey);
  requestedKeyRef.current = sourceKey;

  useEffect(() => () => cancelAnimation(fade), [fade]);
  useEffect(() => {
    if (!candidate && displayed && paintedKey === displayed.key && (displayed.key === sourceKey
      || (displayed.fallback && failedPrimaryRef.current === sourceKey))) onSettled?.();
  }, [candidate, displayed, onSettled, paintedKey, sourceKey]);

  useEffect(() => {
    if (displayed?.key === sourceKey || candidate?.key === sourceKey) return;
    if (
      failedPrimaryRef.current === sourceKey &&
      (displayed?.key === fallbackKey || candidate?.key === fallbackKey)
    ) {
      return;
    }
    failedPrimaryRef.current = null;
    cancelAnimation(fade);
    fade.value = 0;
    setCandidate({ fallback: false, key: sourceKey, source });
  }, [candidate?.key, displayed?.key, fade, fallbackKey, source, sourceKey]);

  const commitCandidate = useCallback((key: string, nextSource: ImageSourcePropType, fallback: boolean) => {
    // A completion queued by the UI thread can arrive after a newer source.
    if (candidateRef.current?.key !== key || (!fallback && requestedKeyRef.current !== key)) return;
    if (fallback && failedPrimaryRef.current !== requestedKeyRef.current) return;
    setPaintedKey(null);
    setDisplayed({ fallback, key, source: nextSource });
    setCandidate((current) => (current?.key === key ? null : current));
  }, []);

  const handleLoad = useCallback(() => {
    if (!candidate) return;
    onReady?.();
    const loaded = candidate;
    if (transitionDuration === 0) {
      fade.value = 1;
      commitCandidate(loaded.key, loaded.source, loaded.fallback);
      return;
    }
    fade.value = withTiming(1, { duration: transitionDuration }, (finished) => {
      if (finished) runOnJS(commitCandidate)(loaded.key, loaded.source, loaded.fallback);
    });
  }, [candidate, commitCandidate, fade, onReady, transitionDuration]);

  const handleError = useCallback(() => {
    if (!candidate) return;
    if (!candidate.fallback && fallbackSource && fallbackKey && fallbackKey !== candidate.key) {
      failedPrimaryRef.current = candidate.key;
      fade.value = 0;
      setCandidate({ fallback: true, key: fallbackKey, source: fallbackSource });
      return;
    }
    onFailure?.();
  }, [candidate, fade, fallbackKey, fallbackSource, onFailure]);

  const candidateStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const displayedStyle = useAnimatedStyle(() => ({ opacity: candidate ? 1 - fade.value : 1 }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <SceneImagePerformanceTrace sceneKey="kingdom" sourceKey={sourceKey} />
      {displayed ? (
        <Animated.View style={[StyleSheet.absoluteFill, displayedStyle]}>
          <Image
            key={displayed.key}
            source={displayed.source}
            contentFit="contain"
            allowDownscaling={allowDownscaling}
            cachePolicy="memory"
            recyclingKey={displayed.key}
            transition={0}
            priority={priority}
            onDisplay={() => setPaintedKey(displayed.key)}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      {candidate ? (
        <Animated.View key={candidate.key} style={[StyleSheet.absoluteFill, candidateStyle]}>
          <Image
            source={candidate.source}
            contentFit="contain"
            allowDownscaling={allowDownscaling}
            cachePolicy="memory"
            recyclingKey={candidate.key}
            transition={0}
            priority={priority}
            onLoad={handleLoad}
            onError={handleError}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
});
