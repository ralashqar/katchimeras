import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { DayPromptKind, TodayGrowthSource } from '@/types/home';

export type FtueSurface = 'today' | 'hatch' | 'companion' | 'merge';
export type FtuePresentation = 'inline_choice' | 'route_action' | 'cta_action' | 'observed_game_action' | 'acknowledgement';
export type FtueHandlerId =
  | 'day_prompt'
  | 'private_growth'
  | 'journal_photo'
  | 'journal_text'
  | 'journal_people'
  | 'journal_place'
  | 'discovery_hatch'
  | 'companion_conversation'
  | 'merge_item_created'
  | 'merge_order_served'
  | 'merge_energy_depleted'
  | 'acknowledgement';

export type FtueChoiceOption = {
  id: string;
  label: string;
  icon: IconSymbolName;
  private?: boolean;
  domainChoiceId?: string;
};

export type FtueActionDefinition = {
  id: string;
  title: string;
  description: string;
  icon: IconSymbolName;
  presentation: FtuePresentation;
  handlerId: FtueHandlerId;
  options?: readonly FtueChoiceOption[];
  promptKind?: DayPromptKind;
  growthSource?: TodayGrowthSource;
  growthReward?: number;
  nextStepId?: string;
  backendEvent?: boolean;
};

export type FtueGuide = { eyebrow: string; title: string; body: string };

export type FtueTarget =
  | { kind: 'board_item'; instanceId: string }
  | { kind: 'board_cell'; cell: number }
  | { kind: 'order_serve'; orderId: string };

export type FtueCueDefinition =
  | { kind: 'drag'; from: FtueTarget; to: FtueTarget }
  | { kind: 'tap'; target: FtueTarget };

export type FtueSpotlightDefinition = {
  targets: readonly FtueTarget[];
  grouping?: 'individual' | 'bounding_rect';
  padding?: number;
  radius?: number;
  dimOpacity?: number;
};

export type FtueInteractionPolicy =
  | { mode: 'none' }
  | { mode: 'exclusive'; allowed: { kind: 'board_drag'; from: FtueTarget; to: FtueTarget } }
  | { mode: 'exclusive'; allowed: { kind: 'order_serve'; target: FtueTarget } };

export type FtueEvent =
  | {
      type: 'merge_completed';
      fromInstanceId: string;
      targetInstanceId: string;
      resultDefinitionId: string;
      resultCell: number;
      revision: number;
    }
  | { type: 'order_served'; orderId: string; revision: number };

export type FtueEventMatcher =
  | {
      type: 'merge_completed';
      fromInstanceId?: string;
      targetInstanceId?: string;
      resultDefinitionId?: string;
    }
  | { type: 'order_served'; orderId?: string };

export type FtueGraphEdge = {
  event: FtueEventMatcher;
  commitActionId: string;
  nextStepId: string;
};

export type FtueStepDefinition = {
  id: string;
  surface: FtueSurface;
  guide: FtueGuide;
  actions: readonly FtueActionDefinition[];
  interaction?: FtueInteractionPolicy;
  cue?: FtueCueDefinition;
  spotlight?: FtueSpotlightDefinition;
  edges?: readonly FtueGraphEdge[];
  blockingBeat?: 'mossprout_intro' | 'energy_connection' | 'energy_awarded' | 'chapter_complete';
};

export type FtueScriptDefinition = {
  id: string;
  version: number;
  entryStepId: string;
  terminalStepId: string;
  steps: readonly FtueStepDefinition[];
};

export type FtueAnswer = {
  actionId: string;
  optionId: string | null;
  label: string | null;
  private: boolean;
  committedAt: string;
};

export type FtueReceiptStatus = 'pending' | 'committed' | 'presented';

export type FtueCommitReceipt = {
  clientEventId: string;
  actionId: string;
  stepId: string;
  scriptId: string;
  scriptVersion: number;
  surface: FtueSurface;
  status: FtueReceiptStatus;
  startedAt: string;
  committedAt: string | null;
  presentedAt: string | null;
  evidenceRef: string | null;
  syncAttempts: number;
  syncedAt: string | null;
};

export type FtueRunStatus = 'active' | 'complete';

export type FtueRunState = {
  schemaVersion: 4;
  runId: string;
  scriptId: string;
  scriptVersion: number;
  stepId: string;
  status: FtueRunStatus;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  answers: Record<string, FtueAnswer>;
  receipts: FtueCommitReceipt[];
  mergeInstalled: boolean;
  awardedMergeEnergy: number | null;
};

export type FtueSurfaceViewModel = {
  active: boolean;
  run: FtueRunState | null;
  step: FtueStepDefinition | null;
  guide: FtueGuide | null;
  actions: readonly FtueActionDefinition[];
  blockingBeat: FtueStepDefinition['blockingBeat'] | null;
};
