import { type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Lantern } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';

// THE shared popup shell for every Today-page sheet. House rules:
// - an ✕ in the top-right corner is the close affordance (no bottom Close row)
// - touching the empty space outside dismisses immediately (onPressIn, so the
//   start of a drag closes too — not just a completed tap)
// - tap or drag-down on the popup's own BACKGROUND dismisses. The dismiss
//   surface sits UNDERNEATH the content, so buttons, rows, and scroll areas
//   (which render on top and own their touches) are never hijacked — only
//   padding, gaps, and the grabber/header band reach it.
// - drag past ~90dp (or a quick flick) dismisses; short pulls settle back
// - the header is one compact kicker+title block, cleared of the ✕
// - anchored above the floating tab bar via Meadow.overlay.bottomClearance
type MeadowSheetProps = {
  onClose: () => void;
  children: ReactNode;
  // Compact header: small uppercase kicker over a single title line.
  kicker?: string;
  title?: string;
  maxHeight?: number | `${number}%`;
  variant?: 'compact' | 'tall';
  zIndex?: number;
};

export function MeadowSheet({ onClose, children, kicker, title, maxHeight = '74%', variant = 'compact', zIndex = 50 }: MeadowSheetProps) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dragY = useSharedValue(0);
  const tablet = window.width >= 700;
  const horizontalInset = tablet ? Math.max(20, (window.width - 600) / 2) : 12;
  const tallTopClearance = insets.top + 8;
  const tallBottomClearance = Math.max(Meadow.overlay.bottomClearance, insets.bottom + 12);
  const availableTallHeight = Math.max(0, window.height - tallTopClearance - tallBottomClearance);
  const tallHeight = Math.min(
    availableTallHeight,
    window.height * (tablet ? 0.84 : 0.93)
  );

  // Down-only pan on the background layer: sideways/up fails fast.
  const dismissPan = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-14)
    .failOffsetX([-28, 28])
    .onChange((event) => {
      dragY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (dragY.value > 90 || event.velocityY > 900) {
        // A caller may guard dismissal (for example, to confirm a dirty
        // draft). Always settle the sheet back in case it remains mounted.
        dragY.value = withTiming(0, { duration: 160 });
        runOnJS(onClose)();
      } else {
        dragY.value = withTiming(0, { duration: 160 });
      }
    })
    .onFinalize((_event, success) => {
      if (!success) dragY.value = withTiming(0, { duration: 160 });
    });

  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  return (
    <View style={[styles.overlay, { elevation: zIndex, zIndex }]}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable onPressIn={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(260)}
        exiting={SlideOutDown.duration(200)}
        style={[
          styles.sheet,
          dragStyle,
          {
            bottom: variant === 'tall' ? tallBottomClearance : Meadow.overlay.bottomClearance,
            left: horizontalInset,
            right: horizontalInset,
            height: variant === 'tall' ? tallHeight : undefined,
            maxHeight: variant === 'tall' ? tallHeight : maxHeight,
          },
        ]}>
        {/* Dismiss surface: BELOW everything that follows, so it only receives
            touches no content view claims (sheet padding, gaps, header band). */}
        <GestureDetector gesture={dismissPan}>
          <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        </GestureDetector>

        {/* The grabber + header pass touches through to the dismiss surface —
            dragging the top band is the classic way to pull a sheet closed. */}
        <View pointerEvents="none" style={styles.grabber} />
        {kicker || title ? (
          <View pointerEvents="none" style={styles.header}>
            {kicker ? (
              <ThemedText style={styles.kicker} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
                {kicker}
              </ThemedText>
            ) : null}
            {title ? (
              <ThemedText style={styles.title} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {title}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
        {children}

        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.closeX}>
          <IconSymbol name="xmark" size={12} color="rgba(251,243,228,0.75)" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: Meadow.overlay.sheetBg,
    borderColor: Meadow.overlay.sheetBorder,
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    gap: 8,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    position: 'absolute',
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    height: 4,
    width: 38,
  },
  closeX: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,248,230,0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 10,
    width: 28,
    zIndex: 5,
  },
  header: { gap: 1, paddingRight: 36 },
  kicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '800', lineHeight: 20 },
});
