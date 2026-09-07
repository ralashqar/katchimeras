/**
 * Design tokens — the single source of truth for the game's look.
 *
 * No component may hardcode a colour. Reskinning the whole game should mean
 * editing this file and nothing else.
 *
 * Art direction: dark chrome and neon. Everything except the two fonts is drawn in
 * code — there are no image assets, and nothing here needs a native module.
 *
 * ## This file must stay import-free
 *
 * It has ~21 importers and `node --test` runs `.ts` directly by stripping types, so a
 * transitive `react-native` or `react-native-reanimated` import would execute inside
 * the test process (Reanimated's root module has side effects). `./color.ts` is pure
 * arithmetic and is the only import allowed here. That constraint is why `easingCurve`
 * holds bare tuples instead of `Easing` objects, and why `border.hair` is a literal
 * rather than `StyleSheet.hairlineWidth`.
 */

import { alpha } from './color';

export const palette = {
  // base / chrome
  ink: '#05060B',
  ink2: '#0A0D18',
  ink3: '#111726',
  steel900: '#171E30',
  steel700: '#232C42',
  steel500: '#33405C',
  steel300: '#56658A',
  chromeHi: '#C7D3E8',
  chromeEdge: '#8FA0C0',
  chromeLo: '#4A5670',

  text: '#EEF3FF',
  textDim: '#9AA8C4',
  textFaint: '#5F6C88',

  // neon accents
  red: '#FF2D46',
  redHot: '#FF6B5A',
  redDeep: '#8E0F27',
  amber: '#FFB020',
  amberHot: '#FFD866',
  amberDeep: '#8A4A00',
  blue: '#2FA8FF',
  blueHot: '#8FD8FF',
  blueDeep: '#0B3E78',
  green: '#24E08A',
  greenHot: '#8DF7C6',
  greenDeep: '#0A6A44',
  violet: '#A45CFF',
  violetHot: '#D7B4FF',
  violetDeep: '#3E1A78',
} as const;

/**
 * The five block palettes, keyed by the engine's `BlockColorId`.
 * Each cell renders as a deep base, a bright→mid→deep gradient, and a shine bar.
 */
export const blocks = {
  ignition: { bright: '#FF9E93', mid: '#FF3B30', deep: '#8E1119', glow: '#FF3B30' },
  turbo: { bright: '#FFE08A', mid: '#FFA51F', deep: '#8A4A05', glow: '#FFB020' },
  coolant: { bright: '#9FD8FF', mid: '#2E9BFF', deep: '#10407F', glow: '#2FA8FF' },
  nitro: { bright: '#D7B4FF', mid: '#9A4DFF', deep: '#3E1A78', glow: '#A45CFF' },
  grip: { bright: '#A6F5CE', mid: '#1FD189', deep: '#0A6A44', glow: '#24E08A' },
} as const;

export type BlockPaletteId = keyof typeof blocks;

