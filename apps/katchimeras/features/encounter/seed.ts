/** FNV-1a over a string: the same numbers the engine draws its own luck from, for an encounter's seeded turns. */
export function hashSeed(value: string): number {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}

/** A number in [0, 1) for a label. */
export function seededUnit(value: string): number {
  return hashSeed(value) / 0x100000000;
}
