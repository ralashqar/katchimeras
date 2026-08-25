import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';

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
  priority = 'normal',
  source,
}: Props) {
  const sourceKey = useMemo(() => worldImageSourceKey(source), [source]);
  const fallbackKey = useMemo(() => (fallbackSource ? worldImageSourceKey(fallbackSource) : null), [fallbackSource]);
  const [displayed, setDisplayed] = useState<Candidate | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(() => ({ fallback: false, key: sourceKey, source }));
  const failedPrimaryRef = useRef<string | null>(null);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (displayed?.key === sourceKey || candidate?.key === sourceKey) return;
    if (
      failedPrimaryRef.current === sourceKey &&
      (displayed?.key === fallbackKey || candidate?.key === fallbackKey)
    ) {
      return;
    }
    failedPrimaryRef.current = null;
    fade.value = 0;
    setCandidate({ fallback: false, key: sourceKey, source });
  }, [candidate?.key, displayed?.key, fade, fallbackKey, source, sourceKey]);

  const commitCandidate = useCallback((key: string, nextSource: ImageSourcePropType, fallback: boolean) => {
    setDisplayed({ fallback, key, source: nextSource });
    setCandidate((current) => (current?.key === key ? null : current));
  }, []);

  const handleLoad = useCallback(() => {
    if (!candidate) return;
    onReady?.();
    const loaded = candidate;
    fade.value = withTiming(1, { duration: KINGDOM_RENDERING.lodCrossfadeMs }, (finished) => {
      if (finished) runOnJS(commitCandidate)(loaded.key, loaded.source, loaded.fallback);
    });
  }, [candidate, commitCandidate, fade, onReady]);

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

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {displayed ? (
        <Image
          source={displayed.source}
          contentFit="contain"
          allowDownscaling={allowDownscaling}
          cachePolicy="memory"
          recyclingKey={displayed.key}
          transition={0}
          priority={priority}
          style={StyleSheet.absoluteFill}
        />
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
