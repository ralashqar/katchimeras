import { createContext, type PropsWithChildren, use, useCallback, useMemo, useState } from 'react';

type EggAvatarCustomizerModeValue = {
  active: boolean;
  close: () => void;
  open: () => void;
};

const EggAvatarCustomizerModeContext = createContext<EggAvatarCustomizerModeValue | null>(null);

export function EggAvatarCustomizerModeProvider({ children }: PropsWithChildren) {
  const [active, setActive] = useState(false);
  const open = useCallback(() => setActive(true), []);
  const close = useCallback(() => setActive(false), []);
  const value = useMemo(() => ({ active, close, open }), [active, close, open]);
  return <EggAvatarCustomizerModeContext value={value}>{children}</EggAvatarCustomizerModeContext>;
}

export function useEggAvatarCustomizerMode() {
  const value = use(EggAvatarCustomizerModeContext);
  if (!value) throw new Error('useEggAvatarCustomizerMode must be used inside EggAvatarCustomizerModeProvider.');
  return value;
}
