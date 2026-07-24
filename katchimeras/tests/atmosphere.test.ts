import assert from 'node:assert/strict';
import test from 'node:test';

import {
  atmosphereParticleCount,
  atmosphereLayerParticleCount,
  atmospherePresetUsesAuthoredSprites,
  atmosphereParticleFamily,
  atmospherePresetForWeather,
  atmospherePresetSeedOffset,
  atmosphereTargetIncludes,
  generateAtmosphereParticles,
  resolvedAtmosphereQuality,
} from '../utils/atmosphere';

test('authored sprite effects are limited to the polished atlas families', () => {
  assert.equal(atmospherePresetUsesAuthoredSprites('falling_leaves'), true);
  assert.equal(atmospherePresetUsesAuthoredSprites('petal_drift'), true);
  assert.equal(atmospherePresetUsesAuthoredSprites('celebration_drift'), true);
  assert.equal(atmospherePresetUsesAuthoredSprites('dandelion_seeds'), true);
  assert.equal(atmospherePresetUsesAuthoredSprites('dream_wisps'), true);
  assert.equal(atmospherePresetUsesAuthoredSprites('journey_breeze'), true);
  assert.equal(atmospherePresetUsesAuthoredSprites('social_ribbons'), true);
  assert.equal(atmospherePresetUsesAuthoredSprites('rain'), false);
  assert.equal(atmospherePresetUsesAuthoredSprites('golden_motes'), false);
});

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
  assert.equal(atmosphereParticleCount('celebration_drift', 'medium', 390, 1), 30);
  assert.equal(atmosphereParticleCount('golden_motes', 'medium', 390, 1), 26);
  assert.equal(atmosphereParticleCount('journey_breeze', 'medium', 390, 1), 10);
  assert.equal(atmosphereParticleCount('quiet_dust', 'medium', 390, 1), 18);
  assert.equal(atmosphereLayerParticleCount('journey_breeze', 'medium', 390, 1, 0.6), 6);
});

test('expressive presets resolve into distinct deterministic particle families', () => {
  assert.equal(atmosphereParticleFamily('celebration_drift'), 'drift');
  assert.equal(atmosphereParticleFamily('fireflies'), 'glow');
  assert.equal(atmosphereParticleFamily('journey_breeze'), 'breeze');
  assert.equal(atmosphereParticleFamily('dream_wisps'), 'sparse');
  assert.notEqual(atmospherePresetSeedOffset('fireflies'), atmospherePresetSeedOffset('golden_motes'));
  assert.equal(atmospherePresetSeedOffset('fireflies'), atmospherePresetSeedOffset('fireflies'));
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
