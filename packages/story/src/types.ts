// Games augment this open registry in their own TypeScript project.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StoryTypeRegistry {}
type Binding<K extends string> = StoryTypeRegistry extends Record<K, infer V extends string> ? V : string;
export type ContentFlowSurface = Binding<'surface'>;

export type ContentFlowBackPolicy = 'allow' | 'pause' | 'locked';
export type ContentFlowReplayPolicy = 'replay' | 'continue';
export type ContentFlowReadinessGate =
  | 'route'
  | 'data'
  | 'layout'
  | 'background'
  | 'foreground'
  | 'interaction_target';

export type StoryRouteId = Binding<'route'>;

export type StoryRouteTarget = {
  id: StoryRouteId;
  pathname: string;
  surface: ContentFlowSurface;
  params?: Readonly<Record<string, string>>;
};

export type ContentFlowNodePolicy = {
  /** Renderer/domain capability used by this node. Validated when authored. */
  capability: string;
  /** Explicit Back behavior. Visible nodes may never inherit screen-specific behavior. */
  backPolicy?: ContentFlowBackPolicy;
  /** Readiness gates required before revealing a routed destination. */
  readiness?: readonly ContentFlowReadinessGate[];
};

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
      capability: string;
      surface: ContentFlowSurface;
      sceneId: string;
      payload?: Readonly<Record<string, unknown>>;
      actions: readonly ContentFlowAction[];
    }
  | {
      id: string;
      kind: 'task';
      capability: string;
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
      capability: string;
      effectId: string;
      effectType: string;
      payload?: Readonly<Record<string, unknown>>;
      next: string;
    }
  | {
      id: string;
      kind: 'presentation';
      capability: string;
      surface: ContentFlowSurface;
      presentationId: string;
      presentationType: string;
      payload?: Readonly<Record<string, unknown>>;
      replayPolicy?: ContentFlowReplayPolicy;
      next: string;
    }
  | {
      id: string;
      kind: 'route';
      capability: string;
      surface: ContentFlowSurface;
      routeId: string;
      target: StoryRouteTarget;
      lock?: boolean;
      backPolicy?: ContentFlowBackPolicy;
      readiness?: readonly ContentFlowReadinessGate[];
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
  /** Stable node aliases used to migrate released saves after a manifest edit. */
  migrations?: Readonly<Record<string, string>>;
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
  executionMode: 'live';
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
  /** Optimistic revision used by the atomic command reducer. */
  revision: number;
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
  | {
      kind: 'navigation';
      key: string;
      target: StoryRouteTarget;
      surface: ContentFlowSurface;
      lock: boolean;
      backPolicy: ContentFlowBackPolicy;
      readiness: readonly ContentFlowReadinessGate[];
    };

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
  conflictRunIds: readonly string[];
};
