import { AppFontFamilies, KatchaDeckUI, Lantern } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';

export type KatchaSurface = 'night' | 'parchment';

export type KatchaSurfaceTokens = {
  scrim: string;
  background: string;
  elevated: string;
  subtle: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentPressed: string;
  accentText: string;
  destructive: string;
  destructivePressed: string;
  destructiveText: string;
  success: string;
  shadow: string;
  cardShadow: string;
  buttonGlow: string;
};

export const KatchaSurfacePalette: Record<KatchaSurface, KatchaSurfaceTokens> = {
  night: {
    scrim: 'rgba(4,7,15,0.66)',
    background: Lantern.ink800,
    elevated: Lantern.dusk700,
    subtle: 'rgba(255,255,255,0.055)',
    border: Lantern.line,
    borderStrong: 'rgba(196,186,240,0.16)',
    text: Lantern.moon50,
    textSecondary: Lantern.moon300,
    textTertiary: Lantern.moon500,
    accent: Lantern.ember300,
    accentPressed: Lantern.ember500,
    accentText: Lantern.emberInk,
    destructive: '#9B4944',
    destructivePressed: '#7F3935',
    destructiveText: '#FFF5F1',
    success: Lantern.auroraTeal,
    shadow: '0 24px 64px rgba(0,0,0,0.58)',
    cardShadow: '0 8px 22px rgba(0,0,0,0.28)',
    buttonGlow: '0 8px 30px rgba(245,142,60,0.32), 0 2px 8px rgba(0,0,0,0.30)',
  },
  parchment: {
    scrim: 'rgba(24,17,12,0.62)',
    background: '#E6CDA7',
    elevated: '#F0D9B1',
    subtle: 'rgba(255,248,232,0.40)',
    border: 'rgba(122,84,44,0.18)',
    borderStrong: Meadow.cardBorder,
    text: Meadow.ink,
    // These inks remain readable over both the parchment base and its raised
    // cards. The older soft brown was only 3.0:1 on the sheet.
    textSecondary: '#62452B',
    textTertiary: '#704F2F',
    accent: '#E7B951',
    accentPressed: '#D6A640',
    accentText: Meadow.ink,
    destructive: '#8C3F36',
    destructivePressed: '#75322C',
    destructiveText: '#FFF7EC',
    success: Meadow.leafDeep,
    shadow: '0 24px 64px rgba(48,30,14,0.48), inset 0 1px 0 rgba(255,248,230,0.62)',
    cardShadow: '-2px 4px 12px rgba(58,38,18,0.18), inset 0 1px 0 rgba(255,248,230,0.52)',
    buttonGlow: '0 9px 26px rgba(58,38,18,0.26), 0 2px 7px rgba(58,38,18,0.18)',
  },
};

export type KatchaAccessibleAccent = {
  foreground: string;
  tint: string;
  border: string;
};

const PARCHMENT_ACCENT_INKS: Record<string, string> = {
  '#FFC36B': '#7B5000',
  '#F4BE8D': '#8A4D1D',
  '#E8C272': '#7B5000',
  '#AAB2FF': '#46589B',
  '#A7D5FF': '#46589B',
  '#92D7FF': '#46589B',
  '#F49AC1': '#9C3F68',
  '#F5AFC6': '#9C3F68',
  '#C77DFF': '#6B499C',
  '#D5B8FF': '#6B499C',
  '#C9C2E8': '#6B499C',
  '#91D8C7': '#356256',
  '#A8C99A': '#356256',
};

/**
 * Pastel moment accents are artwork colors, not readable foregrounds. This
 * converts them into a parchment-safe ink while retaining the source hue as
 * a quiet tile tint. Unknown colors fall back to the semantic body ink.
 */
export function resolveParchmentAccent(accent: string): KatchaAccessibleAccent {
  const normalized = accent.toUpperCase();
  const foreground = PARCHMENT_ACCENT_INKS[normalized] ?? KatchaSurfacePalette.parchment.textSecondary;
  const tint = /^#[0-9A-F]{6}$/.test(normalized) ? `${normalized}20` : 'rgba(98,69,43,0.10)';
  return { foreground, tint, border: `${foreground}52` };
}

export const KatchaUI = {
  spacing: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 28, xxl: 40 },
  radius: { control: 14, card: 18, sheet: 26, pill: 999 },
  touchTarget: 44,
  layout: {
    phoneGutter: 16,
    compactGutter: 12,
    readableWidth: 560,
    sheetContentWidth: 680,
    sectionGap: 18,
  },
  motion: {
    press: 140,
    chrome: 220,
    contentIn: 240,
    contentOut: 140,
    progress: 320,
    sheetIn: 260,
    sheetOut: 200,
  },
  companionPanel: {
    background: '#DFC8A4',
    border: 'rgba(104,72,38,0.24)',
    shadow: '0 18px 38px rgba(46,29,13,0.34), inset 0 1px 0 rgba(255,248,230,0.72)',
    cardBackground: '#E9D6B5',
    cardBorder: 'rgba(116,79,39,0.22)',
    cardShadow: '-2px 4px 11px rgba(58,38,18,0.18), inset 0 1px 0 rgba(255,248,230,0.72)',
    cardSelected: '#F0DCB3',
    cardComplete: '#DDE1C8',
    softBackground: 'rgba(255,246,222,0.42)',
    softBorder: 'rgba(91,65,38,0.13)',
    divider: 'rgba(91,65,38,0.13)',
    ink: '#3B2A1B',
    inkSoft: '#725B44',
  },
  type: {
    display: { fontFamily: AppFontFamilies.instrumentSerif, fontSize: 30, lineHeight: 34 },
    title: { fontFamily: AppFontFamilies.manrope, fontSize: 17, fontWeight: '800' as const, lineHeight: 22 },
    body: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
    label: { fontFamily: AppFontFamilies.manrope, fontSize: 10.5, fontWeight: '900' as const, letterSpacing: 1.1, textTransform: 'uppercase' as const },
    action: { fontFamily: AppFontFamilies.manrope, fontSize: 14, fontWeight: '900' as const, lineHeight: 19 },
    companionName: {
      ...KatchaDeckUI.typography.kingdomDisplay,
      fontSize: 34,
      lineHeight: 39,
      letterSpacing: -0.35,
    },
    companionDisplay: {
      fontFamily: AppFontFamilies.fredokaBold,
      fontSize: 35,
      lineHeight: 38,
      letterSpacing: -0.45,
    },
    companionPageTitle: {
      fontFamily: AppFontFamilies.fredokaBold,
      fontSize: 27,
      lineHeight: 31,
      letterSpacing: -0.3,
    },
    companionCardTitle: {
      fontFamily: AppFontFamilies.fredokaBold,
      fontSize: 19,
      lineHeight: 23,
      letterSpacing: -0.1,
    },
    companionSectionTitle: {
      fontFamily: AppFontFamilies.fredokaBold,
      fontSize: 20,
      lineHeight: 25,
      letterSpacing: -0.1,
    },
    screenTitle: KatchaDeckUI.typography.screenTitle,
    sectionTitle: KatchaDeckUI.typography.screenHeader,
    meta: KatchaDeckUI.typography.screenMeta,
    companionBody: KatchaDeckUI.typography.uiBody,
    companionAction: KatchaDeckUI.typography.uiAction,
    numeric: {
      fontFamily: AppFontFamilies.manrope,
      fontWeight: '800' as const,
    },
  },
} as const;
