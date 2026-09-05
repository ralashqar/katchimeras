import { createContext, useContext, useCallback, useLayoutEffect, useId, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

type RemovalController = (() => void) & { register: (id: string) => () => void };
export const CompanionStackRemovalContext = createContext<RemovalController | null>(null);
export function useCompanionStackRemoval(registerRow = true) {
  const controller = useContext(CompanionStackRemovalContext);
  const id = useId();
  useLayoutEffect(() => registerRow ? controller?.register(id) : undefined, [controller, id, registerRow]);
  return controller;
}

/** Hold the tray footprint across row removal, then shrink it on the UI thread. */
export function useCompanionStackLayout() {
  const reduceMotion = useReducedMotion();
  const [measured, setMeasured] = useState(false);
  const previous = useRef<{ width: number; height: number } | null>(null);
  const height = useSharedValue(0);
  const removalUntil = useRef(0);
  const rows = useRef(new Set<string>());
  const removalRows = useRef<Set<string> | null>(null);
  const prepareRemoval = useMemo(() => Object.assign(() => {
    removalUntil.current = Date.now() + 600;
    removalRows.current = new Set(rows.current);
  }, { register: (id: string) => {
    rows.current.add(id);
    return () => { rows.current.delete(id); };
  } }), []);
  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    const before = previous.current;
    if (before?.width === next.width && before.height === next.height) return;
    previous.current = { width: next.width, height: next.height };
    // Only a completed row may animate the footprint. Dialogue, CTA changes,
    // submenu content and orientation changes initialize at their final size.
    const oldRows = removalRows.current;
    const survivingRowsOnly = oldRows && rows.current.size > 0 && rows.current.size < oldRows.size
      && [...rows.current].every((id) => oldRows.has(id));
    const animate = survivingRowsOnly && removalUntil.current > Date.now() && before && before.width === next.width
      && before.height > next.height && next.height > 0;
    removalUntil.current = 0;
    removalRows.current = null;
    height.value = animate ? withTiming(next.height, {
      duration: reduceMotion ? 100 : 300,
      easing: Easing.inOut(Easing.cubic),
    }) : next.height;
    setMeasured(true);
  }, [height, reduceMotion]);
  const frameStyle = useAnimatedStyle(() => ({ height: measured ? height.value : undefined }), [measured]);
  return { measured, frameStyle, onContentLayout, prepareRemoval };
}
