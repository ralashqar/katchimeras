import { Image } from 'expo-image';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { memo, useCallback, useEffect, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  Keyframe,
  LayoutAnimationConfig,
  LinearTransition,
  type SharedValue,
  ZoomIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { RotatingRadialSunburst } from '@/components/katchadeck/ui/radial-sunburst';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { MERGE_CHARACTER_NAMES } from '@/constants/merge-world-catalog';
import { MERGE_WORLD_UI_ART } from '@/constants/merge-world-ui-art';
import type { MergeRailInteractionGate } from '@/features/onboarding/merge-ftue';
import { isAppForeground, useAppForeground } from '@/hooks/use-app-foreground';
import type { HomeVisualKey } from '@/types/home';
import type { MergeCharacterId, MergeOrder, MergeWorldArrival } from '@/types/merge-world';
import { resolveCreatureArtSource, resolveCreatureOrderArtSource } from '@/utils/creature-art';
import { orderMountWindow, orderViewportWindows } from '@/utils/merge-world/order-window';
import { recordMergeRender } from '@/utils/merge-world/performance';

import { PersistentMergeItemArt } from './feastle-persistent-merge-board';
import { MergeParcelTrayCard } from './merge-parcel-overlay';
import type { MergeScreenPoint } from './merge-serve-reward-overlay';

const TRAY_WIDTH = 120;
const TRAY_GAP = 10;
const TRAY_HEIGHT = 120;
// Extend beyond the 110.4px character frame so the rays aren't hidden by it.
const READY_RAYS_SIZE = 148;
const TRAY_ITEM_SIZE = 34;
const ORDER_TABLE_ART_SCALE = 0.9;
const ORDER_TABLE_ART_HEIGHT = 60;
const ORDER_TABLE_ART_WIDTH = 136;
const TRAY_ART = require('@incubator/art-merge-world/ui/order-service-tray.webp');
const READY_GLOW_ART = require('@incubator/art-characters/soft-glow.png');
const ORDER_REWARD_ART = {
  bond: require('@incubator/art-merge-world/ui/bond.webp'),
  coins: GAME_CURRENCY_ART.coins,
  energy: require('@incubator/art-merge-world/ui/energy.webp'),
} as const;
const CONTROLLED_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const SERVE_CELEBRATION_MS = 250;
const ORDER_RAIL_Z_INDEX = 50;
const SERVE_CONTROL_Z_INDEX = 80;
const TRAY_SERVE_EXIT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  34: { opacity: 1, transform: [{ translateY: 2 }, { scale: 0.965 }] },
  58: { opacity: 1, transform: [{ translateY: -5 }, { scale: 1.025 }] },
  100: { opacity: 0, transform: [{ translateY: -28 }, { scale: 0.94 }] },
}).duration(260);
const PARCEL_STACK_EXIT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  45: { opacity: 1, transform: [{ translateY: -2 }, { scale: 1.03 }] },
  100: { opacity: 0, transform: [{ translateY: -14 }, { scale: 0.9 }] },
}).duration(220);
const READY_GLOW_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.72 }] },
  38: { opacity: 0.7, transform: [{ scale: 1.02 }] },
  72: { opacity: 0.28, transform: [{ scale: 1.16 }] },
  100: { opacity: 0.2, transform: [{ scale: 1.08 }] },
}).duration(280);
const READY_TICK_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 5 }, { scale: 0.45 }] },
  58: { opacity: 1, transform: [{ translateY: -1 }, { scale: 1.18 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
}).duration(240);
const ITEM_TICK_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.45 }] },
}).duration(150);
const SERVE_BUTTON_IN = new Keyframe({
  // Keep the final stacking depth in every keyframe. On native, animating an
  // element from opacity zero can create a temporary compositing layer; if
  // zIndex is absent from that layer it may be drawn below the merge board.
  0: { opacity: 0, transform: [{ translateY: 7 }, { scale: 0.82 }], zIndex: SERVE_CONTROL_Z_INDEX },
  62: { opacity: 1, transform: [{ translateY: -1 }, { scale: 1.05 }], zIndex: SERVE_CONTROL_Z_INDEX },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], zIndex: SERVE_CONTROL_Z_INDEX },
}).duration(230);
const REWARD_POPUP_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateY: -4 }, { scale: 0.96 }] },
}).duration(180);

