import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';

import { visiblePixelBoundsFromRgba, type VisiblePixelBounds } from '@/utils/alpha-bounds';

export async function measureImageAlphaBounds(uri: string): Promise<VisiblePixelBounds | null> {
  let data: ReturnType<typeof Skia.Data.fromBase64> | null = null;
  let image: ReturnType<typeof Skia.Image.MakeImageFromEncoded> = null;
  try {
    data = uri.startsWith('data:')
      ? Skia.Data.fromBase64(uri.slice(uri.indexOf(',') + 1))
      : await Skia.Data.fromURI(uri);
    if (!data) return null;

    image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) return null;
    const width = image.width();
    const height = image.height();
    const pixels = image.readPixels(0, 0, {
      width,
      height,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    });
    if (!pixels) return null;
    return visiblePixelBoundsFromRgba(pixels, width, height);
  } catch {
    return null;
  } finally {
    image?.dispose();
    data?.dispose();
  }
}
