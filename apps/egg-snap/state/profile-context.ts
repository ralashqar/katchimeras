import { createContext, useContext } from 'react';
import type { Profile } from './profile';

type ProfileContextValue = {
  profile: Profile | null;
  error: string | null;
  refresh: () => Promise<void>;
  act: (work: () => Promise<Profile>) => Promise<Profile>;
};
// Keep context identity independent from repository/content hot reloads.
export const ProfileContext = createContext<ProfileContextValue | null>(null);
export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('ProfileProvider missing');
  return value;
}
