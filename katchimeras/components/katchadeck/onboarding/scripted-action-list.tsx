import { Image } from 'expo-image';
import { useRef } from 'react';
import { Pressable, StyleSheet, View, type View as ViewType } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp, FadeOutUp, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { GameSurface } from '@/components/katchadeck/ui/game-surface';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { DASHBOARD_STAT_ART } from '@/constants/journal-art-sources';
import { Meadow } from '@/constants/meadow-theme';
import { KatchaDeckUI } from '@/constants/theme';
import type { FtueActionDefinition } from '@/features/onboarding/ftue-types';
import { playEggActionHaptic } from '@/features/today/egg-haptics';

export function ScriptedActionList({ actions, locked, onAction, stepCount, stepEnergy }: {
  actions: readonly FtueActionDefinition[];
  locked?: boolean;
  onAction: (action: FtueActionDefinition, from: FeedSourceRect) => void;
  stepCount?: number | null;
  stepEnergy?: number | null;
}) {
  const reduceMotion = useReducedMotion();
  return <Animated.View layout={LinearTransition.duration(220)} style={styles.list}>
    {actions.filter((action) => action.presentation !== 'inline_choice').map((action) => (
      <ScriptedActionCard
        action={action}
        key={action.id}
        locked={locked}
        reduceMotion={reduceMotion}
        onAction={onAction}
        stepCount={stepCount}
        stepEnergy={stepEnergy}
      />
    ))}
  </Animated.View>;
}

