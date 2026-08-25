export type ContentFlowSurface = 'today' | 'hatch' | 'companion' | 'merge' | 'haven' | 'collection' | 'none';

export type ContentFlowValue = string | number | boolean | null;
export type ContentFlowVariables = Record<string, ContentFlowValue>;

export type ContentFlowEventMatcher = {
  type: string;
  where?: Readonly<Record<string, ContentFlowValue>>;
};

export type ContentFlowAction = {
  id: string;
  next: string;
  set?: ContentFlowVariables;
};

export type ContentFlowRequirement = {
  id: string;
  event: ContentFlowEventMatcher;
  count?: number;
  /** Optional destination for alternative/any-mode event edges. */
  next?: string;
};

export type ContentFlowNode =
  | {
      id: string;
      kind: 'scene';
      surface: ContentFlowSurface;
      sceneId: string;
      payload?: Readonly<Record<string, unknown>>;
      actions: readonly ContentFlowAction[];
    }
  | {
      id: string;
      kind: 'task';
      surface: ContentFlowSurface;
      taskId: string;
      payload?: Readonly<Record<string, unknown>>;
      requirements: readonly ContentFlowRequirement[];
      mode?: 'all' | 'any';
      next: string;
    }
  | {
      id: string;
      kind: 'effect';
      effectId: string;
      effectType: string;
      payload?: Readonly<Record<string, unknown>>;
      next: string;
    }
  | {
      id: string;
      kind: 'presentation';
      surface: ContentFlowSurface;
      presentationId: string;
      presentationType: string;
      payload?: Readonly<Record<string, unknown>>;
      replayPolicy?: 'replay' | 'continue';
      next: string;
    }
  | {
      id: string;
      kind: 'route';
      surface: ContentFlowSurface;
      routeId: string;
      route: string;
      lock?: boolean;
      next: string;
    }
  | {
      id: string;
      kind: 'branch';
      branches: readonly { variable: string; equals: ContentFlowValue; next: string }[];
      fallback: string;
    }
  | { id: string; kind: 'complete' };

export type ContentFlowDefinition = {
  id: string;
  version: number;
  entryNodeId: string;
  nodes: readonly ContentFlowNode[];
  metadata?: Readonly<Record<string, unknown>>;
};

export type ContentFlowRunPhase =
  | 'entering'
  | 'awaiting_input'
  | 'awaiting_event'
  | 'awaiting_effect'
  | 'awaiting_presentation'
  | 'awaiting_navigation'
  | 'suspended'
  | 'completed'
  | 'failed_recoverable';

export type ContentFlowRun = {
  schemaVersion: 1;
  executionMode: 'shadow' | 'live';
  runId: string;
  definitionId: string;
  definitionVersion: number;
  nodeId: string;
  phase: ContentFlowRunPhase;
  status: 'active' | 'completed' | 'failed_recoverable';
  parentRunId: string | null;
  variables: ContentFlowVariables;
  objectiveProgress: Record<string, number>;
  effectReceipts: Record<string, { completedAt: number; result?: unknown }>;
  presentationReceipts: Record<string, { acknowledgedAt: number }>;
  navigationReceipts: Record<string, { acknowledgedAt: number }>;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  error: string | null;
};

export type ContentFlowEvent = {
  eventId: string;
  type: string;
  runId: string;
  nodeId: string;
  objectiveId?: string;
  payload: Readonly<Record<string, unknown>>;
  occurredAt: number;
};

export type ContentFlowCommand =
  | { type: 'submit_scene'; actionId: string; values?: ContentFlowVariables; now?: number }
  | { type: 'record_event'; event: ContentFlowEvent; now?: number }
  | { type: 'effect_completed'; effectKey: string; result?: unknown; now?: number }
  | { type: 'presentation_acknowledged'; presentationKey: string; now?: number }
  | { type: 'navigation_acknowledged'; navigationKey: string; now?: number }
  | { type: 'fail'; message: string; now?: number }
  | { type: 'retry'; now?: number };

export type ContentFlowPendingWork =
  | { kind: 'none' }
  | { kind: 'effect'; key: string; effectType: string; payload: Readonly<Record<string, unknown>> }
  | { kind: 'presentation'; key: string; presentationType: string; payload: Readonly<Record<string, unknown>>; replayPolicy: 'replay' | 'continue' }
  | { kind: 'navigation'; key: string; route: string; surface: ContentFlowSurface; lock: boolean };

export type ContentFlowTransition = {
  run: ContentFlowRun;
  pendingWork: ContentFlowPendingWork;
  consumedEvent: boolean;
};

export type ContentFlowValidationIssue = {
  path: string;
  message: string;
};

export type ContentFlowSurfaceViewModel = {
  active: boolean;
  run: ContentFlowRun | null;
  node: ContentFlowNode | null;
  surface: ContentFlowSurface;
  blocksNavigation: boolean;
  pendingWork: ContentFlowPendingWork;
};
