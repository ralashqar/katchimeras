import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const swiftPath = resolve(
  process.cwd(),
  'modules/katchimera-map-search/ios/KatchimeraMapSearchModule.swift'
);
const bridgePath = resolve(
  process.cwd(),
  'modules/katchimera-map-search/src/KatchimeraMapSearch.ts'
);

test('the Expo bridge exposes the photo place lookup contract', async () => {
  const [swift, bridge] = await Promise.all([
    readFile(swiftPath, 'utf8'),
    readFile(bridgePath, 'utf8'),
  ]);

  assert.match(swift, /AsyncFunction\("resolveNearbyPlacesAsync"\)/);
  assert.match(swift, /MKLocalPointsOfInterestRequest/);
  assert.match(swift, /MKReverseGeocodingRequest/);
  assert.match(swift, /CLGeocoder/);
  assert.match(swift, /areasOfInterest/);
  assert.match(swift, /resolveAreasOfInterest/);
  assert.match(swift, /request\.resultTypes = \[\.pointOfInterest, \.physicalFeature\]/);
  assert.match(swift, /"areaCandidates"/);
  assert.match(swift, /"nameMatchScore"/);
  assert.match(swift, /latitudinalMeters: 10_000/);
  assert.match(swift, /response\.mapItems\.prefix\(25\)/);
  assert.match(swift, /min\(max\(radiusMeters, 40\), 200\)/);
  assert.match(swift, /"normalizedCategory"/);
  assert.match(swift, /"distanceMeters"/);
  assert.match(swift, /identifier\.rawValue/);
  assert.match(swift, /alternateIdentifiers\.map\(\\\.rawValue\)/);
  assert.doesNotMatch(swift, /identifierString/);
  assert.match(bridge, /resolveNearbyPlacesAsync/);
});
