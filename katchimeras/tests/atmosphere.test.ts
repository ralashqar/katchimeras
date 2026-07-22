import assert from 'node:assert/strict';
import test from 'node:test';

import {
  atmosphereParticleCount,
  atmospherePresetForWeather,
  atmosphereTargetIncludes,
  generateAtmosphereParticles,
  resolvedAtmosphereQuality,
} from '../utils/atmosphere';

test('atmosphere particle layouts are deterministic and normalized', () => {
  const first = generateAtmosphereParticles(12, 407);
  const second = generateAtmosphereParticles(12, 407);
  const different = generateAtmosphereParticles(12, 408);

  assert.deepEqual(first, second);
  assert.notDeepEqual(first, different);
  assert.equal(first.length, 12);
  for (const particle of first) {
    assert.ok(particle.x >= 0 && particle.x <= 1);
    assert.ok(particle.y >= 0 && particle.y <= 1);
    assert.ok(particle.depth >= 0.35 && particle.depth <= 1);
  }
});

test('automatic atmosphere quality and particle caps stay bounded', () => {
  assert.equal(resolvedAtmosphereQuality('auto', 320), 'low');
  assert.equal(resolvedAtmosphereQuality('auto', 390), 'medium');
  assert.equal(resolvedAtmosphereQuality('auto', 1024), 'high');
  assert.equal(resolvedAtmosphereQuality('low', 1024), 'low');

  assert.equal(atmosphereParticleCount('rain', 'low', 390, 1), 32);
  assert.equal(atmosphereParticleCount('snow', 'medium', 390, 1), 36);
  assert.equal(atmosphereParticleCount('storm', 'high', 390, 1), 88);
  assert.equal(atmosphereParticleCount('fog', 'high', 390, 1), 0);
  assert.ok(atmosphereParticleCount('rain', 'medium', 390, 0) < 56);
});

test('stored weather resolves without introducing render-time weather work', () => {
  assert.equal(atmospherePresetForWeather('rain'), 'rain');
  assert.equal(atmospherePresetForWeather('snow'), 'snow');
  assert.equal(atmospherePresetForWeather('fog'), 'fog');
  assert.equal(atmospherePresetForWeather('storm'), 'storm');
  assert.equal(atmospherePresetForWeather('clear'), 'none');
  assert.equal(atmospherePresetForWeather('cloudy'), 'none');
  assert.equal(atmospherePresetForWeather(undefined), 'none');
});

test('dev override targeting is explicit per live surface', () => {
  assert.equal(atmosphereTargetIncludes('off', 'today'), false);
  assert.equal(atmosphereTargetIncludes('today', 'today'), true);
  assert.equal(atmosphereTargetIncludes('today', 'kingdom'), false);
  assert.equal(atmosphereTargetIncludes('kingdom', 'kingdom'), true);
  assert.equal(atmosphereTargetIncludes('both', 'today'), true);
  assert.equal(atmosphereTargetIncludes('both', 'kingdom'), true);
});
