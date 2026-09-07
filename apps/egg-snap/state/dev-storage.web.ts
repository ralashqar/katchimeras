export const devStorage = {
  async read(key: string) { return localStorage.getItem(`egg-snap-dev:${key}`); },
  async write(key: string, value: string | null) { if (value === null) localStorage.removeItem(`egg-snap-dev:${key}`); else localStorage.setItem(`egg-snap-dev:${key}`, value); },
};
