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
export type HomeLocationSource = 'foreground' | 'background' | 'photo_attachment' | 'manual' | 'health_workout_route';
export type LocationPermissionState = 'unknown' | 'granted' | 'denied';
export type ActivityPermissionState = 'unknown' | 'granted' | 'denied' | 'unavailable';
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
  | 'ironette'
  | 'bedrotte'
  | 'steppling'
  | 'errandimp'
  | 'quietome'
  | 'relicoon'
  | 'shellio'
  | 'flickerbun'
  | 'baristabbit'
  | 'waglet'
  | 'whiskit'
  | 'snuglet'
  | 'driftkin'
  | 'duskle'
  | 'crustling'
  | 'nigirimp'
  | 'noodloo'
  | 'sundael'
  | 'bobaloo'
  | 'pagelet'
  | 'hooplet'
  | 'serveling'
  | 'petalimp'
  | 'fernip'
  | 'drizzlet'
  | 'amberleaf'
  | 'blossle'
  | 'peakle'
  | 'stillo'
  | 'twinklet'
  | 'feastle'
  | 'museling'
  | 'tasklet'
  | 'cheerlet'
  | 'voyagle'
  | 'skylo'
  | 'flexel'
  | 'mendle'
  | 'pixooka'
  | 'snoozle'
  | 'encora'
  | 'vesperitt'
  | 'dawnle'
  | 'tempesto'
  | 'mistle';

export type DayScores = Record<HomeScoreKey, number>;

export type DayPromptKind =
  | 'feeling'
  | 'activity'
  | 'people'
  | 'meaning'
  | 'day_word'
  | 'meaningful_photo'
  | 'sleep'
  | 'hobby'
  | 'intention'
  | 'energy'
  | 'inner_weather'
  | 'highlight'
  | 'gratitude'
  | 'body'
  | 'for_who';

export type DayPromptAnswerSource = 'prompt_chip' | 'photo_meaning' | 'prefill_confirm';

export type DayPromptEncounterBias = {
  seedId: string;
  intensity: number;
};

export type DayPromptAnswer = {
  id: string;
  kind: DayPromptKind;
  choiceIds: string[];
  labels: string[];
  createdAt: string;
  dismissed?: boolean;
  source: DayPromptAnswerSource;
  semanticTags: string[];
  scoreBias: Partial<DayScores>;
  encounterSeedBias?: DayPromptEncounterBias[];
  relatedAssetId?: string | null;
  noteText?: string | null;
};

export type HatchCheckInStatus = 'in_progress' | 'completed' | 'partial' | 'skipped';
export type HatchCheckInEligibilityReason = 'empty' | 'thin' | 'regular' | 'rich';
export type HatchCheckInMode = 'reconstruct' | 'reflect';

