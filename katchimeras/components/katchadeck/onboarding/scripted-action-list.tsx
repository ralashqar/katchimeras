import { useRef } from 'react';
import { Pressable, StyleSheet, View, type View as ViewType } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp, FadeOutUp, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { GameSurface } from '@/components/katchadeck/ui/game-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Meadow } from '@/constants/meadow-theme';
import { KatchaDeckUI } from '@/constants/theme';
import type { FtueActionDefinition } from '@/features/onboarding/ftue-types';

export function ScriptedActionList({ actions, locked, onAction }: {
  actions: readonly FtueActionDefinition[];
  locked?: boolean;
  onAction: (action: FtueActionDefinition, from: FeedSourceRect) => void;
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
      />
    ))}
  </Animated.View>;
}

function ScriptedActionCard({ action, locked, reduceMotion, onAction }: {
  action: FtueActionDefinition;
  locked?: boolean;
  reduceMotion: boolean;
  onAction: (action: FtueActionDefinition, from: FeedSourceRect) => void;
}) {
  const cardRef = useRef<ViewType>(null);
  const invoke = (callback: (rect: FeedSourceRect) => void) => {
    cardRef.current?.measureInWindow((x, y, w, h) => callback({ x, y, w, h }));
  };
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
});
