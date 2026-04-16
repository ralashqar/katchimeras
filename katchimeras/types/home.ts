import type { IconSymbolName } from '@/components/ui/icon-symbol';

export type InspirationCategory = 'calm' | 'motivation' | 'reflection' | 'energy' | 'gratitude';
export type HomeMomentType =
  | 'photo'
  | 'inspiration'
  | 'coffee'
  | 'walk'
  | 'new_place'
  | 'social'
  | 'calm'
  | 'focus';
export type HomeQuickMomentType = Exclude<HomeMomentType, 'photo' | 'inspiration'>;
export type HomeMomentSource = 'quick_tag' | 'photo_library' | 'inspiration_library';
export type HomeDayState = 'forming' | 'ready_to_hatch' | 'hatched';
export type HomeScoreKey = 'energy' | 'calm' | 'social' | 'exploration' | 'focus';
export type HomeRarityTier = 'common' | 'rare' | 'epic' | 'legendary';
export type HomeLocationType = 'home' | 'cafe' | 'park' | 'unknown';
export type HomeLocationSource = 'foreground' | 'photo_attachment' | 'manual' | 'health_workout_route';
export type LocationPermissionState = 'unknown' | 'granted' | 'denied';
export type HealthPermissionState = 'unknown' | 'granted' | 'denied' | 'unavailable';
export type HealthRouteImportStatus = 'idle' | 'success' | 'no_data' | 'denied' | 'unavailable' | 'error';
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
  text?: string;
  category?: InspirationCategory;
  contextTags?: string[];
  quoteId?: string;
  locationType?: HomeLocationType;
  latitude?: number;
  longitude?: number;
};

export type StoredHomeLocationPoint = {
  id: string;
  lat: number;
  lng: number;
  capturedAt: string;
  type: HomeLocationType;
  hasPhoto: boolean;
  source: HomeLocationSource;
  momentId?: string | null;
  thumbnailUri?: string;
  accuracyMeters?: number;
};

export type DayMapCoordinate = {
  latitude: number;
  longitude: number;
};

export type DayMapNode = {
  id: string;
  latitude: number;
  longitude: number;
  type: HomeLocationType;
  importance: number;
  hasPhoto: boolean;
  linkedMomentId: string | null;
  photoThumbnailUri: string | null;
  startedAt: string;
  endedAt: string;
  sampleCount: number;
};

export type DayMapViewport = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type DayMapSummary = {
  nodes: DayMapNode[];
  path: DayMapCoordinate[];
  primaryLocationId: string | null;
  viewport: DayMapViewport | null;
  totalSamples: number;
};

export type StoredExactRouteCoordinate = {
  latitude: number;
  longitude: number;
  capturedAt: string;
};

export type StoredExactRouteSegment = {
  id: string;
  workoutId: string;
  activityType: string;
  startedAt: string;
  endedAt: string;
  coordinates: StoredExactRouteCoordinate[];
};

export type StoredHealthRouteImportMeta = {
  status: HealthRouteImportStatus;
  importedAt: string | null;
  workoutIds: string[];
  importedWorkoutCount: number;
  sampledPointCount: number;
  segmentCount: number;
  message?: string | null;
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
    }
  | {
      type: 'inspiration';
      source: 'inspiration_library';
      metadata: HomeMomentMetadata & {
        text: string;
        category: InspirationCategory;
        contextTags: string[];
        quoteId: string;
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

export type EggAuraInteractionState = {
  dragX: number;
  dragY: number;
  pressProgress: number;
  releaseVelocity: number;
  interactionEnergy: number;
};

export type EggRippleEvent = {
  id: string;
  originX: number;
  originY: number;
  startedAt: number;
};

export type EggDragTrailPoint = {
  id: string;
  x: number;
  y: number;
  strength: number;
  startedAt: number;
};

export type EggDragTrailState = {
  activeX: number | null;
  activeY: number | null;
  releaseVelocity: number;
  points: EggDragTrailPoint[];
};

export type EggMembranePoint = {
  angle: number;
  baseRadius: number;
  offset: number;
  velocity: number;
};

export type EggForceImpulse = {
  id: string;
  kind: 'tap' | 'drag' | 'wake';
  x: number;
  y: number;
  strength: number;
  createdAt: number;
  durationMs: number;
};

export type EggAuraConfig = {
  baseRadius: number;
  membraneThickness: number;
  maxPullDistance: number;
  rippleDurationMs: number;
  particleCount: number;
  hapticsEnabled: boolean;
};

export type EggMembraneConfig = {
  pointCount: number;
  springStrength: number;
  damping: number;
  neighborInfluence: number;
  maxPullDistance: number;
};

export type EggInteriorFieldConfig = {
  glowStrength: number;
  wakeBlur: number;
  chargeDecay: number;
  shaderEnabled: boolean;
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
  locations: StoredHomeLocationPoint[];
  healthRouteImport: StoredHealthRouteImportMeta | null;
  exactRouteSegments: StoredExactRouteSegment[];
  selectedPathId: string | null;
  creature: LocalCreatureRecord | null;
};

export type StoredHomeState = {
  version: 3;
  locationPermission: LocationPermissionState;
  healthPermission: HealthPermissionState;
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
  dayMap: DayMapSummary | null;
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
  kind: 'photo' | 'quick_tag' | 'inspiration';
};

export type RecentPhotoAsset = {
  id: string;
  uri: string;
  thumbnailUri: string;
  createdAt: number;
  width: number;
  height: number;
  isScreenshot?: boolean;
  latitude?: number;
  longitude?: number;
};

export type InspirationQuote = {
  id: string;
  text: string;
  category: InspirationCategory;
  tags: string[];
};

export type InspirationSelection = {
  quote: InspirationQuote;
  category: InspirationCategory;
  contextTags: string[];
  mode: 'auto' | 'category';
};

export type AbsorptionPayload = {
  kind: 'tag' | 'photo' | 'inspiration';
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
  | 'inspiration_card'
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
  inspirationSelection: InspirationSelection | null;
  absorption: AbsorptionPayload | null;
  error: AddMomentFlowError | null;
};
