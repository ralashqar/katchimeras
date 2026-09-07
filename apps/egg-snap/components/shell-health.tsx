import {useEffect, useSyncExternalStore} from 'react';
import {StyleSheet, View} from 'react-native';
import {Image} from 'expo-image';
import {LinearGradient} from 'expo-linear-gradient';
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import type {CombatPresentation} from '../game/combat-presentation';
import {Copy} from './ui';

const HEART = require('@incubator/art-merge-world/ui/bond.webp');

/** Subscribes to collision HP only; the battle tree does not repaint for bar animation. */
export function ShellHealth({presentation, max, compact, reduced, side = 'player', name = 'Your Shell'}: {
  presentation: CombatPresentation; max: number; compact: boolean; reduced: boolean;
  side?: 'player' | 'opponent'; name?: string;
}) {
  const rival = side === 'opponent';
  const hp = useSyncExternalStore(presentation.subscribe, rival ? presentation.opponentHp : presentation.playerHp);
  const hpLabel = `${hp} / ${max}`;
  const barHeight = compact ? 24 : 26;
  const fraction = useSharedValue(Math.max(0, Math.min(1, hp / max)));
  useEffect(() => {fraction.value = withTiming(Math.max(0, Math.min(1, hp / max)), {duration: reduced ? 0 : 180});}, [hp, max, reduced, fraction]);
  const fill = useAnimatedStyle(() => ({width: `${fraction.value * 100}%` as `${number}%`}));
  return <View accessible accessibilityLabel={`${name}, health ${hp} of ${max}`} pointerEvents="none"
    style={{height: rival ? (compact ? 56 : 64) : compact ? 36 : 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#F1DFC0', overflow: 'hidden', boxShadow: '0px 2px 6px #07160E55'}}>
    <LinearGradient colors={['#345D42', '#13382B']} style={StyleSheet.absoluteFill} />
    {rival && <Copy numberOfLines={1} style={{fontFamily: 'EggDisplay', color: '#FFF1CE', textAlign: 'center',
      fontSize: compact ? 18 : 20, lineHeight: compact ? 22 : 26, includeFontPadding: false,
      paddingHorizontal: 14, marginTop: 3}}>{name}</Copy>}
    <View style={{flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: rival ? 4 : 0, gap: 7}}>
      {!rival && <Copy style={{fontFamily: 'EggDisplay', fontSize: compact ? 14 : 16, color: '#FFF1CE', paddingVertical: 3}}>{name}</Copy>}
      <Image source={HEART} contentFit="contain" transition={0} style={{width: compact ? 20 : 23, height: compact ? 20 : 23}} />
      <View style={{flex: 1, height: barHeight, borderRadius: 13, backgroundColor: '#061F1FCC', borderWidth: 1, borderColor: '#AFD7A344', overflow: 'hidden'}}>
          <Animated.View style={[{height: '100%', borderRadius: 12, overflow: 'hidden'}, fill]}>
            <LinearGradient colors={rival ? ['#FFE49A', '#F2BB3E'] : hp / max <= .2 ? ['#FFD58C', '#E7A44C'] : ['#CAFF94', '#78D64F']} style={StyleSheet.absoluteFill} />
          </Animated.View>
          {/* Explicit full-width line box avoids native auto-fit shrinking to a tiny baseline. */}
          <Copy numberOfLines={1} allowFontScaling={false} style={[StyleSheet.absoluteFill, {fontFamily: 'EggDisplay',
            fontSize: hpLabel.length > 13 ? 11 : compact ? 14 : 16, lineHeight: barHeight - 2, includeFontPadding: false,
            paddingHorizontal: 5, color: '#FFFFFF', textAlign: 'center', textAlignVertical: 'center', fontVariant: ['tabular-nums'],
            textShadowColor: '#123020', textShadowRadius: 2, textShadowOffset: {width: 0, height: 1}}]}>{hpLabel}</Copy>
      </View>
    </View>
  </View>;
}
