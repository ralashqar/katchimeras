import { useCallback, useEffect, useState } from 'react';

import type { ContentFlowRun, ContentFlowSurface, ContentFlowSurfaceViewModel } from '@/types/content-flow';

import { contentFlowDefinition } from './content-flow-catalog';
import { contentFlowEffectKey, contentFlowNavigationKey, contentFlowPresentationKey } from './content-flow-interpreter';
import { listContentFlowRuns, subscribeContentFlowJournal } from './content-flow-repository';
import { recordStoryFlowDiagnostic } from './story-flow-diagnostics';

const EMPTY_WORK = { kind: 'none' as const };

export function contentFlowSurfaceView(run: ContentFlowRun | null, surface: ContentFlowSurface, conflictRunIds: readonly string[] = []): ContentFlowSurfaceViewModel {
  const definition = run ? contentFlowDefinition(run.definitionId, run.definitionVersion) : null;
  const node = definition?.nodes.find((candidate) => candidate.id === run?.nodeId) ?? null;
  const nodeSurface = node && 'surface' in node ? node.surface : 'none';
  const active = Boolean(run?.executionMode === 'live' && run.status === 'active' && nodeSurface === surface);
  const pendingWork = !active || !run || !node ? EMPTY_WORK
    : node.kind === 'effect'
      ? { kind: 'effect' as const, key: contentFlowEffectKey(run, node.effectId), effectType: node.effectType, payload: node.payload ?? {} }
      : node.kind === 'presentation'
        ? { kind: 'presentation' as const, key: contentFlowPresentationKey(run, node.presentationId), presentationType: node.presentationType, payload: node.payload ?? {}, replayPolicy: node.replayPolicy ?? 'replay' as const }
        : node.kind === 'route'
          ? {
              kind: 'navigation' as const,
              key: contentFlowNavigationKey(run, node.routeId),
              target: node.target,
              surface: node.surface,
              lock: node.lock ?? false,
              backPolicy: node.backPolicy ?? (node.lock ? 'locked' as const : 'pause' as const),
              readiness: node.readiness ?? ['route', 'data', 'layout', 'background', 'foreground'],
            }
          : EMPTY_WORK;
  return { active, run: active ? run : null, node: active ? node : null, surface, blocksNavigation: active && node?.kind === 'route' && Boolean(node.lock), pendingWork, conflictRunIds };
}

export function useContentFlowSurface(surface: ContentFlowSurface): ContentFlowSurfaceViewModel {
  const [selection, setSelection] = useState<{ run: ContentFlowRun | null; conflicts: readonly string[] }>({ run: null, conflicts: [] });
  const refresh = useCallback(() => {
    void listContentFlowRuns({ activeOnly: true }).then((runs) => {
      const live = runs.filter((candidate) => candidate.executionMode === 'live' && candidate.phase !== 'suspended');
      const matching = live.filter((candidate) => {
        const definition = contentFlowDefinition(candidate.definitionId, candidate.definitionVersion);
        const node = definition?.nodes.find((item) => item.id === candidate.nodeId);
        return node && 'surface' in node && node.surface === surface;
      }).sort((left, right) => Number(Boolean(right.parentRunId)) - Number(Boolean(left.parentRunId)) || right.updatedAt - left.updatedAt);
      const run = matching[0] ?? null;
      const conflicts = matching.slice(1).map((candidate) => candidate.runId);
      setSelection({ run, conflicts });
      if (run && conflicts.length) recordStoryFlowDiagnostic({ category: 'ownership', message: 'Multiple flows requested one surface; child/newest run won', details: { conflicts, owner: run.runId, surface } });
    });
  }, [surface]);
  useEffect(() => {
    refresh();
    return subscribeContentFlowJournal(refresh);
  }, [refresh]);
  return contentFlowSurfaceView(selection.run, surface, selection.conflicts);
}
