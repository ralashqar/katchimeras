import { AppFontFamilies } from '@/constants/theme';

/** One visual recipe for game CTAs, independent of the surrounding sheet theme. */
export const GAME_CTA = {
  radius: 20,
  compactRadius: 17,
  rim: '#BC822C',
  text: '#583617',
  face: ['#F5D37A', '#EDBD54', '#DFAA3D'] as const,
  shadow: '0 4px 8px rgba(83,52,17,0.22)',
  bevel: 'inset 0 2px 0 rgba(255,245,198,0.55)',
  label: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 22, lineHeight: 27,
    fontWeight: 'normal' as const, textTransform: 'uppercase' as const, textAlign: 'center' as const },
  compactLabel: { fontSize: 17, lineHeight: 22 },
} as const;
