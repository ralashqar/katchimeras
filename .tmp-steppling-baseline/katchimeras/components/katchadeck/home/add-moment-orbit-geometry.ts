export function getOrbitOffset(index: number, count: number, radius: number) {
  const safeCount = Math.max(1, count);
  const angle = (-90 + (360 / safeCount) * index) * (Math.PI / 180);

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}
