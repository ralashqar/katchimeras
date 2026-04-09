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
  instrumentSerif: 'InstrumentSerif',
  manrope: 'Manrope',
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
    text: palette.frost,
    background: palette.obsidian,
    surface: 'rgba(16, 24, 40, 0.72)',
    surfaceElevated: '#121B2F',
    glass: 'rgba(21, 32, 52, 0.52)',
    border: 'rgba(208, 221, 255, 0.12)',
    muted: '#94A2C4',
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
    onboarding: ['#090B12', '#121A2D', '#181C33'] as const,
    reveal: ['#090B12', '#10192A', '#171B35'] as const,
    world: ['#090C14', '#121A2B', '#151D30'] as const,
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
      fontFamily: Fonts.serif,
      fontSize: 42,
      lineHeight: 46,
      fontWeight: '700',
      letterSpacing: -0.8,
    } satisfies TextStyle,
    hero: {
      fontFamily: Fonts.serif,
      fontSize: 34,
      lineHeight: 38,
      fontWeight: '700',
      letterSpacing: -0.5,
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
      fontFamily: Fonts.serif,
      fontSize: 44,
      lineHeight: 46,
      fontWeight: '700',
      letterSpacing: -0.6,
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
