import { useEffect, useState } from 'react';

export function useMicrocopy(timeoutMs = 2400) {
  const [microcopy, setMicrocopy] = useState<string | null>(null);

  useEffect(() => {
    if (!microcopy) {
      return;
    }

    const id = setTimeout(() => setMicrocopy(null), timeoutMs);
    return () => clearTimeout(id);
  }, [microcopy, timeoutMs]);

  return {
    microcopy,
    setMicrocopy,
  };
}
