import { Image, type ImageSourcePropType } from 'react-native';

// Turns a bundled (require'd) image into a base64 data URI, so it can be sent to
// the server-side comic generator as an input image without expo-asset/file-
// system. Resolves the asset to a fetchable URI (Metro URL in dev, bundled file
// in release), fetches the bytes, and reads them as a data URL via the RN
// FileReader/Blob polyfill. Best-effort: returns null on any failure.
export async function resolveBundledImageDataUri(source: ImageSourcePropType): Promise<string | null> {
  try {
    const resolved = Image.resolveAssetSource(source);
    if (!resolved?.uri) {
      return null;
    }

    const response = await fetch(resolved.uri);
    const blob = await response.blob();

    const dataUri = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });

    // Some platforms hand back an image/* data URI already; guard against an
    // unexpected non-image result (e.g. an HTML error page in dev).
    return dataUri && dataUri.startsWith('data:image') ? dataUri : null;
  } catch {
    return null;
  }
}
