import { useCallback, useLayoutEffect } from 'react';
import { runOnJS, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import type { CombatPresentation } from './combat-presentation';

/** UI frame sampling; one JS message per second, independent of projectile count. */
export function useFrameQuality(presentation: CombatPresentation, active: boolean, diagnostics: boolean) {
  const enabled = useSharedValue(active);
  const elapsed = useSharedValue(0), frames = useSharedValue(0), slow = useSharedValue(0), max = useSharedValue(0);
  const fresh = useSharedValue(true);
  const window = useCallback((count: number, late: number, peak: number) => {
    presentation.quality.window(count, late);
    if (diagnostics) presentation.performance.uiWindow(count, late, peak);
  }, [presentation, diagnostics]);
  useLayoutEffect(() => {
    enabled.value = active;
    fresh.value = true;
    presentation.quality.resetWindow();
  }, [active, enabled, fresh, presentation]);
  useFrameCallback(frame => {
    if (!enabled.value || fresh.value) {
      elapsed.value = frames.value = slow.value = max.value = 0;
      fresh.value = !enabled.value;
      return;
    }
    const ms = frame.timeSincePreviousFrame ?? 0;
    if (ms <= 0) return;
    elapsed.value += ms; frames.value++; if (ms > 25) slow.value++;
    max.value = Math.max(max.value, ms);
    if (elapsed.value >= 1000) {
      runOnJS(window)(frames.value, slow.value, max.value);
      elapsed.value = frames.value = slow.value = max.value = 0;
    }
  });
}
