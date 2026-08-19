import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { COMPANION_MERGE_REQUEST_PALETTE, CompanionMergeRequestTray } from '@/components/katchadeck/world/companion-merge-request-tray';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';
import { MOSSPROUT_CHAPTER_ZERO_REQUESTS } from '@/utils/merge-world/chapter-zero-policy';

export function MossproutFtueStoryStage({ onOpenMerge }: { onOpenMerge: () => void }) {
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.stage}>
      <View style={styles.heading}>
        <View style={styles.mark}><IconSymbol color={KatchaUI.companionScenePanel.accentInk} name="leaf.fill" size={21} /></View>
        <View style={styles.copy}>
          <ThemedText selectable style={styles.eyebrow} lightColor={KatchaUI.companionScenePanel.accent} darkColor={KatchaUI.companionScenePanel.accent}>A LITTLE PLACE TO BEGIN</ThemedText>
          <ThemedText selectable style={styles.title} lightColor={KatchaUI.companionScenePanel.ink} darkColor={KatchaUI.companionScenePanel.ink}>Two things to grow</ThemedText>
        </View>
      </View>
      <ThemedText selectable style={styles.body} lightColor={KatchaUI.companionScenePanel.inkSoft} darkColor={KatchaUI.companionScenePanel.inkSoft}>
        Make these two items in the Wild Garden.
      </ThemedText>
      <CompanionMergeRequestTray
        accessibilityLabel="Mossprout's first two requests"
        eyebrow="GARDEN REQUESTS"
        palette={COMPANION_MERGE_REQUEST_PALETTE}
        requests={MOSSPROUT_CHAPTER_ZERO_REQUESTS.slice(0, 2).map((request) => ({
          id: request.id,
          badge: request.badge,
          title: request.title,
          description: request.description,
          definitionIds: [request.definitionId],
        }))}
      />
      <Pressable accessibilityRole="button" onPress={onOpenMerge} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <IconSymbol color={KatchaUI.companionScenePanel.accentInk} name="leaf.fill" size={19} />
        <ThemedText style={styles.primaryLabel} lightColor={KatchaUI.companionScenePanel.accentInk} darkColor={KatchaUI.companionScenePanel.accentInk}>Open the garden</ThemedText>
        <IconSymbol color={KatchaUI.companionScenePanel.accentInk} name="arrow.right" size={17} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { backgroundColor: KatchaUI.companionScenePanel.background, borderColor: KatchaUI.companionScenePanel.border, borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, boxShadow: KatchaUI.companionScenePanel.shadow, gap: 7, padding: 10 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  mark: { alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.accent, borderRadius: 14, height: 40, justifyContent: 'center', width: 40 },
  copy: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: -0.25, lineHeight: 22 },
  body: { fontSize: 12, lineHeight: 17 },
  primary: { alignItems: 'center', backgroundColor: KatchaUI.companionScenePanel.accent, borderCurve: 'continuous', borderRadius: 15, flexDirection: 'row', gap: 8, minHeight: 43, paddingHorizontal: 12 },
  primaryLabel: { flex: 1, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
