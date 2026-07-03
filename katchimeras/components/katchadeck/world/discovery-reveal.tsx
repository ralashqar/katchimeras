import { useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { DiscoveryDef, DiscoveryRarity } from '@/types/discoveries';
import { artefactForReward } from '@/utils/discoveries-artefacts';
import { discoveryEssence } from '@/utils/essence-engine';
import { Meadow } from '@/constants/meadow-theme';

// "Discovery Recorded" — the celebration when a NEW discovery unlocks (post-baseline).
// Tasteful, rarity-scaled, queue-safe (the host shows one at a time). Carries a
// shareable card (captured to an image, like the Day Card). Never "Achievement
// Unlocked". See docs/discoveries-system-design.md §8.

const RARITY_TINT: Record<DiscoveryRarity, string> = {
  common: '#9DB4C0',
  rare: '#92D7FF',
  epic: '#A78BFA',
  legendary: '#FFC36B',
};
const RARITY_LABEL: Record<DiscoveryRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

type DiscoveryRevealProps = {
  discovery: DiscoveryDef;
  onDismiss: () => void;
};

export function DiscoveryReveal({ discovery, onDismiss }: DiscoveryRevealProps) {
  const tint = RARITY_TINT[discovery.rarity];
  const isLegendary = discovery.rarity === 'legendary';
  const cardRef = useRef<View | null>(null);
  const [sharing, setSharing] = useState(false);

  const kicker = discovery.hidden ? '✨ New Discovery Found' : 'Discovery Recorded';
  const artefact = artefactForReward(discovery.worldRewardId);
  const essence = discoveryEssence(discovery);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    const message = [
      '✨ Discovery Recorded',
      discovery.name,
      discovery.description,
      artefact ? `${artefact.name} joined my world.` : null,
      'What discoveries will your world unlock?',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      let url: string | undefined;
      if (cardRef.current) {
        url = await captureRef(cardRef.current, { format: 'png', quality: 1, result: 'tmpfile' });
      }
      await Share.share(url ? { message, url } : { message });
    } catch {
      try {
        await Share.share({ message });
      } catch {
        // user cancelled / share unavailable — no-op
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={styles.backdrop}>
        <Pressable onPress={onDismiss} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View entering={ZoomIn.springify().damping(13).mass(0.9)} exiting={FadeOut.duration(180)} style={styles.center}>
        {/* The shareable card (captured for sharing). */}
        <View ref={cardRef} collapsable={false} style={[styles.card, { borderColor: `${tint}66` }]}>
          <View style={[styles.glow, { backgroundColor: tint, opacity: isLegendary ? 0.28 : 0.16 }]} />
          <ThemedText style={styles.kicker} lightColor={tint} darkColor={tint}>
            {kicker}
          </ThemedText>
          <ThemedText style={[styles.icon, isLegendary && styles.iconLegendary]}>{discovery.icon}</ThemedText>
          <ThemedText type="display" style={styles.name} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {discovery.name}
          </ThemedText>
          <ThemedText style={styles.description} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {discovery.description}
          </ThemedText>
          <View style={[styles.rarityChip, { borderColor: `${tint}66` }]}>
            <View style={[styles.rarityDot, { backgroundColor: tint }]} />
            <ThemedText style={styles.rarityLabel} lightColor={tint} darkColor={tint}>
              {RARITY_LABEL[discovery.rarity]}
            </ThemedText>
          </View>
          {artefact ? (
            <ThemedText style={styles.reward} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              {artefact.name} joined your world.
            </ThemedText>
          ) : null}
          <ThemedText style={styles.essence} lightColor={tint} darkColor={tint}>
            ✦ +{essence} Essence
          </ThemedText>
        </View>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={handleShare} style={[styles.shareBtn, { borderColor: `${tint}88` }]}>
            <ThemedText style={styles.shareLabel} lightColor={tint} darkColor={tint}>
              {sharing ? 'Sharing…' : 'Share'}
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.continueBtn}>
            <ThemedText style={styles.continueLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              Continue
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 40, zIndex: 60, alignItems: 'center', justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.66)' },
  center: { alignItems: 'center', gap: 16, paddingHorizontal: 28, width: '100%' },
  card: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: Meadow.overlay.sheetBg,
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
    gap: 8,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  glow: { position: 'absolute', top: -60, width: 220, height: 220, borderRadius: 999 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  icon: { fontSize: 64, lineHeight: 72 },
  iconLegendary: { fontSize: 80, lineHeight: 88 },
  name: { fontSize: 30, fontStyle: 'italic', lineHeight: 36, textAlign: 'center' },
  description: { fontSize: 14.5, fontWeight: '500', lineHeight: 20, textAlign: 'center' },
  rarityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(12,10,20,0.6)',
    marginTop: 2,
  },
  rarityDot: { width: 7, height: 7, borderRadius: 999 },
  rarityLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  reward: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  essence: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  shareBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  shareLabel: { fontSize: 14, fontWeight: '800' },
  continueBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  continueLabel: { fontSize: 14, fontWeight: '800' },
});
