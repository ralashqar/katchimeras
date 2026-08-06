import { type ReactNode, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KatchaSurfaceProvider } from '@/components/katchadeck/ui/katcha-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaSurfacePalette, KatchaUI, type KatchaSurface } from '@/constants/katcha-ui';
import { Meadow } from '@/constants/meadow-theme';

export type KatchaSheetSize = 'compact' | 'tall' | 'full';
export type KatchaSheetCloseReason = 'button' | 'backdrop' | 'swipe' | 'hardwareBack';

export type KatchaSheetHeader = {
  eyebrow?: string;
  title?: string;
  titleVariant?: 'display' | 'strong';
  subtitle?: string;
  step?: { current: number; total: number };
};

export type KatchaSheetProps = {
  children: ReactNode;
  footer?: ReactNode;
  fullBleed?: boolean;
  header?: KatchaSheetHeader;
  keyboardAvoiding?: boolean;
  maxHeight?: number | `${number}%`;
  onRequestClose: (reason: KatchaSheetCloseReason) => void;
  open?: boolean;
  portal?: boolean;
  scroll?: boolean;
  scrollContentStyle?: StyleProp<ViewStyle>;
  showClose?: boolean;
  size?: KatchaSheetSize;
  surface?: KatchaSurface;
  zIndex?: number;
};

export function KatchaSheet({
  children,
  footer,
  fullBleed = false,
  header,
  keyboardAvoiding = false,
  maxHeight = '74%',
  onRequestClose,
  open = true,
  portal = true,
  scroll = false,
  scrollContentStyle,
  showClose = true,
  size = 'compact',
  surface = 'night',
  zIndex = 50,
}: KatchaSheetProps) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dragY = useSharedValue(0);
  const palette = KatchaSurfacePalette[surface];
  const tablet = window.width >= 700;
  const horizontalInset = tablet ? Math.max(20, (window.width - 600) / 2) : 12;
  const topClearance = insets.top + 8;
  const bottomClearance = Math.max(Meadow.overlay.bottomClearance, insets.bottom + 12);
  const availableTallHeight = Math.max(0, window.height - topClearance - bottomClearance);
  const tallHeight = Math.min(availableTallHeight, window.height * (tablet ? 0.84 : 0.93));
  const expanded = size !== 'compact';

  useEffect(() => {
    if (open) dragY.value = 0;
  }, [dragY, open]);

  const close = (reason: KatchaSheetCloseReason) => onRequestClose(reason);
  const dismissPan = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-14)
    .failOffsetX([-28, 28])
    .onChange((event) => { dragY.value = Math.max(0, event.translationY); })
    .onEnd((event) => {
      if (dragY.value > 90 || event.velocityY > 900) {
        dragY.value = withTiming(0, { duration: 160 });
        runOnJS(close)('swipe');
      } else {
        dragY.value = withTiming(0, { duration: 160 });
      }
    })
    .onFinalize((_event, success) => { if (!success) dragY.value = withTiming(0, { duration: 160 }); });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.scroll}>
      {children}
    </ScrollView>
  ) : children;

  const content = (
    <View style={[styles.overlay, !portal && { zIndex }]}>
      <Animated.View
        entering={reduceMotion ? FadeIn.duration(80) : FadeIn.duration(180)}
        exiting={FadeOut.duration(160)}
        style={[styles.backdrop, { backgroundColor: palette.scrim }]}>
        <Pressable accessibilityLabel="Close popup" onPressIn={() => close('backdrop')} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        entering={reduceMotion ? FadeIn.duration(80) : SlideInDown.duration(KatchaUI.motion.sheetIn)}
        exiting={reduceMotion ? FadeOut.duration(80) : SlideOutDown.duration(KatchaUI.motion.sheetOut)}
        style={[
          styles.sheetFrame,
          {
            bottom: size === 'full' ? 0 : size === 'tall' ? bottomClearance : Meadow.overlay.bottomClearance,
            height: size === 'full' ? window.height : size === 'tall' ? tallHeight : undefined,
            left: size === 'full' ? 0 : horizontalInset,
            maxHeight: expanded ? (size === 'full' ? window.height : tallHeight) : maxHeight,
            right: size === 'full' ? 0 : horizontalInset,
          },
        ]}>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            expanded && styles.expanded,
            dragStyle,
            { backgroundColor: palette.background, borderColor: palette.borderStrong, boxShadow: palette.shadow },
            {
              borderRadius: size === 'full' ? 0 : KatchaUI.radius.sheet,
              borderWidth: size === 'full' ? 0 : 1,
              maxHeight: expanded ? (size === 'full' ? window.height : tallHeight) : maxHeight,
              paddingBottom: size === 'full' ? 0 : 14,
              paddingHorizontal: size === 'full' ? 0 : 16,
              paddingTop: size === 'full' ? 0 : 10,
            },
          ]}>
        {size !== 'full' ? (
          <GestureDetector gesture={dismissPan}>
            <Pressable accessible={false} onPress={() => close('backdrop')} style={StyleSheet.absoluteFill} />
          </GestureDetector>
        ) : null}
        {size !== 'full' ? <View pointerEvents="none" style={[styles.grabber, { backgroundColor: palette.textTertiary }]} /> : null}
        <KeyboardAvoidingView
          behavior={keyboardAvoiding && process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.content,
            expanded && styles.expanded,
            size === 'full' && !fullBleed && { paddingBottom: insets.bottom + 10, paddingHorizontal: Math.max(16, insets.left, insets.right), paddingTop: insets.top + 8 },
            size === 'full' && fullBleed && styles.fullBleedContent,
          ]}>
          {header ? <KatchaSheetHeading header={header} surface={surface} /> : null}
          <View style={[styles.body, expanded && styles.expanded]}>{body}</View>
          {footer ? <View style={[styles.footer, { borderTopColor: palette.border }]}>{footer}</View> : null}
        </KeyboardAvoidingView>
        {showClose ? (
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => close('button')}
            style={({ pressed }) => [
              styles.close,
              { backgroundColor: palette.subtle, borderColor: palette.borderStrong },
              pressed && styles.pressed,
            ]}>
            <IconSymbol name="xmark" size={13} color={palette.textSecondary} />
          </Pressable>
        ) : null}
        </Animated.View>
      </Animated.View>
    </View>
  );

  const wrapped = <KatchaSurfaceProvider surface={surface}>{content}</KatchaSurfaceProvider>;
  if (!portal) return open ? wrapped : null;
  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={() => close('hardwareBack')}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={open}>
      <GestureHandlerRootView style={styles.modalRoot}>{wrapped}</GestureHandlerRootView>
    </Modal>
  );
}