const SERVE_CONFETTI = [
  { color: '#FFD86E', dx: -53, fall: 17, lift: 47, rotate: -180, round: false },
  { color: '#F58B63', dx: -39, fall: 11, lift: 63, rotate: 145, round: true },
  { color: '#A7D766', dx: -26, fall: 19, lift: 43, rotate: -120, round: false },
  { color: '#FFF0AE', dx: -12, fall: 8, lift: 68, rotate: 210, round: false },
  { color: '#72C9C0', dx: 7, fall: 15, lift: 57, rotate: -205, round: true },
  { color: '#FFD86E', dx: 22, fall: 9, lift: 70, rotate: 165, round: false },
  { color: '#F58B63', dx: 36, fall: 18, lift: 49, rotate: -150, round: false },
  { color: '#A7D766', dx: 51, fall: 12, lift: 59, rotate: 190, round: true },
] as const;

const CHARACTER_VISUALS: Record<MergeCharacterId, HomeVisualKey> = {
  baristabbit: 'baristabbit', feastle: 'feastle', steppling: 'steppling', flexel: 'flexel', bedrotte: 'bedrotte',
  dawnle: 'dawnle', mendle: 'mendle', gatherglow: 'gatherglow', heartmote: 'heartmote', kindling: 'kindling',
  snuglet: 'snuglet', waglet: 'waglet', tasklet: 'tasklet', errandimp: 'errandimp', pagelet: 'pagelet',
  relicoon: 'relicoon', museling: 'museling', encora: 'encora', flickerbun: 'flickerbun', pixooka: 'pixooka',
  mossprout: 'mossprout', shellio: 'shellio', skylo: 'skylo', voyagle: 'voyagle', cheerlet: 'cheerlet',
};

export type MergeTrayEntry =
  | {
      id: 'parcel-stack';
      kind: 'parcel';
      arrival: MergeWorldArrival;
      count: number;
      disabled: boolean;
      shakeNonce: number;
    }
  | {
      id: string;
      kind: 'order';
      order: MergeOrder;
      itemReadiness: readonly boolean[];
      ready: boolean;
    }
  | {
      id: string;
      kind: 'chat_note';
      characterId: MergeCharacterId;
      bondPoints: number;
    };

export type MergeOrderTrayEntry = Extract<MergeTrayEntry, { kind: 'order' }>;

export function EmptyMergeOrderTrayCard() {
  return (
    <View
      accessibilityLabel="Empty order tray"
      pointerEvents="none"
      style={styles.card}>
      <Image
        accessibilityIgnoresInvertColors
        allowDownscaling
        cachePolicy="memory"
        contentFit="contain"
        source={TRAY_ART}
        style={styles.trayArt}
        transition={0}
      />
    </View>
  );
}

export function FrozenMergeOrderTrayCard({ entry }: { entry: MergeOrderTrayEntry }) {
  const recipient = entry.order.recipientSkinId ? katchimeraSkinById.get(entry.order.recipientSkinId) : null;
  const visualKey = recipient?.visualKey ?? CHARACTER_VISUALS[entry.order.characterId];
  const requestedItems = entry.order.requirements
    .flatMap((requirement) => Array.from({ length: requirement.quantity }, () => requirement.definitionId))
    .slice(0, 3);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.card}>
      <View style={styles.characterLayer}>
        <Image
          accessibilityIgnoresInvertColors
          allowDownscaling
          cachePolicy="memory"
          contentFit="contain"
          recyclingKey={`merge-order-frozen-${entry.order.recipientSkinId ?? entry.order.characterId}`}
          source={resolveCreatureOrderArtSource(visualKey)}
          style={styles.character}
          transition={0}
        />
      </View>
      <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" source={TRAY_ART} style={styles.trayArt} transition={0} />
      <View style={styles.items}>
        {requestedItems.map((definitionId, index) => (
          <View key={`${definitionId}:${index}`} style={styles.item}>
            <PersistentMergeItemArt definitionId={definitionId} size={TRAY_ITEM_SIZE} />
          </View>
        ))}
      </View>
    </View>
  );
}

