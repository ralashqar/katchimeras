import { useCallback, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';

/** Stack routes stay mounted on push. Release their animated scenes while covered. */
export function FocusedScreen({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  return focused ? children : null;
}
