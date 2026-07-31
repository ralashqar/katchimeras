import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TodaySceneBackdrop } from '@/components/katchadeck/home/today-scene-backdrop';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchimeraBackButton } from '@/components/katchadeck/ui/katchimera-back-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { StatusBadge, type StatusTone } from '@/components/katchadeck/ui/status-badge';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import type { KatchaSurface } from '@/constants/katcha-ui';
import type { TodayAtmosphereBackground } from '@/utils/day-background-scene';

export function CompanionSheetShell({
  children,
  background,
  fullBleed = false,
  keyboardAvoiding = true,
  onRequestClose,
  portal = true,
  showClose = true,
  surface = 'parchment',
}: {
  children: ReactNode;
  background?: TodayAtmosphereBackground;
  fullBleed?: boolean;
  keyboardAvoiding?: boolean;
  onRequestClose: () => void;
  portal?: boolean;
  showClose?: boolean;
  surface?: KatchaSurface;
}) {
  return (
    <KatchaSheet
      fullBleed={fullBleed}
      onRequestClose={onRequestClose}
      portal={portal}
      showClose={showClose}
      size={fullBleed ? 'full' : 'tall'}
      surface={surface}>
      <View style={styles.shellFrame}>
        {background ? <TodaySceneBackdrop background={background} scene={null} variant="splash" /> : null}
        <KeyboardAvoidingView
          behavior={keyboardAvoiding && process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
          style={styles.shell}>
          {children}
        </KeyboardAvoidingView>
      </View>
    </KatchaSheet>
  );
}

export function CompanionDestinationHeader({
  backLabel = 'Home',
  label,
  onBack,
}: {
  backLabel?: string;
  label: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.destinationHeader, { paddingTop: insets.top + 10 }]}>
      <CompanionBackAction label={backLabel} onPress={onBack} tone="night" />
      <View style={styles.destinationHeading}>
        <ThemedText
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.3}
          minimumFontScale={0.82}
          numberOfLines={1}
          selectable
          style={styles.destinationTitle}
          lightColor="#FFF9EA"
          darkColor="#FFF9EA">
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

export function CompanionDestinationSurface({
  children,
  immersive = false,
}: {
  children: ReactNode;
  immersive?: boolean;
}) {
  return (
    <View style={[styles.destinationSurface, immersive && styles.destinationSurfaceImmersive]}>
      {children}
    </View>
  );
}

export function CompanionPrimaryAction({
  disabled = false,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon: IconSymbolName;
  label: string;
  onPress: () => void;
}) {
  return (
    <KatchaButton
      disabled={disabled}
      fullWidth
      icon={icon}
      label={label}
      onPress={onPress}
      variant="primary"
    />
  );
}

export function CompanionSecondaryAction({
  destructive = false,
  icon,
  label,
  onPress,
}: {
  destructive?: boolean;
  icon?: IconSymbolName;
  label: string;
  onPress: () => void;
}) {
  return (
    <KatchaButton
      icon={icon}
      label={label}
      onPress={onPress}
      size="compact"
      variant={destructive ? 'destructive' : 'secondary'}
    />
  );
}

