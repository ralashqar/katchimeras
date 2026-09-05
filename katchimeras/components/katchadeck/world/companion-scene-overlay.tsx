import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

function createOverlayStore() {
  let content: ReactNode = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => content,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(next: ReactNode) { content = next; listeners.forEach((listener) => listener()); },
  };
}
const OverlayContext = createContext<ReturnType<typeof createOverlayStore> | null>(null);

function OverlayOutlet({ store }: { store: ReturnType<typeof createOverlayStore> }) {
  const content = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return <View collapsable={false} pointerEvents={content ? 'box-none' : 'none'} style={styles.overlay}>{content}</View>;
}

/** Orders sit outside the card ScrollView and never contribute to its height. */
export function CompanionSceneOverlayHost({ children }: { children: ReactNode }) {
  const [store] = useState(createOverlayStore);
  return <OverlayContext.Provider value={store}>
    <View collapsable={false}>
      {children}
      <OverlayOutlet store={store} />
    </View>
  </OverlayContext.Provider>;
}

export function CompanionSceneOverlay({ visible, children }: { visible: boolean; children: ReactNode }) {
  const store = useContext(OverlayContext);
  useLayoutEffect(() => {
    store?.set(visible ? children : null);
    return () => store?.set(null);
  }, [children, store, visible]);
  if (store) return null;
  // Older standalone meditation routes already own a bottom-anchored surface.
  return <View collapsable={false} pointerEvents={visible ? 'auto' : 'none'}
    accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    style={[styles.overlay, { opacity: visible ? 1 : 0 }]}>{children}</View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