function ScriptedActionCard({ action, locked, reduceMotion, onAction, stepCount, stepEnergy }: {
  action: FtueActionDefinition;
  locked?: boolean;
  reduceMotion: boolean;
  onAction: (action: FtueActionDefinition, from: FeedSourceRect) => void;
  stepCount?: number | null;
  stepEnergy?: number | null;
}) {
  const cardRef = useRef<ViewType>(null);
  const bondSourceRef = useRef<ViewType>(null);
  const invoke = (callback: (rect: FeedSourceRect) => void) => {
    if (locked) return;
    const sourceRef = action.id === 'egg.feed_steps' ? bondSourceRef : cardRef;
    sourceRef.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) {
        if (action.id.startsWith('egg.')) playEggActionHaptic();
        callback({ x, y, w, h });
      }
    });
  };
  if (action.presentation === 'cta_action') {
    return <Animated.View
      entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.duration(300).easing(Easing.out(Easing.cubic))}
      exiting={reduceMotion ? FadeOutUp.duration(80) : FadeOutUp.duration(230).easing(Easing.in(Easing.cubic))}
      layout={LinearTransition.duration(220)}
      ref={cardRef}>
      <KatchaButton
        disabled={locked}
        fullWidth
        glow
        icon={action.icon}
        label={action.title}
        labelStyle={KatchaDeckUI.typography.ftuePanelTitle}
        onPress={() => invoke((rect) => onAction(action, rect))}
      />
    </Animated.View>;
  }
  if ((action.id === 'energy.convert_steps' || action.id === 'egg.feed_steps') && stepCount != null && stepEnergy != null) {
    return <Animated.View
      entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.duration(300).easing(Easing.out(Easing.cubic))}
      exiting={reduceMotion ? FadeOutUp.duration(80) : FadeOutUp.duration(230).easing(Easing.in(Easing.cubic))}
      layout={LinearTransition.duration(220)}>
      <GameSurface contentStyle={styles.stepsSurfaceContent} density="regular" style={styles.card} tone="cream">
        <Pressable
          accessibilityLabel={action.id === 'egg.feed_steps' ? `Feed ${stepCount.toLocaleString()} steps to the Egg for ${stepEnergy} Bond` : `Turn ${stepCount.toLocaleString()} steps into ${stepEnergy} Energy`}
          accessibilityRole="button"
          disabled={locked}
          onPress={() => invoke((rect) => onAction(action, rect))}
          ref={cardRef}
          style={({ pressed }) => [styles.stepsRow, pressed && styles.pressed]}>
          <View style={styles.stepsValueGroup}>
            <Image contentFit="contain" source={DASHBOARD_STAT_ART.steps} style={styles.stepsArt} />
            <View style={styles.stepsCopy}>
              <ThemedText style={styles.stepsValue} lightColor={KatchaDeckUI.ftue.goldDeep} darkColor={KatchaDeckUI.ftue.goldDeep}>{stepCount.toLocaleString()}</ThemedText>
              <ThemedText style={styles.stepsLabel} lightColor={KatchaDeckUI.ftue.ink} darkColor={KatchaDeckUI.ftue.ink}>steps</ThemedText>
            </View>
          </View>
          <IconSymbol color={Meadow.inkFaint} name="arrow.right" size={21} />
          <View collapsable={false} ref={bondSourceRef} style={styles.energyValueGroup}>
            <Image contentFit="contain" source={action.id === 'egg.feed_steps' ? GAME_CURRENCY_ART.bond : GAME_CURRENCY_ART.energy} style={styles.energyArt} />
            <ThemedText style={styles.energyValue} lightColor={KatchaDeckUI.ftue.goldDeep} darkColor={KatchaDeckUI.ftue.goldDeep}>+{stepEnergy}</ThemedText>
          </View>
        </Pressable>
      </GameSurface>
    </Animated.View>;
  }
  return <Animated.View
    entering={reduceMotion ? FadeIn.duration(80) : FadeInUp.duration(300).easing(Easing.out(Easing.cubic))}
    exiting={reduceMotion ? FadeOutUp.duration(80) : FadeOutUp.duration(230).easing(Easing.in(Easing.cubic))}
    layout={LinearTransition.duration(220)}>
    <GameSurface contentStyle={styles.surfaceContent} density="regular" style={styles.card} tone="cream">
      <Pressable
        accessibilityRole="button"
        disabled={locked}
        onPress={() => invoke((rect) => onAction(action, rect))}
        ref={cardRef}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <View style={styles.iconFrame}><IconSymbol color={Meadow.goldDeep} name={action.icon} size={25} /></View>
        <View style={styles.copy}>
          <ThemedText style={styles.title} lightColor={KatchaDeckUI.ftue.goldDeep} darkColor={KatchaDeckUI.ftue.goldDeep}>{action.title}</ThemedText>
          <ThemedText style={styles.body} lightColor={KatchaDeckUI.ftue.ink} darkColor={KatchaDeckUI.ftue.ink}>{action.description}</ThemedText>
        </View>
        <IconSymbol color={Meadow.inkFaint} name="arrow.right" size={19} />
      </Pressable>
    </GameSurface>
  </Animated.View>;
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: { width: '100%' },
  surfaceContent: { paddingHorizontal: 10, paddingVertical: 6 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 9, minHeight: 55 },
  iconFrame: { alignItems: 'center', height: 48, justifyContent: 'center', marginLeft: -3, width: 48 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  copy: { flex: 1, gap: 2 },
  title: KatchaDeckUI.typography.ftuePanelTitle,
  body: KatchaDeckUI.typography.ftuePanelBody,
  stepsSurfaceContent: { paddingHorizontal: 14, paddingVertical: 9 },
  stepsRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 62 },
  stepsValueGroup: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  stepsArt: { height: 44, width: 44 },
  stepsCopy: { gap: 0 },
  stepsValue: { ...KatchaDeckUI.typography.ftuePanelTitle, fontVariant: ['tabular-nums'] },
  stepsLabel: { ...KatchaDeckUI.typography.ftuePanelBody, opacity: 0.72 },
  energyValueGroup: { alignItems: 'center', flexDirection: 'row', gap: 5, minWidth: 76, justifyContent: 'flex-end' },
  energyArt: { height: 36, width: 36 },
  energyValue: { ...KatchaDeckUI.typography.ftuePanelTitle, fontVariant: ['tabular-nums'] },
});
