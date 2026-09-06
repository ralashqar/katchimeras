import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { GAME_CURRENCY_ART } from '@/constants/game-currency-art';
import { Lantern } from '@/constants/theme';

/** The same Bond-token flight for every Egg question. */
export function eggBondFeedPayload(amount: number, currencyFrom: FeedSourceRect, label?: string) {
  return { currencyFrom, energyAmount: amount, energyOnly: true, imageSource: GAME_CURRENCY_ART.energy, label, tint: Lantern.ember300 };
}
