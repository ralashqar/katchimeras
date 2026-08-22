import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useKatchaSurface } from '@/components/katchadeck/ui/katcha-surface';
import { BondIconArt } from '@/components/katchadeck/ui/bond-icon-art';
import { ThemedText } from '@/components/themed-text';
import { KatchaUI } from '@/constants/katcha-ui';
import type { CompanionBondProgress } from '@/utils/companion-bond';

export function CompanionBondMeter({ name, progress }: { name: string; progress: CompanionBondProgress }) {
  const { tokens } = useKatchaSurface();
  const reduceMotion = useReducedMotion();
  const animatedProgress = useSharedValue(0);
  const valueLabel = `${progress.totalPoints}`;
  const hint = progress.nextRelationshipStage == null
    ? `You and ${name} have reached the deepest bond.`
    : `${progress.relationshipPointsRemaining} bond until ${progress.nextRelationshipStage}.`;

  useEffect(() => {
    const percent = Math.max(progress.totalPoints > 0 ? 4 : 0, progress.relationshipStageRatio * 100);
    animatedProgress.value = reduceMotion
      ? percent
      : withTiming(percent, { duration: KatchaUI.motion.progress });
  }, [animatedProgress, progress.relationshipStageRatio, progress.totalPoints, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${animatedProgress.value}%` }));

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: tokens.subtle, borderColor: tokens.border, boxShadow: tokens.cardShadow },
      ]}
      accessibilityLabel={`Bond with ${name}. ${valueLabel}. ${hint}`}>
      <View style={styles.icon}><BondIconArt size={24} /></View>
      <ThemedText style={styles.label} lightColor={tokens.text} darkColor={tokens.text}>Bond</ThemedText>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.relationshipStageRatio * 100) }}
        style={[styles.track, { backgroundColor: tokens.border }]}>
        <Animated.View style={[styles.fill, { backgroundColor: tokens.success }, fillStyle]} />
      </View>
      <ThemedText numberOfLines={1} style={styles.value} lightColor={tokens.textSecondary} darkColor={tokens.textSecondary}>{valueLabel}</ThemedText>
      <View style={[styles.level, { backgroundColor: `${tokens.accent}32`, borderColor: tokens.border }]}>
        <ThemedText style={styles.levelText} lightColor={tokens.text} darkColor={tokens.text}>{progress.relationshipStage}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', borderCurve: 'continuous', borderRadius: KatchaUI.radius.control, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 46, paddingHorizontal: 9, paddingVertical: 7 },
  icon: { alignItems: 'center', backgroundColor: 'rgba(169,80,67,0.12)', borderRadius: 999, height: 28, justifyContent: 'center', width: 28 },
  label: { ...KatchaUI.type.companionAction, fontSize: 11.5 },
  value: { ...KatchaUI.type.numeric, fontSize: 10, fontVariant: ['tabular-nums'] },
  track: { borderRadius: KatchaUI.radius.pill, flex: 1, height: 6, minWidth: 42, overflow: 'hidden' },
  fill: { borderRadius: KatchaUI.radius.pill, height: '100%' },
  level: { alignItems: 'center', borderRadius: 9, borderWidth: 1, boxShadow: '-1px 2px 4px rgba(58,38,18,0.14), inset 0 1px 0 rgba(255,252,234,0.68)', justifyContent: 'center', minHeight: 28, minWidth: 58, paddingHorizontal: 7 },
  levelText: { ...KatchaUI.type.numeric, fontSize: 10, fontVariant: ['tabular-nums'], fontWeight: '900' },
});
