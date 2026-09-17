import type { ContentPack } from '@/types/content-pack';
import { normalizeContentPack } from './normalize-content-pack';
import { composeContentDocument, CONTENT_KINDS, validateReleaseComposition } from './release';

/** Validate references against the full candidate release, never the running release. */
export function normalizeContentRelease(documents: readonly unknown[]): { packs: ContentPack[]; issues: string[] } {
  const packs: ContentPack[] = [];
  const issues: string[] = [];
  for (const document of documents) {
    if (!document || typeof document !== 'object' || Array.isArray(document)) { issues.push('a pack is an object'); continue; }
    const raw = document as Record<string, unknown>;
    const metadata = { ...raw };
    for (const kind of CONTENT_KINDS) delete metadata[kind];
    delete metadata.art;
    const header = normalizeContentPack(metadata);
    issues.push(...header.issues);
    if (!header.pack) continue;
    const pack = { ...header.pack, art: raw.art } as ContentPack;
    if (pack.contentSchemaVersion < 2 && ((Array.isArray(raw.liveEvents) && raw.liveEvents.length) || (Array.isArray(raw.chapters) && raw.chapters.some((chapter) => chapter?.afterChapterId)))) {
      issues.push(`${pack.id}: live events and Journey continuations require content schema 2`);
    }
    if (pack.contentSchemaVersion < 3 && ((Array.isArray(raw.liveEvents) && raw.liveEvents.some(e => e?.authority === 'local')) || (Array.isArray(raw.harmonyDefinitions) && raw.harmonyDefinitions.length))) issues.push(`${pack.id}: local events and Harmony require content schema 3`);
    if (pack.contentSchemaVersion < 4 && (
      (Array.isArray(raw.liveEvents) && raw.liveEvents.some(e => e?.encounters?.some((n: Record<string, unknown>) => n.companionId || n.actionTitle || n.hexId !== 'mossprout-garden')))
      || (Array.isArray(raw.hatchables) && raw.hatchables.some(h => h?.availability?.kind === 'event_joined'))
    )) issues.push(`${pack.id}: world event presentation and event-introduced tiles require content schema 4`);
    if (pack.contentSchemaVersion < 5 && (
      (Array.isArray(raw.storyTiles) && raw.storyTiles.some((tile) => tile?.residentSkinId !== undefined))
      || (Array.isArray(raw.chapters) && raw.chapters.some((chapter) => chapter?.speakerSkinId !== undefined))
    )) issues.push(`${pack.id}: resident and speaker forms require content schema 5`);
    for (const kind of CONTENT_KINDS) {
      if (raw[kind] !== undefined && !Array.isArray(raw[kind])) issues.push(`${raw.id}: ${kind} must be a list`);
      else if (raw[kind]) Object.assign(pack, { [kind]: raw[kind] });
    }
    if (raw.art !== undefined && (!raw.art || typeof raw.art !== 'object' || Array.isArray(raw.art))) issues.push(`${raw.id}: art must map keys to entries`);
    packs.push(pack);
  }
  if (issues.length) return { packs: [], issues };
  try {
    issues.push(...validateReleaseComposition(packs));
    if (issues.length) return { packs: [], issues };
    const combined = normalizeContentPack(composeContentDocument(packs));
    issues.push(...combined.issues);
    if (!combined.pack || issues.length) return { packs: [], issues };
    return { packs: packs.map((pack) => ({ ...pack, art: Object.fromEntries(Object.keys(pack.art ?? {}).map((key) => [key, combined.pack!.art![key]!])) })), issues: [] };
  } catch (error) {
    return { packs: [], issues: [`Invalid release: ${error instanceof Error ? error.message : String(error)}`] };
  }
}
