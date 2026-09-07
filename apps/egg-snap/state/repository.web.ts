import { createProfileRepository, type Profile } from "./profile";
// Browser preview uses one atomic localStorage value. Native builds use SQLite.
export const repository = createProfileRepository({
  async read() {
    const value = localStorage.getItem("egg-snap-profile-v1");
    return value ? (JSON.parse(value) as Profile) : null;
  },
  async write(p) {
    localStorage.setItem("egg-snap-profile-v1", JSON.stringify(p));
  },
});