function KatchaSheetHeading({ header, surface }: { header: KatchaSheetHeader; surface: KatchaSurface }) {
  const palette = KatchaSurfacePalette[surface];
  return (
    <View pointerEvents="none" style={styles.header}>
      {header.step ? (
        <ThemedText style={styles.step} lightColor={palette.textTertiary} darkColor={palette.textTertiary}>
          {`Step ${header.step.current} of ${header.step.total}`}
        </ThemedText>
      ) : null}
      {header.eyebrow ? <ThemedText style={styles.eyebrow} lightColor={surface === 'parchment' ? palette.textTertiary : palette.accent} darkColor={surface === 'parchment' ? palette.textTertiary : palette.accent}>{header.eyebrow}</ThemedText> : null}
      {header.title ? <ThemedText maxFontSizeMultiplier={1.35} style={[styles.title, surface === 'parchment' && header.titleVariant !== 'strong' && styles.parchmentTitle, header.titleVariant === 'strong' && styles.strongTitle]} lightColor={palette.text} darkColor={palette.text}>{header.title}</ThemedText> : null}
      {header.subtitle ? <ThemedText style={styles.subtitle} lightColor={palette.textSecondary} darkColor={palette.textSecondary}>{header.subtitle}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheetFrame: { position: 'absolute' },
  sheet: { gap: 8 },
  content: { gap: 10 },
  fullBleedContent: { gap: 0, paddingBottom: 0, paddingHorizontal: 0, paddingTop: 0 },
  expanded: { flex: 1, minHeight: 0 },
  body: { minHeight: 0 },
  scroll: { minHeight: 0 },
  scrollContent: { gap: 10, paddingBottom: 6 },
  footer: { borderTopWidth: 1, gap: 8, paddingTop: 12 },
  grabber: { alignSelf: 'center', borderRadius: 999, height: 4, opacity: 0.48, width: 38 },
  close: { alignItems: 'center', borderRadius: 999, borderWidth: 1, height: 36, justifyContent: 'center', position: 'absolute', right: 11, top: 11, width: 36, zIndex: 5 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.96 }] },
  header: { gap: 2, paddingRight: 42 },
  step: { ...KatchaUI.type.label, opacity: 0.82 },
  eyebrow: KatchaUI.type.label,
  title: { ...KatchaUI.type.title, fontSize: 17 },
  parchmentTitle: { ...KatchaUI.type.display, fontSize: 25, lineHeight: 29 },
  strongTitle: { ...KatchaUI.type.title, fontSize: 22, lineHeight: 28 },
  subtitle: { ...KatchaUI.type.body, paddingTop: 2 },
});
