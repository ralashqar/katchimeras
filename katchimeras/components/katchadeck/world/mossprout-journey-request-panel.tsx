import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';

import {
  COMPANION_MERGE_REQUEST_PALETTE,
  CompanionMergeRequestTray,
  type CompanionMergeRequest,
} from './companion-merge-request-tray';

export function MossproutJourneyRequestPanel({
  actionLabel = 'Go to the Garden',
  animateEntrance = true,
  disabled = false,
  onAction,
  requests,
  standalone = false,
  title,
}: {
  actionLabel?: string;
  animateEntrance?: boolean;
  disabled?: boolean;
  onAction?: () => void;
  requests: readonly CompanionMergeRequest[];
  standalone?: boolean;
  title: string;
}) {
  return (
    <Animated.View
      accessibilityLabel={`${title}. Garden requests`}
      entering={animateEntrance ? FadeInUp.duration(220) : undefined}
      style={[styles.content, standalone && styles.standalone]}>
      <View style={styles.heading}>
        <View style={styles.mark}>
          <IconSymbol color={KatchaUI.companionScenePanel.accentInk} name="leaf.fill" size={19} />
        </View>
        <View style={styles.headingCopy}>
          <ThemedText selectable style={styles.eyebrow} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>TODAY’S JOURNEY</ThemedText>
          <ThemedText selectable numberOfLines={2} style={styles.title} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>{title}</ThemedText>
        </View>
      </View>
      <CompanionMergeRequestTray
        accessibilityLabel={`${title}. Garden requests`}
        eyebrow="GARDEN REQUESTS"
        palette={COMPANION_MERGE_REQUEST_PALETTE}
        requests={requests}
      />
      {onAction ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onAction}
          style={({ pressed }) => [styles.action, disabled && styles.actionDisabled, pressed && !disabled && styles.actionPressed]}>
          <ThemedText selectable style={styles.actionLabel} lightColor={KatchaUI.companionScenePanel.accentInk} darkColor={KatchaUI.companionScenePanel.accentInk}>{actionLabel}</ThemedText>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 9 },
  standalone: {
    backgroundColor: KatchaUI.companionScenePanel.background,
    borderColor: KatchaUI.companionScenePanel.border,
    borderCurve: 'continuous',
    borderRadius: 26,
    borderWidth: 1,
    boxShadow: KatchaUI.companionScenePanel.shadow,
    flex: 1,
    overflow: 'hidden',
    padding: 12,
  },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  mark: { alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.accent, borderRadius: 13, height: 38, justifyContent: 'center', width: 38 },
  headingCopy: { flex: 1, gap: 1 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 17, fontWeight: '900', lineHeight: 21 },
  action: { alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.accent, borderCurve: 'continuous', borderRadius: 17, justifyContent: 'center', minHeight: 52, paddingHorizontal: 16 },
  actionDisabled: { opacity: 0.42 },
  actionPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  actionLabel: { fontSize: 15, fontWeight: '900' },
});
