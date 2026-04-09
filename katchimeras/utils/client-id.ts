function randomSegment(length: number) {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length)
    .padEnd(length, '0');
}

export function createClientId(prefix?: string) {
  const base = `${Date.now().toString(36)}-${randomSegment(6)}-${randomSegment(6)}`;
  return prefix ? `${prefix}_${base}` : base;
}
