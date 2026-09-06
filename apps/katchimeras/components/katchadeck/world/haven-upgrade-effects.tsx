import { createUpgradeEffects } from '@incubator/environments/upgrade-effects';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { AppFontFamilies } from '@/constants/theme';
export const { HavenUpgradeEffects } = createUpgradeEffects({coinArt:GAME_CURRENCY_ART.coins,fontFamily:AppFontFamilies.manrope});
