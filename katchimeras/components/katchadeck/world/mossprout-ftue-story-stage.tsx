import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { CompanionMergeRequestTray } from '@/components/katchadeck/world/companion-merge-request-tray';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MOSSPROUT_CHAPTER_ZERO_REQUESTS } from '@/utils/merge-world/chapter-zero-policy';

const palette = {
  trayBackground: 'rgba(255,255,255,0.54)',
  trayBorder: 'rgba(78,105,46,0.22)',
  rowBackground: '#F8F7E5',
  eyebrow: '#617A39',
  count: '#52643B',
  title: '#29341F',
  description: '#5F684F',
  item: '#58713B',
  badgeBackground: '#6E8B43',
  badgeText: '#FFFBEF',
} as const;

export function MossproutFtueStoryStage({ onOpenMerge }: { onOpenMerge: () => void }) {
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.stage}>
      <View style={styles.heading}>
        <View style={styles.mark}><IconSymbol color="#FFFBEF" name="leaf.fill" size={21} /></View>
        <View style={styles.copy}>
          <ThemedText selectable style={styles.eyebrow} lightColor="#617A39" darkColor="#617A39">A LITTLE PLACE TO BEGIN</ThemedText>
          <ThemedText selectable style={styles.title} lightColor="#29341F" darkColor="#29341F">Two things to grow</ThemedText>
        </View>
      </View>
      <ThemedText selectable style={styles.body} lightColor="#5F684F" darkColor="#5F684F">
        Start with what we have. Then use the Wild Garden to grow something taller.
      </ThemedText>
      <CompanionMergeRequestTray
        accessibilityLabel="Mossprout's first two requests"
        eyebrow="GARDEN REQUESTS"
        palette={palette}
        requests={MOSSPROUT_CHAPTER_ZERO_REQUESTS.map((request) => ({
          id: request.id,
          badge: request.badge,
          title: request.title,
          description: request.description,
          definitionIds: [request.definitionId],
        }))}
      />
      <Pressable accessibilityRole="button" onPress={onOpenMerge} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <IconSymbol color="#FFFBEF" name="leaf.fill" size={19} />
        <ThemedText style={styles.primaryLabel} lightColor="#FFFBEF" darkColor="#FFFBEF">Open the garden</ThemedText>
        <IconSymbol color="#FFFBEF" name="arrow.right" size={17} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { backgroundColor: '#F2F1D9', borderColor: 'rgba(78,105,46,0.28)', borderCurve: 'continuous', borderRadius: 28, borderWidth: 1, boxShadow: '0 12px 28px rgba(48,68,31,0.16)', gap: 14, padding: 18 },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  mark: { alignItems: 'center', backgroundColor: '#6E8B43', borderRadius: 18, height: 48, justifyContent: 'center', width: 48 },
  copy: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 21, fontWeight: '900', letterSpacing: -0.35, lineHeight: 25 },
  body: { fontSize: 13.5, lineHeight: 20 },
  primary: { alignItems: 'center', backgroundColor: '#5E7838', borderCurve: 'continuous', borderRadius: 19, flexDirection: 'row', gap: 10, minHeight: 54, paddingHorizontal: 15 },
  primaryLabel: { flex: 1, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