export const MergeOrderRail = memo(function MergeOrderRail({ active = true, servingOrderId, entries, focusOrderId, onOpenChat, onOpenParcel, onReroll, onServe, onBlockedInteraction, onRailTargetRef, interactionGate = { kind: 'open' }, parcelTargetRef }: {
  active?: boolean;
  servingOrderId?: string | null;
  entries: readonly MergeTrayEntry[];
  focusOrderId?: string;
  onOpenChat: (characterId: MergeCharacterId, noteId: string) => void;
  onOpenParcel: (arrivalId: string) => void;
  onReroll: (order: MergeOrder) => void;
  onServe: (order: MergeOrder, itemTargets: readonly MergeScreenPoint[]) => boolean | Promise<boolean>;
  onBlockedInteraction?: () => void;
  onRailTargetRef?: (targetKey: string, view: View | null) => void;
  interactionGate?: MergeRailInteractionGate;
  parcelTargetRef: RefObject<View | null>;
}) {
  recordMergeRender('order-rail');
  const reduceMotion = useReducedMotion();
  const foreground = useAppForeground();
  const effectsActive = active && foreground;
  const scrollRef = useRef<ScrollView>(null);
  const lastAutoFocusKeyRef = useRef<string | null>(null);
  const pendingWindowFrameRef = useRef<number | null>(null);
  const [windows, setWindows] = useState(() => ({ mounted: orderMountWindow(0, entries.length), visible: { start: 0, end: 0 } }));
  const { mounted: mountedWindow, visible: visibleWindow } = windows;
  const requestedWindowsRef = useRef(windows);
  const viewportRef = useRef({ offset: 0, width: 0 });
  const firstEntryId = entries[0]?.id ?? null;
  const parcelArrivalId = entries.find((entry) => entry.kind === 'parcel')?.arrival.id ?? null;
  const handleParcelTargetRef = useCallback((view: View | null) => {
    parcelTargetRef.current = view;
    if (parcelArrivalId) onRailTargetRef?.(`tray-parcel:${parcelArrivalId}`, view);
  }, [onRailTargetRef, parcelArrivalId, parcelTargetRef]);

  const moveMountedWindow = useCallback(() => {
    const { offset, width } = viewportRef.current;
    const { mounted, visible } = orderViewportWindows(offset, width, entries.length, TRAY_WIDTH + TRAY_GAP, TRAY_WIDTH, 3);
    const previous = requestedWindowsRef.current;
    // Pixel-by-pixel scroll events need no React work until a card boundary changes.
    if (mounted.start === previous.mounted.start && mounted.end === previous.mounted.end
      && visible.start === previous.visible.start && visible.end === previous.visible.end) return;
    requestedWindowsRef.current = { mounted, visible };
    if (pendingWindowFrameRef.current != null) return;
    // Defer image/card mounting until after the scroll event is delivered. It
    // keeps gestures responsive and coalesces several fast scroll events.
    pendingWindowFrameRef.current = requestAnimationFrame(() => {
      pendingWindowFrameRef.current = null;
      setWindows(requestedWindowsRef.current);
    });
  }, [entries.length]);

  useEffect(() => {
    // Clamp a stale offset when serving/rerolling shrinks the row.
    viewportRef.current.offset = Math.min(viewportRef.current.offset, Math.max(0, entries.length * (TRAY_WIDTH + TRAY_GAP) + 21 - viewportRef.current.width));
    moveMountedWindow();
  }, [entries.length, moveMountedWindow]);

  useEffect(() => () => {
    if (pendingWindowFrameRef.current != null) cancelAnimationFrame(pendingWindowFrameRef.current);
  }, []);

  useEffect(() => {
    const autoFocusKey = firstEntryId?.startsWith('chat-note:') ? firstEntryId : focusOrderId ?? null;
    if (!autoFocusKey || lastAutoFocusKeyRef.current === autoFocusKey) return;
    const targetIndex = firstEntryId?.startsWith('chat-note:')
      ? 0
      : focusOrderId
        ? entries.findIndex((entry) => entry.kind === 'order' && entry.order.id === focusOrderId)
        : -1;
    if (targetIndex < 0) return;
    const frame = requestAnimationFrame(() => {
      lastAutoFocusKeyRef.current = autoFocusKey;
      scrollRef.current?.scrollTo({ x: targetIndex * (TRAY_WIDTH + TRAY_GAP), y: 0, animated: !reduceMotion });
    });
    return () => cancelAnimationFrame(frame);
  }, [entries, firstEntryId, focusOrderId, reduceMotion]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    viewportRef.current = { offset: Math.max(0, contentOffset.x), width: layoutMeasurement.width };
    moveMountedWindow();
  }, [moveMountedWindow]);

  if (!entries.length) return <View accessibilityLabel="No active Katchimera requests" style={styles.emptyRail} />;

  return (
    <ScrollView
      accessibilityLabel="Katchimera parcels and orders"
      contentContainerStyle={styles.content}
      decelerationRate="fast"
      disableIntervalMomentum
      horizontal
      scrollEnabled={interactionGate.kind === 'open'}
      onScroll={handleScroll}
      onLayout={(event) => {
        viewportRef.current.width = event.nativeEvent.layout.width;
        moveMountedWindow();
      }}
      ref={scrollRef}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      snapToAlignment="start"
      snapToInterval={TRAY_WIDTH + TRAY_GAP}
      style={styles.rail}>
      {entries.map((entry, index) => {
        const mounted = index >= mountedWindow.start && index < mountedWindow.end;
        const visible = index >= visibleWindow.start && index < visibleWindow.end;
        return (
        <Animated.View
          entering={reduceMotion
            ? FadeIn.duration(100)
            : FadeInUp.delay(Math.min(index, 5) * 42).duration(260).easing(CONTROLLED_EASE)}
          exiting={reduceMotion ? FadeOut.duration(90) : entry.kind === 'parcel' ? PARCEL_STACK_EXIT : TRAY_SERVE_EXIT}
          key={entry.id}
          layout={reduceMotion ? undefined : LinearTransition.duration(220).easing(CONTROLLED_EASE)}
          style={styles.entry}>
          {/* Lightweight keyed slots stay put. Only real order removals run
              their outro; virtualized artwork is detached without animation. */}
          {mounted ? <LayoutAnimationConfig skipEntering skipExiting>
          <View collapsable={false} style={styles.card}>
          {entry.kind === 'parcel' ? (
            <MergeParcelTrayCard
              arrival={entry.arrival}
              count={entry.count}
              disabled={entry.disabled || (interactionGate.kind !== 'open' && !(interactionGate.kind === 'parcel' && interactionGate.arrivalId === entry.arrival.id))}
              onPress={() => interactionGate.kind === 'open' || (interactionGate.kind === 'parcel' && interactionGate.arrivalId === entry.arrival.id) ? onOpenParcel(entry.arrival.id) : onBlockedInteraction?.()}
              ref={handleParcelTargetRef}
              shakeNonce={entry.shakeNonce}
            />
          ) : entry.kind === 'order' ? (
            <StableOrderTray
              animateEntrance={false}
              effectsActive={effectsActive && visible}
              surfaceActive={effectsActive}
              serveInFlight={servingOrderId === undefined ? undefined : servingOrderId === entry.order.id}
              entry={entry}
              index={index}
              interactionAllowed={interactionGate.kind === 'open' || (interactionGate.kind === 'serve' && interactionGate.orderId === entry.order.id)}
              interactionLocked={interactionGate.kind !== 'open'}
              onBlockedInteraction={onBlockedInteraction}
              onRailTargetRef={onRailTargetRef}
              onReroll={onReroll}
              onServe={onServe}
              reduceMotion={reduceMotion}
            />
          ) : (
            <ChatNoteTrayCard
              entry={entry}
              onPress={() => interactionGate.kind === 'open' || (interactionGate.kind === 'chat_note' && interactionGate.noteId === entry.id)
                ? onOpenChat(entry.characterId, entry.id)
                : onBlockedInteraction?.()}
              onRailTargetRef={onRailTargetRef}
              reduceMotion={reduceMotion}
            />
          )}
          </View>
          </LayoutAnimationConfig> : null}
        </Animated.View>
        );
      })}
    </ScrollView>
  );
});

