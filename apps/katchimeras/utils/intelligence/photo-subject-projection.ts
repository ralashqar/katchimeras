import type { PhotoSubjectRole, StoredHomeDayRecord } from '@/types/home';

export type ProjectedPhotoSubject = {
  value: string;
  role: PhotoSubjectRole;
  score: number;
};

export function projectDayPhotoSubjects(
  day: Pick<StoredHomeDayRecord, 'classifiedMemories'>,
  limit = 4
): ProjectedPhotoSubject[] {
  const byValue = new Map<string, ProjectedPhotoSubject>();
  for (const memory of day.classifiedMemories ?? []) {
    if (memory.sourceType !== 'photo' || !memory.photoAnalysis) continue;
    for (const subject of memory.photoAnalysis.subjects) {
      if (subject.role === 'incidental') continue;
      const current = byValue.get(subject.canonicalValue);
      if (!current || roleWeight(subject.role) > roleWeight(current.role) || subject.score > current.score) {
        byValue.set(subject.canonicalValue, {
          value: subject.canonicalValue,
          role: subject.role,
          score: subject.score,
        });
      }
    }
  }
  return [...byValue.values()]
    .sort((left, right) => roleWeight(right.role) - roleWeight(left.role) || right.score - left.score)
    .slice(0, limit);
}

function roleWeight(role: PhotoSubjectRole) {
  return role === 'primary' ? 2 : role === 'supporting' ? 1 : 0;
}
