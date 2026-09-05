import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveZodiacSign, scorePersonality, validBirthday } from '../utils/world-identity-rules';

test('zodiac boundaries and year crossover are deterministic', () => {
  assert.equal(deriveZodiacSign(3, 20), 'pisces'); assert.equal(deriveZodiacSign(3, 21), 'aries');
  assert.equal(deriveZodiacSign(12, 21), 'sagittarius'); assert.equal(deriveZodiacSign(12, 22), 'capricorn');
  assert.equal(deriveZodiacSign(1, 19), 'capricorn'); assert.equal(deriveZodiacSign(1, 20), 'aquarius');
});

test('birthday validation accepts leap day and rejects impossible dates', () => {
  assert.equal(validBirthday(2, 29), true); assert.equal(validBirthday(2, 30), false); assert.equal(validBirthday(13, 1), false);
});

test('personality scoring recommends the strongest archetype', () => {
  assert.equal(scorePersonality({ 'free-afternoon': 'creator', progress: 'create', friends: 'spark' }), 'creator');
  assert.equal(scorePersonality({}), null);
});
