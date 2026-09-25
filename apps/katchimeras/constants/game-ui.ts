import { AppFontFamilies } from '@/constants/theme';
import { createGameTheme } from '@incubator/game-ui/theme';
export { formatGameCurrency } from '@/utils/game-currency';
export const TOAST_MESSAGES_ENABLED = false;
export const GameUI = createGameTheme(AppFontFamilies);
export type GameSurfaceTone = keyof typeof GameUI.surface;

export type GameCurrencyId = 'energy' | 'coins' | 'gems' | 'timber';

export const GAME_CURRENCY_CATALOG = {
  energy: { icon: 'bolt.fill' as const, label: 'Energy', tint: GameUI.color.energy },
  coins: { icon: 'sparkles' as const, label: 'Glow', tint: GameUI.color.coin },
  gems: { icon: 'diamond.fill' as const, label: 'Gems', tint: GameUI.color.gem },
  // Building material from Supply Runs; its art is `GAME_CURRENCY_ART.timber`.
  timber: { icon: 'circle.fill' as const, label: 'Timber', tint: '#B07A3E' },
} satisfies Record<GameCurrencyId, { icon: 'bolt.fill' | 'sparkles' | 'circle.fill' | 'diamond.fill'; label: string; tint: string }>;