export const semantic = {
  /** A row clear is worth the most speed, so it wears the speed colour. */
  speedAxis: palette.amber,
  sabotageAxis: palette.red,
  specialAxis: palette.blue,

  valid: palette.green,
  invalid: palette.red,
  gain: palette.green,
  loss: palette.red,

  // Board chrome, lifted verbatim from the reference implementation — these
  // exact values are what make the well read as recessed rather than flat.
  boardBezelTop: '#2B2948',
  boardBezelMid: '#17162B',
  boardBezelLow: '#0D0C19',
  boardWell: '#090A15',
  cellEmpty: '#191B32',
  cellEdge: '#242850',

  /** Warm highlight used for "these lines will clear" and the burst. */
  clearGlow: '#FFF0A8',
  clearGlowEdge: '#FFF8DE',
  clearSpark: '#FFF4C4',

  road: '#0E1119',
  roadEdge: '#141A26',
  laneStripe: '#E8EEF9',
  guardrail: '#3A455F',

  /**
   * Roadside and surface wear.
   *
   * These three were inline hex literals in `RoadSkia.tsx`, against this file's own
   * tokens-only rule. Moved here when the road was rebuilt in 3D, with the values carried
   * over unchanged so the look is identical.
   */
  verge: '#1B3A22',
  vergeDeep: '#0E2114',
  roadWear: '#0A0D14',
  /** Alternating kerb colour. The other stripe is `laneStripe`. */
  kerb: '#C2303A',

  /**
   * The sky dome, bottom to top. **Deep at the horizon, brightening upward.**
   *
   * ## Only the bottom 22 degrees is ever on screen
   *
   * This is the constraint that decides all three values, and ignoring it is what made two earlier
   * attempts wrong. The chase lens is 68 degrees vertical with its axis angled *down* at the road, so
   * the top of the frame sits about 22 degrees above the horizon — dome height `sin(22°)` = 0.375.
   * Everything above that is geometry the player never sees.
   *
   * ## The gradient runs the opposite way to a real sky, deliberately
   *
   * A physically honest sky is palest at the horizon — you look through the most atmosphere there, so
   * the blue is diluted toward white — and reaches saturated blue overhead. This one does the reverse,
   * and the reason is that the visible band is 22 degrees of a 90-degree ramp. Graded the honest way,
   * *everything the player sees is one end of the gradient*: the previous values ran `#57B8DE` to about
   * `#338AC6` across the whole visible slice, a change of 0.09 in luma, which reads as a flat wash of
   * light blue. All the interest was parked above the frame.
   *
   * Inverting it puts the dark end at the horizon, where the frame actually is, and the ramp now spans
   * 0.24 to 0.52 in luma inside the visible band — a change the eye reads as depth rather than as a
   * backdrop. Physical accuracy is what gets spent, knowingly: a correct gradient nobody can see the
   * variation in is not more realistic, just flatter.
   *
   * **This direction has failed before, and the mitigation is the point.** `sky-dome.test.ts` used to
   * pin the honest direction and its comment recorded that dark-at-horizon "made the first version of
   * this sky read as a coloured ball rather than as sky". That failure comes from putting the *bright
   * pole* in frame, which reads as a lit sphere overhead. Here the bright end is the zenith, which is
   * never on screen — the player only ever sees a lower band getting lighter as it rises, which is what
   * a deep atmosphere looks like. If it does read as a ball on device, this is the note to start from.
   *
   * The hue stays on the cyan side of blue. Partly taste, partly the palette: every accent in this game
   * is a neon (`blue` is already `#2FA8FF`), and a sky leaning cyan sits behind them rather than
   * competing with them.
   *
   * ## The horizon must equal the fog colour
   *
   * `skyHorizon` **must equal `CAM.FOG_COLOR`**, and that is load-bearing rather than tidy: the road
   * and verge fade to the fog colour at the distance they disappear, so any other value puts a hard
   * line along the horizon where the ground stops.
   *
   * The inversion therefore darkens the distance haze as well, and that is a real consequence rather
   * than a side effect to ignore. It still works, because the haze only has to differ from the road to
   * carry depth, not to be bright: the tarmac is near-black and `#12456B` is comfortably lighter, so
   * distance still lifts — just into deep blue instead of pale cyan.
   */
  skyHorizon: '#12456B',
  skyMid: '#3A8FC6',
  skyZenith: '#6FC2EA',

  playerCar: palette.blue,
  rivalCar: palette.red,
} as const;

