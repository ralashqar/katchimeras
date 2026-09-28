import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MERGE_WORLD_GENERATOR_ART } from '@/constants/merge-world-art';
import { COMBAT_CHAIN_DESCRIPTIONS, COMBAT_CHAIN_NAMES, SECONDARY_CHAINS, type SecondaryGenerator } from '@/features/mission-mechanics/combat-rules';
import { unlockedCombatGenerators } from '@/features/encounter/combat-loadout';
import type { BattleSession } from '@/features/encounter/battle-session';
import { useGameSurfaceReadiness } from '@/features/navigation/game-screen-transition';

export function CombatPreparation({ session, onStart, onBack }: { session: BattleSession; onStart: (generator: SecondaryGenerator, reward: 'timber' | 'glow') => void; onBack: () => void }) {
  const mechanic = session.encounter.mechanic;
  const loan = mechanic?.kind === 'lanes' ? mechanic.secondary?.generatorId : undefined;
  const [selected, setSelected] = useState<SecondaryGenerator>(session.loadout.secondaryGenerator ?? loan ?? 'storm-pot');
  const insets = useSafeAreaInsets();
  const [reward, setReward] = useState<'timber' | 'glow'>('timber');
  const [laidOut, setLaidOut] = useState(false);
  useGameSurfaceReadiness('battle', { data: true, layout: laidOut, foreground: laidOut, background: laidOut, interaction_target: laidOut, route: true }, true);
  const choices = unlockedCombatGenerators(session.world.chaptersClaimed, loan);
  return <ScrollView onLayout={() => setLaidOut(true)} style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
    <Pressable onPress={onBack} accessibilityRole="button" style={styles.back}><Text style={styles.copy}>‹ Return to sanctuary</Text></Pressable>
    <Text style={styles.title}>Prepare your garden</Text>
    <Text style={styles.copy}>{session.source.kind === 'island' ? session.source.context.mission.objective : 'Protect the sanctuary.'}</Text>
    <Text style={styles.hint}>Three sanctuary hearts · Merge between waves · One Garden sprinkler + one support generator</Text>
    <Text style={styles.label}>Choose your support</Text>
    {choices.map((generator) => {
      const chain = SECONDARY_CHAINS[generator];
      return <Pressable key={generator} accessibilityRole="radio" accessibilityState={{ checked: selected === generator }} onPress={() => setSelected(generator)} style={[styles.choice, selected === generator && styles.selected]}>
        <Image source={MERGE_WORLD_GENERATOR_ART[generator]} style={styles.art} contentFit="contain" />
        <View style={styles.words}><Text style={styles.name}>{COMBAT_CHAIN_NAMES[chain]}{generator === loan ? ' · suggested' : ''}</Text><Text style={styles.copy}>{COMBAT_CHAIN_DESCRIPTIONS[chain]}</Text></View>
      </Pressable>;
    })}
    <Text style={styles.hint}>Recommended hero level {session.encounter.recommendedLevel ?? 1} · Your lead: level {session.loadout.level}</Text>
    <Text style={styles.hint}>{Math.round(((session.loadout.combatProfile?.damageMultiplier ?? 1) - 1) * 100)}% extra attack from training. Upgrade the Nursery for better seeds, the Cellar for shields, the Dew Spring for healing, and the Bloom House for faster support.</Text>
    {session.encounter.id.startsWith('frontier:') ? <View style={{ gap: 8 }}><Text style={styles.label}>First-clear salvage</Text>{(['timber', 'glow'] as const).map((kind) => <Pressable key={kind} accessibilityRole="radio" accessibilityState={{ checked: reward === kind }} onPress={() => setReward(kind)} style={[styles.choice, reward === kind && styles.selected]}><Text style={styles.copy}>{kind === 'timber' ? 'Gather 4 extra Timber for buildings' : 'Gather 18 extra Glow for training'}</Text></Pressable>)}</View> : null}
    <Pressable accessibilityRole="button" onPress={() => onStart(selected, reward)} style={styles.start}><Text style={styles.startText}>Defend the sanctuary</Text></Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#203C36' }, content: { paddingHorizontal: 24, gap: 16 }, back: { minHeight: 44, justifyContent: 'center' },
  title: { fontSize: 30, fontWeight: '800', color: '#F6E9C8' }, copy: { color: '#E7EFE4', fontSize: 15, lineHeight: 22 },
  hint: { color: '#BECFC0', fontSize: 13, lineHeight: 20 }, label: { color: '#F6E9C8', fontSize: 19, fontWeight: '700', marginTop: 8 },
  choice: { borderWidth: 2, borderColor: '#50675A', borderRadius: 18, padding: 10, flexDirection: 'row', alignItems: 'center', minHeight: 94 },
  selected: { borderColor: '#E4C77C', backgroundColor: '#355448' }, art: { width: 70, height: 70 }, words: { flex: 1, gap: 3 }, name: { color: '#F6E9C8', fontSize: 18, fontWeight: '700' },
  start: { backgroundColor: '#E4C77C', borderRadius: 18, minHeight: 54, alignItems: 'center', justifyContent: 'center' }, startText: { color: '#203C36', fontSize: 17, fontWeight: '800' },
});
