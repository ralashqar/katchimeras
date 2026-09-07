import Storage from 'expo-sqlite/kv-store';
export const devStorage = {
  read: (key: string) => Storage.getItem(`egg-snap-dev:${key}`),
  write: (key: string, value: string | null) => value === null ? Storage.removeItem(`egg-snap-dev:${key}`) : Storage.setItem(`egg-snap-dev:${key}`, value),
};
