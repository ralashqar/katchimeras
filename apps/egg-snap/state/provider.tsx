import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { repository } from "./repository";
import type { Profile } from "./profile";
import { ProfileContext as Context } from './profile-context';
export { useProfile } from './profile-context';
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const act = useCallback(async (work: () => Promise<Profile>) => {
    try {
      const p = await work();
      setProfile(p);
      setError(null);
      return p;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save progress");
      throw e;
    }
  }, []);
  const refresh = useCallback(async () => {
    await act(repository.load);
  }, [act]);
  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);
  return (
    <Context.Provider value={{ profile, error, refresh, act }}>
      {children}
    </Context.Provider>
  );
}
