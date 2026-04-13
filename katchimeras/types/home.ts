import type { IconSymbolName } from '@/components/ui/icon-symbol';

export type HomeMomentType = 'photo' | 'coffee' | 'walk' | 'new_place' | 'social' | 'calm' | 'focus';
export type HomeQuickMomentType = Exclude<HomeMomentType, 'photo'>;
export type HomeMomentSource = 'quick_tag' | 'photo_library';
export type HomeDayState = 'forming' | 'ready_to_hatch' | 'hatched';
export type HomeScoreKey = 'energy' | 'calm' | 'social' | 'exploration' | 'focus';
export type HomeRarityTier = 'common' | 'rare' | 'epic' | 'legendary';
export type HomeVisualKey =
  | 'voltstep'
  | 'hearthsip'
  | 'glimmuse'
  | 'skysette'
  | 'creamalume'
  | 'pulsepounce'
  | 'gatherglow'
  | 'mossprout'
  | 'lattelet'
  | 'sprintail'
  | 'neonpoko'
  | 'crumbun'
  | 'hayhorn'
  | 'ironette';

export type DayScores = Record<HomeScoreKey, number>;

export type HomeMomentMetadata = {
  localUri?: string;
  assetId?: string | null;
  thumbnailUri?: string;
  width?: number;
  height?: number;
  isScreenshot?: boolean;
};

export type HomeMoment = {
  id: string;
  type: HomeMomentType;
  label: string;
  icon: IconSymbolName;
  accentColor: string;
  createdAt: string;
  source: HomeMomentSource;
  metadata?: HomeMomentMetadata | null;
};

export type AddMomentInput =
  | {
      type: HomeQuickMomentType;
      source?: 'quick_tag';
    }
  | {
      type: 'photo';
      source: 'photo_library';
      metadata: HomeMomentMetadata & {
        localUri: string;
      };
    };

export type LocalPathOption = {
  id: string;
  key: HomeScoreKey;
  title: string;
  body: string;
  accentColor: string;
  icon: IconSymbolName;
};

export type EggVisualState = {
  accentColor: string;
  haloColor: string;
  coreColor: string;
  intensity: number;
  shimmer: boolean;
  swirl: number;
  label: string;
};

export type LocalCreatureRecord = {
  id: string;
  name: string;
  primaryTrait: HomeScoreKey;
  secondaryTrait: HomeScoreKey;
  rarity: HomeRarityTier;
  visualKey: HomeVisualKey;
  accentColor: string;
  highlightMomentId: string | null;
  highlight: string;
  reflection: string;
  motifTags: string[];
};

export type StoredHomeDayRecord = {
  id: string;
  isoDate: string;
  state: HomeDayState;
  moments: HomeMoment[];
  selectedPathId: string | null;
  creature: LocalCreatureRecord | null;
};

export type StoredHomeState = {
  version: 1;
  archivedDays: StoredHomeDayRecord[];
  today: StoredHomeDayRecord;
};

export type WeekProfile = DayScores;

export type HomeDayRecord = StoredHomeDayRecord & {
  kind: 'day';
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
  scores: DayScores;
  egg: EggVisualState;
  insightLine: string;
  pathOptions: LocalPathOption[];
  canAddMoments: boolean;
  canHatch: boolean;
  highlight: string | null;
};

export type HomeTomorrowRecord = {
  kind: 'tomorrow';
  id: 'tomorrow';
  isoDate: string;
  dayLabel: string;
  dateLabel: string;
  title: string;
  subtitle: string;
  accentColor: string;
};

export type HomeTimelineDay = HomeDayRecord | HomeTomorrowRecord;

export type RadialMomentAction = {
  id: HomeMomentType;
  label: string;
  icon: IconSymbolName;
  accentColor: string;
  kind: 'photo' | 'quick_tag';
};

export type RecentPhotoAsset = {
  id: string;
  uri: string;
  thumbnailUri: string;
  createdAt: number;
  width: number;
  height: number;
  isScreenshot?: boolean;
};

export type AbsorptionPayload = {
  kind: 'tag' | 'photo';
  label: string;
  icon?: IconSymbolName;
  accentColor: string;
  previewUri?: string;
  orbitIndex: number;
  orbitCount: number;
};

export type AddMomentFlowStage =
  | 'closed'
  | 'moment_ring'
  | 'photo_permission_request'
  | 'photo_ring_loading'
  | 'photo_ring_ready'
  | 'photo_picker_fallback'
  | 'absorbing'
  | 'completed'
  | 'error';

export type AddMomentFlowError = {
  title: string;
  body: string;
  action: 'retry_photo' | 'use_picker' | null;
};

export type AddMomentFlowState = {
  stage: AddMomentFlowStage;
  actions: RadialMomentAction[];
  recentPhotos: RecentPhotoAsset[];
  absorption: AbsorptionPayload | null;
  error: AddMomentFlowError | null;
};
