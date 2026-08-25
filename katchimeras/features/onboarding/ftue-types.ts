import type { IconSymbolName } from '@/components/ui/icon-symbol';
import type { DayPromptKind, TodayGrowthSource } from '@/types/home';

export type FtueSurface = 'today' | 'hatch' | 'companion' | 'merge' | 'haven';
export type FtueResumeTarget =
  | { kind: 'today' }
  | { kind: 'haven' }
  | { kind: 'companion'; creatureId: string; ftue?: string }
  | { kind: 'merge'; creatureId: string };

export type FtueNavigationDirective = {
  /** Prevent leaving this authored beat through app chrome or native back navigation. */
  lock: boolean;
  /** Durable route identity used to restore this beat after a cold launch or foreground. */
  resume: FtueResumeTarget;
};
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
  | 'companion_order_preview'
  | 'merge_item_created'
  | 'merge_parcel_claimed'
  | 'merge_generator_spawned'
  | 'merge_order_served'
  | 'merge_chat_note_opened'
  | 'merge_energy_depleted'
  | 'pedometer_steps'
  | 'movement_context'
  | 'haven_upgrade'
  | 'haven_reveal'
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
  | { kind: 'board_items'; definitionId: string; occurrence: number }
  | { kind: 'board_generator'; generatorId: string }
  | { kind: 'board_dream_echo'; echoId: string }
  | { kind: 'board_companion_discovery'; discoveryId: string }
  | { kind: 'board_discovery_fork'; gateId: string }
  | { kind: 'active_resident_card_item' }
  | { kind: 'active_resident_card_node' }
  | { kind: 'order_requirement_item'; orderId: string; requirementIndex: number; occurrence?: number }
  | { kind: 'board_cell'; cell: number }
  | { kind: 'order_card'; orderId: string }
  | { kind: 'order_serve'; orderId: string }
  | { kind: 'tray_chat_note'; noteId: string }
  | { kind: 'tray_parcel'; arrivalId: string }
  | { kind: 'active_resident_parcel' }
  | { kind: 'active_resident_order_card' }
  | { kind: 'active_resident_order_serve' }
  | { kind: 'haven_tile'; characterId: string }
  | { kind: 'haven_tile_hud'; characterId: string }
  | { kind: 'haven_upgrade_button'; characterId: string }
  | { kind: 'haven_world' };

export type FtueCueDefinition =
  | { kind: 'drag'; from: FtueTarget; to: FtueTarget }
  | { kind: 'tap'; target: FtueTarget };

export type FtueSpotlightDefinition = {
  targets: readonly FtueTarget[];
  grouping?: 'individual' | 'bounding_rect';
  padding?: number;
  radius?: number;
  dimOpacity?: number;
  /** Remove this spotlight when its transient Egg guide is dismissed. */
  dismissOnGuideClose?: boolean;
};

export type FtueInteractionPolicy =
  | { mode: 'none' }
  | { mode: 'exclusive'; allowed: { kind: 'target_tap'; target: FtueTarget } }
  | { mode: 'exclusive'; allowed: { kind: 'board_drag'; from: FtueTarget; to: FtueTarget } }
  | { mode: 'exclusive'; allowed: { kind: 'generator_tap'; target: FtueTarget } }
  | { mode: 'exclusive'; allowed: { kind: 'order_serve'; target: FtueTarget } }
  | { mode: 'exclusive'; allowed: { kind: 'chat_note_tap'; target: FtueTarget } }
  | { mode: 'exclusive'; allowed: { kind: 'parcel_tap'; target: FtueTarget } };

export type FtueEvent =
  | {
      type: 'merge_completed';
      fromInstanceId: string;
      targetInstanceId: string;
      resultDefinitionId: string;
      resultCell: number;
      revision: number;
    }
  | { type: 'dream_echo_cleared'; echoId: string; resultDefinitionId: string; resultCell: number; revision: number }
  | {
      type: 'item_spawned';
      generatorId: string;
      instanceId: string;
      definitionId: string;
      resultCell: number;
      revision: number;
    }
  | { type: 'order_served'; orderId: string; residentDiscoveryId?: string; revision: number }
  | { type: 'chat_note_opened'; noteId: string; revision: number }
  | { type: 'arrival_claimed'; arrivalId: string; residentDiscoveryId?: string; revision: number }
  | { type: 'companion_discovery_advanced'; discoveryId: string; stage: number; completedCharacterId?: string; revision: number }
  | { type: 'resident_card_revealed'; discoveryId: string; residentId: string; revision: number }
  | { type: 'resident_dialogue_acknowledged'; discoveryId: string; revision: number }
  | { type: 'resident_card_reveal_acknowledged'; discoveryId: string; revision: number }
  | { type: 'ui_target_pressed'; target: FtueTarget; revision: number }
  | { type: 'haven_upgrade_completed'; characterId: string; stage: number; revision: number };

export type FtueEventMatcher =
  | {
      type: 'merge_completed';
      fromInstanceId?: string;
      targetInstanceId?: string;
      resultDefinitionId?: string;
    }
  | { type: 'dream_echo_cleared'; echoId?: string; resultDefinitionId?: string }
  | { type: 'item_spawned'; generatorId?: string; definitionId?: string }
  | { type: 'order_served'; orderId?: string; residentDiscovery?: boolean }
  | { type: 'chat_note_opened'; noteId?: string }
  | { type: 'arrival_claimed'; arrivalId?: string; residentDiscovery?: boolean }
  | { type: 'companion_discovery_advanced'; discoveryId?: string; stage?: number; completedCharacterId?: string }
  | { type: 'resident_card_revealed'; discoveryId?: string; residentId?: string }
  | { type: 'resident_dialogue_acknowledged'; discoveryId?: string }
  | { type: 'resident_card_reveal_acknowledged'; discoveryId?: string }
  | { type: 'ui_target_pressed'; target?: FtueTarget }
  | { type: 'haven_upgrade_completed'; characterId?: string; stage?: number };

export type FtueCameraDirective =
  | { kind: 'focus_target'; target: FtueTarget; zoom?: number; anchorY?: number; durationMs?: number }
  | { kind: 'fit_targets'; targets: readonly FtueTarget[]; padding?: number; durationMs?: number };

export type FtueGraphEdge = {
  event: FtueEventMatcher;
  commitActionId: string;
  nextStepId: string;
  requiredCount?: number;
};

export type FtueStepDefinition = {
  id: string;
  surface: FtueSurface;
  navigation?: FtueNavigationDirective;
  guide: FtueGuide;
  actions: readonly FtueActionDefinition[];
  interaction?: FtueInteractionPolicy;
  cue?: FtueCueDefinition;
  spotlight?: FtueSpotlightDefinition;
  camera?: FtueCameraDirective;
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
  schemaVersion: 6;
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
  objectiveProgress: Record<string, number>;
};

export type FtueSurfaceViewModel = {
  active: boolean;
  run: FtueRunState | null;
  step: FtueStepDefinition | null;
  guide: FtueGuide | null;
  actions: readonly FtueActionDefinition[];
  blockingBeat: FtueStepDefinition['blockingBeat'] | null;
};
