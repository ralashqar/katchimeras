/**
 * Colour arithmetic for the token layer.
 *
 * Exists because the codebase was full of `${color}55` — string-concatenating a
 * two-digit hex alpha onto a token. That works, but it is unreadable (nobody knows
 * what `55` is), it silently produces garbage if the token ever gains its own alpha,
 * and it cannot be composed. `alpha(palette.red, 0.33)` says the same thing out loud.
 *
 * ## Zero dependencies, on purpose
 *
 * `tokens.ts` imports this, `tokens.ts` has ~21 importers, and `node --test` runs
 * `.ts` files directly by stripping types. So nothing in this chain may import
 * `react-native` or `react-native-reanimated` — Reanimated's root module has side
 * effects and would run inside the test process. Keep this file to arithmetic.
 *
 * Everything takes and returns `#RRGGBB` / `#RRGGBBAA` strings, because that is what
 * React Native style props accept and what the rest of the tokens already are. No
 * intermediate colour object: it would have to be unwrapped at every call site.
 */

/** Parsed channels, 0..255 each, alpha included. */
type Channels = { r: number; g: number; b: number; a: number };

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

/**
 * Parse `#RGB`, `#RGBA`, `#RRGGBB` or `#RRGGBBAA`.
 *
 * Throws on anything else rather than returning a fallback. A silently-wrong colour
 * is a bug you find in a screenshot three days later; a throw is one you find on the
 * first render. These are all compile-time-constant token strings, so the throw can
 * only fire on a genuine typo.
 */
export function parseHex(hex: string): Channels {
  if (hex.charCodeAt(0) !== 35 /* # */) {
    throw new Error(`parseHex: expected a leading '#', got ${JSON.stringify(hex)}`);
  }
  const body = hex.slice(1);
  const short = body.length === 3 || body.length === 4;
  const long = body.length === 6 || body.length === 8;
  if (!short && !long) {
    throw new Error(`parseHex: expected 3, 4, 6 or 8 hex digits, got ${JSON.stringify(hex)}`);
  }

  const step = short ? 1 : 2;
  const read = (index: number): number => {
    const start = index * step;
    const digits = body.slice(start, start + step);
    const value = Number.parseInt(short ? digits + digits : digits, 16);
    if (Number.isNaN(value)) {
      throw new Error(`parseHex: ${JSON.stringify(hex)} is not hex`);
    }
    return value;
  };

  const hasAlpha = body.length === 4 || body.length === 8;
  return { r: read(0), g: read(1), b: read(2), a: hasAlpha ? read(3) : 255 };
}

const byteToHex = (value: number): string => {
  const clamped = value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
  return clamped.toString(16).padStart(2, '0').toUpperCase();
};

/** `#RRGGBB`, or `#RRGGBBAA` when not fully opaque. */
export function toHex({ r, g, b, a }: Channels): string {
  const rgb = `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`;
  return Math.round(a) >= 255 ? rgb : `${rgb}${byteToHex(a)}`;
}

/**
 * Set a colour's opacity. `0` is transparent, `1` is opaque.
 *
 * **Replaces** any existing alpha rather than multiplying it. Multiplying reads as
 * clever and behaves badly: `alpha(alpha(c, 0.5), 0.5)` silently becoming 25% makes
 * a component's opacity depend on whether its caller already dimmed the token.
 * Replacement means the number you write is the opacity you get.
 *
 * Rounds to the nearest byte, which is exactly what the old `${color}66` literals
 * encoded — `alpha(c, 0.4)` is byte-identical to `` `${c}66` ``.
 */
export function alpha(color: string, opacity: number): string {
  const { r, g, b } = parseHex(color);
  return toHex({ r, g, b, a: clamp01(opacity) * 255 });
}

/**
 * Blend two colours. `t = 0` is `from`, `t = 1` is `to`.
 *
 * Straight sRGB interpolation, not linear-light. Mixing in linear light is more
 * physically correct and looks *wrong* here: the whole palette was hand-picked as
 * sRGB values, so a token halfway between two of them should be the value a designer
 * would have picked by eye, which is the sRGB midpoint.
 */
export function mix(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const k = clamp01(t);
  return toHex({
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
    a: a.a + (b.a - a.a) * k,
  });
}

/** Lighten toward white. Shorthand for the most common `mix`. */
export const lighten = (color: string, amount: number): string => mix(color, '#FFFFFF', amount);

/** Darken toward the palette's own black rather than pure black, so tints stay in-family. */
export const darken = (color: string, amount: number): string => mix(color, '#000000', amount);

/**
 * Relative luminance, 0..1, per WCAG 2.1.
 *
 * Used to decide whether text on an accent should be ink or white — the neon palette
 * spans `amber #FFB020` (luminance 0.53) and `violetDeep #3E1A78` (0.03), so a fixed
 * choice is wrong at one end or the other.
 */
export function luminance(color: string): number {
  const { r, g, b } = parseHex(color);
  const channel = (value: number): number => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Pick whichever of `light`/`dark` will read on `background`.
 *
 * The 0.45 threshold is empirical, not the WCAG 0.179 crossover: this palette is
 * saturated neon on near-black, and at the true crossover mid-tone accents like
 * `blue #2FA8FF` (0.36) take dark text, which looks muddy against the surrounding
 * white-on-ink UI. Biasing toward light text keeps the screen coherent.
 */
export function readableOn(background: string, light: string, dark: string): string {
  return luminance(background) > 0.45 ? dark : light;
}
