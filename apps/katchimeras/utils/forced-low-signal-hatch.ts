import type { StoredHomeDayRecord } from '@/types/home';

/**
 * Builds the private, temporary input used by a forced low-signal hatch.
 * The persisted day remains untouched; only the active pre-hatch questionnaire
 * is allowed to shape the creature, its traits, rarity, and deterministic draw.
 */
export function dayForDevHatchSelection(day: StoredHomeDayRecord): StoredHomeDayRecord {
  if (day.devHatchReflectionMode !== 'force_low_signal') return day;
  return {
    ...day,
    stepsCount: 0,
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    locationSampleCount: 0,
    moments: [],
    locations: [],
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: null,
    promptAnswers: [],
    heroPhoto: null,
    placeCategorySeeds: [],
    vision: undefined,
    evidence: [],
    classifiedMemories: [],
    photoPlaceResolutions: [],
    manualJournalEntries: [],
    journalRecords: [],
    keyJournalRecordId: null,
    weather: undefined,
    capturedEnergy: undefined,
    capturedMeanings: [],
    confirmedPlaces: [],
    sleep: undefined,
    stepsInterpretation: undefined,
    foodMoments: [],
    studioMoments: [],
    notes: [],
    bigMoments: [],
  };
}