// A deliberately tiny, optional pre-hatch reflection. Its persisted plan adapts
// to the day's signal level while remaining one aggregate timeline entry.
export type HatchCheckIn = {
  planVersion?: 2;
  mode?: HatchCheckInMode;
  questionPlan?: string[];
  answeredQuestionIds?: string[];
  status: HatchCheckInStatus;
  eligibilityReason: HatchCheckInEligibilityReason;
  moodId: string | null;
  moodLabel: string | null;
  flowId: string | null;
  flowLabel: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  anchorId?: string | null;
  anchorLabel?: string | null;
  meaningId?: string | null;
  meaningLabel?: string | null;
  semanticTags: string[];
  scoreBias: Partial<DayScores>;
  encounterSeedBias: DayPromptEncounterBias[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type DayHeroPhoto = {
  assetId: string;
  thumbnailUri: string;
  localUri?: string;
  selectedAt: string;
  meaningChoiceIds: string[];
  meaningLabels: string[];
  noteText?: string | null;
};

// On-device vision read ("Read the day"). Produced per-photo by the native
// Apple Vision module (utils/photo-vision.ts), then aggregated per day. All
// fields are derived on-device — no pixels leave the phone.
export type PhotoVisionLabel = {
  name: string;
  confidence: number;
};

export type NormalizedImageRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
};

export type PhotoVisionRegionClassification = {
  region: NormalizedImageRegion;
  labels: PhotoVisionLabel[];
};

export type PhotoVisionResult = {
  labels: PhotoVisionLabel[];
  text: string[];
  faceCount: number;
  humanCount?: number;
  animals?: {
    kind: 'cat' | 'dog' | 'unknown';
    confidence: number;
    region?: NormalizedImageRegion | null;
  }[];
  humans?: NormalizedImageRegion[];
  faces?: NormalizedImageRegion[];
  recognizedText?: { text: string; confidence: number; region?: NormalizedImageRegion | null }[];
  dominantSubject?: {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  } | null;
  salientSubjects?: NormalizedImageRegion[];
  regionClassifications?: PhotoVisionRegionClassification[];
  documentDetected?: boolean;
  // Local provenance used before semantic classification. Location/live-camera
  // evidence supports a physical-world read; screenshot/screen-content evidence
  // takes priority and prevents depicted objects becoming real-life memories.
  isScreenshot?: boolean;
  hasLocation?: boolean;
  captureSource?: 'camera' | 'camera_roll' | 'unknown';
  reality?: {
    kind: 'real_world' | 'screen_content' | 'unknown';
    confidence: number;
    reasons: string[];
  };
};

export type DayEvidenceSourceType =
  | 'photo'
  | 'voice_note'
  | 'text_note'
  | 'place'
  | 'weather'
  | 'steps'
  | 'sleep'
  | 'studio'
  | 'food'
  | 'manual_log';

export type DayEvidenceProvider =
  | 'appleVision'
  | 'appleFoundation'
  | 'appleNaturalLanguage'
  | 'appleSpeech'
  | 'remoteLlm'
  | 'deterministic'
  | 'manual';

export type DayEvidenceSignal = {
  key: string;
  confidence: number;
  raw?: string | null;
  provider: DayEvidenceProvider;
  source: 'vision' | 'scene' | 'note' | 'manual' | 'aggregate';
  centrality?: MemoryQualityCentrality;
  qualityStatus?: MemoryQualityStatus;
};

export type DayEvidence = {
  id: string;
  sourceType: DayEvidenceSourceType;
  sourceId: string;
  observedAt: string;
  provider: DayEvidenceProvider;
  confidence: number;
  signals: DayEvidenceSignal[];
  thumbnailUri?: string | null;
  explanation?: string | null;
};

export type MemorySourceType = 'photo' | 'text_note' | 'voice_note' | 'place' | 'movement' | 'manual_log';

export type MemoryDomain =
  | 'animal'
  | 'people'
  | 'food'
  | 'media'
  | 'movement'
  | 'place'
  | 'work'
  | 'nature'
  | 'life_event'
  | 'other';

export type IntelligenceObservation = {
  key: string;
  value: string;
  confidence: number;
  provider: DayEvidenceProvider;
  raw?: string | null;
};

export type MemoryFacet = {
  key: string;
  value: string;
  confidence: number;
  sensitive?: boolean;
  confirmed?: boolean;
};

export type MemoryQualityCentrality = 'primary' | 'supporting' | 'incidental';
export type MemoryQualityStatus = 'inferred' | 'confirmed' | 'rejected';

export type MemoryQualitySource = {
  provider: DayEvidenceProvider;
  confidence: number;
  weight: number;
  raw?: string | null;
};

export type MemoryQualityScore = {
  qualityId: string;
  score: number;
  centrality: MemoryQualityCentrality;
  status: MemoryQualityStatus;
  sources: MemoryQualitySource[];
  reasons: string[];
};

export type UserConfirmation = {
  promptId: string;
  optionId: string;
  label: string;
  facetKey: string;
  facetValue: string;
  createdAt: string;
};

export type KatchimeraAssignment = {
  seedId: string;
  role: 'primary' | 'supporting';
  score: number;
  reasons: string[];
  confirmed: boolean;
};

export type ClarificationStatus = 'not_needed' | 'pending' | 'answered' | 'dismissed';

export type ClarificationGoal =
  | 'representation'
  | 'subject_focus'
  | 'device_activity'
  | 'authorship'
  | 'relationship'
  | 'ownership'
  | 'food_context'
  | 'media_identity'
  | 'place_context'
  | 'nature_context'
  | 'movement_context'
  | 'work_context'
  | 'life_event'
  | 'meaning';

export type QuestionScoreComponents = {
  evidenceSupport: number;
  centrality: number;
  informationGain: number;
  downstreamValue: number;
  continuity: number;
  novelty: number;
  penalty: number;
};

export type QuestionCandidateTrace = {
  questionId: string;
  goal: ClarificationGoal;
  eligible: boolean;
  score: number;
  components: QuestionScoreComponents;
  reasons: string[];
  blockers: string[];
};

export type ClarificationState = {
  status: ClarificationStatus;
  graphId?: string | null;
  currentNodeId?: string | null;
  answeredNodeIds: string[];
  dismissedAt?: string | null;
  graphVersion: number;
  questionCount?: number;
  maxQuestions?: number;
  skippedGoalIds?: string[];
  completedGoalIds?: string[];
  plannerVersion?: number;
  currentQuestionId?: string | null;
  askedQuestionIds?: string[];
  resolvedGoalIds?: string[];
  microQuestionCount?: number;
  candidateTrace?: QuestionCandidateTrace[];
};

export type PhotoSubjectRole = 'primary' | 'supporting' | 'incidental';

export type PhotoRepresentationKind =
  | 'physical_scene'
  | 'physical_artwork'
  | 'physical_document'
  | 'device_showing_content'
  | 'native_digital_image'
  | 'screenshot'
  | 'unknown';

export type PhotoContainerKind =
  | 'none'
  | 'book'
  | 'screen'
  | 'frame_or_canvas'
  | 'poster_or_print'
  | 'document'
  | 'packaging'
  | 'unknown';

export type DeviceKind =
  | 'laptop'
  | 'desktop'
  | 'phone'
  | 'tablet'
  | 'monitor'
  | 'television'
  | 'other';

export type ScreenContentKind =
  | 'gameplay'
  | 'work_app'
  | 'study_material'
  | 'creative_app'
  | 'video'
  | 'reading'
  | 'browser'
  | 'unknown';

export type DeviceActivity =
  | 'working'
  | 'studying'
  | 'creating'
  | 'gaming'
  | 'watching'
  | 'reading'
  | 'browsing'
  | 'other'
  | 'incidental';

export type PhotoHierarchyHypothesis = {
  path: string[];
  confidence: number;
  evidenceIds: string[];
  contradictions: string[];
};

export type PhotoUnresolvedFacet = {
  key: 'representation' | 'container' | 'primary_subject' | 'relationship' | 'authorship' | 'media_type' | 'place_kind' | 'device_activity';
  candidates: string[];
  importance: number;
  uncertainty: number;
  askable: boolean;
};

export type PhotoAnalysisSubject = {
  id: string;
  label: string;
  canonicalValue: string;
  domain: MemoryDomain;
  role: PhotoSubjectRole;
  score: number;
  region?: NormalizedImageRegion | null;
  providers: DayEvidenceProvider[];
  sensitive?: boolean;
};

export type PhotoAnalysisDescriptor = {
  schemaVersion: 2;
  stage: 'vision' | 'foundation' | 'complete';
  representation: {
    kind: 'real_world' | 'screen_content' | 'unknown';
    confidence: number;
    reasons: string[];
  };
  dominantSubjectId: string | null;
  subjects: PhotoAnalysisSubject[];
  selectedOcr: { text: string; confidence: number; purpose: 'title_candidate' | 'document' | 'context' }[];
  regions: Array<NormalizedImageRegion & { kind: 'saliency' | 'human' | 'face' | 'animal' }>;
  providerRuns: {
    provider: DayEvidenceProvider;
    status: 'used' | 'fallback' | 'unavailable' | 'rejected';
    promptVersion?: string | null;
    reason?: string | null;
  }[];
  alternatives: { domain: MemoryDomain; score: number; reason: string }[];
  hierarchy?: {
    schemaVersion: 2;
    representation: { kind: PhotoRepresentationKind; confidence: number; evidenceIds: string[] };
    container: { kind: PhotoContainerKind; confidence: number; evidenceIds: string[] };
    hypotheses: PhotoHierarchyHypothesis[];
    unresolvedFacets: PhotoUnresolvedFacet[];
  };
};

export type ClassifiedMemory = {
  id: string;
  sourceType: MemorySourceType;
  sourceId: string;
  dominantDomain: MemoryDomain;
  observations: IntelligenceObservation[];
  facets: MemoryFacet[];
  qualities: MemoryQualityScore[];
  confirmations: UserConfirmation[];
  entityIds: string[];
  assignments: KatchimeraAssignment[];
  promptState: ClarificationState;
  photoAnalysis?: PhotoAnalysisDescriptor | null;
  createdAt: string;
  schemaVersion: number;
};

export type PersonalEntity = {
  id: string;
  kind: 'person' | 'pet' | 'place';
  displayName?: string;
  relationship?: string;
  subrole?: string;
  createdAt: string;
  lastUsedAt: string;
};

// A canonical day-level subject, after grouping synonyms across the day's
// photos. `salience` (sum of per-photo confidence) weights it by frequency AND
// reliability; `coverage` (share of photos featuring it) says how much the day
// was *about* it. Both drive hatch intensity and the nightly line.
export type DayVisionConcept = {
  name: string;
  salience: number;
  coverage: number;
  count: number;
  peakConfidence: number;
};

// A coarse read of the day's weather. Sourced either from the day's photos
// (on-device vision: rain/snow) or a key-less forecast lookup on a coarsened
// location (see utils/day-weather.ts). Feeds the mood classifier and the
// nightly line, and shows as a small icon. Abstract label only — no coordinates.
export type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm';

export type DayWeather = {
  condition: WeatherCondition;
  tempMaxC?: number;
  source: 'vision' | 'forecast';
};

export type DayVisionSummary = {
  concepts: DayVisionConcept[];
  // The most salient *specific* raw labels, un-canonicalised ("marble
  // sculpture", "golden retriever"), for narration — more evocative than the
  // grouped concepts, which exist for seed matching.
  details: string[];
  maxFaceCount: number;
  faceCoverage: number;
  textTokens: string[];
  analyzedPhotoCount: number;
  // Structural signals from Vision's saliency/document requests. These let
  // media detection distinguish a cover filling the frame from a book that is
  // merely sitting in the background. Optional for migrated/legacy summaries.
  dominantSubjectCoverage?: number;
  documentCoverage?: number;
  representation?: PhotoVisionResult['reality'];
  analysisRegions?: Array<NormalizedImageRegion & { kind: 'saliency' | 'human' | 'face' | 'animal' }>;
  recognizedText?: { text: string; confidence: number }[];
};

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

// A single weighted signal the day surfaced, unified across every input source
// for the orbiting field around the egg. `weight` (0..1) drives orbit radius +
// size + glow; `feedsSpecies` links the tag to the candidate creature(s) it
// pushes, so tapping a tag can glow them. See utils/day-tags.ts.
export type DayTagSource = 'moment' | 'prompt' | 'vision' | 'place' | 'steps' | 'studio' | 'capture' | 'weather';

export type DayTag = {
  id: string;
  label: string;
  icon: IconSymbolName;
  accentColor: string;
  weight: number;
  feedsSpecies: string[]; // encounterProfileIds
  source: DayTagSource;
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
  // User-confirmed journal places keep their chosen Apple Maps/manual label.
  // Passive location samples omit these fields and continue to be reverse-geocoded.
  label?: string;
  address?: string;
  journalRecordId?: string;
  // Perceptual hash of the attached photo (when one is present), used to
  // collapse visual near-duplicates during day-map album curation.
  similarityHash?: string;
  // On-device brightness signals (0-255) of the attached photo, so the day-map
  // album can drop black / single-colour frames at DISPLAY time even if they
  // slipped into stored points.
  meanLuminance?: number;
  luminanceRange?: number;
};

export type DayMapCoordinate = {
  latitude: number;
  longitude: number;
};

export type DayMapNodePhoto = {
  id: string;
  thumbnailUri: string;
  capturedAt: string;
  momentId: string | null;
  // Derived display provenance. Older persisted/derived records omit these and
  // the day-map content selector reconstructs them from source IDs.
  sourceId?: string;
  provenance?: 'logged' | 'photo_library';
  meanLuminance?: number;
  luminanceRange?: number;
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
  // The curated album for this place cluster — keepers only, in capture order.
  photos: DayMapNodePhoto[];
  startedAt: string;
  endedAt: string;
  sampleCount: number;
  // Stable provenance lets the Places UI connect a derived dwell cluster back
  // to explicit journal/photo points without relying on the cluster id alone.
  sourcePointIds?: string[];
  sources?: HomeLocationSource[];
  journalRecordIds?: string[];
  label?: string;
  address?: string;
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
  encounterProfileId: string | null;
  repeatDepth: number;
  reflectionSource?: 'local' | 'generated';
  // Rarity is fixed at birth from the day's living conditions; bond grows with
  // return visits. The two axes are deliberately independent — see
  // utils/living-rarity.ts and utils/bond.ts.
  rarityReason?: string | null;
  livingFactors?: string[];
  bondStage?: number;
  bondVisitCount?: number;
  // The day's emotional read (mood) and relationship depth (bondDepth) at hatch,
  // plus the resolved expression-grid cell `<mood>_<bondDepth>` when this creature
  // has a variant set. Fixed at hatch like the rest of the record. See
  // utils/reflection-context.ts and utils/creature-variant.ts.
  mood?: string;
  bondDepth?: string;
  variantCell?: string;
  // Hatch Engine v2: the probability this creature had of being drawn from the
  // day's candidate field, the candidates it beat ("echoes"), and the seed
  // signals that formed it. Fixed at hatch. See utils/hatch-selection.ts.
  pickProbability?: number;
  fieldEchoes?: KatchimeraFieldEcho[];
  birthSignals?: string[];
};

export type EncounterHistoryEntry = {
  count: number;
  lastSeenIsoDate: string;
};

export type EncounterHistoryMap = Record<string, EncounterHistoryEntry>;

// A candidate the day's field surfaced that the hatch did NOT pick — the
// "almost caught" echo. Persisted on the winning creature so the reveal/share
// can say "you beat Ironette (Epic), 12%" without recomputation. See
// utils/hatch-selection.ts.
export type KatchimeraFieldEcho = {
  speciesId: string; // the losing creature's encounterProfileId
  name: string;
  visualKey: HomeVisualKey;
  rarity: HomeRarityTier;
  probability: number; // its share of the softmax this day (0..1)
  reason: string | null; // the day's living reason, when it would have been rare+
};

// A meaning the user chose for a captured / essence photo. `archetype` is the
// capture-energy MeaningTag (calm/energy/together/meaningful); `label` is the
// human phrase they picked ("Working", "A slow sip").
export type CapturedMeaning = {
  archetype: string;
  label: string;
  thumbnailUri: string | null;
  sourceId?: string | null;
  createdAt: string;
};

// Food memories — what you tasted, shared, or enjoyed (never calorie tracking).
// Created only when food is actually part of the day (a food quest / manual add).
export type FoodMeaning = 'treat' | 'sharedMeal' | 'comfort' | 'fuel' | 'discovery';
// How a food memory entered the vault: a manual two-step add, an auto-detect from
// a snapped photo (Apple Vision), or an auto-detect from a note's text.
export type FoodSource = 'manual' | 'photo' | 'note';
// The optional "what kind?" tag on a Meal — a cuisine FAMILY (drives the food
// journey keepsakes: one Cuisine Lantern per first-time family).
export type CuisineFamily =
  | 'italian'
  | 'japanese'
  | 'chinese'
  | 'indian'
  | 'mexican'
  | 'middle_eastern'
  | 'french'
  | 'greek';
export type FoodMoment = {
  id: string;
  label: string; // "Coffee", "Dinner", "Dessert"
  emoji: string;
  meaning?: FoodMeaning | null;
  thumbnailUri?: string | null;
  source?: FoodSource;
  sourceId?: string | null;
  noteId?: string | null; // the note this food was detected in (source 'note')
  detail?: string | null; // a short snippet for the reader (e.g. note excerpt)
  // Optional "what kind?" answer on a Meal — either a cuisine family or
  // home-made (never both; both absent when skipped or not asked).
  cuisine?: CuisineFamily | null;
  homeCooked?: boolean;
  createdAt: string;
};

// Inspiration archive (the Studio) — books, films, shows, games, music, art you
// took in. NOT a review/rating tracker: a keepsake of what you experienced and how
// it landed, kept for later. Created from a note that mentions it, a photo (a book
// cover / poster), or a manual two-step add.
export type StudioMediaType = 'book' | 'film' | 'show' | 'game' | 'music' | 'art' | 'other';
// How it landed — a graded scale, most positive first. "inspired" sits alongside
// "loved" so a thing can be cherished for moving you, not just for being enjoyed.
export type StudioRating = 'loved' | 'inspired' | 'liked' | 'meh';
export type StudioSource = 'manual' | 'photo' | 'note';
export type StudioMoment = {
  id: string;
  label: string; // the title if known ("Dune"), else the media kind ("A book")
  mediaType: StudioMediaType;
  emoji: string;
  rating?: StudioRating | null;
  thumbnailUri?: string | null;
  source?: StudioSource;
  sourceId?: string | null;
  noteId?: string | null; // the note this was detected in (source 'note')
  detail?: string | null; // a short snippet for the reader (e.g. note excerpt)
  createdAt: string;
};

// The Featured Memory Board (docs/world-structures-cozy-direction.md §9.3) — the
// day's "cover": one user-chosen photo shown billboard-style by the Memory Vault,
// or an illustrated card when there's no photo. Display-only.
export type FeaturedMemory = {
  kind: 'photo' | 'card';
  assetId?: string; // camera-roll / capture asset id, when a photo
  thumbnailUri?: string; // the displayed image
  createdAt: string;
};

// How the day began, atmospherically. Never a score or a failure — low sleep is
// just a softer, mistier morning. Manual for now (a one-tap "how was your
// sleep?"); Apple Health can fill it passively later.
export type SleepQuality = 'good' | 'normal' | 'low';
export type DaySleep = {
  quality: SleepQuality;
  source: 'manual' | 'appleHealth';
  totalSleepMinutes?: number;
  recordedAt?: string;
};

// How a notably active day MOVED — the steps tell us "a lot happened", the user
// tells us what it WAS (a hike, a long walk, a run...). Read-only interpretation
// that colours the day's story; never a goal or a score. One-tap, from the "!" on
// the Steps structure when the day's steps spike.
export type DayMovementKind =
  | 'hike'
  | 'walk'
  | 'run'
  | 'cycle'
  | 'workout'
  | 'errands'
  | 'transit'
  | 'drive'
  | 'commute'
  | 'travel'
  | 'mixed';
export type StepsInterpretation = {
  movement: DayMovementKind;
  label: string; // "A hike", "A long walk"
  emoji: string;
  subtype?: string | null;
  createdAt: string;
};

// A place the user confirmed for the day — the "where" (category) + the "why"
// (meaning). Location gives the spot; the user gives the meaning. Keyed by the
// day-map node id so each detected place is confirmed at most once.
export type ConfirmedPlace = {
  id: string; // the day-map node id this confirmation belongs to
  category: string; // 'cafe' | 'park' | 'work' | 'home' | 'food' | ... (the "where")
  archetype: string; // calm | energy | together | meaningful | focus (the "why")
  label: string; // display label (the category's friendly name)
  meaningLabel?: string; // the category-specific "what it meant" phrase ("Focused", "A treat")
  confirmedAt: string;
  // New place saves are location-first. `other_place` / `unassigned` mean the
  // user has saved the where but has not optionally enriched it yet.
  name?: string;
  categoryLabel?: string;
  latitude?: number;
  longitude?: number;
  address?: string | null;
  placeId?: string | null;
  locationSource?: JournalLocationSelection['source'] | 'detected';
  locationPointId?: string;
  detectedNodeId?: string;
};

// A written or spoken note attached to the day — a time-capsule entry. The
// transcript (for voice) + an inferred mood feed the patch's cells; an optional
// detected Big Moment grows a special landmark. Voice notes also keep their audio.
export type DayNote = {
  id: string;
  kind: 'text' | 'voice';
  text: string;
  audioUri: string | null; // local file uri for voice notes
  durationMs: number | null;
  archetype: string; // calm | energy | together | meaningful
  label: string;
  parentSourceType?: 'photo' | null;
  parentSourceId?: string | null;
  createdAt: string;
};

export type BigMomentType =
  | 'birthday'
  | 'anniversary'
  | 'firstTime'
  | 'holiday'
  | 'trip'
  | 'achievement'
  | 'milestone'
  // Life-event types (each lights its own celebration keepsake in the Kingdom).
  | 'baby'
  | 'wedding'
  | 'graduation'
  | 'newHome'
  | 'newJob'
  | 'reunion';

// A special event a note revealed (always user-confirmed) — grows a rare
// landmark object in the patch's centre.
export type BigMoment = {
  id: string;
  type: BigMomentType;
  label: string;
  subject: string | null; // e.g. "son"
  noteId: string | null;
  createdAt: string;
};

export type ManualJournalEntry = {
  id: string;
  flowId: string;
  flowVersion: number;
  path: string[];
  categoryId: string;
  canonicalQualityIds: string[];
  fields: Record<string, string | string[] | boolean | null>;
  feeling?: string | null;
  note?: string | null;
  sourceType?: 'manual' | 'photo';
  sourceId?: string | null;
  linkedNoteId?: string | null;
  location?: JournalLocationSelection | null;
  createdAt: string;
};

export type JournalInputKind = 'manual' | 'photo' | 'text_note' | 'voice_note';

export type JournalSource =
  | { kind: 'manual'; sourceId: string }
  | { kind: 'photo'; sourceId: string; thumbnailUri?: string | null; classifiedMemoryId?: string | null; evidenceId?: string | null }
  | { kind: 'text_note'; sourceId: string; origin?: JournalSourceOrigin | null }
  | { kind: 'voice_note'; sourceId: string; audioUri?: string | null; durationMs?: number | null; origin?: JournalSourceOrigin | null };

export type JournalSourceOrigin = {
  kind: 'companion_reflection';
  creatureId: string;
  promptId: string;
  promptText: string;
};

export type JournalAttachment = {
  id: string;
  kind: 'text' | 'voice' | 'photo';
  text?: string | null;
  uri?: string | null;
  durationMs?: number | null;
};

export type JournalConfirmedFacet = { key: string; value: string; sensitive?: boolean };

export type JournalLocationSelection = {
  latitude: number;
  longitude: number;
  name: string;
  address?: string | null;
  placeId?: string | null;
  source: 'apple_maps' | 'current_location' | 'manual_pin' | 'photo_metadata' | 'day_location';
  accuracyMeters?: number | null;
};

export type JournalRouteProposal = {
  id: string;
  flowId: string;
  choiceId: string;
  label: string;
  confidence: number;
  reasons: string[];
  confirmedFacets: JournalConfirmedFacet[];
  prefilledSpecific?: string;
};

export type JournalNoteClassification = {
  kind: 'categorized' | 'generic' | 'ambiguous';
  flowId: string | null;
  categoryId: string | null;
  fields: {
    specific: string | null;
    context: string | null;
  };
  feeling: string | null;
  provider: 'appleFoundation';
  confidence?: number | null;
  decisionSource?: 'foundation' | 'foundationRetry' | 'registryCorroborated' | 'generic' | 'legacy';
};

export type JournalDraft = {
  sessionId: string;
  source: JournalSource;
  flowId: string | null;
  categoryId: string | null;
  fields: Record<string, string | string[] | boolean | null>;
  feeling: string | null;
  note: string | null;
  attachments: JournalAttachment[];
  confirmedFacets: JournalConfirmedFacet[];
  location?: JournalLocationSelection | null;
};

export type JournalRecord = {
  id: string;
  schemaVersion: 1;
  idempotencyKey: string;
  source: JournalSource;
  flowId: string;
  flowVersion: number;
  categoryId: string;
  canonicalQualityIds: string[];
  fields: Record<string, string | string[] | boolean | null>;
  feeling: string | null;
  note: string | null;
  attachments: JournalAttachment[];
  confirmedFacets: JournalConfirmedFacet[];
  location?: JournalLocationSelection | null;
  createdAt: string;
};

export type JournalCommitCommand = {
  idempotencyKey: string;
  draft: JournalDraft;
};

export type JournalNoteDraft = {
  kind: 'text' | 'voice';
  text: string;
  audioUri?: string | null;
  durationMs?: number | null;
};

export type ManualJournalSubmission = {
  flowId: string;
  path: string[];
  categoryId: string;
  canonicalQualityIds: string[];
  fields: Record<string, string | string[] | boolean | null>;
  feeling?: string | null;
  note?: string | null;
  sourceType?: 'manual' | 'photo';
  sourceId?: string | null;
  thumbnailUri?: string | null;
  linkedNote?: JournalNoteDraft | null;
  sessionId?: string;
  confirmedFacets?: JournalConfirmedFacet[];
  journalSource?: JournalSource;
  location?: JournalLocationSelection | null;
};

export type StoredHomeDayRecord = {
  id: string;
  isoDate: string;
  state: HomeDayState;
  stepsCount: number;
  // The local calendar day the pedometer aggregate was measured for. This keeps
  // a late-night "today" reading from being copied into tomorrow's forming egg.
  stepsCountDayId?: string;
  stepsUpdatedAt?: string | null;
  visitedPlaceCount: number;
  newPlaceCount: number;
  locationSampleCount: number;
  shareReadyAt: string | null;
  moments: HomeMoment[];
  locations: StoredHomeLocationPoint[];
  healthRouteImport: StoredHealthRouteImportMeta | null;
  exactRouteSegments: StoredExactRouteSegment[];
  selectedPathId: string | null;
  creature: LocalCreatureRecord | null;
  promptAnswers: DayPromptAnswer[];
  hatchCheckIn?: HatchCheckIn;
  // Developer tools can replay the hatch at any hour and optionally exercise
  // the low-signal hierarchy without deleting the day's real journal data.
  devForceReadyToHatch?: boolean;
  devHatchReflectionMode?: 'force_low_signal';
  heroPhoto: DayHeroPhoto | null;
  placeCategorySeeds?: string[];
  // Aggregated on-device vision read of the day's photos (optional — present
  // only once the native vision module has analysed them).
  vision?: DayVisionSummary;
  // Per-source intelligence evidence for quest-grade verification. Aggregate
  // fields like `vision` remain derived compatibility surfaces for older code.
  evidence?: DayEvidence[];
  // Versioned, explainable classification records. Legacy `vision` and
  // `evidence` remain readable compatibility surfaces during the v8 rollout.
  classifiedMemories?: ClassifiedMemory[];
  manualJournalEntries?: ManualJournalEntry[];
  // Canonical, reviewed journal inputs. Older arrays below remain materialized
  // compatibility projections while their readers migrate to journal selectors.
  journalRecords?: JournalRecord[];
  // Coarse weather for the day (optional — resolved best-effort at hatch).
  weather?: DayWeather;
  // Energy captured through the camera (Moment Capture): score deltas that fold
  // into the day's scores alongside moments + prompt answers. See
  // utils/capture-energy.ts.
  capturedEnergy?: Partial<DayScores>;
  // What the user said a captured/essence photo meant ("Working", "A slow sip").
  // Display-only: surfaced in the day's "Photos · what they meant" section. The
  // archetype (calm/energy/together/meaningful) drives the chip icon + colour.
  capturedMeanings?: CapturedMeaning[];
  // Camera-roll asset ids the user has already added to the vault, so they're
  // excluded from future photo prompts / the "!" (only NEW photos prompt).
  usedPhotoAssetIds?: string[];
  // Places the user confirmed (category + meaning) for the day — drives the
  // Places cell + clears the places "!" once every detected place is confirmed.
  confirmedPlaces?: ConfirmedPlace[];
  // Detected dwell clusters explicitly rejected by the user should not return
  // every time the Today Places sheet is opened.
  dismissedPlaceCandidateIds?: string[];
  // How the day began (sleep atmosphere) — manual one-tap for now.
  sleep?: DaySleep;
  // What a notably active day's steps MEANT (hike / walk / run...) — one-tap from
  // the "!" on the Steps structure. Read-only colour, never a goal.
  stepsInterpretation?: StepsInterpretation;
  // Food memories — populate the Food Vault when food is part of the day.
  foodMoments?: FoodMoment[];
  // Inspiration archive — books/films/shows/games you took in (the Studio).
  studioMoments?: StudioMoment[];
  // The day's "cover" memory shown on the Featured Memory Board (user-chosen photo,
  // or an illustrated card). See utils/day-memories.ts + the Memory cluster.
  featuredMemory?: FeaturedMemory;
  // Today Patch V2 — Daily Seed ids the user has completed (manual one-tap).
  // Passive seeds are satisfied from signals, not stored here. Each earned seed
  // grows its reward object on the Today patch. See utils/daily-seeds-engine.ts.
  seedCompletions?: string[];
  // Voice/text notes for the day (time-capsule entries) + any confirmed Big
  // Moments they revealed. See utils/note-meaning.ts + today-patch-engine.ts.
  notes?: DayNote[];
  bigMoments?: BigMoment[];
  // A user-given name for the day/patch (the namePatch quest). Display-only.
  dayName?: string;
  // Cheap signature of the inputs the derived fields (dayMap, place counts)
  // depend on — lets normalize skip re-deriving settled archived days.
  derivedSignature?: string;
  // Stable per-day nonce, generated once when the forming day is created. Seeds
  // the hatch RNG (with isoDate + input signature) so the probabilistic draw is
  // reproducible across re-derivations yet differs day to day. See
  // utils/hatch-selection.ts.
  storedNonce?: string;
};

export type StoredHomeState = {
  version: 12;
  locationPermission: LocationPermissionState;
  activityPermission: ActivityPermissionState;
  healthPermission: HealthPermissionState;
  encounterHistory: EncounterHistoryMap;
  // User-confirmed local context only. No face embeddings or biometric data.
  personalEntities: PersonalEntity[];
  // Remote enrichment is disabled by default and must be explicitly enabled.
  cloudIntelligenceEnabled: boolean;
  archivedDays: StoredHomeDayRecord[];
  today: StoredHomeDayRecord;
  // A forming "next day" the user can pre-feed (moments / prompts / captures)
  // once today has hatched. Promoted to `today` at the calendar rollover. Absent
  // until something is fed into it.
  tomorrow?: StoredHomeDayRecord;
  backfilledAt?: string;
};

// Which forming day an input (moment / prompt / capture) targets.
export type DayInputTarget = 'today' | 'tomorrow';

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
  // On-device perceptual hash (hex dHash) for visual-similarity curation.
  similarityHash?: string;
  // On-device brightness signals (0-255) so the live seeder also drops black /
  // single-colour junk before it becomes a pin.
  meanLuminance?: number;
  luminanceRange?: number;
  // On-device vision read of this frame (labels/OCR/face count), when analysed.
  vision?: PhotoVisionResult;
  visionSummary?: DayVisionSummary;
  sceneRead?: {
    memoryDomain?: MemoryDomain | null;
    type: 'media' | 'food' | 'social' | 'screen' | 'nature' | 'pet' | 'activity' | 'place' | 'document' | 'other';
    label: string;
    detail?: string | null;
    food?: { detected: boolean; label?: string; emoji?: string; cuisine?: CuisineFamily | null };
    media?: { mediaType: StudioMediaType; title: string | null; creator: string | null };
    source: 'llm' | 'semantic' | 'rules';
    supportingSubjects?: string[];
    representation?: 'real_world' | 'screen_content' | 'unknown' | null;
    promptVersion?: string | null;
  };
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
