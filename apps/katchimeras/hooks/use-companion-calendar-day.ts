import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDayId } from '@/utils/world-identity-rules';

export function useCompanionCalendarDay() {
  const [dayId, setDayId] = useState(localDayId);
  useEffect(() => {
    const refresh = () => setDayId(localDayId());
    const timer = setInterval(refresh, 30000);
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); app.remove(); };
  }, []);
  return dayId;
}
