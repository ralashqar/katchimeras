import { useEffect, useRef } from 'react';

import type { ClassifiedMemory, DayVisionSummary, PhotoVisionResult } from '@/types/home';
import { buildPhotoClassifiedMemory } from '@/utils/intelligence/classification';
import type { PhotoAnalysisInput } from '@/utils/intelligence/photo-analysis';
import type { PhotoPlaceResolution } from '@/types/photo-place';
import { classifyScene, type SceneRead } from '@/utils/scene-classify';

type Snapshot = {
  rawVision: PhotoVisionResult | null;
  vision: DayVisionSummary | null;
  scene: SceneRead | null;
  memory: ClassifiedMemory | null;
  placeResolution: PhotoPlaceResolution | null;
};

// Capture has one immutable Vision snapshot. Journal routing consumes that
// snapshot independently; this hook only builds downstream memory/quest data
// and never launches a second Foundation scene classifier.
export function usePhotoAnalysisSession(input: {
  analyze: () => Promise<PhotoAnalysisInput>;
  photoUri: string | null;
  sourceId?: string | null;
  observedAt?: string | null;
  onReady: (snapshot: Snapshot) => void;
}) {
  const visionRef = useRef<DayVisionSummary | null>(null);
  const rawVisionRef = useRef<PhotoVisionResult | null>(null);
  const sceneRef = useRef<SceneRead | null>(null);
  const memoryRef = useRef<ClassifiedMemory | null>(null);
  const placeResolutionRef = useRef<PhotoPlaceResolution | null>(null);
  const committedRef = useRef(false);
  const onReady = useRef(input.onReady);
  onReady.current = input.onReady;
  const observedAtRef = useRef(input.observedAt ?? new Date().toISOString());

  useEffect(() => {
    let active = true;
    void input.analyze().then((analyzed) => {
      if (!active) return;
      const vision = analyzed.summary;
      const rawVision = analyzed.rawVision;
      const placeResolution = analyzed.placeResolution ?? null;
      const scene = vision ? classifyScene(vision) : null;
      const memory = vision ? buildPhotoClassifiedMemory({
        sourceId: input.sourceId ?? input.photoUri ?? 'capture-preview',
        observedAt: observedAtRef.current,
        vision,
        rawVision,
        scene,
      }) : null;
      visionRef.current = vision;
      rawVisionRef.current = rawVision;
      sceneRef.current = scene;
      memoryRef.current = memory;
      placeResolutionRef.current = placeResolution;
      committedRef.current = false;
      onReady.current({ rawVision, vision, scene, memory, placeResolution });
    }).catch(() => {
      if (active) onReady.current({ rawVision: null, vision: null, scene: null, memory: null, placeResolution: null });
    });
    return () => { active = false; };
  }, [input.analyze, input.photoUri, input.sourceId]);

  return { visionRef, rawVisionRef, sceneRef, memoryRef, placeResolutionRef, committedRef };
}
