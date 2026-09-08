import { createUpgradeEffects } from '@incubator/environments/upgrade-effects';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { AppFontFamilies } from '@/constants/theme';

const { HavenUpgradeEffects: BaseHavenUpgradeEffects } = createUpgradeEffects({
  coinArt: GAME_CURRENCY_ART.coins,
  fontFamily: AppFontFamilies.manrope,
});

/** Each Glow coin seating in the tile is one tap; the last one lands heavier. */
function tapCoinLanding(last: boolean) {
  void Haptics.impactAsync(last ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
    .catch(() => undefined);
}

type HavenUpgradeEffectsProps = Omit<ComponentProps<typeof BaseHavenUpgradeEffects>, 'onCoinLanded'>;

export function HavenUpgradeEffects(props: HavenUpgradeEffectsProps) {
  return <BaseHavenUpgradeEffects {...props} onCoinLanded={tapCoinLanding} />;
}
