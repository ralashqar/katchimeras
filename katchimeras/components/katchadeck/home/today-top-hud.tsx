import { memo, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameCurrencyHud } from '@/components/katchadeck/ui/game-currency-hud';
import { GameHudBar } from '@/components/katchadeck/ui/game-primitives';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { useGameWallet } from '@/features/ui/game-wallet-provider';
import type { HomeTimelineDay } from '@/types/home';

type TodayTopHudProps = {
  days?: HomeTimelineDay[];
  energyValueOverride?: number | null;
  energyPulseNonce?: number;
  energyTargetRef?: RefObject<View | null>;
  interactionLocked?: boolean;
  onSelectDay?: (dayId: string) => void;
  selectedId?: string;
};

export const TodayTopHud = memo(function TodayTopHud({
  energyTargetRef,
}: TodayTopHudProps) {
  const wallet = useGameWallet();
  return (
    <GameHudBar
      content={<>
        <GameCurrencyHud balances={[{ art: GAME_CURRENCY_ART.coins, id: 'coins', value: wallet.coins }]} style={styles.currencyHud} tone="glass" />
        <View pointerEvents="none" ref={energyTargetRef} style={styles.hiddenLegacyTarget} />
      </>}
      density="compact"
      style={styles.hud}
      tone="glass"
    />
  );
});

const styles = StyleSheet.create({
  hud: { alignSelf: 'center', maxWidth: 430, width: '100%' },
  currencyHud: { flex: 1 },
  hiddenLegacyTarget: { height: 1, opacity: 0, position: 'absolute', right: 0, top: 0, width: 1 },
});
