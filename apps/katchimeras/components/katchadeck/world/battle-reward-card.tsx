import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { FTUE_SCENE_LAYERS } from '@/constants/ftue-scene-layers';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { GLOW } from '@/constants/glow';
import { KatchaUI } from '@/constants/katcha-ui';

export type BattleReward = {
  key: string;
  /** Over the title: Victory by default (a Supply Run's crate says so). */
  eyebrow?: string;
  title: string;
  /** 1 to 3, from the battle's grade; 0 for a reward with no stars (a crate). */
  stars: number;
  glow: number;
  xp?: number;
  timber?: number;
};

/**
 * A won battle's card: the stars one by one, then what it paid. Continue hands the story (or the track) on; the Glow
 * counts into the counter as the card goes.
 */
export function BattleRewardCard({ reward, onContinue }: { reward: BattleReward; onContinue: () => void }) {
  const reduceMotion = useReducedMotion();
  const card = useSharedValue(0);
  useEffect(() => {
    card.value = withTiming(1, { duration: reduceMotion ? 120 : 420, easing: Easing.out(Easing.cubic) });
  }, [card, reduceMotion]);
  const cardStyle = useAnimatedStyle(() => ({ opacity: card.value, transform: [{ scale: 0.92 + card.value * 0.08 }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: card.value }));
  return <View style={[StyleSheet.absoluteFill, styles.layer]}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
    <View style={styles.center} pointerEvents="box-none">
      <Animated.View style={[styles.card, cardStyle]}>
        <Text style={styles.eyebrow}>{reward.eyebrow ?? 'Victory'}</Text>
        <Text style={styles.title}>{reward.title}</Text>
        {reward.stars > 0 ? <View style={styles.stars}>
          {[0, 1, 2].map((index) => <Star key={index} lit={index < reward.stars} delayMs={(reduceMotion ? 0 : 380) + index * (reduceMotion ? 0 : 220)} />)}
        </View> : null}
        <View style={styles.rewards}>
          <View style={styles.reward}>
            <Image source={GAME_CURRENCY_ART.coins} style={styles.rewardIcon} contentFit="contain" transition={0} />
            <Text style={styles.rewardValue}>+{reward.glow} {GLOW.name}</Text>
          </View>
          {reward.timber ? <View style={styles.reward}>
            <Image source={GAME_CURRENCY_ART.timber} style={styles.rewardIcon} contentFit="contain" transition={0} />
            <Text style={styles.rewardValue}>+{reward.timber} Timber</Text>
          </View> : null}
          {reward.xp ? <View style={styles.reward}><Text style={styles.rewardValue}>+{reward.xp} XP</Text></View> : null}
        </View>
        <KatchaButton fullWidth glow pill label="Continue" onPress={onContinue} />
      </Animated.View>
    </View>
  </View>;
}

function Star({ lit, delayMs }: { lit: boolean; delayMs: number }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withDelay(delayMs, withSpring(1, { damping: 8, stiffness: 180 }));
  }, [delayMs, shown]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 0.4 + shown.value * 0.6 }], opacity: 0.3 + shown.value * 0.7 }));
  return <Animated.Text style={[styles.star, lit ? styles.starLit : null, style]}>★</Animated.Text>;
}

const styles = StyleSheet.create({
  layer: { zIndex: FTUE_SCENE_LAYERS.hero + 6 },
  scrim: { backgroundColor: 'rgba(12,10,26,0.55)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  card: { width: '100%', maxWidth: 340, borderRadius: 26, padding: 22, gap: 12, alignItems: 'center', backgroundColor: '#1F1B36', borderWidth: 1, borderColor: 'rgba(255,231,168,0.4)' },
  eyebrow: { ...KatchaUI.type.label, color: '#FFE7A8' },
  title: { ...KatchaUI.type.display, fontSize: 28, lineHeight: 32, color: '#FFF8E6', textAlign: 'center' },
  stars: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 38, color: 'rgba(255,255,255,0.18)' },
  starLit: { color: '#FFD36B', textShadowColor: 'rgba(255,196,92,0.7)', textShadowRadius: 12 },
  rewards: { flexDirection: 'row', gap: 16, marginBottom: 6 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rewardIcon: { width: 26, height: 26 },
  rewardValue: { ...KatchaUI.type.title, color: '#FFF8E6' },
});