export function CompanionSection({
  children,
  description,
  label,
  style,
}: {
  children: ReactNode;
  description?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens } = useKatchaSurface();
  return (
    <View style={[styles.section, style]}>
      {label || description ? (
        <View style={styles.sectionHeading}>
          {label ? (
            <ThemedText style={styles.sectionLabel} lightColor={tokens.textTertiary} darkColor={tokens.textTertiary}>
              {label}
            </ThemedText>
          ) : null}
          {description ? (
            <ThemedText selectable style={styles.sectionDescription} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>
              {description}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function CompanionCard({
  children,
  selected = false,
  style,
}: {
  children: ReactNode;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens } = useKatchaSurface();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: selected ? `${tokens.accent}24` : tokens.subtle,
          borderColor: selected ? tokens.accentPressed : tokens.border,
          boxShadow: tokens.cardShadow,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function CompanionStatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return <StatusBadge label={label} tone={tone} warm />;
}

export function CompanionResultNotice({
  body,
  tasks,
  title,
}: {
  body?: string;
  tasks: readonly string[];
  title?: string;
}) {
  const reduceMotion = useReducedMotion();
  const { tokens } = useKatchaSurface();
  const hasTasks = tasks.length > 0;

  useEffect(() => {
    if (hasTasks && process.env.EXPO_OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [hasTasks]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      entering={reduceMotion ? undefined : FadeInUp.duration(KatchaUI.motion.contentIn)}
      style={[
        styles.resultNotice,
        {
          backgroundColor: tokens.elevated,
          borderColor: tokens.border,
          boxShadow: tokens.cardShadow,
        },
      ]}>
      <View style={[styles.resultMark, { backgroundColor: hasTasks ? tokens.success : tokens.subtle }]}>
        <IconSymbol
          color={hasTasks ? tokens.accentText : tokens.textSecondary}
          name="checkmark"
          size={18}
        />
      </View>
      <View style={styles.resultCopy}>
        <ThemedText style={styles.resultEyebrow} lightColor={hasTasks ? tokens.success : tokens.textTertiary} darkColor={hasTasks ? tokens.success : tokens.textTertiary}>
          {hasTasks ? 'Added to Today' : 'Check-in saved'}
        </ThemedText>
        <ThemedText selectable style={styles.resultTitle} lightColor={tokens.text} darkColor={tokens.text}>
          {title ?? (hasTasks
            ? `${tasks.length} small ${tasks.length === 1 ? 'task' : 'tasks'} added`
            : 'Your answers are saved')}
        </ThemedText>
        <ThemedText selectable style={styles.resultBody} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>
          {body ?? (hasTasks
            ? 'Chosen from your answers. Keep what helps today.'
            : 'They will shape future questions and reflections.')}
        </ThemedText>
        {tasks.length ? (
          <View style={[styles.resultTaskList, { borderTopColor: tokens.border }]}>
            {tasks.map((task, index) => (
              <View
                key={`${index}:${task}`}
                style={[
                  styles.resultTask,
                  index > 0 && {
                    borderTopColor: tokens.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                ]}>
                <View style={[styles.resultTaskMark, { backgroundColor: `${tokens.success}18` }]}>
                  <IconSymbol color={tokens.success} name="checkmark" size={12} />
                </View>
                <ThemedText selectable style={styles.resultTaskLabel} lightColor={tokens.text} darkColor={tokens.text}>
                  {task}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function CompanionBackAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
  tone?: 'night' | 'parchment';
}) {
  return <KatchimeraBackButton accessibilityLabel={label} onPress={onPress} />;
}

const styles = StyleSheet.create({
  shellFrame: { flex: 1, minHeight: 0, position: 'relative' },
  shell: { flex: 1, gap: KatchaUI.spacing.xs, minHeight: 0 },
  destinationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: KatchaUI.spacing.sm,
    paddingBottom: KatchaUI.spacing.sm,
    paddingHorizontal: KatchaUI.layout.phoneGutter,
    position: 'relative',
    zIndex: 4,
  },
  destinationHeading: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'center',
    minHeight: KatchaUI.touchTarget,
    minWidth: 0,
  },
  destinationTitle: {
    ...KatchaUI.type.companionPageTitle,
    fontSize: 25,
    lineHeight: 30,
    paddingRight: 2,
    textAlign: 'right',
    textShadowColor: 'rgba(23,40,49,0.65)',
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 3,
  },
  destinationSurface: {
    backgroundColor: 'transparent',
    flex: 1,
    minHeight: 0,
    paddingHorizontal: KatchaUI.layout.phoneGutter,
    position: 'relative',
    zIndex: 3,
  },
  destinationSurfaceImmersive: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    boxShadow: 'none',
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  section: { gap: KatchaUI.spacing.sm },
  sectionHeading: { gap: KatchaUI.spacing.xxs },
  sectionLabel: { ...KatchaUI.type.label },
  sectionDescription: { ...KatchaUI.type.companionBody },
  card: {
    borderCurve: 'continuous',
    borderRadius: KatchaUI.radius.card,
    borderWidth: 1,
    gap: KatchaUI.spacing.sm,
    padding: KatchaUI.spacing.md,
  },
  resultNotice: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: KatchaUI.radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: KatchaUI.spacing.sm,
    paddingHorizontal: KatchaUI.spacing.md,
    paddingVertical: KatchaUI.spacing.sm,
  },
  resultMark: {
    alignItems: 'center',
    borderRadius: KatchaUI.radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  resultCopy: { flex: 1, gap: 2 },
  resultEyebrow: { ...KatchaUI.type.label, fontSize: 9.5 },
  resultTitle: { ...KatchaUI.type.sectionTitle, fontSize: 17, lineHeight: 22 },
  resultBody: { ...KatchaUI.type.companionBody, fontSize: 12, lineHeight: 17 },
  resultTaskList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: KatchaUI.spacing.xs,
    paddingTop: KatchaUI.spacing.xxs,
  },
  resultTask: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: KatchaUI.spacing.xs,
    minHeight: 38,
    paddingVertical: 7,
  },
  resultTaskMark: {
    alignItems: 'center',
    borderRadius: KatchaUI.radius.pill,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  resultTaskLabel: {
    ...KatchaUI.type.companionAction,
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
