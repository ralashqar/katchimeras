import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPlausibleGeographicCoordinate,
  resolvePhotoCoordinatePair,
  resolvePhotoLocation,
} from '@/utils/photo-location';

test('EXIF coordinate references are normalized and west remains negative', () => {
  const coordinate = resolvePhotoCoordinatePair({
    GPSLatitude: [51, 30, 0],
    GPSLatitudeRef: 'north',
    GPSLongitude: [0, 8, 24],
    GPSLongitudeRef: 'west',
  });
  assert.equal(coordinate?.latitude, 51.5);
  assert.ok(Math.abs((coordinate?.longitude ?? 0) - -0.14) < 0.000001);
});

test('ambiguous unsigned EXIF coordinates are rejected instead of assumed east', () => {
  assert.equal(resolvePhotoCoordinatePair({
    GPSLatitude: 51.5,
    GPSLongitude: 0.14,
  }), null);
});

test('native photo coordinates accept numeric strings but reject sentinels and invalid bounds', () => {
  assert.deepEqual(resolvePhotoLocation('51.5', '-0.14', null), {
    latitude: 51.5,
    longitude: -0.14,
  });
  assert.equal(resolvePhotoLocation(0, 0, null), null);
  assert.equal(resolvePhotoLocation(95, -0.14, null), null);
  assert.equal(isPlausibleGeographicCoordinate(51.5, -181), false);
});

test('a bad native pair can fall back to a complete signed EXIF pair', () => {
  assert.deepEqual(resolvePhotoLocation(0, 0, {
    GPSLatitude: 51.5,
    GPSLatitudeRef: 'N',
    GPSLongitude: 0.14,
    GPSLongitudeRef: 'W',
  }), {
    latitude: 51.5,
    longitude: -0.14,
  });
});