/**
 * The opponent field's liveries, **indexed by rank** — 0 is the front-runner.
 *
 * One colour per car rather than one colour for "the rival", because the player now passes five of them
 * one at a time and needs to tell which is which: the car you just took should not look like the next
 * one up. Distinct hues make a pass legible in peripheral vision, which matters because the player's
 * eyes are on the slot footprints, not on the road.
 *
 * Ordered so the ladder reads without a legend. The front two are the hot end — red for the leader,
 * amber behind it — and it cools through violet to green at the back. That is the same "dullest to
 * brightest means better" convention `rarity` uses, and it means the colour of the car ahead tells the
 * player how much of the field is left.
 *
 * `rivalCar` stays as rank 0's colour: the leader is the car the old single rival was, so the one-rival
 * red survives as the thing at the very top of the ladder.
 *
 * Must hold at least `MAX_FIELD_SIZE - 1` entries — `field-livery.test.ts` pins that, since the two numbers
 * live in different modules and a short array would silently hand two cars the same paint.
 *
 * The last two exist for a *level* rather than for the default race: a level may ask for a bigger field, up to
 * `MAX_FIELD_SIZE`, and the scene builds a rig per possible opponent. Blue and a deep red continue the cooling
 * ramp past green without reaching back into the hot end, so the ladder still reads front-to-back on the
 * longest grid the game can draw.
 */
export const fieldCars = [
  palette.red,
  palette.amber,
  palette.violet,
  palette.greenHot,
  palette.green,
  palette.blue,
  palette.redDeep,
] as const;

/**
 * Loot and contract tiers.
 *
 * Reuses the neon families rather than inventing four more hues — the palette is
 * already the game's vocabulary, and a fifth family would compete with the block
 * colours for meaning. Ordered dullest to brightest so "better" reads without a
 * legend.
 */
export const rarity = {
  common: palette.chromeEdge,
  rare: palette.blue,
  epic: palette.violet,
  legendary: palette.amber,
} as const;

export type RarityId = keyof typeof rarity;

