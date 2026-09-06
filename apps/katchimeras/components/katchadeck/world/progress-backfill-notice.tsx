import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KatchaUI } from '@/constants/katcha-ui';

export function ProgressBackfillNotice({
  achievementCount,
  discoveryCount,
  onDismiss,
}: {
  achievementCount: number;
  discoveryCount: number;
  onDismiss: () => void;
}) {
  const parts = [
    achievementCount ? `${achievementCount} companion ${achievementCount === 1 ? 'achievement' : 'achievements'}` : null,
    discoveryCount ? `${discoveryCount} global ${discoveryCount === 1 ? 'discovery' : 'discoveries'}` : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <Animated.View accessibilityLiveRegion="polite" entering={FadeInDown.duration(260)} exiting={FadeOut.duration(160)} style={styles.wrap}>
      <View style={styles.icon}><IconSymbol color="#7B541F" name="trophy.fill" size={21} weight="bold" /></View>
      <View style={styles.copy}>
        <ThemedText selectable style={styles.title} lightColor="#382719" darkColor="#382719">Your history found its shelves</ThemedText>
        <ThemedText selectable style={styles.body} lightColor="#654D35" darkColor="#654D35">{parts.join(' and ')} were credited quietly from days you already lived.</ThemedText>
      </View>
      <Pressable accessibilityLabel="Dismiss progress summary" accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
        <IconSymbol color="#6E573D" name="xmark" size={17} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', backgroundColor: '#E9D3AB', borderColor: 'rgba(255,247,220,0.78)', borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, bottom: 112, boxShadow: '0 14px 32px rgba(31,21,12,0.34), inset 0 1px 0 rgba(255,255,255,0.72)', flexDirection: 'row', gap: 10, left: 14, padding: 12, position: 'absolute', right: 14, zIndex: 75 },
  icon: { alignItems: 'center', backgroundColor: 'rgba(169,115,40,0.18)', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  copy: { flex: 1, gap: 2 },
  title: { ...KatchaUI.type.title, fontSize: 13.5, lineHeight: 18 },
  body: { ...KatchaUI.type.body, fontSize: 10.5, lineHeight: 14 },
  close: { alignItems: 'center', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
