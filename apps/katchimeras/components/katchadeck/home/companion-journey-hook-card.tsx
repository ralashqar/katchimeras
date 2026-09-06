import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies } from '@/constants/theme';
import type { MossproutJourneyHandoffViewModel } from '@/game/katchimeras/mossprout-journey-handoff';

export function CompanionJourneyHookCard({ model, onPress }: {
  model: MossproutJourneyHandoffViewModel;
  onPress: () => void;
}) {
  const ready = model.state === 'ready_to_begin';
  return (
    <Pressable
      accessibilityHint={ready ? 'Opens Mossprout so you can begin the next Journey Day' : 'Opens Mossprout and the Garden'}
      accessibilityLabel={`${model.title}. ${model.body}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, ready && styles.cardReady, pressed && styles.pressed]}>
      <View style={[styles.iconWell, ready && styles.iconWellReady]}>
        <IconSymbol color={ready ? '#FFF8D8' : '#537B3D'} name={ready ? 'sparkles' : 'leaf.fill'} size={19} />
      </View>
      <View style={styles.copy}>
        <ThemedText style={styles.eyebrow} lightColor="#607151" darkColor="#607151">{model.eyebrow}</ThemedText>
        <ThemedText style={styles.title} lightColor="#263721" darkColor="#263721">{model.title}</ThemedText>
        <ThemedText style={styles.body} lightColor="#52604C" darkColor="#52604C">{model.body}</ThemedText>
      </View>
      <IconSymbol color="#6E724F" name="chevron.right" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(247,242,211,0.96)',
    borderColor: 'rgba(103,126,75,0.28)',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    boxShadow: '0 6px 16px rgba(40,67,35,0.16), inset 0 1px 0 rgba(255,255,255,0.72)',
    flexDirection: 'row',
    gap: 10,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  cardReady: { borderColor: 'rgba(198,151,43,0.48)' },
  iconWell: {
    alignItems: 'center',
    backgroundColor: 'rgba(114,157,76,0.16)',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconWellReady: { backgroundColor: '#789947' },
  copy: { flex: 1, gap: 1, minWidth: 0 },
  eyebrow: { fontFamily: AppFontFamilies.manrope, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 16, fontWeight: '700', lineHeight: 19 },
  body: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '700', lineHeight: 14 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