const StableOrderTray = memo(function StableOrderTray({ onReroll, onServe, ...props }:
  Omit<ComponentProps<typeof MergeOrderTrayCard>, 'onReroll' | 'onServe'> & {
    onReroll: (order: MergeOrder) => void;
    onServe: (order: MergeOrder, targets: readonly MergeScreenPoint[]) => boolean | Promise<boolean>;
  }) {
  const order = props.entry.order;
  const reroll = useCallback(() => onReroll(order), [onReroll, order]);
  const serve = useCallback((targets: readonly MergeScreenPoint[]) => onServe(order, targets), [onServe, order]);
  return <MergeOrderTrayCard {...props} onReroll={reroll} onServe={serve} />;
});

export function MergeOrderTrayCard({ animateEntrance = true, effectsActive = true, surfaceActive = true, serveInFlight, entry, index, interactionAllowed, interactionLocked, onBlockedInteraction, onRailTargetRef, onReroll, onServe, reduceMotion }: {
  effectsActive?: boolean;
  surfaceActive?: boolean;
  serveInFlight?: boolean;
  animateEntrance?: boolean;
  entry: MergeOrderTrayEntry;
  index: number;
  interactionAllowed: boolean;
  interactionLocked: boolean;
  onBlockedInteraction?: () => void;
  onRailTargetRef?: (targetKey: string, view: View | null) => void;
  onReroll: () => void;
  onServe: (itemTargets: readonly MergeScreenPoint[]) => boolean | Promise<boolean>;
  reduceMotion: boolean;
}) {
  recordMergeRender('order-card');
  const { itemReadiness, order, ready } = entry;
  const [rewardOpen, setRewardOpen] = useState(false);
  const [serving, setServing] = useState(false);
  const [entryMotionEnabled, setEntryMotionEnabled] = useState(animateEntrance);
  const servingRef = useRef(false);
  const serveAttemptRef = useRef(0);
  const itemRefs = useRef<(View | null)[]>([]);
  const recipient = order.recipientSkinId ? katchimeraSkinById.get(order.recipientSkinId) : null;
  const recipientName = recipient?.displayName ?? MERGE_CHARACTER_NAMES[order.characterId];
  const recipientVisualKey = recipient?.visualKey ?? CHARACTER_VISUALS[order.characterId];
  const characterSource = resolveCreatureOrderArtSource(recipientVisualKey);
  const orderCardTargetKey = `order-card:${order.id}`;
  const serveTargetKey = `order-serve:${order.id}`;
  const setOrderCardTargetRef = useCallback(
    (view: View | null) => onRailTargetRef?.(orderCardTargetKey, view),
    [onRailTargetRef, orderCardTargetKey],
  );
  const setServeTargetRef = useCallback(
    (view: View | null) => onRailTargetRef?.(serveTargetKey, view),
    [onRailTargetRef, serveTargetKey],
  );
  const requestedItems = order.requirements
    .flatMap((requirement) => Array.from({ length: requirement.quantity }, () => requirement.definitionId))
    .slice(0, 3);
  const itemDelay = Math.min(index, 5) * 42 + 115;
  useEffect(() => {
    if (!rewardOpen) return;
    const timer = setTimeout(() => setRewardOpen(false), 3_200);
    return () => clearTimeout(timer);
  }, [rewardOpen]);
  useEffect(() => {
    if (entryMotionEnabled) return;
    const frame = requestAnimationFrame(() => setEntryMotionEnabled(true));
    return () => cancelAnimationFrame(frame);
  }, [entryMotionEnabled]);

  useEffect(() => {
    if (!surfaceActive || serveInFlight === false) {
      serveAttemptRef.current += 1;
      servingRef.current = false;
      setServing(false);
      setRewardOpen(false);
    }
    return () => { serveAttemptRef.current += 1; };
  }, [serveInFlight, surfaceActive]);

  const beginServe = async () => {
    if (!interactionAllowed) {
      onBlockedInteraction?.();
      return;
    }
    if (!surfaceActive || !isAppForeground() || !ready || servingRef.current || serveInFlight) return;
    const attempt = ++serveAttemptRef.current;
    setRewardOpen(false);
    servingRef.current = true;
    setServing(true);
    const targets = await Promise.all(requestedItems.map((_, itemIndex) => measureViewCenter(itemRefs.current[itemIndex])));
    if (attempt !== serveAttemptRef.current || !isAppForeground()) return;
    if (targets.some((target) => target == null)) {
      servingRef.current = false;
      setServing(false);
      return;
    }
    const launched = await onServe(targets as MergeScreenPoint[]);
    if (launched || attempt !== serveAttemptRef.current) return;
    servingRef.current = false;
    setServing(false);
  };

  return (
    <Pressable
      accessible={interactionAllowed}
      accessibilityHint={ready ? 'Serves the completed request' : undefined}
      accessibilityLabel={`${recipientName} order, ${order.title}${ready ? ', ready to serve' : ''}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: interactionLocked && !interactionAllowed }}
      onLongPress={interactionLocked ? onBlockedInteraction : onReroll}
      onPress={!interactionAllowed ? onBlockedInteraction : ready ? beginServe : undefined}
      ref={setOrderCardTargetRef}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {ready ? (
        <Animated.View
          entering={!entryMotionEnabled ? undefined : reduceMotion ? FadeIn.duration(70) : READY_GLOW_IN}
          exiting={FadeOut.duration(reduceMotion ? 70 : 180)}
          key="ready-glow"
          pointerEvents="none"
          style={styles.readyGlow}
        ><Image accessibilityIgnoresInvertColors contentFit="contain" source={READY_GLOW_ART} style={StyleSheet.absoluteFill} tintColor="#AEDC5F" transition={0} /></Animated.View>
      ) : null}
      {ready ? (
        <Animated.View entering={!entryMotionEnabled ? undefined : FadeIn.duration(reduceMotion ? 70 : 220)} exiting={FadeOut.duration(reduceMotion ? 70 : 180)} pointerEvents="none" style={styles.readyRays}>
          <RotatingRadialSunburst active={effectsActive} baseOpacity={0.86} rotationDurationMs={32_000} size={READY_RAYS_SIZE} />
        </Animated.View>
      ) : null}
      {serving && !reduceMotion ? <TrayServeConfetti /> : null}
      <Animated.View entering={!entryMotionEnabled ? undefined : reduceMotion ? FadeIn.duration(100) : FadeInUp.delay(Math.min(index, 5) * 42 + 45).duration(230)} style={styles.characterLayer}>
        <Pressable
          accessible={!ready && !interactionLocked}
          accessibilityHint={ready ? undefined : 'Shows the rewards for this request'}
          accessibilityLabel={`${recipientName} reward details`}
          accessibilityRole="button"
          onPress={(event) => {
            event.stopPropagation();
            if (!interactionAllowed) {
              onBlockedInteraction?.();
              return;
            }
            if (ready) {
              void beginServe();
              return;
            }
            if (interactionLocked) {
              onBlockedInteraction?.();
              return;
            }
            setRewardOpen((current) => !current);
          }}
          style={({ pressed }) => [styles.characterButton, pressed && styles.characterPressed]}>
          <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" recyclingKey={`merge-order-${order.recipientSkinId ?? order.characterId}`} source={characterSource} style={styles.character} transition={0} />
        </Pressable>
      </Animated.View>
      {rewardOpen ? <OrderRewardPopup order={order} reduceMotion={reduceMotion} /> : null}
      <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" source={TRAY_ART} style={styles.trayArt} transition={0} />
      <Animated.View pointerEvents="none" style={styles.items}>
        {requestedItems.map((definitionId, itemIndex) => (
          <Animated.View
            entering={!entryMotionEnabled ? undefined : reduceMotion ? FadeIn.duration(90) : ZoomIn.delay(itemDelay + itemIndex * 35).duration(190).easing(CONTROLLED_EASE)}
            key={`${definitionId}:${itemIndex}`}
            ref={(node) => { itemRefs.current[itemIndex] = node as unknown as View; }}
            style={styles.item}>
            <PersistentMergeItemArt definitionId={definitionId} size={TRAY_ITEM_SIZE} />
            {itemReadiness[itemIndex] ? (
              <Animated.View
                entering={!entryMotionEnabled ? undefined : reduceMotion ? FadeIn.duration(70) : READY_TICK_IN}
                exiting={reduceMotion ? FadeOut.duration(70) : ITEM_TICK_OUT}
                pointerEvents="none"
                style={styles.itemReadyTick}>
                <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" source={MERGE_WORLD_UI_ART.readyTick} style={styles.itemReadyTickArt} transition={0} />
              </Animated.View>
            ) : null}
          </Animated.View>
        ))}
      </Animated.View>
      {ready && !serving && !serveInFlight ? (
        <Animated.View
          entering={!entryMotionEnabled ? undefined : reduceMotion ? FadeIn.duration(70) : SERVE_BUTTON_IN}
          exiting={FadeOut.duration(reduceMotion ? 70 : 150)}
          style={styles.serveButton}>
          <Pressable
            accessibilityHint="Serves the completed request"
            accessibilityLabel={`Serve ${order.title}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: !interactionAllowed }}
            onPress={(event) => {
              event.stopPropagation();
              void beginServe();
            }}
            ref={setServeTargetRef}
            style={({ pressed }) => [styles.serveButtonHit, pressed && styles.serveButtonPressed]}>
            <View pointerEvents="none" style={styles.serveButtonShine} />
            <ThemedText style={styles.serveButtonText} lightColor="#FFFDE8" darkColor="#FFFDE8">SERVE</ThemedText>
          </Pressable>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

function measureViewCenter(view: View | null): Promise<MergeScreenPoint | null> {
  return new Promise((resolve) => {
    if (!view) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => resolve({ x: x + width / 2, y: y + height / 2 }));
  });
}

