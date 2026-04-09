import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressMotion } from '@/components/katchadeck/motion';
import { ThemedText } from '@/components/themed-text';
import { Fonts, KatchaDeckUI } from '@/constants/theme';

type CollectibleCardProps = {
  name: string;
  trait: string;
  location: string;
  rarity: string;
  palette: [string, string];
  compact?: boolean;
  interactive?: boolean;
};

export function CollectibleCard({
  name,
  trait,
  location,
  rarity,
  palette,
  compact = false,
  interactive = true,
}: CollectibleCardProps) {
  const press = usePressMotion();

  const content = (
    <Animated.View style={interactive ? press.animatedStyle : null}>
      <LinearGradient
        colors={[...palette]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.card, compact ? styles.compactCard : null]}>
        <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.02)']} style={styles.sheen} />
        <View style={styles.topRow}>
          <ThemedText type="label" style={styles.rarityText} lightColor="#fdf7ef" darkColor="#fdf7ef">
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
            <View style={styles.avatarVoid}>
              <View style={styles.avatarGlimmer} />
            </View>
          </View>
        </View>
        <View style={styles.footer}>
          <ThemedText type="display" style={styles.cardTitle} lightColor="#fff8f0" darkColor="#fff8f0">
            {name}
          </ThemedText>
          <ThemedText style={styles.cardTrait} lightColor="#f5efe6" darkColor="#f5efe6">
            {trait}
          </ThemedText>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  if (!interactive) {
    return content;
  }

  return (
    <Pressable onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: 'rgba(255,255,255,0.18)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: KatchaDeckUI.shadows.card,
    gap: 18,
    minHeight: 274,
    overflow: 'hidden',
    padding: 18,
    width: 236,
  },
  compactCard: {
    minHeight: 232,
    width: 164,
  },
  sheen: {
    borderRadius: 28,
    height: '48%',
    left: '8%',
    opacity: 0.54,
    position: 'absolute',
    top: '6%',
    width: '38%',
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rarityText: {
    fontSize: 11,
  },
  locationPill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationText: {
    ...KatchaDeckUI.typography.pill,
    color: '#FDF7EF',
    fontFamily: Fonts.sans,
  },
  body: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  orbitalHalo: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    height: 122,
    position: 'absolute',
    width: 122,
  },
  avatarSilhouette: {
    alignItems: 'center',
    backgroundColor: 'rgba(12, 15, 24, 0.64)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 80,
    borderWidth: 1,
    height: 140,
    justifyContent: 'center',
    width: 110,
  },
  avatarVoid: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 28,
    height: 54,
    justifyContent: 'center',
    width: 42,
  },
  avatarGlimmer: {
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderRadius: 999,
    height: 6,
    width: 18,
  },
  footer: {
    gap: 6,
  },
  cardTitle: {
    fontSize: 28,
    lineHeight: 28,
  },
  cardTrait: {
    fontSize: 14,
    lineHeight: 21,
  },
});
