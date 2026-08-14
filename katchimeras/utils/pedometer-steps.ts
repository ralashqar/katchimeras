export type PedometerStepDay = { dayId: string; totalSteps: number; observedAt: string };
export type PedometerAccess = 'should_request' | 'available' | 'denied' | 'unsupported';

async function loadPedometer() {
  if (process.env.EXPO_OS === 'web') return null;
  const { Pedometer } = await import('expo-sensors');
  return Pedometer;
}

export async function getPedometerAccess(): Promise<PedometerAccess> {
  try {
    const pedometer = await loadPedometer();
    if (!pedometer || !(await pedometer.isAvailableAsync())) return 'unsupported';
    const permission = await pedometer.getPermissionsAsync();
    if (permission.granted) return 'available';
    if (permission.canAskAgain === false) return 'denied';
    return 'should_request';
  } catch {
    return 'unsupported';
  }
}

export async function requestPedometerAccess(): Promise<boolean> {
  try {
    const pedometer = await loadPedometer();
    if (!pedometer) return false;
    return (await pedometer.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export async function readRecentPedometerStepDays(now = new Date(), count = 4): Promise<PedometerStepDay[]> {
  try {
    const pedometer = await loadPedometer();
    if (!pedometer || !(await pedometer.isAvailableAsync())) return [];
    const observedAt = now.toISOString();
    const days = Array.from({ length: count }, (_, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (count - 1 - offset), 12);
      const dayId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const end = offset === count - 1
        ? now
        : new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
      return { dayId, start, end };
    });
    return Promise.all(days.map(async ({ dayId, start, end }) => {
      try {
        const result = await pedometer.getStepCountAsync(start, end);
        return { dayId, totalSteps: Math.max(0, Math.round(result.steps ?? 0)), observedAt };
      } catch {
        return { dayId, totalSteps: 0, observedAt };
      }
    }));
  } catch {
    return [];
  }
}