function OrderRewardPopup({ order, reduceMotion }: {
  order: MergeOrder;
  reduceMotion: boolean;
}) {
  const rows = [
    { amount: order.reward.friendshipXp, art: ORDER_REWARD_ART.bond, id: 'bond', label: 'Bond' },
    { amount: order.reward.coins, art: ORDER_REWARD_ART.coins, id: 'coins', label: 'Glow' },
    { amount: order.reward.energy, art: ORDER_REWARD_ART.energy, id: 'energy', label: 'Energy' },
  ].filter((row) => row.amount > 0);

  return (
    <Animated.View
      accessibilityLabel={rows.map((row) => `${row.amount} ${row.label}`).join(', ')}
      entering={reduceMotion ? FadeIn.duration(90) : ZoomIn.duration(180).easing(CONTROLLED_EASE)}
      exiting={reduceMotion ? FadeOut.duration(90) : REWARD_POPUP_OUT}
      pointerEvents="none"
      style={styles.rewardPopup}>
      {rows.map((row) => (
        <View accessibilityLabel={`Reward ${row.amount} ${row.label}`} key={row.id} style={styles.rewardRow}>
          <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" source={row.art} style={styles.rewardIcon} transition={0} />
          <ThemedText style={styles.rewardAmount} lightColor="#FFF9DC" darkColor="#FFF9DC">+{row.amount}</ThemedText>
        </View>
      ))}
    </Animated.View>
  );
}

