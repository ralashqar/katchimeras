import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type TodayHeroCrossfadeProps = {
  children: ReactNode;
  transitionKey: string;
};

const HERO_ART_STAGE_HEIGHT = 258;
const ENTER_DURATION_MS = 220;
const EXIT_DURATION_MS = 170;

type CrossfadeState = {
  currentKey: string;
  outgoing: ReactNode | null;
};

// Keep both heroes on the same fixed art plane while selection changes. The
// outgoing layer remains visible underneath the incoming one, so cached and
// uncached creature images never expose an empty frame between days.
export function TodayHeroCrossfade({ children, transitionKey }: TodayHeroCrossfadeProps) {
  const latestChildrenRef = useRef(children);
  const [crossfade, setCrossfade] = useState<CrossfadeState>({
    currentKey: transitionKey,
    outgoing: null,
  });
  const incomingOpacity = useSharedValue(1);
  const outgoingOpacity = useSharedValue(0);
  const selectionChanged = crossfade.currentKey !== transitionKey;

  // Keep the previous hero on screen until the layout effect installs both
  // explicit layers. This prevents a one-frame empty/new-only commit.
  useLayoutEffect(() => {
    if (!selectionChanged) {
      latestChildrenRef.current = children;
      return;
    }

    const outgoing = latestChildrenRef.current;
    latestChildrenRef.current = children;
    setCrossfade({ currentKey: transitionKey, outgoing });
  }, [children, selectionChanged, transitionKey]);

  const clearOutgoing = useCallback((completedKey: string) => {
    setCrossfade((current) => current.currentKey === completedKey
      ? { ...current, outgoing: null }
      : current);
  }, []);

  useLayoutEffect(() => {
    if (!crossfade.outgoing) {
      incomingOpacity.value = 1;
      outgoingOpacity.value = 0;
      return;
    }

    cancelAnimation(incomingOpacity);
    cancelAnimation(outgoingOpacity);
    incomingOpacity.value = 0;
    outgoingOpacity.value = 1;
    const completedKey = crossfade.currentKey;
    outgoingOpacity.value = withTiming(0, {
      duration: EXIT_DURATION_MS,
      easing: Easing.in(Easing.cubic),
    });
    incomingOpacity.value = withTiming(
      1,
      { duration: ENTER_DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(clearOutgoing)(completedKey);
      }
    );
  }, [clearOutgoing, crossfade.currentKey, crossfade.outgoing, incomingOpacity, outgoingOpacity]);

  const incomingStyle = useAnimatedStyle(() => ({ opacity: incomingOpacity.value }));
  const outgoingStyle = useAnimatedStyle(() => ({ opacity: outgoingOpacity.value }));

  // Until the layout effect processes a new key, continue showing the old
  // child. React Native therefore never commits a blank or abruptly swapped
  // creature frame.
  const incoming = selectionChanged ? latestChildrenRef.current : children;

  return (
    <View pointerEvents="box-none" style={styles.stage}>
      {crossfade.outgoing ? (
        <Animated.View
          collapsable={false}
          pointerEvents="none"
          style={[styles.layer, outgoingStyle]}>
          {crossfade.outgoing}
        </Animated.View>
      ) : null}
      <Animated.View
        collapsable={false}
        pointerEvents="box-none"
        style={[styles.layer, crossfade.outgoing ? incomingStyle : null]}>
        {incoming}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    height: HERO_ART_STAGE_HEIGHT,
    overflow: 'visible',
    width: '100%',
  },
  layer: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