export const radius = { xs: 4, sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;

/**
 * Border widths.
 *
 * `hair` is 0.5 rather than `StyleSheet.hairlineWidth` because this file may not import
 * `react-native` (see the header). 0.5 is what hairlineWidth resolves to on every 2x and
 * 3x device, which is all of them.
 */
export const border = { hair: 0.5, thin: 1, rail: 2, rim: 3 } as const;

/**
 * `borderCurve: 'continuous'` — an iOS squircle instead of a circular arc.
 *
 * Spread rather than passed as a value so the prop name never has to be typed at a call
 * site: `{ ...curve, borderRadius: radius.md }`. It was appearing ad-hoc in four files.
 * Inert on Android, which is why it can be applied unconditionally.
 */
export const curve = { borderCurve: 'continuous' } as const;

export const space = {
  none: 0,
  hair: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  huge: 24,
} as const;

/**
 * The two typefaces, as `useFonts` map keys.
 *
 * **Michroma** for display: very wide, geometric, and the closest free face to the
 * broadcast graphics of real motorsport. It has exactly one weight and is unreadable below
 * about 14pt or in a paragraph, so it is reserved for titles and numbers that want presence.
 *
 * **Saira Condensed** for everything else: condensed enough to fit dense HUD labels, with
 * nine real weights.
 *
 * The actual `.ttf`s are loaded by `ui/fonts.ts`. These strings are just the keys, which is
 * why this file can name them without importing anything.
 */
export const font = {
  display: 'Michroma_400Regular',
  body: 'SairaCondensed_500Medium',
  ui: 'SairaCondensed_600SemiBold',
  uiBold: 'SairaCondensed_700Bold',
  uiBlack: 'SairaCondensed_900Black',
  /** Numerals get Bold: at 10–16pt SemiBold digits go muddy over a moving road. */
  numeric: 'SairaCondensed_700Bold',
} as const;

/**
 * Type scale.
 *
 * ## Never pair `fontFamily` with `fontWeight`
 *
 * With a custom face, weight *is* the family — `SairaCondensed_700Bold` is a different file
 * from `SairaCondensed_500Medium`. Setting `fontWeight` on top asks the platform to synthesise
 * a weight that already exists: on Android that means a faked smear or a silent fall back to
 * Roboto, and on iOS it is ignored. So every variant here carries a family and no weight, and
 * no call site should add one.
 *
 * ## Why the sizes moved
 *
 * Michroma's advance widths run about 25% wider than system-900 at the same `fontSize`, so
 * `display` came down from 34 to 28 — at 34 the words "NITRO GRID" overflow a 360pt screen.
 * Its tracking also flipped from -0.5 to +1.4: negative tracking on a geometric face reads as
 * a mistake, and Michroma wants air.
 *
 * Every display variant carries an explicit `lineHeight`, because Michroma's intrinsic line
 * box crops descenders on Android.
 *
 * `speed` lost its -0.4 tracking: Saira Condensed is already condensed, and negative tracking
 * on top of that collides adjacent digits.
 *
 * `fontVariant: ['tabular-nums']` is kept where it was, but **do not rely on it** — it is a
 * no-op if the face lacks the feature. The real guarantee against a jittering speed readout
 * is the fixed `width` that `RaceHud`'s `LiveNumber` already applies.
 */
export const type = {
  /** The home wordmark and the results verdict. */
  hero: { fontFamily: font.display, fontSize: 44, lineHeight: 54, letterSpacing: 2 },
  display: { fontFamily: font.display, fontSize: 28, lineHeight: 36, letterSpacing: 1.4 },
  title: { fontFamily: font.display, fontSize: 17, lineHeight: 24, letterSpacing: 1.2 },
  /**
   * A big, *readable* size that is deliberately not Michroma.
   *
   * Screen headings need to be scannable, and Michroma at 22pt in a sentence is a wall. This
   * is the escape hatch that stops the display face being misused for copy.
   */
  heading: { fontFamily: font.uiBlack, fontSize: 22, lineHeight: 27, letterSpacing: 0.4 },
  speed: {
    fontFamily: font.numeric,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  },
  stat: { fontFamily: font.numeric, fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'] },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: font.uiBold, fontSize: 12, lineHeight: 15, letterSpacing: 1.6 },
  micro: { fontFamily: font.uiBold, fontSize: 10, lineHeight: 13, letterSpacing: 1.3 },
} as const;

export type TypeVariant = keyof typeof type;

/**
 * Standard opacities, so `0.16` stops being retyped from memory in eight files.
 *
 * Named by what they are *for*, not by value — `opacity.disabled` survives a designer
 * deciding disabled should be 0.35, where a token called `o40` would not.
 */
export const opacity = {
  ghost: 0.055,
  faint: 0.12,
  subtle: 0.18,
  dim: 0.35,
  disabled: 0.4,
  muted: 0.62,
  strong: 0.82,
} as const;

/**
 * Hairline and rim colours — the 1px lines that do most of the work in this UI.
 *
 * `rim*` are the bright inner top edge that makes a panel read as a lit object rather
 * than a coloured rectangle. `edge*` are the outer boundary. Both were previously
 * inline `rgba(255,255,255,0.0x)` literals scattered through `Tray`, `SlotField` and
 * `PieceArt`.
 */
export const line = {
  /** Bright inner top edge. The whole trick behind "rim lighting" on a flat surface. */
  rim: alpha(palette.text, 0.22),
  rimSoft: alpha('#FFFFFF', opacity.ghost),
  rimBright: alpha('#FFFFFF', opacity.subtle),
  edge: palette.steel700,
  edgeSoft: alpha(palette.chromeHi, 0.16),
  edgeWell: palette.ink3,
} as const;

/**
 * Translucent plate fills.
 *
 * `plate` and `plateDeep` are the HUD-chip / tray / guide recipe — dark enough to hold
 * white text over a moving road, translucent enough that the road still shows through.
 * Carried over from the values those three components had inline.
 */
export const surface = {
  plate: alpha('#141227', 0.82),
  plateDeep: alpha('#090814', 0.78),
  scrim: alpha(palette.ink, 0.72),
  scrimSoft: alpha(palette.ink, 0.35),
  clear: alpha(palette.ink, 0),
} as const;

/** Neon glow recipes. `boxShadow` as a string needs RN 0.76+ / new arch. */
export const glow = {
  sm: (color: string) => `0 0 6px ${alpha(color, 0.4)}`,
  md: (color: string) => `0 0 12px ${alpha(color, 0.5)}, 0 0 3px ${alpha(color, 0.8)}`,
  lg: (color: string) => `0 0 22px ${alpha(color, 0.6)}, 0 0 6px ${color}`,
} as const;

export const elevation = {
  panel: `0 10px 24px ${alpha('#000000', 0.55)}, inset 0 1px 0 ${line.rim}`,
  well: `inset 0 2px 6px ${alpha('#000000', 0.65)}, inset 0 -1px 0 ${alpha(palette.chromeHi, 0.1)}`,
  float: `0 18px 32px ${alpha('#03040A', 0.66)}`,
  /** The board's own drop shadow — deeper and softer than a panel's. */
  board: `0 18px 32px ${alpha('#05040E', 0.46)}`,
  /** A floating tray piece under the finger. */
  lifted: `0 10px 24px ${alpha('#060511', 0.26)}, inset 0 1px 0 ${line.rimSoft}`,
} as const;

/**
 * Gradient recipes.
 *
 * Returned as prop-spreadable objects so a caller writes
 * `<LinearGradient {...gradient.bezel(accent)} />` and cannot get `locations` out of
 * step with `colors` — which is the actual failure mode, not the colour choice.
 */
export const gradient = {
  /**
   * The block-cell and panel-bezel recipe: bright → mid → deep with the midpoint just
   * past halfway, so the lit face is wider than the shadowed one.
   */
  face: (bright: string, mid: string, deep: string) => ({
    colors: [bright, mid, deep] as const,
    locations: [0, 0.52, 1] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  }),
  /** Diagonal chrome bezel, as the board well uses. */
  bezel: () => ({
    colors: [semantic.boardBezelTop, semantic.boardBezelMid, semantic.boardBezelLow] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  }),
  /** Fades the bottom of a 3D hero into the screen. Lifted from the race screen. */
  heroFade: () => ({
    colors: [surface.clear, alpha(palette.ink, 0.28), palette.ink] as const,
    locations: [0, 0.78, 1] as const,
  }),
  /**
   * Darkens the top of a hero so overlaid chips hold contrast.
   *
   * 0.5 at the top, down from 0.85. It was sized for a race HUD whose versus readout was a
   * full-width bar with no background of its own, so the scrim had to carry all of that contrast.
   * That bar is now two corner chips with their own opaque plates and borders, and the only thing
   * left needing help is the progress row.
   *
   * The cost of the old value only became visible once the race sky stopped being black: at 0.85 it
   * washed the top third of the 3D view to near-black, which was most of the reason a blue sky was
   * still reading as grey.
   */
  heroScrim: () => ({
    colors: [alpha(palette.ink, 0.5), alpha(palette.ink, 0.16), surface.clear] as const,
  }),
  /**
   * The rotating highlight behind `BorderSweep`.
   *
   * A hard-edged bright band with transparent shoulders. The band must be narrow —
   * spread over more than ~30% of the sweep it stops reading as a travelling highlight
   * and starts reading as the panel simply glowing.
   */
  sweep: (accent: string) => ({
    colors: [
      alpha(accent, 0),
      alpha(accent, 0),
      accent,
      alpha(accent, 0),
      alpha(accent, 0),
    ] as const,
    locations: [0, 0.38, 0.5, 0.62, 1] as const,
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  }),
} as const;

/**
 * The white shine bar sitting on top of a gradient face.
 *
 * Height is a fraction of the cell, not a constant, because it has to stay proportional
 * across the 32–48 px cell range the board solves for.
 */
export const shine = (size: number, strength = opacity.subtle) => ({
  height: Math.max(1, size * 0.16),
  backgroundColor: alpha('#FFFFFF', strength),
});

/**
 * Durations in ms. Keep effect timings here so pacing can be tuned globally.
 *
 * `motion` is the original name and is kept as an alias — it has no importers to break,
 * but `duration.snap` reads better at a call site than `motion.snap`.
 */
export const duration = {
  flash: 90,
  tick: 140,
  snap: 220,
  pop: 280,
  sweep: 420,
  stinger: 900,
  /** One full revolution of a panel's border highlight. */
  orbit: 2800,
  /** A breathing pulse, one direction. */
  breathe: 1000,
} as const;

export const motion = duration;

/**
 * Easing control points, as bare tuples.
 *
 * Tuples rather than Reanimated `Easing` objects because this file may not import
 * Reanimated (see the header). `src/ui/motion.ts` converts them once.
 *
 * `controlled` is the shared curve that was defined twice, identically, in
 * `SlotField.tsx` and `Tray.tsx`.
 */
export const easingCurve = {
  controlled: [0.22, 1, 0.36, 1],
  entrance: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
  standard: [0.4, 0, 0.2, 1],
  /**
   * Overshoots once, then settles. The `y2 > 1` control point is what pushes it past the
   * target.
   *
   * Use this instead of an under-damped spring wherever exactly one bounce is wanted. A
   * spring's bounce count is a consequence of its damping ratio rather than something you
   * state — `withSpring({ damping: 18, stiffness: 190 })` has a ratio of 0.65 and oscillates
   * three or four times, which on something small and fast like a tab indicator reads as a
   * wobble rather than as weight. A curve has a fixed duration and a shape you can see.
   */
  overshoot: [0.34, 1.56, 0.64, 1],
} as const;

/** Per-item delay for a staggered list build, ms. */
export const stagger = {
  panel: 70,
  cell: 50,
  stat: 90,
} as const;

/**
 * Stacking order for absolutely-positioned siblings.
 *
 * Android does not reliably honour document paint order for absolute siblings, so these
 * have to be explicit — see the note in `race.tsx`. They were five magic numbers spread
 * across three files; the gaps are deliberate so a layer can be slid between two
 * without renumbering.
 */
/**
 * Paint order for the race screen's overlapping layers.
 *
 * Listed in ascending order, which is also the order to read them in. Two of these values exist to
 * satisfy a constraint rather than a preference, and both are noted where they sit.
 *
 * The race screen's layers are absolutely-positioned **siblings**, so document order alone would
 * decide this — except that an explicit `zIndex` beats document order outright. Which is precisely
 * how the dragged piece ended up underneath the footprints it was being aimed at: the slot field is
 * declared *before* the play stack but carried a `zIndex` the play stack did not.
 */
export const zLayer = {
  /** A tray piece at rest, among its neighbours. */
  trayPiece: 1,
  /** A tray piece under the finger, lifted above its neighbours *within the tray*. */
  trayLifted: 40,
  /**
   * The slot field: the footprints drawn around the car.
   *
   * Above the play stack's own backdrop would be wrong, and it is not what this is for — it is here
   * to clear the HUD overlay, which is declared after it. See `playStack` for the other half.
   */
  slotField: 50,
  /**
   * The play stack — nitro row and tray — and with it **the piece being dragged**.
   *
   * Above `slotField`, which is the whole point: the dragged piece lives inside the tray's subtree,
   * so no amount of `zIndex` on the piece itself can lift it past a sibling container of the tray.
   * The container has to win, and the piece rides up with it.
   *
   * Safe only because the field's *drawn* footprints clear the play stack. Its bounding box overlaps
   * the stack by ~78pt — the box carries `SLOT_MARGIN` empty cells on every side — but nothing is
   * painted in that region, and the solver holds the drawn area `SLOT_PLAY_GAP` (10pt) clear of it.
   * `race-layout.test.ts` already pins exactly that, in "the slot field never collides with the play
   * stack", so the ordering here cannot silently start hiding footprints behind the tray.
   */
  playStack: 60,
  /** Word stickers: OVERTAKE, streak callouts. */
  callout: 200,
  /** Cleared cells flying field → car. */
  bullets: 300,
  countdown: 400,
  /** The pre-launch guide, above the countdown. */
  guide: 420,
} as const;
