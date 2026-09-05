import type { DayVisionSummary, PhotoVisionResult, UserConfirmation } from '@/types/home';
import type { SceneRead } from '@/utils/scene-classify';

import { buildPhotoClassifiedMemory } from './classification';
import { buildPhotoEvidence } from './evidence';

export function buildPhotoIntelligence(input: {
  sourceId: string;
  observedAt: string;
  thumbnailUri?: string | null;
  vision?: DayVisionSummary | null;
  rawVision?: PhotoVisionResult | null;
  scene?: SceneRead | null;
  confirmations?: UserConfirmation[];
}) {
  const memory = buildPhotoClassifiedMemory(input);
  const evidence = buildPhotoEvidence({ ...input, memory });
  return { memory, evidence };
}
