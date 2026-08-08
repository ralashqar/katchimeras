import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WispCompanion } from '@/components/katchadeck/wisps/wisp-companion';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import { WISPS_BY_ID } from '@/constants/wisps';
import { useWisps } from '@/features/wisps/wisp-provider';
import { useAllDays } from '@/hooks/use-all-days';
import type { WispId } from '@/types/wisp';
import { resolveWispCandidates } from '@/utils/wisp-engine';

export default function WispDetailScreen() {
  const router = useRouter();
  const { wispId } = useLocalSearchParams<{ wispId: string }>();
  const definition = WISPS_BY_ID.get(wispId as WispId);
  const wisps = useWisps();
  const { days } = useAllDays();
  if (!definition) return null;
  const owned = wisps.isOwned(definition.id);
  const equipped = wisps.equippedWispId === definition.id;
  const progress = wisps.progressFor(definition.id, days);
  const matchingDays = days.filter((day, index) => resolveWispCandidates(day, days.slice(0, index)).some((item) => item.wispId === definition.id));
  const unlock = wisps.state.unlocked[definition.id];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <IconSymbol color={Meadow.ink} name="chevron.left" size={22} />
        </Pressable>
        <View style={styles.hero}>
          <View style={styles.glow} />
          <WispCompanion id={definition.id} size={190} />
        </View>
        <ThemedText style={styles.eyebrow} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>{definition.rarity.toUpperCase()} WISP</ThemedText>
        <ThemedText style={styles.title} lightColor={Meadow.ink} darkColor={Meadow.ink}>{owned || !definition.hidden ? definition.name : '???'}</ThemedText>
        <ThemedText style={styles.subtitle} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{owned ? definition.subtitle : definition.hidden ? 'Its story is still hidden.' : definition.description}</ThemedText>

        <View style={styles.progressCard}>
          <View style={styles.progressHeading}>
            <ThemedText style={styles.cardLabel} lightColor={Meadow.inkFaint} darkColor={Meadow.inkFaint}>{owned ? 'DISCOVERED' : 'DISCOVERY PROGRESS'}</ThemedText>
            <ThemedText style={styles.progressNumber} lightColor={Meadow.ink} darkColor={Meadow.ink}>{owned ? 'Complete' : `${progress.current} / ${progress.target}`}</ThemedText>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, progress.current / progress.target * 100)}%` }]} /></View>
          <ThemedText style={styles.rule} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>{owned ? definition.description : `Keep going: ${progress.unit}.`}</ThemedText>
        </View>

        {owned ? <Pressable accessibilityRole="button" onPress={() => wisps.equip(equipped ? null : definition.id)} style={({ pressed }) => [styles.equip, pressed && styles.pressed]}>
          <ThemedText style={styles.equipText} lightColor="#FFF8E7" darkColor="#FFF8E7">{equipped ? 'Let it rest' : 'Equip Wisp'}</ThemedText>
        </Pressable> : null}

        <View style={styles.history}>
          <ThemedText style={styles.sectionTitle} lightColor={Meadow.ink} darkColor={Meadow.ink}>Your history</ThemedText>
          <ThemedText style={styles.historyNumber} lightColor={Meadow.ink} darkColor={Meadow.ink}>{matchingDays.length}</ThemedText>
          <ThemedText style={styles.historyLabel} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>days together</ThemedText>
          {unlock ? <ThemedText style={styles.firstLine} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>First discovered {new Date(unlock.unlockedAt).toLocaleDateString()}</ThemedText> : null}
          {matchingDays[0] ? <ThemedText style={styles.firstLine} lightColor={Meadow.inkSoft} darkColor={Meadow.inkSoft}>First memory: {matchingDays[0].dayName ?? matchingDays[0].dateLabel}</ThemedText> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: '#F5E7CB', flex: 1 },
  content: { alignItems: 'center', paddingBottom: 48, paddingHorizontal: 22 },
  back: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,248,231,0.78)', borderRadius: 16, height: 42, justifyContent: 'center', marginTop: 4, width: 42 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  hero: { alignItems: 'center', height: 230, justifyContent: 'center', marginTop: 4, width: '100%' },
  glow: { backgroundColor: 'rgba(255,220,135,0.34)', borderRadius: 100, height: 155, position: 'absolute', width: 155 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { fontFamily: 'InstrumentSerif', fontSize: 48, lineHeight: 52, marginTop: 3 },
  subtitle: { fontSize: 15, lineHeight: 22, maxWidth: 320, textAlign: 'center' },
  progressCard: { backgroundColor: 'rgba(255,247,228,0.78)', borderCurve: 'continuous', borderRadius: 24, marginTop: 26, padding: 18, width: '100%' },
  progressHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2 },
  progressNumber: { fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '900' },
  track: { backgroundColor: 'rgba(104,80,50,0.14)', borderRadius: 99, height: 8, marginTop: 12, overflow: 'hidden' },
  fill: { backgroundColor: '#8EA06A', borderRadius: 99, height: '100%' },
  rule: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  equip: { alignItems: 'center', backgroundColor: '#5D6F43', borderCurve: 'continuous', borderRadius: 18, marginTop: 14, paddingVertical: 14, width: '100%' },
  equipText: { fontSize: 14, fontWeight: '900' },
  history: { alignItems: 'center', marginTop: 30, width: '100%' },
  sectionTitle: { alignSelf: 'flex-start', fontFamily: 'InstrumentSerif', fontSize: 28 },
  historyNumber: { fontFamily: 'InstrumentSerif', fontSize: 52, marginTop: 10 },
  historyLabel: { fontSize: 13, fontWeight: '700' },
  firstLine: { fontSize: 13, marginTop: 8 },
});
