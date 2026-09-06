
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ContentFlowPendingWork, ContentFlowRun } from '@incubator/story/types';

import { contentFlowNavigationKey } from '@incubator/story/interpreter';
import type { createContentFlowCatalog } from '@incubator/story/catalog';
import type { createContentFlowDirector } from '@incubator/story/director';
import type { createContentFlowRepository } from './repository';
import type { StoryDiagnostic } from './surface';
import type { createGameScreenTransitions, GameSurfaceId } from '@incubator/presentation/screen-transition';
export function createContentFlowNavigation({catalog,repository,director,useGameScreenTransition,gameSurface,onReturn,shouldBypassPath,diagnostics:recordStoryFlowDiagnostic = ()=>{}}: {
catalog:ReturnType<typeof createContentFlowCatalog>;repository:Pick<ReturnType<typeof createContentFlowRepository>,'listContentFlowRuns'|'subscribeContentFlowJournal'>;director:Pick<ReturnType<typeof createContentFlowDirector>,'dispatchContentFlowCommand'>;useGameScreenTransition:ReturnType<typeof createGameScreenTransitions>['useGameScreenTransition'];gameSurface:(surface:ContentFlowPendingWork extends never ? never : string)=>GameSurfaceId|null;onReturn:(router:ReturnType<typeof useRouter>)=>void;shouldBypassPath:(pathname:string)=>boolean;diagnostics?:(entry:StoryDiagnostic)=>void;
}) {
const DIAGNOSTICS_ENABLED=true;
const {contentFlowDefinition}=catalog;
const {listContentFlowRuns,subscribeContentFlowJournal}=repository;
const {dispatchContentFlowCommand}=director;
type NavigationOwner = { run: ContentFlowRun; work: Extract<ContentFlowPendingWork, { kind: 'navigation' }> };

function navigationOwner(runs: readonly ContentFlowRun[]): NavigationOwner | null {
  for (const run of runs.filter((candidate) => candidate.status === 'active' && candidate.phase === 'awaiting_navigation').sort((a, b) => b.updatedAt - a.updatedAt)) {
    const definition = contentFlowDefinition(run.definitionId, run.definitionVersion);
    const node = definition?.nodes.find((candidate) => candidate.id === run.nodeId);
    if (node?.kind !== 'route') continue;
    return {
      run,
      work: {
        kind: 'navigation',
        key: contentFlowNavigationKey(run, node.routeId),
        target: node.target,
        surface: node.surface,
        lock: node.lock ?? false,
        backPolicy: node.backPolicy ?? (node.lock ? 'locked' : 'pause'),
        readiness: node.readiness ?? ['route', 'data', 'layout', 'background', 'foreground'],
      },
    };
  }
  return null;
}

function ContentFlowNavigationCoordinator() {
  const pathname = usePathname();
  const router = useRouter();
  const { phase, transitionTo } = useGameScreenTransition();
  const [owner, setOwner] = useState<NavigationOwner | null>(null);
  const attemptedKeyRef = useRef<string | null>(null);
  const pausedKeyRef = useRef<string | null>(null);

  const refresh = useCallback(() => {
    void listContentFlowRuns({ activeOnly: true }).then((runs) => setOwner(navigationOwner(runs)));
  }, []);

  useEffect(() => {
    refresh();
    return subscribeContentFlowJournal(refresh);
  }, [refresh]);

  useEffect(() => {
    if (!owner || phase !== 'idle' || shouldBypassPath(pathname)) return;
    if (pausedKeyRef.current === owner.work.key || attemptedKeyRef.current === owner.work.key) return;
    const targetSurface = gameSurface(owner.work.surface);
    if (!targetSurface) return;
    // Content-flow ownership is global, while its destinations can be nested
    // Tab leaves. `navigate` crosses that navigator boundary; `replace` cannot.
    const navigate = () => router.navigate({ pathname: owner.work.target.pathname, params: owner.work.target.params } as never);
    const accepted = transitionTo({
      announcement: 'Opening the next part of your story',
      expectedPathname: owner.work.target.pathname,
      navigate,
      navigationKey: owner.work.key,
      onReady: () => {
        if (DIAGNOSTICS_ENABLED) recordStoryFlowDiagnostic({ category: 'navigation', message: 'Destination acknowledged', details: { key: owner.work.key, pathname: owner.work.target.pathname, runId: owner.run.runId } });
        void dispatchContentFlowCommand(owner.run.runId, { type: 'navigation_acknowledged', navigationKey: owner.work.key });
      },
      onReturn: () => {
        pausedKeyRef.current = owner.work.key;
        attemptedKeyRef.current = null;
        onReturn(router);
        if (DIAGNOSTICS_ENABLED) recordStoryFlowDiagnostic({ category: 'navigation', message: 'Player returned from recoverable navigation', details: { key: owner.work.key, runId: owner.run.runId } });
      },
      requiredReadiness: owner.work.readiness,
      target: targetSurface,
    });
    if (accepted) {
      attemptedKeyRef.current = owner.work.key;
      if (DIAGNOSTICS_ENABLED) recordStoryFlowDiagnostic({ category: 'navigation', message: 'Started correlated navigation', details: { key: owner.work.key, pathname: owner.work.target.pathname, runId: owner.run.runId } });
    }
  }, [owner, pathname, phase, router, transitionTo]);

  useEffect(() => {
    if (!owner || owner.work.key !== attemptedKeyRef.current) attemptedKeyRef.current = null;
    if (!owner || owner.work.key !== pausedKeyRef.current) pausedKeyRef.current = null;
  }, [owner]);

  return null;
}

return {ContentFlowNavigationCoordinator};
}
