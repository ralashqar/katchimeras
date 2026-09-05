import Animated from 'react-native-reanimated';
import { useCompanionActionSlide } from '@/hooks/use-companion-action-slide';
import { useCompanionStackLayout } from '@/hooks/use-companion-stack-layout';
import { createContext, useContext, useLayoutEffect, useRef, useState, useId, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

const ActionNavigationContext = createContext<ReturnType<typeof useCompanionActionSlide> | null>(null);
export const useCompanionActionNavigation = () => useContext(ActionNavigationContext);

function createOverlayStore() {
  let content: ReactNode = null;
  const entries = new Map<string, ReactNode>();
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => content,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(id: string, next: ReactNode) {
      if (next == null) entries.delete(id); else entries.set(id, next);
      const latest = [...entries.values()].at(-1) ?? null;
      if (latest === content) return;
      content = latest; listeners.forEach((listener) => listener());
    },
  };
}
const OverlayContext = createContext<ReturnType<typeof createOverlayStore> | null>(null);

function OverlayOutlet({ store }: { store: ReturnType<typeof createOverlayStore> }) {
  const content = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const layout = useCompanionStackLayout();
  return <Animated.View collapsable={false} layout={layout} pointerEvents={content ? 'box-none' : 'none'} style={styles.overlay}>{content}</Animated.View>;
}

/** Orders sit outside the card ScrollView and never contribute to its height. */
export function CompanionSceneOverlayHost({ children }: { children: ReactNode }) {
  const inherited = useContext(OverlayContext);
  const [store] = useState(createOverlayStore);
  const navigation = useCompanionActionSlide();
  const layout = useCompanionStackLayout(true);
  if (inherited) return <>{children}</>;
  return <OverlayContext.Provider value={store}><ActionNavigationContext.Provider value={navigation}>
    <Animated.View collapsable={false} layout={layout}>
      <Animated.View collapsable={false} style={navigation.rootStyle} pointerEvents={navigation.active ? 'none' : 'auto'}
        accessibilityElementsHidden={navigation.active} importantForAccessibility={navigation.active ? 'no-hide-descendants' : 'auto'}>
        {children}
      </Animated.View>
      <OverlayOutlet store={store} />
    </Animated.View>
  </ActionNavigationContext.Provider></OverlayContext.Provider>;
}

export function CompanionSceneOverlay({ visible, children }: { visible: boolean; children: ReactNode }) {
  const store = useContext(OverlayContext);
  const id = useId();
  useLayoutEffect(() => {
    store?.set(id, visible ? children : null);
    return () => store?.set(id, null);
  }, [children, id, store, visible]);
  if (store) return null;
  // Older standalone meditation routes already own a bottom-anchored surface.
  return <View collapsable={false} pointerEvents={visible ? 'auto' : 'none'}
    accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    style={[styles.overlay, { opacity: visible ? 1 : 0 }]}>{children}</View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});


/** Keep the outgoing submenu and root mounted until their two-leg handoff ends. */
export function CompanionSlidingSubmenu({ visible, children }: { visible: boolean; children: ReactNode }) {
  const navigation = useCompanionActionNavigation();
  const [presented, setPresented] = useState(visible);
  const target = useRef(false);
  const retained = useRef(children);
  if (visible) retained.current = children;
  useLayoutEffect(() => {
    if (target.current === visible) return;
    if (!navigation) { target.current = visible; setPresented(visible); return; }
    if (navigation.busy) return;
    if (visible) setPresented(true);
    if (navigation.navigate(visible, visible ? undefined : () => setPresented(false))) target.current = visible;
  }, [navigation, visible]);
  return <CompanionSceneOverlay visible={visible || presented}>
    <Animated.View collapsable={false} style={navigation?.destinationStyle}
      pointerEvents={navigation?.busy || !visible ? 'none' : 'auto'}
      accessibilityElementsHidden={navigation?.busy || !visible}
      importantForAccessibility={navigation?.busy || !visible ? 'no-hide-descendants' : 'auto'}>
      {visible ? children : retained.current}
    </Animated.View>
  </CompanionSceneOverlay>;
}
