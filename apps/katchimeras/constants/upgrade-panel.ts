import { GameUI } from '@/constants/game-ui';
import { KatchaSurfacePalette, KatchaUI } from '@/constants/katcha-ui';

const cream = GameUI.surface.cream;
const dark = GameUI.surface.dark;
const gold = GameUI.surface.gold;
const sage = GameUI.surface.sage;
const parchment = KatchaSurfacePalette.parchment;

/**
 * One palette for every docked upgrade panel (tiles, the Lantern, a Haven):
 * nothing in those panels names a colour itself. Faces are two-stop gradients
 * from the game's surface tones; depth comes from a rim with a light stroke
 * just inside it all the way round, never from a drop shadow on the panel
 * that slides.
 */
export const UpgradePanelUI = {
  // The frame: a wood surround holding the title bar, the cream body card and the tab track.
  bar: dark.top,
  barFace: [GameUI.color.woodRaised, dark.bottom] as const,
  frameBorder: cream.rim,
  frameInner: 'rgba(255,236,190,0.22)',
  barInk: GameUI.color.cream,
  barInkSoft: GameUI.color.creamMuted,
  barInkShadow: 'rgba(20,12,6,0.55)',
  levelPillFace: ['#8DB86A', '#5F8C45'] as const,
  levelPillBorder: '#CBE3A8',
  levelPillInk: GameUI.color.cream,
  pill: dark.rim,
  pillBorder: 'rgba(255,236,190,0.34)',
  pillFill: [gold.top, gold.bottom] as const,
  /** Full: everything the next level asks for is there. */
  pillFillReady: ['#B5E07A', '#6BA63C'] as const,
  pillInk: GameUI.color.cream,
  grabber: 'rgba(255,248,231,0.4)',
  // The tab track at the foot of the frame.
  tabTrack: dark.rim,
  tabFace: ['#FFFDF4', cream.top] as const,
  tabInk: GameUI.color.ink,
  tabIdleInk: GameUI.color.creamMuted,
  tabIcon: sage.rim,
  // The body card and what stands on it.
  body: GameUI.color.cream,
  bodyFace: ['#FFFDF4', '#FBF1DA'] as const,
  bodyBorder: cream.rim,
  /** The light stroke just inside every rim. */
  innerStroke: 'rgba(255,255,255,0.72)',
  innerStrokeSoft: 'rgba(255,255,255,0.38)',
  cardFace: ['#FFFBEE', '#F8ECD0'] as const,
  cardBorder: 'rgba(169,129,54,0.36)',
  row: KatchaUI.companionPanel.cardSelected,
  rowFace: ['#FBEFD0', '#F2DFB6'] as const,
  rowMetFace: ['#EAF3DA', '#D3E3B6'] as const,
  rowBorder: 'rgba(169,129,54,0.45)',
  rowMetBorder: 'rgba(111,146,88,0.6)',
  chipFace: ['#FFFFFF', cream.top] as const,
  well: cream.top,
  divider: KatchaUI.companionPanel.divider,
  dividerFade: ['rgba(169,129,54,0)', 'rgba(169,129,54,0.45)', 'rgba(169,129,54,0)'] as const,
  ink: GameUI.color.ink,
  inkSoft: GameUI.color.inkSecondary,
  inkFaint: GameUI.color.inkTertiary,
  success: parchment.success,
  successFace: [sage.top, sage.bottom] as const,
  successInk: sage.ink,
  leaf: sage.rim,
  danger: GameUI.color.danger,
  dangerFace: ['#FBE3DC', '#F1C7B8'] as const,
  dangerBorder: 'rgba(140,63,54,0.4)',
  // The hero picture: the subject under an open sky, in a pale mount.
  mount: '#FFFDF6',
  mountBorder: 'rgba(169,129,54,0.5)',
  pictureFace: ['#BFE4F4', '#E4F1D6'] as const,
  pictureLockedFace: ['#D5DAD0', '#B4BCAC'] as const,
  ribbonFace: ['#7FA65F', '#56803E'] as const,
  ribbonBorder: '#CBE3A8',
  ribbonInk: GameUI.color.cream,
  // Level slots.
  slotDoneFace: ['#F3F7E6', '#D6E4BB'] as const,
  slotDoneBorder: sage.rim,
  slotNextFace: [gold.top, '#F3CE72'] as const,
  slotNextBorder: gold.rim,
  slotAheadFace: ['#EEE8DA', '#DDD3BE'] as const,
  slotAheadBorder: 'rgba(112,76,40,0.28)',
  slotPickedGlow: '0 0 0 3px rgba(233,184,79,0.55), 0 0 12px rgba(233,184,79,0.6)',
  slotUnknownInk: 'rgba(58,37,23,0.34)',
  slotNextInk: gold.ink,
  connector: 'rgba(138,112,80,0.5)',
  badgeDone: sage.rim,
  badgeNext: GameUI.color.goldStrong,
  badgeAhead: GameUI.color.inkTertiary,
  badgeBorder: 'rgba(255,248,231,0.92)',
  badgeInk: GameUI.color.cream,
  barFillShort: gold.bottom,
  radius: GameUI.radius.sheet,
  cardRadius: 20,
  rowRadius: 16,
  motion: { enter: KatchaUI.motion.sheetIn, exit: KatchaUI.motion.contentOut, settle: 300 },
} as const;
