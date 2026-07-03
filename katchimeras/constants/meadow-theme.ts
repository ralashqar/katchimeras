// The Meadow theme — design tokens for the Today-page redesign (the cozy
// golden-hour mockup). One token file the redesigned surfaces import, so the
// look is tuned in ONE place.
//
// Values are read off the mockup visually; once design/today-mockup.png lands
// in the repo, scripts can pixel-sample and tighten them (see the pipeline in
// docs — Stage 1). Geometry is in dp assuming a 393pt-wide device.

export const Meadow = {
  // --- Colors ---------------------------------------------------------------
  // PIXEL-SAMPLED from design/today-mockup.jpeg (flat regions averaged, text
  // via darkest-decile) — see the redesign pipeline Stage 1.
  // Warm latte-parchment surfaces over the painted background.
  card: '#EBD4B2', // main card fill — lifted above the panel so tiles visibly pop
  cardSoft: '#E3C7A3', // inner tiles (Today-in-Numbers cells)
  cardBorder: 'rgba(122, 84, 44, 0.22)',
  iconOnCard: '#9C6B3F', // icon brown on cream tiles (accents wash out here)
  trackOnCard: '#EBD8B8', // progress track — LIGHTER than the card, not darker
  // The big parchment panel the sections sit ON — DARKER than the cards, so
  // the lighter cards + their drop shadows float above it (mockup hierarchy).
  panel: '#DDBD94',
  panelBorder: 'rgba(110, 74, 38, 0.28)',
  cardShadow: '0 6px 14px rgba(58, 38, 18, 0.32)',
  panelShadow: '0 10px 26px rgba(40, 26, 12, 0.28)',

  // Ink — warm dark brown, never pure black.
  ink: '#3A2517', // titles ("3 blooms earned today", numbers)
  inkSoft: '#8A7050', // secondary copy ("Keep going, you're growing")
  inkFaint: '#735430', // section kickers (TODAY IN NUMBERS)

  // Golds — the accent family (badges, selection ring, highlights).
  gold: '#E5BE6A', // count badges, TODAY ring
  goldDeep: '#A98136', // badge borders / pressed
  goldSoft: 'rgba(229, 190, 106, 0.3)', // glows, selected halos

  // Greens — growth (progress bar, reflection accents) — muted sage.
  leaf: '#6B805F',
  leafDeep: '#55684B',

  // Chips floating over the scene (category buttons, week strip circles).
  chip: 'rgba(74, 50, 26, 0.62)', // translucent warm-dark fill (richer brown)
  chipBorder: 'rgba(244, 222, 180, 0.6)', // light warm ring
  chipLabel: '#FBF3E4', // label text on chips

  // Scene scrim — behind text sitting directly on the painting.
  scrim: 'rgba(30, 20, 10, 0.35)',

  // Shared overlay sheets (category readers, pickers, prompts): one warm
  // night-parchment surface, always floating ABOVE the tab bar.
  overlay: {
    // Floating pill bar = bottom 20 + ~76 tall; sheets clear it with margin.
    bottomClearance: 110,
    sheetBg: '#221B10',
    sheetBorder: 'rgba(244, 222, 180, 0.24)',
  },

  // Bottom nav (carved wood bar).
  navWood: '#3B2F25',
  navWoodEdge: '#2A211A',
  navActive: '#F1D9A8',
  navInactive: 'rgba(241, 217, 168, 0.55)',

  // --- Geometry (dp @ 393pt width) -------------------------------------------
  radius: {
    card: 22, // big cream cards
    tile: 16, // inner stat tiles
    chip: 999, // circular category buttons
    photo: 12, // photo-meaning thumbnails
  },
  space: {
    page: 16, // screen edge inset
    cardPad: 16, // inside cards
    gap: 10, // between tiles / chips
    section: 18, // between stacked cards
  },
  chipSize: 62, // category circle diameter
  weekCircle: 56, // week-strip portrait diameter
  badge: 20, // count badge diameter

  // --- Type scale -------------------------------------------------------------
  type: {
    greeting: 24, // "Good morning, Rami" (serif-feel, bold)
    cardTitle: 17, // "3 blooms earned today"
    body: 13.5,
    kicker: 12, // ALL-CAPS section labels, letterSpacing 1
    statValue: 22, // "6.0k"
    statLabel: 12.5,
    chipLabel: 12,
  },
} as const;

export type MeadowTheme = typeof Meadow;
