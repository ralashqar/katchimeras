import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type CollectibleCardProps = {
  name: string;
  trait: string;
  location: string;
  rarity: string;
  palette: [string, string];
  compact?: boolean;
};

export function CollectibleCard({
  name,
  trait,
  location,
  rarity,
  palette,
  compact = false,
}: CollectibleCardProps) {
  return (
    <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, compact ? styles.compactCard : null]}>
      <View style={styles.topRow}>
        <ThemedText style={styles.rarityText} lightColor="#fdf7ef" darkColor="#fdf7ef">
          {rarity}
        </ThemedText>
        <View style={styles.locationPill}>
          <ThemedText style={styles.locationText} lightColor="#fdf7ef" darkColor="#fdf7ef">
            {location}
          </ThemedText>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.orbitalHalo} />
        <View style={styles.avatarSilhouette}>
          <View style={styles.avatarVoid} />
        </View>
      </View>
      <View style={styles.footer}>
        <ThemedText type="subtitle" style={styles.cardTitle} lightColor="#fff8f0" darkColor="#fff8f0">
          {name}
        </ThemedText>
        <ThemedText style={styles.cardTrait} lightColor="#f5efe6" darkColor="#f5efe6">
          {trait}
        </ThemedText>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: 'continuous',
    borderRadius: 28,
    gap: 18,
    minHeight: 260,
    overflow: 'hidden',
    padding: 18,
    width: 228,
  },
  compactCard: {
    minHeight: 220,
    width: 196,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rarityText: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  locationPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '600',
  },
  body: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  orbitalHalo: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    height: 118,
    position: 'absolute',
    width: 118,
  },
  avatarSilhouette: {
    alignItems: 'center',
    backgroundColor: 'rgba(19, 15, 28, 0.66)',
    borderRadius: 80,
    height: 136,
    justifyContent: 'center',
    width: 104,
  },
  avatarVoid: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 28,
    height: 52,
    width: 40,
  },
  footer: {
    gap: 6,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 26,
  },
  cardTrait: {
    fontSize: 14,
    lineHeight: 20,
  },
});
