import { Directory, File, Paths } from 'expo-file-system';
import { buildPhotoIntelligence } from '@/utils/intelligence/photo-intelligence';
import { resolvePhotoCategory } from '@/utils/photo-category';
import { gradePhotoMatch } from '@/utils/companion-photo-match';
import type { PhotoAnalysisInput } from '@/utils/intelligence/photo-analysis';
import type { CompanionPhotoActivityConfig } from '@/types/companion-daily';
import type { CompanionLifePhoto } from './companion-life-activity-storage';

/**
 * A photo taken for a friend's daily card, read and graded against their
 * config. A friend who keeps photos (Mossprout) has it copied out of the
 * camera cache first so a relaunch can resume; anyone else is shown the
 * photo where it is and keeps only the fact.
 */
export function prepareCompanionLifePhoto(config: CompanionPhotoActivityConfig, id: string, uri: string, capturedAt: number, analysis: PhotoAnalysisInput): CompanionLifePhoto {
  let kept = uri;
  if (config.keepPhoto) {
    const directory = new Directory(Paths.document, config.keepPhoto.directory);
    directory.create({ idempotent: true, intermediates: true });
    const file = new File(directory, `${id.replace(/[^a-zA-Z0-9_-]/g, '-')}.jpg`);
    if (!file.exists) new File(uri).copy(file);
    kept = file.uri;
  }
  const intelligence = buildPhotoIntelligence({ sourceId: kept, thumbnailUri: kept, observedAt: new Date(capturedAt).toISOString(),
    rawVision: analysis.rawVision, vision: analysis.summary });
  const categoryId = analysis.summary ? resolvePhotoCategory(analysis.summary).id : null;
  return { uri: kept, capturedAt, memory: intelligence.memory, evidence: intelligence.evidence, vision: analysis.summary, categoryId,
    match: gradePhotoMatch(intelligence.memory, Boolean(analysis.rawVision), config.match, categoryId) };
}

/** Deletes a kept photo, and only a kept one: nothing outside the friend's own directory. */
export function discardCompanionLifePhoto(uri: string, directoryName: string) {
  const directory = new Directory(Paths.document, directoryName);
  const prefix = `${directory.uri.replace(/\/$/, '')}/`;
  if (!uri.startsWith(prefix) || uri.slice(prefix.length).includes('/')) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
