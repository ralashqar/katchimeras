import { useCallback, useEffect, useState } from 'react';

import type { ContentFlowRun, ContentFlowSurface, ContentFlowSurfaceViewModel } from '@/types/content-flow';

import { contentFlowDefinition } from './content-flow-catalog';
import { contentFlowEffectKey, contentFlowNavigationKey, contentFlowPresentationKey } from './content-flow-interpreter';
import { listContentFlowRuns, subscribeContentFlowJournal } from './content-flow-repository';

const EMPTY_WORK = { kind: 'none' as const };

export function contentFlowSurfaceView(run: ContentFlowRun | null, surface: ContentFlowSurface): ContentFlowSurfaceViewModel {
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
          ? { kind: 'navigation' as const, key: contentFlowNavigationKey(run, node.routeId), route: node.route, surface: node.surface, lock: node.lock ?? false }
          : EMPTY_WORK;
  return { active, run: active ? run : null, node: active ? node : null, surface, blocksNavigation: active && node?.kind === 'route' && Boolean(node.lock), pendingWork };
}

export function useContentFlowSurface(surface: ContentFlowSurface): ContentFlowSurfaceViewModel {
  const [run, setRun] = useState<ContentFlowRun | null>(null);
  const refresh = useCallback(() => {
    void listContentFlowRuns({ activeOnly: true }).then((runs) => {
      const live = runs.filter((candidate) => candidate.executionMode === 'live' && candidate.phase !== 'suspended');
      setRun(live.find((candidate) => {
        const definition = contentFlowDefinition(candidate.definitionId, candidate.definitionVersion);
        const node = definition?.nodes.find((item) => item.id === candidate.nodeId);
        return node && 'surface' in node && node.surface === surface;
      }) ?? null);
    });
  }, [surface]);
  useEffect(() => {
    refresh();
    return subscribeContentFlowJournal(refresh);
  }, [refresh]);
  return contentFlowSurfaceView(run, surface);
}