function TrayServeConfetti() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: SERVE_CELEBRATION_MS, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(progress);
  }, [progress]);

  return (
    <View pointerEvents="none" style={styles.serveConfetti}>
      {SERVE_CONFETTI.map((particle, index) => (
        <ServeConfettiParticle index={index} key={`${particle.color}-${index}`} particle={particle} progress={progress} />
      ))}
    </View>
  );
}

function ServeConfettiParticle({ index, particle, progress }: {
  index: number;
  particle: (typeof SERVE_CONFETTI)[number];
  progress: SharedValue<number>;
}) {
  const particleStyle = useAnimatedStyle(() => {
    const value = progress.value;
    return {
      opacity: interpolate(value, [0, 0.1, 0.72, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: particle.dx * value },
        { translateY: -particle.lift * value + particle.fall * value * value },
        { rotateZ: `${particle.rotate * value}deg` },
        { scale: interpolate(value, [0, 0.18, 1], [0.5, 1, 0.82]) },
      ],
    };
  }, [particle, progress]);

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        particle.round && styles.confettiParticleRound,
        { backgroundColor: particle.color, left: 69 + (index % 2) * 4 },
        particleStyle,
      ]}
    />
  );
}

function ChatNoteTrayCard({ entry, onPress, onRailTargetRef, reduceMotion }: {
  entry: Extract<MergeTrayEntry, { kind: 'chat_note' }>;
  onPress: () => void;
  onRailTargetRef?: (targetKey: string, view: View | null) => void;
  reduceMotion: boolean;
}) {
  const characterSource = resolveCreatureArtSource(CHARACTER_VISUALS[entry.characterId], { lod: 'medium' });
  const targetKey = `chat-note:${entry.id}`;
  const setTargetRef = useCallback(
    (view: View | null) => onRailTargetRef?.(targetKey, view),
    [onRailTargetRef, targetKey],
  );
  const subtitle = entry.bondPoints > 0 ? `+${entry.bondPoints} Bond · Read` : 'Read next scene';
  return (
    <Pressable
      accessibilityLabel={`${MERGE_CHARACTER_NAMES[entry.characterId]} left a note. ${subtitle}`}
      accessibilityRole="button"
      onPress={onPress}
      ref={setTargetRef}
      style={({ pressed }) => [styles.card, styles.noteCard, pressed && styles.pressed]}>
      <Animated.View entering={reduceMotion ? FadeIn.duration(100) : FadeInUp.delay(45).duration(230)} style={styles.characterLayer}>
        <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" recyclingKey={`merge-note-${entry.characterId}`} source={characterSource} style={styles.character} transition={0} />
      </Animated.View>
      <Image accessibilityIgnoresInvertColors allowDownscaling cachePolicy="memory" contentFit="contain" source={TRAY_ART} style={styles.trayArt} transition={0} />
      <Animated.View entering={reduceMotion ? FadeIn.duration(100) : FadeInUp.delay(115).duration(240).easing(CONTROLLED_EASE)} style={styles.notePaper}>
        <ThemedText numberOfLines={2} style={styles.noteTitle} lightColor="#4A291B" darkColor="#4A291B">I have something for you</ThemedText>
        <View pointerEvents="none" style={styles.noteIconBadge}>
          <IconSymbol color="#FFF6DB" name="envelope.fill" size={12} />
        </View>
      </Animated.View>
      <Animated.View entering={reduceMotion ? FadeIn.duration(90) : ZoomIn.delay(235).duration(210).easing(Easing.out(Easing.back(1.12)))} style={styles.alertBadge}>
        <ThemedText style={styles.alertMark} lightColor="#FFF7DF" darkColor="#FFF7DF">!</ThemedText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { elevation: ORDER_RAIL_Z_INDEX, flexGrow: 0, height: TRAY_HEIGHT, overflow: 'visible', position: 'relative', zIndex: ORDER_RAIL_Z_INDEX },
  content: { paddingLeft: 3, paddingRight: 18, position: 'relative', zIndex: ORDER_RAIL_Z_INDEX },
  emptyRail: { height: TRAY_HEIGHT },
  entry: { height: TRAY_HEIGHT, marginRight: TRAY_GAP, position: 'relative', zIndex: ORDER_RAIL_Z_INDEX, width: TRAY_WIDTH },
  card: { height: TRAY_HEIGHT, overflow: 'visible', position: 'relative', zIndex: ORDER_RAIL_Z_INDEX, width: TRAY_WIDTH },
  readyGlow: { height: 114, left: 3, position: 'absolute', top: -11, width: 114, zIndex: 0 },
  readyRays: { height: READY_RAYS_SIZE, left: (TRAY_WIDTH - READY_RAYS_SIZE) / 2, position: 'absolute', top: TRAY_HEIGHT - 23.2 - 110.4 / 2 - READY_RAYS_SIZE / 2, width: READY_RAYS_SIZE, zIndex: 1 },
  characterLayer: { bottom: 23.2, height: 110.4, left: 4.8, position: 'absolute', width: 110.4, zIndex: 2 },
  characterButton: { height: '100%', width: '100%' },
  characterPressed: { transform: [{ scale: 0.96 }] },
  character: { height: '100%', width: '100%' },
  rewardPopup: { backgroundColor: 'rgba(66,45,30,0.94)', borderColor: 'rgba(255,225,164,0.92)', borderCurve: 'continuous', borderRadius: 9, borderWidth: 1, boxShadow: '0 5px 12px rgba(41,24,14,0.38)', paddingHorizontal: 5, paddingVertical: 4, position: 'absolute', right: -5, top: 5, width: 56, zIndex: 12 },
  rewardRow: { alignItems: 'center', flexDirection: 'row', gap: 2, height: 17 },
  rewardIcon: { height: 16, width: 16 },
  rewardAmount: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 10.5, fontVariant: ['tabular-nums'], lineHeight: 14, textShadowColor: 'rgba(48,25,11,0.72)', textShadowOffset: { height: 1, width: 0 }, textShadowRadius: 1 },
  trayArt: {
    bottom: 0,
    height: ORDER_TABLE_ART_HEIGHT * ORDER_TABLE_ART_SCALE,
    left: (TRAY_WIDTH - ORDER_TABLE_ART_WIDTH * ORDER_TABLE_ART_SCALE) / 2,
    position: 'absolute',
    width: ORDER_TABLE_ART_WIDTH * ORDER_TABLE_ART_SCALE,
    zIndex: 3,
  },
  items: { alignItems: 'center', bottom: 22, flexDirection: 'row', justifyContent: 'center', left: 4, position: 'absolute', right: 4, zIndex: 4 },
  serveConfetti: { bottom: 0, left: 0, overflow: 'visible', position: 'absolute', right: 0, top: 0, zIndex: 5 },
  confettiParticle: { borderRadius: 1, height: 7, position: 'absolute', top: 58, width: 4 },
  confettiParticleRound: { borderRadius: 999, height: 6, width: 6 },
  item: { height: TRAY_ITEM_SIZE, position: 'relative', width: TRAY_ITEM_SIZE },
  itemReadyTick: { bottom: -6, height: 19, position: 'absolute', right: -4, width: 19, zIndex: 5 },
  itemReadyTickArt: { height: '100%', width: '100%' },
  serveButton: { alignItems: 'center', backgroundColor: '#58A83D', borderColor: '#DDF5A9', borderCurve: 'continuous', borderRadius: 7, borderWidth: 1.5, bottom: -8, boxShadow: '0 3px 7px rgba(42,83,25,0.45)', elevation: SERVE_CONTROL_Z_INDEX, height: 23, justifyContent: 'center', left: 30, overflow: 'hidden', position: 'absolute', width: 60, zIndex: SERVE_CONTROL_Z_INDEX },
  serveButtonHit: { alignItems: 'center', height: '100%', justifyContent: 'center', width: '100%' },
  serveButtonPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  serveButtonShine: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 4, height: 7, left: 3, position: 'absolute', right: 3, top: 2 },
  serveButtonText: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 10, letterSpacing: 0.4, lineHeight: 13 },
  noteCard: { backgroundColor: 'transparent' },
  notePaper: { alignItems: 'center', backgroundColor: '#FFF4D8', borderColor: '#C78A48', borderCurve: 'continuous', borderRadius: 8, borderWidth: 1, bottom: 5, boxShadow: '0 3px 7px rgba(67,35,17,0.28)', height: 44, justifyContent: 'center', left: 8, paddingHorizontal: 8, position: 'absolute', width: 104, zIndex: 4 },
  noteTitle: { flexShrink: 1, fontFamily: AppFontFamilies.fredokaBold, fontSize: 9.5, lineHeight: 12, textAlign: 'center', width: '100%' },
  noteIconBadge: { alignItems: 'center', backgroundColor: '#A85A31', borderColor: '#FFE2A4', borderRadius: 999, borderWidth: 1.5, boxShadow: '0 2px 5px rgba(74,34,17,0.34)', height: 23, justifyContent: 'center', position: 'absolute', right: -7, top: -9, width: 23, zIndex: 2 },
  alertBadge: { alignItems: 'center', backgroundColor: '#B7552E', borderColor: '#FFE4A1', borderRadius: 999, borderWidth: 2, boxShadow: '0 3px 8px rgba(74,34,17,0.40)', height: 27, justifyContent: 'center', position: 'absolute', right: 4, top: 3, width: 27, zIndex: 10 },
  alertMark: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 20, lineHeight: 23 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.975 }] },
});
