import { seededShuffle } from './trivia-packs';

export function createPattern(seed: string, length: number, padCount = 4): number[] {
  const pool = Array.from({ length: Math.max(length * 3, padCount) }, (_, index) => index % padCount);
  return seededShuffle(pool, seed).slice(0, length);
}

export function patternMatches(pattern: number[], input: number[]): boolean {
  return input.every((value, index) => pattern[index] === value);
}

export function patternComplete(pattern: number[], input: number[]): boolean {
  return input.length === pattern.length && patternMatches(pattern, input);
}

