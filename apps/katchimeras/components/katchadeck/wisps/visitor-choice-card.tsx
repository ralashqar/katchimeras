import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Meadow } from '@/constants/meadow-theme';
import { wispDefinition } from '@/constants/wisps';
import { useEconomy } from '@/features/economy/economy-provider';
import type { WispId } from '@/types/wisp';

import { WispArtwork } from './wisp-artwork';

export function VisitorChoiceCard() {
  const economy = useEconomy();
  const offer = economy.snapshot.visitorOffer;
  const [choosing, setChoosing] = useState<WispId | null>(null);
  if (!economy.config.flags.visitorChoice || !offer || !offer.choices.length) return null;
  return (
    <View accessibilityLabel="A Wisp visitor choice is ready" style={styles.root}>
      <View style={styles.copy}>
        <ThemedText selectable style={styles.eyebrow} lightColor={Meadow.goldDeep} darkColor={Meadow.goldDeep}>A VISITOR FOUND YOU</ThemedText>
        <ThemedText selectable numberOfLines={1} style={styles.title} lightColor={Meadow.ink} darkColor={Meadow.ink}>Choose one to stay</ThemedText>
      </View>
      <View style={styles.choices}>
        {offer.choices.map((id) => (
          <Pressable accessibilityLabel={`Choose ${wispDefinition(id).name}`} accessibilityRole="button" disabled={choosing !== null} key={id} onPress={async () => {
            if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
            setChoosing(id);
            await economy.chooseVisitor(id);
            setChoosing(null);
          }} style={({ pressed }) => [styles.choice, choosing === id && styles.choosing, pressed && styles.pressed]}>
            <WispArtwork id={id} size={43} thumbnail />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', backgroundColor: 'rgba(255,247,226,0.9)', borderColor: 'rgba(125,83,43,0.16)', borderCurve: 'continuous', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 8, marginHorizontal: 14, minHeight: 62, paddingHorizontal: 10, paddingVertical: 6 },
  copy: { flex: 1, gap: 1 },
  eyebrow: { fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8 },
  title: { fontSize: 12, fontWeight: '900' },
  choices: { flexDirection: 'row', gap: 4 },
  choice: { alignItems: 'center', backgroundColor: 'rgba(224,203,170,0.58)', borderRadius: 12, height: 48, justifyContent: 'center', width: 48 },
  choosing: { opacity: 0.55 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
});
