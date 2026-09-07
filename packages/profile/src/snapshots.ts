import { installProfileDomains } from './domains';
export type SnapshotDomain = {
  capture(): Promise<unknown>;
  validate(value: unknown): void;
  install(value: unknown): Promise<void>;
};
export type ProfileSnapshot = { version: 1; gameId: string; domains: Record<string, unknown> };
export type RestoreJournal = { target: ProfileSnapshot; rollback: ProfileSnapshot };

/** A durable intent makes a multi-store replacement recoverable after termination. */
export function createProfileSnapshots(options: {
  gameId: string;
  enabled: () => boolean;
  flush(): Promise<void>;
  domains: Record<string, SnapshotDomain>;
  readJournal(): Promise<RestoreJournal | null>;
  writeJournal(value: RestoreJournal | null): Promise<void>;
  saveRollback?(snapshot: ProfileSnapshot): Promise<void>;
}) {
  let busy = false;
  const assertEnabled = () => { if (!options.enabled()) throw new Error('Developer profiles are disabled'); };
  const validate = (value: ProfileSnapshot) => {
    if (value?.version !== 1 || value.gameId !== options.gameId) throw new Error('Snapshot belongs to another game or version');
    for (const [key, domain] of Object.entries(options.domains)) domain.validate(value.domains[key]);
  };
  const capture = async (): Promise<ProfileSnapshot> => {
    assertEnabled();
    await options.flush();
    const domains: Record<string, unknown> = {};
    for (const [key, domain] of Object.entries(options.domains)) domains[key] = await domain.capture();
    return { version: 1, gameId: options.gameId, domains };
  };
  const install = async (snapshot: ProfileSnapshot) => {
    validate(snapshot);
    await installProfileDomains(Object.entries(options.domains).map(([key, domain]) => ({ validate: () => domain.validate(snapshot.domains[key]), install: () => domain.install(snapshot.domains[key]) })));
  };
  return {
    capture, validate,
    async restore(target: ProfileSnapshot) {
      assertEnabled();
      if (busy) throw new Error('A profile restore is already running');
      validate(target);
      busy = true;
      try {
        const rollback = await capture();
        await options.saveRollback?.(rollback);
        await options.writeJournal({ target, rollback });
        await install(target);
        await options.writeJournal(null);
        return rollback;
      } finally { busy = false; }
    },
    async recover() {
      assertEnabled();
      const journal = await options.readJournal();
      if (!journal) return;
      await install(journal.target);
      await options.writeJournal(null);
    },
  };
}
