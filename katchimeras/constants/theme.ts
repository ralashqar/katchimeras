import { Platform, type TextStyle } from 'react-native';

const BaseFonts =
  Platform.select({
    ios: {
      sans: 'system-ui',
      serif: 'ui-serif',
      rounded: 'ui-rounded',
      mono: 'ui-monospace',
    },
    web: {
      sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      serif: "Iowan Old Style, Georgia, 'Times New Roman', serif",
      rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
      mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    },
    default: {
      sans: 'normal',
      serif: 'serif',
      rounded: 'normal',
      mono: 'monospace',
    },
  }) ?? {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  };

export const Fonts = BaseFonts;

export const AppFontFamilies = {
  bungee: 'Bungee',
  instrumentSerif: 'InstrumentSerif',
  manrope: 'Manrope',
} as const;

// Lantern design language tokens (docs/katchimera-lantern-design-language.md).
// Rule: light = life - ink world, warmth only on living things and one CTA.
export const Lantern = {
  ink950: '#0C0A14',
  ink900: '#14111F',
  ink800: '#1C1830',
  dusk700: '#272140',
  line: 'rgba(196,186,240,0.08)',
  moon50: '#F6F3FF',
  moon300: '#C9C2E8',
  moon500: '#908AB5',
  ember300: '#FFC36B',
  ember500: '#F58E3C',
  emberGlow: 'rgba(245,142,60,0.35)',
  emberInk: '#21130A',
  auroraViolet: '#A78BFA',
  auroraTeal: '#7DE8CD',
  auroraRose: '#F49AC1',
} as const;

const palette = {
  obsidian: '#090B12',
  deepNavy: '#11192B',
  moonBlue: '#C8D8FF',
  mist: '#EEF3FF',
  moss: '#5FA87B',
  ember: '#E3A06E',
  auroraPlum: '#6A5FE8',
  ink: '#0F1320',
  steel: '#72809D',
  frost: '#F8FBFF',
};

export const Colors = {
  light: {
    text: '#12192A',
    background: '#F4F7FF',
    surface: 'rgba(255,255,255,0.88)',
    surfaceElevated: '#FFFFFF',
    glass: 'rgba(255,255,255,0.56)',
    border: 'rgba(102, 122, 164, 0.18)',
    muted: '#64728C',
    tint: palette.deepNavy,
    accent: palette.moonBlue,
    accentSecondary: palette.auroraPlum,
    success: palette.moss,
    premium: palette.ember,
    icon: '#7D88A0',
    tabIconDefault: '#8591AA',
    tabIconSelected: palette.deepNavy,
    shadow: 'rgba(12, 19, 39, 0.14)',
  },
  dark: {
    text: Lantern.moon50,
    background: Lantern.ink950,
    surface: Lantern.ink900,
    surfaceElevated: Lantern.ink800,
    glass: 'rgba(20, 17, 31, 0.94)',
    border: Lantern.line,
    muted: Lantern.moon500,
    tint: palette.moonBlue,
    accent: palette.moonBlue,
    accentSecondary: palette.auroraPlum,
    success: palette.moss,
    premium: palette.ember,
    icon: '#9EAECE',
    tabIconDefault: '#73809E',
    tabIconSelected: palette.moonBlue,
    shadow: 'rgba(0, 0, 0, 0.38)',
  },
};

export type AppColorName = keyof typeof Colors.light & keyof typeof Colors.dark;

export const KatchaDeckUI = {
  palette,
  radii: {
    xs: 14,
    sm: 18,
    md: 24,
    lg: 30,
    xl: 36,
    pill: 999,
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 18,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  gradients: {
    onboarding: ['#0C0A14', '#14111F', '#1B1430'] as const,
    reveal: ['#0C0A14', '#131020', '#1A1430'] as const,
    world: ['#0C0A14', '#14111F', '#191430'] as const,
    premium: ['#D9E5FF', '#F0DFFF', '#FFD8C0'] as const,
    glassSheen: ['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.02)'] as const,
    mascotGlow: ['rgba(200,216,255,0.84)', 'rgba(106,95,232,0.08)'] as const,
    hoodedAura: ['rgba(200,216,255,0.36)', 'rgba(106,95,232,0.02)'] as const,
  },
  shadows: {
    soft: '0 18px 54px rgba(4, 9, 20, 0.28)',
    card: '0 20px 48px rgba(4, 9, 20, 0.34)',
    premium: '0 22px 56px rgba(227, 160, 110, 0.26)',
  },
  typography: {
    display: {
      fontFamily: AppFontFamilies.instrumentSerif,
      fontSize: 42,
      lineHeight: 46,
      fontWeight: '400',
      letterSpacing: 0,
    } satisfies TextStyle,
    hero: {
      fontFamily: AppFontFamilies.instrumentSerif,
      fontSize: 34,
      lineHeight: 38,
      fontWeight: '400',
      letterSpacing: 0,
    } satisfies TextStyle,
    headline: {
      fontFamily: Fonts.sans,
      fontSize: 28,
      lineHeight: 32,
      fontWeight: '700',
      letterSpacing: -0.4,
    } satisfies TextStyle,
    subtitle: {
      fontFamily: Fonts.sans,
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '600',
      letterSpacing: -0.2,
    } satisfies TextStyle,
    bodyLarge: {
      fontFamily: Fonts.sans,
      fontSize: 17,
      lineHeight: 26,
      fontWeight: '400',
    } satisfies TextStyle,
    body: {
      fontFamily: Fonts.sans,
      fontSize: 15,
      lineHeight: 23,
      fontWeight: '400',
    } satisfies TextStyle,
    label: {
      fontFamily: Fonts.sans,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    } satisfies TextStyle,
    pill: {
      fontFamily: Fonts.sans,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      letterSpacing: 0.2,
    } satisfies TextStyle,
    onboardingDisplay: {
      fontFamily: AppFontFamilies.instrumentSerif,
      fontSize: 44,
      lineHeight: 48,
      fontWeight: '400',
      letterSpacing: 0,
    } satisfies TextStyle,
    onboardingCTA: {
      fontFamily: AppFontFamilies.manrope,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '700',
      letterSpacing: -0.1,
    } satisfies TextStyle,
    onboardingLabel: {
      fontFamily: AppFontFamilies.manrope,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    } satisfies TextStyle,
  },
  motion: {
    quick: 180,
    base: 420,
    slow: 720,
    stagger: 90,
    driftDistance: 7,
  },
} as const;
