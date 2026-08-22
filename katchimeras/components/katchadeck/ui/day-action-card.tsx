import type { ReactNode } from 'react';
import { StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { GameRewardChip, GameSurface } from '@/components/katchadeck/ui/game-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { Meadow } from '@/constants/meadow-theme';

export type DayActionReward = {
  amount: number;
  art?: ImageSourcePropType;
  icon?: IconSymbolName;
  kind: 'bond' | 'coins' | 'energy';
};

export function DayActionCardSurface({
  artwork,
  completed = false,
  eyebrow,
  overlay,
  reward,
  style,
  subtitle,
  title,
  trailing,
}: {
  artwork: ReactNode;
  completed?: boolean;
  eyebrow?: string | null;
  overlay?: ReactNode;
  reward?: ReactNode;
  style?: StyleProp<ViewStyle>;
  subtitle?: string | null;
  title: string;
  trailing?: ReactNode;
}) {
  return <GameSurface contentStyle={styles.content} style={[styles.card, style]} tone="cream">
    {overlay}
    <View style={[styles.artwork, completed && styles.artworkCompleted]}>{artwork}</View>
    <View style={styles.copy}>
      {eyebrow ? <ThemedText numberOfLines={1} selectable style={styles.eyebrow} lightColor={completed ? Meadow.leafDeep : Meadow.goldDeep} darkColor={completed ? Meadow.leafDeep : Meadow.goldDeep}>{eyebrow}</ThemedText> : null}
      <ThemedText numberOfLines={2} selectable style={styles.title} lightColor={Meadow.ink} darkColor={Meadow.ink}>{title}</ThemedText>
      {subtitle ? <ThemedText numberOfLines={2} selectable style={[styles.subtitle, completed && styles.subtitleCompleted]} lightColor={completed ? Meadow.leafDeep : Meadow.inkSoft} darkColor={completed ? Meadow.leafDeep : Meadow.inkSoft}>{subtitle}</ThemedText> : null}
    </View>
    {reward}
    {trailing ?? <IconSymbol color={Meadow.inkSoft} name="chevron.right" size={17} />}
  </GameSurface>;
}

export function DayActionIcon({ completed = false, icon }: { completed?: boolean; icon: IconSymbolName }) {
  return <View style={[styles.iconWell, completed && styles.iconWellCompleted]}>
    <IconSymbol color={completed ? Meadow.leafDeep : Meadow.goldDeep} name={completed ? 'checkmark' : icon} size={24} />
  </View>;
}

export function DayActionRewardChip({ reward }: { reward: DayActionReward }) {
  const art = reward.art ?? (reward.kind === 'bond' ? GAME_CURRENCY_ART.bond : undefined);
  return <GameRewardChip
    amount={reward.amount}
    art={art}
    icon={reward.icon}
    tone={reward.kind === 'bond' ? 'rose' : 'gold'}
  />;
}

export function DayActionCompletedTick() {
  return <View style={styles.completedTick}><IconSymbol color="#FFF9E9" name="checkmark" size={17} /></View>;
}

const styles = StyleSheet.create({
  card: { minHeight: 66 },
  content: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 63, paddingHorizontal: 11, paddingVertical: 7 },
  artwork: { alignItems: 'center', flexShrink: 0, justifyContent: 'center' },
  artworkCompleted: { opacity: 0.94 },
  copy: { flex: 1, gap: 1, minWidth: 0 },
  eyebrow: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.75, lineHeight: 11, textTransform: 'uppercase' },
  title: { fontSize: 14, fontWeight: '900', lineHeight: 17 },
  subtitle: { fontSize: 10, fontWeight: '600', lineHeight: 13 },
  subtitleCompleted: { fontWeight: '800' },
  iconWell: { alignItems: 'center', backgroundColor: Meadow.goldSoft, borderCurve: 'continuous', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  iconWellCompleted: { backgroundColor: 'rgba(101,139,81,0.14)' },
  completedTick: { alignItems: 'center', backgroundColor: '#527A49', borderColor: 'rgba(255,248,218,0.9)', borderRadius: 999, borderWidth: 1.5, boxShadow: '0 3px 8px rgba(49,79,42,0.24), inset 0 1px 0 rgba(255,255,255,0.2)', height: 34, justifyContent: 'center', width: 34 },
});
