import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';

// On-device perceptual hashing — the visual-similarity signal that drives photo
// curation. Each frame is decoded, shrunk to a tiny grayscale grid, and turned
// into a 64-bit difference hash (dHash). Look-alikes produce near-identical
// hashes; the curation layer collapses frames whose hashes are within a small
// Hamming distance. All pixel work happens locally through Skia (already a
// dependency) — no image ever leaves the device.
//
// dHash compares each pixel to its right-hand neighbour, so it is robust to
// brightness/contrast shifts and minor recompression — exactly the "looks the
// same" case (re-shooting the same subject) we want to catch.

const HASH_WIDTH = 9; // 9 columns → 8 horizontal comparisons per row
const HASH_HEIGHT = 8; // 8 rows → 64 bits total → 16 hex characters

// A single on-device read of a frame: its perceptual hash plus cheap quality
// signals computed from the very same decoded grayscale grid (so the extra
// information costs nothing beyond the decode we already pay for).
//   - meanLuminance: average brightness (0-255). A near-zero mean is a fully
//     black/blacked-out frame.
//   - luminanceRange: max minus min brightness across the grid (0-255). A tiny
//     range is a flat frame with no tonal structure — a blank wall, a lens-cap
//     shot, or an over-blurred/over-exposed throwaway.
// Both are deliberately coarse (read off the 9x8 grid); they reliably catch the
// "fully black" and "no detail" cases the curator wants to drop without
// pretending to be a real sharpness model.
export type PhotoSignature = {
  hash: string;
  meanLuminance: number;
  luminanceRange: number;
};

// Best-effort: returns the frame's signature, or null if it can't be decoded
// (unsupported URI, transient failure). Callers treat null as "no signal" and
// fall back to time-based heuristics / never drop on a guess.
export async function computePhotoSignature(uri: string): Promise<PhotoSignature | null> {
  // MEMORY: a decoded full-resolution photo is 50-190MB of RGBA. Callers should
  // pass a small thumbnail (data: URI) whenever possible; and every Skia object
  // is disposed EXPLICITLY below — JS GC lags behind native allocations, and a
  // burst of undisposed decodes is exactly what gets the app jetsam-killed.
  let data: ReturnType<typeof Skia.Data.fromBase64> | null = null;
  let image: ReturnType<typeof Skia.Image.MakeImageFromEncoded> = null;
  let surface: ReturnType<typeof Skia.Surface.MakeOffscreen> = null;
  try {
    data = uri.startsWith('data:')
      ? Skia.Data.fromBase64(uri.slice(uri.indexOf(',') + 1))
      : await Skia.Data.fromURI(uri);
    if (!data) {
      return null;
    }

    image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) {
      return null;
    }

    surface = Skia.Surface.MakeOffscreen(HASH_WIDTH, HASH_HEIGHT);
    if (!surface) {
      return null;
    }

    const canvas = surface.getCanvas();
    const paint = Skia.Paint();
    canvas.drawImageRect(
      image,
      Skia.XYWHRect(0, 0, image.width(), image.height()),
      Skia.XYWHRect(0, 0, HASH_WIDTH, HASH_HEIGHT),
      paint
    );
    surface.flush();

    const snapshot = surface.makeImageSnapshot();
    const pixels = snapshot.readPixels(0, 0, {
      width: HASH_WIDTH,
      height: HASH_HEIGHT,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });
    snapshot.dispose();
    if (!pixels) {
      return null;
    }

    return signatureFromRgba(pixels, HASH_WIDTH, HASH_HEIGHT);
  } catch {
    return null;
  } finally {
    surface?.dispose();
    image?.dispose();
    data?.dispose();
  }
}

// Back-compat thin wrapper for callers that only need the similarity hash.
export async function computePhotoHash(uri: string): Promise<string | null> {
  return (await computePhotoSignature(uri))?.hash ?? null;
}

function signatureFromRgba(pixels: Uint8Array | Float32Array, width: number, height: number): PhotoSignature {
  const gray = new Array<number>(width * height);
  let min = 255;
  let max = 0;
  let sum = 0;
  for (let index = 0; index < width * height; index += 1) {
    const r = Number(pixels[index * 4]);
    const g = Number(pixels[index * 4 + 1]);
    const b = Number(pixels[index * 4 + 2]);
    const value = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[index] = value;
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  let bits = '';
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      bits += gray[y * width + x] > gray[y * width + x + 1] ? '1' : '0';
    }
  }

  let hex = '';
  for (let index = 0; index < bits.length; index += 4) {
    hex += Number.parseInt(bits.slice(index, index + 4), 2).toString(16);
  }

  return {
    hash: hex,
    meanLuminance: sum / (width * height),
    luminanceRange: max - min,
  };
}
