export function resolvePhotoLatitude(exif: Record<string, unknown> | null) {
  const rawLatitude = resolveExifCoordinate(exif, 'GPSLatitude');
  const ref = typeof exif?.GPSLatitudeRef === 'string' ? exif.GPSLatitudeRef : null;
  if (rawLatitude == null) {
    return null;
  }

  return ref === 'S' ? -rawLatitude : rawLatitude;
}

export function resolvePhotoLongitude(exif: Record<string, unknown> | null) {
  const rawLongitude = resolveExifCoordinate(exif, 'GPSLongitude');
  const ref = typeof exif?.GPSLongitudeRef === 'string' ? exif.GPSLongitudeRef : null;
  if (rawLongitude == null) {
    return null;
  }

  return ref === 'W' ? -rawLongitude : rawLongitude;
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
