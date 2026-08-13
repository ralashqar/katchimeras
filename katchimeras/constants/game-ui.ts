import { AppFontFamilies } from '@/constants/theme';
export { formatGameCurrency } from '@/utils/game-currency';

export const GameUI = {
  color: {
    canvas: '#2B1B13',
    wood: '#3B2F25',
    woodRaised: '#4B392A',
    parchment: '#DFC49B',
    parchmentRaised: '#F0D9B1',
    parchmentSoft: '#E8D2AC',
    ink: '#3A2517',
    inkSecondary: '#6F543A',
    inkTertiary: '#8A7050',
    cream: '#FFF8E7',
    creamMuted: 'rgba(255,248,231,0.68)',
    line: 'rgba(112,76,40,0.22)',
    lineLight: 'rgba(255,236,190,0.24)',
    gold: '#E5BE6A',
    goldStrong: '#A98136',
    goldInk: '#4A291B',
    sage: '#617755',
    danger: '#8C3F36',
    dangerSoft: '#F1C7B8',
    gem: '#77CED1',
    energy: '#FFD45F',
    coin: '#E9B94F',
    scrim: 'rgba(31,20,11,0.62)',
  },
  spacing: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 28, xxl: 40 },
  radius: { control: 14, card: 20, hero: 26, sheet: 28, pill: 999 },
  shadow: {
    chrome: '0 6px 18px rgba(36,22,11,0.28), inset 0 1px 0 rgba(255,248,230,0.16)',
    card: '0 8px 20px rgba(58,38,18,0.22), inset 0 1px 0 rgba(255,248,230,0.48)',
    floating: '0 18px 42px rgba(38,24,12,0.38), inset 0 1px 0 rgba(255,248,230,0.58)',
    reward: '0 8px 24px rgba(169,129,54,0.34)',
  },
  type: {
    display: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 30, lineHeight: 35, letterSpacing: -0.35 },
    title: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 20, lineHeight: 25 },
    body: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
    label: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' as const, letterSpacing: 0.9 },
    action: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '900' as const, lineHeight: 19 },
    numeric: { fontFamily: AppFontFamilies.manrope, fontWeight: '900' as const, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
  },
  layout: { phoneGutter: 14, tabletGutter: 24, readableWidth: 600, touchTarget: 44 },
  motion: { press: 140, chrome: 220, reveal: 360 },
  layer: { scene: 0, content: 10, chrome: 20, dock: 40, notice: 60, toast: 80, modal: 100, reward: 120 },
} as const;

export type GameCurrencyId = 'energy' | 'coins' | 'gems';

export const GAME_CURRENCY_CATALOG = {
  energy: { icon: 'bolt.fill' as const, label: 'Energy', tint: GameUI.color.energy },
  coins: { icon: 'circle.fill' as const, label: 'Coins', tint: GameUI.color.coin },
  gems: { icon: 'diamond.fill' as const, label: 'Gems', tint: GameUI.color.gem },
} satisfies Record<GameCurrencyId, { icon: 'bolt.fill' | 'circle.fill' | 'diamond.fill'; label: string; tint: string }>;
