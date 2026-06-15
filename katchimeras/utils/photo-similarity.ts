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

// Best-effort: returns a 16-character hex hash, or null if the frame can't be
// decoded (unsupported URI, transient failure). Callers treat null as "no
// similarity signal" and fall back to the time-based heuristic.
export async function computePhotoHash(uri: string): Promise<string | null> {
  try {
    const data = await Skia.Data.fromURI(uri);
    if (!data) {
      return null;
    }

    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) {
      return null;
    }

    const surface = Skia.Surface.MakeOffscreen(HASH_WIDTH, HASH_HEIGHT);
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

    const pixels = surface.makeImageSnapshot().readPixels(0, 0, {
      width: HASH_WIDTH,
      height: HASH_HEIGHT,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });
    if (!pixels) {
      return null;
    }

    return dHashFromRgba(pixels, HASH_WIDTH, HASH_HEIGHT);
  } catch {
    return null;
  }
}

function dHashFromRgba(pixels: Uint8Array | Float32Array, width: number, height: number): string {
  const gray = new Array<number>(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const r = Number(pixels[index * 4]);
    const g = Number(pixels[index * 4 + 1]);
    const b = Number(pixels[index * 4 + 2]);
    gray[index] = 0.299 * r + 0.587 * g + 0.114 * b;
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
  return hex;
}
