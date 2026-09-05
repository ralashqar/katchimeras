import { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

/** Two legs: the current page leaves fully before the destination enters. */
export function useCompanionActionSlide() {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const completion = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => { cancelAnimation(progress); completion.current = undefined; }, [progress]);
  const distance = width + 32;
  const rootStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -Math.min(1, progress.value) * distance }] }));
  const destinationStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (2 - Math.max(1, progress.value)) * distance }] }));
  const finish = useCallback((open: boolean) => {
    locked.current = false; setBusy(false); setActive(open);
    const done = completion.current; completion.current = undefined; done?.();
  }, []);
  const navigate = useCallback((open: boolean, done?: () => void) => {
    if (locked.current) return false;
    if (reducedMotion) { progress.value = open ? 2 : 0; setActive(open); done?.(); return true; }
    completion.current = done;
    locked.current = true; setActive(true); setBusy(true);
    const options = { duration: 220, easing: Easing.inOut(Easing.quad) };
    progress.value = withSequence(withTiming(1, options), withTiming(open ? 2 : 0, options, (finished) => {
      if (finished) runOnJS(finish)(open);
    }));
    return true;
  }, [finish, progress, reducedMotion]);
  return { active, busy, rootStyle, destinationStyle, navigate };
}
