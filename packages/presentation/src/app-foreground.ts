import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

// All consumers share one native listener. Navigation focus alone does not
// change when the user opens the app switcher or backgrounds the application.
const listeners = new Set<() => void>();
let subscription: ReturnType<typeof AppState.addEventListener> | null = null;
export const isAppForeground = () => AppState.currentState == null || AppState.currentState === 'active';
function subscribe(listener: () => void) {
  listeners.add(listener);
  subscription ??= AppState.addEventListener('change', () => {
    listeners.forEach((notify) => notify());
  });
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { subscription?.remove(); subscription = null; }
  };
}
export function useAppForeground() {
  return useSyncExternalStore(subscribe, isAppForeground, () => true);
}
