export function resolvePhotoLatitude(exif: Record<string, unknown> | null) {
  const rawLatitude = resolveExifCoordinate(exif, 'GPSLatitude');
  const ref = resolveDirectionRef(exif?.GPSLatitudeRef, 'N', 'S');
  if (rawLatitude == null) {
    return null;
  }

  return ref === 'S' ? -Math.abs(rawLatitude) : ref === 'N' ? Math.abs(rawLatitude) : rawLatitude;
}

export function resolvePhotoLongitude(exif: Record<string, unknown> | null) {
  const rawLongitude = resolveExifCoordinate(exif, 'GPSLongitude');
  const ref = resolveDirectionRef(exif?.GPSLongitudeRef, 'E', 'W');
  if (rawLongitude == null) {
    return null;
  }

  return ref === 'W' ? -Math.abs(rawLongitude) : ref === 'E' ? Math.abs(rawLongitude) : rawLongitude;
}

// Map placement must resolve latitude and longitude atomically. Unsigned EXIF
// numbers without their N/S and E/W references are ambiguous; assuming east is
// how a western photo can be mirrored into another country.
export function resolvePhotoCoordinatePair(exif: Record<string, unknown> | null) {
  const rawLatitude = resolveExifCoordinate(exif, 'GPSLatitude');
  const rawLongitude = resolveExifCoordinate(exif, 'GPSLongitude');
  if (rawLatitude == null || rawLongitude == null) return null;
  const latitudeRef = resolveDirectionRef(exif?.GPSLatitudeRef, 'N', 'S');
  const longitudeRef = resolveDirectionRef(exif?.GPSLongitudeRef, 'E', 'W');
  const latitude = latitudeRef === 'S'
    ? -Math.abs(rawLatitude)
    : latitudeRef === 'N'
      ? Math.abs(rawLatitude)
      : rawLatitude < 0
        ? rawLatitude
        : null;
  const longitude = longitudeRef === 'W'
    ? -Math.abs(rawLongitude)
    : longitudeRef === 'E'
      ? Math.abs(rawLongitude)
      : rawLongitude < 0
        ? rawLongitude
        : null;
  return isPlausibleGeographicCoordinate(latitude, longitude)
    ? { latitude, longitude: longitude as number }
    : null;
}

export function resolvePhotoLocation(
  nativeLatitude: unknown,
  nativeLongitude: unknown,
  exif: Record<string, unknown> | null
) {
  const latitude = finiteNumber(nativeLatitude);
  const longitude = finiteNumber(nativeLongitude);
  if (isPlausibleGeographicCoordinate(latitude, longitude)) return { latitude, longitude: longitude as number };
  return resolvePhotoCoordinatePair(exif);
}

export function isPlausibleGeographicCoordinate(latitude: unknown, longitude: unknown): latitude is number {
  const lat = finiteNumber(latitude);
  const lng = finiteNumber(longitude);
  if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  // (0,0) is the conventional missing-GPS sentinel (“Null Island”), not a
  // credible automatic photo location. Real equator/meridian points remain OK.
  return Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001;
}

function resolveExifCoordinate(exif: Record<string, unknown> | null, key: 'GPSLatitude' | 'GPSLongitude') {
  const rawValue = exif?.[key];
  if (typeof rawValue === 'number') {
    return rawValue;
  }

  if (Array.isArray(rawValue) && rawValue.length >= 3) {
    const [degrees, minutes, seconds] = rawValue;
    if ([degrees, minutes, seconds].every((part) => typeof part === 'number')) {
      return degrees + minutes / 60 + seconds / 3600;
    }
  }

  return null;
}

function resolveDirectionRef(value: unknown, positive: string, negative: string): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === positive || normalized.startsWith(positive)) return positive;
  if (normalized === negative || normalized.startsWith(negative)) return negative;
  return null;
}

function finiteNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
