import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';




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
  /** Resolution-only swaps retain coverage while the sharper/coarser copy paints. */
  retainOutgoingOpacity?: boolean;
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

export function createSeamlessWorldImage({imageCrossfadeMs, Trace}: {imageCrossfadeMs:number;Trace?: import('react').ComponentType<{sourceKey:string}>}) {
const SeamlessWorldImage = memo(function SeamlessWorldImage({
  allowDownscaling = true,
  fallbackSource,
  onFailure,
  onReady,
  onSettled,
  transitionDuration = imageCrossfadeMs,
  retainOutgoingOpacity = false,
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
  const fadingKeyRef = useRef<string | null>(null);

  useEffect(() => () => cancelAnimation(fade), [fade]);
  useEffect(() => {
    if (!candidate && displayed && paintedKey === displayed.key && (displayed.key === sourceKey
      || (displayed.fallback && failedPrimaryRef.current === sourceKey))) onSettled?.();
  }, [candidate, displayed, onSettled, paintedKey, sourceKey]);

  useEffect(() => {
    if (displayed?.key === sourceKey) {
      if (candidate) {
        cancelAnimation(fade);
        fade.value = 0;
        fadingKeyRef.current = null;
        setPaintedKey(displayed.key);
        setCandidate(null);
      }
      return;
    }
    if (candidate?.key === sourceKey) return;
    if (
      failedPrimaryRef.current === sourceKey &&
      (displayed?.key === fallbackKey || candidate?.key === fallbackKey)
    ) {
      return;
    }
    failedPrimaryRef.current = null;
    cancelAnimation(fade);
    fade.value = 0;
    fadingKeyRef.current = null;
    setCandidate({ fallback: false, key: sourceKey, source });
  }, [candidate, displayed?.key, fade, fallbackKey, source, sourceKey]);

  const commitCandidate = useCallback((key: string, nextSource: ImageSourcePropType, fallback: boolean) => {
    // A completion queued by the UI thread can arrive after a newer source.
    if (candidateRef.current?.key !== key || (!fallback && requestedKeyRef.current !== key)) return;
    if (fallback && failedPrimaryRef.current !== requestedKeyRef.current) return;
    // Promote the same keyed native view; do not discard a painted image and
    // mount a blank replacement at the end of a zoom/LOD transition.
    setDisplayed({ fallback, key, source: nextSource });
    setCandidate((current) => (current?.key === key ? null : current));
  }, []);

  const handleDisplay = useCallback(() => {
    if (!candidate) return;
    if (candidateRef.current?.key !== candidate.key) return;
    if (!candidate.fallback && requestedKeyRef.current !== candidate.key) return;
    if (fadingKeyRef.current === candidate.key) return;
    fadingKeyRef.current = candidate.key;
    setPaintedKey(candidate.key);
    onReady?.();
    const loaded = candidate;
    if (!displayed || transitionDuration === 0) {
      fade.value = 1;
      commitCandidate(loaded.key, loaded.source, loaded.fallback);
      return;
    }
    fade.value = withTiming(1, { duration: transitionDuration }, (finished) => {
      if (finished) runOnJS(commitCandidate)(loaded.key, loaded.source, loaded.fallback);
    });
  }, [candidate, commitCandidate, displayed, fade, onReady, transitionDuration]);

  const handleError = useCallback(() => {
    if (!candidate) return;
    if (candidateRef.current?.key !== candidate.key) return;
    if (!candidate.fallback && requestedKeyRef.current !== candidate.key) return;
    if (!candidate.fallback && fallbackSource && fallbackKey && fallbackKey !== candidate.key) {
      failedPrimaryRef.current = candidate.key;
      fade.value = 0;
      fadingKeyRef.current = null;
      setCandidate({ fallback: true, key: fallbackKey, source: fallbackSource });
      return;
    }
    onFailure?.();
  }, [candidate, fade, fallbackKey, fallbackSource, onFailure]);

  const candidateStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const displayedStyle = useAnimatedStyle(() => ({ opacity: candidate && !retainOutgoingOpacity ? 1 - fade.value : 1 }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Trace ? <Trace sourceKey={sourceKey} /> : null}
      {[displayed, candidate].filter((entry): entry is Candidate => entry != null).map((entry) => (
        <Animated.View key={entry.key} style={[StyleSheet.absoluteFill,
          // A promoted candidate must not inherit the outgoing mapper's last
          // opacity (zero) while its new worklet subscription is installed.
          !candidate ? { opacity: 1 } : entry === candidate ? candidateStyle : displayedStyle,
        ]}>
          <Image
            source={entry.source}
            contentFit="contain"
            allowDownscaling={allowDownscaling}
            cachePolicy="memory"
            recyclingKey={entry.key}
            transition={0}
            priority={priority}
            // onLoad only means decoded. Never uncover a tile until the native
            // image reports it has actually displayed its pixels.
            onDisplay={entry === candidate ? handleDisplay : undefined}
            onError={entry === candidate ? handleError : undefined}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ))}
    </View>
  );
});

return SeamlessWorldImage;
}
