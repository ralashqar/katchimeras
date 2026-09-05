export type VisiblePixelBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export const HEX_TILE_ALPHA_THRESHOLD = 16;
export const HEX_TILE_ALIGNMENT_SIZE = 1024;

export function visiblePixelBoundsFromRgba(
  pixels: Uint8Array | Float32Array,
  width: number,
  height: number,
  targetSize = HEX_TILE_ALIGNMENT_SIZE,
  alphaThreshold = HEX_TILE_ALPHA_THRESHOLD
): VisiblePixelBounds | null {
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4) return null;

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let index = 0; index < width * height; index += 1) {
    const rawAlpha = Number(pixels[index * 4 + 3]);
    const alpha = pixels instanceof Float32Array && rawAlpha <= 1 ? rawAlpha * 255 : rawAlpha;
    if (alpha < alphaThreshold) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + 1);
    bottom = Math.max(bottom, y + 1);
  }

  if (right <= left || bottom <= top) return null;
  return {
    left: Math.floor((left / width) * targetSize),
    top: Math.floor((top / height) * targetSize),
    right: Math.ceil((right / width) * targetSize),
    bottom: Math.ceil((bottom / height) * targetSize),
  };
}
