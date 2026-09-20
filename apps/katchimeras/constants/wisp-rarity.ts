import type { WispRarity } from '@/types/wisp';
/** Rarity is readable as text + symbols; color is never the only signal. */
export const WISP_RARITY: Record<WispRarity, { label: string; rank: number; symbol: string; ink: string; fill: string; glow: string; echoes: number }> = {
  common: { label: 'Common', rank: 1, symbol: '●', ink: '#43633C', fill: '#DDE8C5', glow: '#BDD293', echoes: 1 },
  rare: { label: 'Rare', rank: 2, symbol: '◆', ink: '#285D8A', fill: '#D9ECF5', glow: '#8ED1EA', echoes: 5 },
  epic: { label: 'Epic', rank: 3, symbol: '✦', ink: '#75438B', fill: '#EADDF1', glow: '#C6A1E4', echoes: 10 },
  legendary: { label: 'Legendary', rank: 4, symbol: '✧', ink: '#95601D', fill: '#F8E5AA', glow: '#F3CB64', echoes: 20 },
};
