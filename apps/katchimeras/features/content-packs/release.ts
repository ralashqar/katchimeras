import type { ActiveContentPack, ContentPack, ContentPackContent, ContentRegistrySnapshot } from '@/types/content-pack';

export const CONTENT_KINDS = ['characters', 'families', 'skins', 'mergeChains', 'mergeGenerators', 'islands', 'islandCampaigns', 'storyTiles', 'hatchables', 'missions', 'chapters', 'conversations', 'flows', 'liveEvents', 'harmonyDefinitions'] as const satisfies readonly (keyof ContentPackContent)[];

export function canonicalContent(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalContent).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalContent(entry)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** Validate the entire candidate set before downloading or replacing the stored pointer. */
export function validateReleaseComposition(packs: readonly ContentPack[]): string[] {
  const issues: string[] = [];
  const byId = new Map<string, ContentPack>();
  const entries = new Map<string, string>();
  const coordinates = new Map<string, string>();
  for (const pack of packs) {
    if (byId.has(pack.id)) issues.push(`pack ${pack.id} appears more than once`);
    byId.set(pack.id, pack);
    for (const kind of CONTENT_KINDS) {
      for (const entry of pack[kind] ?? []) {
        const record = entry as unknown as Record<string, unknown>;
        const id = record.id ?? record.chainId ?? record.companion ?? record.chapterId;
        const key = `${kind}:${String(id)}`;
        if (entries.has(key)) issues.push(`${key} is owned by both ${entries.get(key)} and ${pack.id}`);
        entries.set(key, pack.id);
        const tile = kind === 'hatchables' ? record.tile as Record<string, unknown> : record;
        if (kind === 'hatchables' || kind === 'storyTiles' || kind === 'islands') {
          const coord = tile?.coord as { q: number; r: number } | undefined;
          if (coord) {
            const position = `${coord.q},${coord.r}`;
            if (coordinates.has(position)) issues.push(`tile position ${position} is shared by ${coordinates.get(position)} and ${key}`);
            coordinates.set(position, key);
          }
        }
      }
    }
    for (const key of Object.keys(pack.art ?? {})) {
      const identity = `art:${key}`;
      if (entries.has(identity)) issues.push(`${identity} is owned by both ${entries.get(identity)} and ${pack.id}`);
      entries.set(identity, pack.id);
    }
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (pack: ContentPack) => {
    if (visiting.has(pack.id)) { issues.push(`cyclic dependency at ${pack.id}`); return; }
    if (visited.has(pack.id)) return;
    visiting.add(pack.id);
    for (const dependency of pack.dependencies ?? []) {
      const required = byId.get(dependency.id);
      if (!required || required.version !== dependency.version) issues.push(`${pack.id} requires ${dependency.id}@${dependency.version}`);
      else visit(required);
    }
    visiting.delete(pack.id);
    visited.add(pack.id);
  };
  packs.forEach(visit);
  return issues;
}

/** Combine candidate definitions for cross-pack reference validation; never register them globally. */
export function composeContentDocument(packs: readonly ContentPack[]): ContentPack {
  const result: ContentPack = { id: 'candidate-release', version: 1, contentSchemaVersion: Math.max(1, ...packs.map((pack) => pack.contentSchemaVersion)), art: Object.assign({}, ...packs.map((pack) => pack.art ?? {})) };
  for (const kind of CONTENT_KINDS) Object.assign(result, { [kind]: packs.flatMap((pack) => (pack[kind] ?? []) as readonly unknown[]) });
  return result;
}

/** Preserve saved definition identities until an explicit compatible migration exists. */
export function installContentRecord(snapshot: ContentRegistrySnapshot, record: ActiveContentPack): ContentRegistrySnapshot {
  const previous = snapshot.packs.find((entry) => entry.pack.id === record.pack.id);
  if (previous && canonicalContent(previous.pack) !== canonicalContent(record.pack)) {
    throw new Error(`Pack ${record.pack.id} is already installed. Publish additive content under a new id until a save migration is provided.`);
  }
  const packs = [...snapshot.packs.filter((entry) => entry.pack.id !== record.pack.id), record];
  const issues = validateReleaseComposition(packs.map((entry) => entry.pack));
  if (issues.length) throw new Error(issues.join('; '));
  return { version: 2, revision: snapshot.revision + 1, packs };
}

export function retireContentRecords(snapshot: ContentRegistrySnapshot, offeredIds: ReadonlySet<string>, now: number): ContentRegistrySnapshot {
  let changed = false;
  const packs = snapshot.packs.map((record) => {
    if (record.source !== 'remote') return record;
    const retiredAt = offeredIds.has(record.pack.id) ? undefined : record.retiredAt ?? now;
    if (retiredAt === record.retiredAt) return record;
    changed = true;
    return { ...record, retiredAt };
  });
  return changed ? { version: 2, revision: snapshot.revision + 1, packs } : snapshot;
}
