import { KINGDOM_HEX_TILE_ALPHA_BOUNDS } from '@/constants/kingdom-hex-tile-bounds.gen';

/**
 * Where a hex tile's art actually is inside its image: the opaque box the
 * scene aligns to the hex. Bundled tiles have theirs measured into the
 * generated table at build time; a content pack ships its tiles' bounds with
 * the art, under the same key it names the art by, and registers them here.
 * Pure, so the scene builders and their tests can import it.
 */
export type AlphaBounds = { left: number; top: number; right: number; bottom: number };

const registered = new Map<string, AlphaBounds>();
const bundled = KINGDOM_HEX_TILE_ALPHA_BOUNDS as Readonly<Record<string, AlphaBounds>>;

/** Every plain hex tile shares this box: the fallback for a key nobody measured. */
export const DEFAULT_HEX_ALPHA_BOUNDS: AlphaBounds = bundled['default_hex_tile.webp']!;

export function registerAlphaBounds(entries: Readonly<Record<string, AlphaBounds>>): void {
  for (const [key, value] of Object.entries(entries)) {
    if (!isAlphaBounds(value)) continue;
    registered.set(key, { left: value.left, top: value.top, right: value.right, bottom: value.bottom });
  }
}

export function clearAlphaBounds(): void {
  registered.clear();
}

export function isAlphaBounds(value: unknown): value is AlphaBounds {
  if (!value || typeof value !== 'object') return false;
  const bounds = value as Record<string, unknown>;
  return ['left', 'top', 'right', 'bottom'].every((side) => typeof bounds[side] === 'number' && Number.isFinite(bounds[side]))
    && (bounds.right as number) > (bounds.left as number) && (bounds.bottom as number) > (bounds.top as number);
}

/** The bounds under a key: registered first, then the bundled table, else null. */
export function alphaBounds(key: string): AlphaBounds | null {
  return registered.get(key) ?? bundled[key] ?? null;
}

/** The bounds under a key, or the plain hex box when nobody measured that key. */
export function hexAlphaBounds(key: string): AlphaBounds {
  return alphaBounds(key) ?? DEFAULT_HEX_ALPHA_BOUNDS;
}
