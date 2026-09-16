import { MOSSPROUT_CHAPTER } from '@/constants/companion-journey-chapters/mossprout';
import { MOSSPROUT_OLD_GROVE } from '@/constants/story-tiles/mossprout-old-grove';
import { companionConversationDefinitionsBundled } from '@/constants/companion-conversations-v2';
import { MERGE_ITEM_CATALOG } from '@/constants/merge-world-catalog';
import { journeyEpisodeConversation } from '@/constants/companion-journey-chapters/episode-conversation';

export type JourneyDraft = { kind: 'journey-draft'; version: 1; sourceRevision: string; name: string; edits: Record<string, string | number>; tileArt: string | null };
export type JourneyPreview = { kind: 'journey-preview'; version: 1; draft: JourneyDraft; image: string | null };
export type AuthorField = { path: string; label: string; value: string | number; max: number; min?: number; options?: { id: string; name: string }[] };
const ids = new Set(MOSSPROUT_CHAPTER.episodes.flatMap((episode) => episode.conversationId ? [episode.conversationId] : []));
const source = { chapter: MOSSPROUT_CHAPTER, tiles: [MOSSPROUT_OLD_GROVE], conversations: companionConversationDefinitionsBundled.filter((entry) => ids.has(entry.id)) };
const serial = JSON.stringify(source, (_key, value) => { if (typeof value === 'function') throw new Error('Journey source still contains executable content'); return value; });
let fingerprint = 2166136261;
for (const char of serial) fingerprint = Math.imul(fingerprint ^ char.charCodeAt(0), 16777619) >>> 0;
export const JOURNEY_SOURCE_REVISION = `mossprout-${fingerprint.toString(16)}-${serial.length}`;
const textKeys = new Set(['title', 'purpose', 'text', 'prompt', 'message', 'label', 'reply', 'description', 'reveal', 'foreshadow', 'complete', 'helperText']);
const numberKeys = new Set(['reflectMs', 'ms', 'count', 'level', 'quantity', 'coins', 'bond']);
const fields: AuthorField[] = [];
function visit(value: unknown, path: string[] = []) {
  if (Array.isArray(value)) { value.forEach((entry, index) => visit(entry, [...path, String(index)])); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    const next = [...path, key];
    if (typeof entry === 'string' && textKeys.has(key)) fields.push({ path: next.join('/'), label: key, value: entry, max: key === 'title' || key === 'label' ? 160 : 1200 });
    else if (typeof entry === 'number' && numberKeys.has(key)) fields.push({ path: next.join('/'), label: key, value: entry,
      min: key === 'quantity' || key === 'level' ? 1 : 0, max: key === 'level' ? 4 : key === 'reflectMs' || key === 'ms' ? 30 * 86400000 : 10000 });
    else if (key === 'definitionId' && typeof entry === 'string') fields.push({ path: next.join('/'), label: 'Merge item', value: entry, max: 160,
      options: MERGE_ITEM_CATALOG.filter((item) => !item.progressionOnly).map((item) => ({ id: item.id, name: item.name })) });
    else visit(entry, next);
  }
}
visit(source);
const allowed = new Map(fields.map((field) => [field.path, field]));
export function journeyAuthoringSource() {
  return { source: JSON.parse(serial) as typeof source, revision: JOURNEY_SOURCE_REVISION, fields,
    draft: { kind: 'journey-draft', version: 1, sourceRevision: JOURNEY_SOURCE_REVISION, name: 'Mossprout · Growing Again', edits: {}, tileArt: null } as JourneyDraft };
}
export function validateJourneyDraft(input: unknown): { draft: JourneyDraft | null; issues: string[] } {
  const issues: string[] = [];
  const d = input as JourneyDraft;
  if (!d || d.kind !== 'journey-draft' || d.version !== 1 || d.sourceRevision !== JOURNEY_SOURCE_REVISION) return { draft: null, issues: ['Source revision differs. Reopen the current Mossprout arc; this draft has not been changed.'] };
  if (typeof d.name !== 'string' || !d.name.trim() || d.name.length > 120) issues.push('Draft name must contain 1–120 characters');
  if (d.tileArt !== null && (typeof d.tileArt !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(d.tileArt))) issues.push('Choose a known tile asset');
  if (!d.edits || typeof d.edits !== 'object' || Array.isArray(d.edits)) return { draft: null, issues: [...issues, 'Invalid edit map'] };
  for (const [path, value] of Object.entries(d.edits)) {
    const field = allowed.get(path);
    if (!field) { issues.push(`${path}: this slice cannot change IDs, graph structure or executable behavior`); continue; }
    if (typeof field.value === 'number') {
      if (!Number.isSafeInteger(value) || Number(value) < field.min! || Number(value) > field.max) issues.push(`${path}: enter an integer from ${field.min} to ${field.max}`);
    } else if (typeof value !== 'string' || value.length > field.max || (!value.trim() && !['reply', 'helperText'].includes(field.label))) issues.push(`${path}: invalid or oversized text`);
    if (field.options && !field.options.some((option) => option.id === value)) issues.push(`${path}: unknown or progression-only merge item`);
  }
  return { draft: issues.length ? null : JSON.parse(JSON.stringify(d)), issues };
}
export function materializeJourneyDraft(input: unknown) {
  const checked = validateJourneyDraft(input);
  if (!checked.draft) throw new Error(checked.issues.join('\n'));
  const result = JSON.parse(serial) as typeof source;
  for (const [path, value] of Object.entries(checked.draft.edits)) {
    const parts = path.split('/'); let cursor = result as unknown as Record<string, unknown>;
    for (const part of parts.slice(0, -1)) cursor = cursor[part] as Record<string, unknown>;
    cursor[parts[parts.length - 1]] = value;
  }
  return result;
}
export function previewJourneyEpisode(input: JourneyDraft, index: number) {
  const model = materializeJourneyDraft(input);
  const episode = model.chapter.episodes[index];
  if (!episode) throw new Error('Choose an episode');
  const conversation = episode.conversationId ? model.conversations.find((entry) => entry.id === episode.conversationId)
    : journeyEpisodeConversation(model.chapter, episode)?.definition;
  return { model, episode, conversation: conversation ?? null };
}
export function parseJourneyPreview(input: unknown): JourneyPreview {
  const p = input as JourneyPreview;
  if (!p || p.kind !== 'journey-preview' || p.version !== 1) throw new Error('Not a Studio journey preview');
  const checked = validateJourneyDraft(p.draft);
  if (!checked.draft) throw new Error(checked.issues.join('\n'));
  if (p.image !== null && (typeof p.image !== 'string' || p.image.length > 2800000 || !/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(p.image))) throw new Error('Invalid embedded tile image');
  return { kind: 'journey-preview', version: 1, draft: checked.draft, image: p.image };
}
