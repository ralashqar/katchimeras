import { Directory, File, Paths } from 'expo-file-system';
import { buildPhotoIntelligence } from '@/utils/intelligence/photo-intelligence';
import { naturePhotoMatch } from './mossprout-life-activities';
import type { PhotoAnalysisInput } from '@/utils/intelligence/photo-analysis';
import type { MossproutNaturePhoto } from './mossprout-life-activity-storage';

/** Keep accepted/pending photos outside the camera cache so relaunch can resume. */
export function prepareMossproutNaturePhoto(id: string, uri: string, capturedAt: number, analysis: PhotoAnalysisInput): MossproutNaturePhoto {
  const directory = new Directory(Paths.document, 'mossprout-memories');
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, `${id.replace(/[^a-zA-Z0-9_-]/g, '-')}.jpg`);
  if (!file.exists) new File(uri).copy(file);
  const intelligence = buildPhotoIntelligence({ sourceId: file.uri, thumbnailUri: file.uri, observedAt: new Date(capturedAt).toISOString(),
    rawVision: analysis.rawVision, vision: analysis.summary });
  return { uri: file.uri, capturedAt, memory: intelligence.memory, evidence: intelligence.evidence, vision: analysis.summary,
    match: naturePhotoMatch(intelligence.memory, Boolean(analysis.rawVision)) };
}

export function discardMossproutNaturePhoto(uri: string) {
  const directory = new Directory(Paths.document, 'mossprout-memories');
  const prefix = `${directory.uri.replace(/\/$/, '')}/`;
  if (!uri.startsWith(prefix) || uri.slice(prefix.length).includes('/')) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
