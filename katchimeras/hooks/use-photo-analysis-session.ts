import { useEffect, useRef } from 'react';

import type { ClassifiedMemory, DayVisionSummary, PhotoVisionResult } from '@/types/home';
import { foundationSceneAvailability, isFoundationSceneAvailable } from '@/utils/foundation-scene';
import { buildPhotoClassifiedMemory } from '@/utils/intelligence/classification';
import type { PhotoAnalysisInput } from '@/utils/intelligence/photo-analysis';
import { classifyScene, resolveSceneRead, type SceneRead } from '@/utils/scene-classify';

type Snapshot = { rawVision: PhotoVisionResult | null; vision: DayVisionSummary | null; scene: SceneRead | null; memory: ClassifiedMemory | null };

export function usePhotoAnalysisSession(input: {
  analyze: () => Promise<PhotoAnalysisInput>;
  photoUri: string | null;
  sourceId?: string | null;
  observedAt?: string | null;
  onReady: (snapshot: Snapshot) => void;
  onUpgrade: (snapshot: Snapshot) => void;
}) {
  const visionRef = useRef<DayVisionSummary | null>(null);
  const rawVisionRef = useRef<PhotoVisionResult | null>(null);
  const sceneRef = useRef<SceneRead | null>(null);
  const memoryRef = useRef<ClassifiedMemory | null>(null);
  const committedRef = useRef(false);
  const callbacks = useRef({ onReady: input.onReady, onUpgrade: input.onUpgrade });
  callbacks.current = { onReady: input.onReady, onUpgrade: input.onUpgrade };
  const observedAtRef = useRef(input.observedAt ?? new Date().toISOString());

  useEffect(() => {
    let active = true;
    void (async () => {
      const analyzed = await input.analyze();
      if (!active) return;
      const vision = analyzed.summary;
      rawVisionRef.current = analyzed.rawVision;
      visionRef.current = vision;
      const fastScene = classifyScene(vision);
      const foundationAvailable = !!vision && isFoundationSceneAvailable();
      const initialScene = foundationAvailable
        ? await resolveSceneRead(vision, input.photoUri, analyzed.rawVision)
        : { ...fastScene, foundationStatus: 'unavailable' as const, foundationReason: foundationSceneAvailability().reason };
      if (!active) return;
      sceneRef.current = initialScene;
      committedRef.current = false;
      const memory = vision ? buildPhotoClassifiedMemory({ sourceId: input.sourceId ?? input.photoUri ?? 'capture-preview', observedAt: observedAtRef.current, vision, rawVision: analyzed.rawVision, scene: initialScene }) : null;
      memoryRef.current = memory;
      callbacks.current.onReady({ rawVision: analyzed.rawVision, vision, scene: initialScene, memory });
      if (!vision || foundationAvailable) return;
      void resolveSceneRead(vision, input.photoUri, analyzed.rawVision).then((read) => {
        if (!active || !read || committedRef.current) return;
        sceneRef.current = read;
        const current = memoryRef.current;
        const upgraded = buildPhotoClassifiedMemory({ sourceId: input.sourceId ?? input.photoUri ?? 'capture-preview', observedAt: current?.createdAt ?? observedAtRef.current, vision, rawVision: analyzed.rawVision, scene: read, confirmations: current?.confirmations ?? [] });
        const reconciled = reconcileProgressiveUpgrade(current, upgraded);
        memoryRef.current = reconciled;
        callbacks.current.onUpgrade({ rawVision: analyzed.rawVision, vision, scene: read, memory: reconciled });
      }).catch(() => {});
    })();
    return () => { active = false; };
  }, [input.analyze, input.photoUri, input.sourceId]);

  return { visionRef, rawVisionRef, sceneRef, memoryRef, committedRef };
}

function reconcileProgressiveUpgrade(current: ClassifiedMemory | null, upgraded: ClassifiedMemory): ClassifiedMemory {
  if (!current || current.confirmations.length === 0) return upgraded;
  const familyChanged = !!current.promptState.graphId && !!upgraded.promptState.graphId && current.promptState.graphId !== upgraded.promptState.graphId;
  const confirmedMedia = upgraded.facets.some((facet) => facet.key === 'media_type' && facet.confirmed && facet.value !== 'other');
  const hasTitle = upgraded.facets.some((facet) => facet.key === 'media_title' && !facet.confirmed && facet.value !== 'unknown');
  const shouldAskTitle = confirmedMedia && hasTitle && !current.confirmations.some((item) => item.facetKey === 'media_title') && (current.promptState.microQuestionCount ?? 0) < 1 && current.promptState.graphId === 'media-context';
  return {
    ...upgraded, createdAt: current.createdAt,
    promptState: {
      ...(familyChanged ? current.promptState : upgraded.promptState),
      answeredNodeIds: current.promptState.answeredNodeIds, askedQuestionIds: current.promptState.askedQuestionIds,
      resolvedGoalIds: current.promptState.resolvedGoalIds, skippedGoalIds: current.promptState.skippedGoalIds,
      completedGoalIds: current.promptState.completedGoalIds, questionCount: current.promptState.questionCount,
      microQuestionCount: current.promptState.microQuestionCount,
      status: shouldAskTitle ? 'pending' : familyChanged ? current.promptState.status : upgraded.promptState.status,
      currentNodeId: shouldAskTitle ? 'title' : familyChanged ? current.promptState.currentNodeId : upgraded.promptState.currentNodeId,
      currentQuestionId: shouldAskTitle ? 'media-context.title' : familyChanged ? current.promptState.currentQuestionId : upgraded.promptState.currentQuestionId,
    },
  };
}
