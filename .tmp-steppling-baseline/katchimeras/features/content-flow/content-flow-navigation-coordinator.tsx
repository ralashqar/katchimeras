import { DIAGNOSTICS_ENABLED } from '@/constants/diagnostics';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useGameScreenTransition, type GameSurfaceId } from '@/features/navigation/game-screen-transition';
import type { ContentFlowPendingWork, ContentFlowRun } from '@/types/content-flow';

import { dispatchContentFlowCommand } from './content-flow-director';
import { contentFlowDefinition } from './content-flow-catalog';
import { contentFlowNavigationKey } from './content-flow-interpreter';
import { listContentFlowRuns, subscribeContentFlowJournal } from './content-flow-repository';
import { recordStoryFlowDiagnostic } from './story-flow-diagnostics';

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

function gameSurface(surface: NavigationOwner['work']['surface']): GameSurfaceId | null {
  if (surface === 'collection') return 'katchimeras';
  if (surface === 'haven' || surface === 'companion') return 'companion';
  if (surface === 'today' || surface === 'merge') return surface;
  return null;
}

export function ContentFlowNavigationCoordinator() {
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
    if (!owner || phase !== 'idle' || pathname.startsWith('/dev-')) return;
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
        router.replace('/katchimera/mossprout/activity');
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
