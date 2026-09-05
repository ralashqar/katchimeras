import assert from 'node:assert/strict';
import test from 'node:test';

import { companionAchievementSections, COMPANION_ACHIEVEMENT_CATALOG, COMPANION_OWNED_DISCOVERY_IDS } from '@/constants/companion-achievements';
import { katchimeraFamilies } from '@/constants/katchimera-skins';
import type { CompanionAchievementContext } from '@/types/companion-achievements';
import { buildCompanionAchievementContexts } from '@/utils/companion-achievements-context';
import { companionAchievementEntries, evaluateCompanionAchievements } from '@/utils/companion-achievements-engine';
import { COMPANION_OWNED_DISCOVERY_IDS as GLOBAL_OWNERSHIP_IDS, GLOBAL_DISCOVERY_CATALOG } from '@/utils/discoveries-catalog';
import { buildPhotoAchievementSnapshot, evaluatePhotoQuality, MOSS_PHOTO_ACHIEVEMENT_RULES } from '@/utils/photo-achievements';
import type { ClassifiedMemory, HomeDayRecord } from '@/types/home';

test('every canonical companion owns a curated semantic collection', () => {
  assert.equal(katchimeraFamilies.length, 25);
  assert.equal(new Set(COMPANION_ACHIEVEMENT_CATALOG.map((def) => def.id)).size, COMPANION_ACHIEVEMENT_CATALOG.length);
  for (const family of katchimeraFamilies) {
    const familyDefs = COMPANION_ACHIEVEMENT_CATALOG.filter((def) => def.familyId === family.id);
    assert.ok(familyDefs.length >= 12, `${family.id}: ${familyDefs.length}`);
    assert.ok(familyDefs.some((def) => def.pillar === 'domain'), `${family.id}: domain`);
    assert.ok(familyDefs.some((def) => def.pillar === 'goals'), `${family.id}: goals`);
    assert.ok(familyDefs.some((def) => def.pillar === 'quests'), `${family.id}: quests`);
    for (const sectionId of new Set(familyDefs.map((def) => def.sectionId))) {
      const defs = familyDefs.filter((def) => def.sectionId === sectionId);
      if (new Set(defs.map((def) => def.metric.signal)).size === 1) {
        assert.ok(defs.every((def, index) => index === 0 || def.metric.target > defs[index - 1].metric.target), `${family.id}.${sectionId}`);
      }
    }
  }

  const stepDays = COMPANION_ACHIEVEMENT_CATALOG.filter((def) => def.familyId === 'steppling' && def.sectionId === 'step-days');
  assert.deepEqual(stepDays.map((def) => def.metric.target), [5000, 10000, 15000, 20000, 30000]);
  const flickerbun = COMPANION_ACHIEVEMENT_CATALOG.filter((def) => def.familyId === 'flickerbun');
  assert.ok(flickerbun.some((def) => def.metric.signal === 'flickerbun.distinctScreenTitles'));
  assert.ok(flickerbun.some((def) => def.metric.signal === 'flickerbun.cinemaVisits'));
  const mossprout = COMPANION_ACHIEVEMENT_CATALOG.filter((def) => def.familyId === 'mossprout');
  assert.equal(mossprout.length, 29);
  assert.equal(mossprout.filter((def) => def.metric.kind === 'photo').length, 12);
});

test('photo achievements count only kept, prominent, physical-world photos and deduplicate sources', () => {
  const memory = {
    id: 'classified:photo:flower-1', sourceType: 'photo', sourceId: 'flower-1', dominantDomain: 'nature',
    observations: [], facets: [], confirmations: [], entityIds: [], assignments: [],
    promptState: { status: 'not_needed', answeredNodeIds: [], graphVersion: 1 }, createdAt: '2026-08-01T12:00:00Z', schemaVersion: 3,
    qualities: [{ qualityId: 'nature.flowers', score: 0.92, centrality: 'supporting', status: 'inferred', sources: [], reasons: [] }],
    photoAnalysis: { schemaVersion: 2, stage: 'complete', representation: { kind: 'real_world', confidence: 0.98, reasons: [] }, dominantSubjectId: null, subjects: [], selectedOcr: [], regions: [], providerRuns: [], alternatives: [] },
  } as unknown as ClassifiedMemory;
  const metric = { kind: 'photo' as const, ...MOSS_PHOTO_ACHIEVEMENT_RULES.blooms, target: 1, unit: 'photos', counting: 'total' as const };
  const keptDay = {
    id: 'day-1', isoDate: '2026-08-01', state: 'forming', classifiedMemories: [memory, memory],
    journalRecords: [{ id: 'journal-1', source: { kind: 'photo', sourceId: 'flower-1' } }],
  } as unknown as HomeDayRecord;
  const snapshot = buildPhotoAchievementSnapshot([keptDay], [metric]);
  assert.equal(snapshot.values[metric.signal], 1);
  assert.equal(snapshot.photoDayCount, 1);
  assert.equal(snapshot.distinctPhysicalQualityCount, 1);
  assert.equal(buildPhotoAchievementSnapshot([{ ...keptDay, journalRecords: [] } as HomeDayRecord], [metric]).values[metric.signal], 0);

  const depicted = { ...memory, photoAnalysis: { ...memory.photoAnalysis!, representation: { kind: 'screen_content' as const, confidence: 0.99, reasons: [] } } } as ClassifiedMemory;
  assert.equal(evaluatePhotoQuality(depicted, 'nature.flowers').status, 'no_match');
  const uncertain = { ...memory, qualities: [{ ...memory.qualities[0], score: 0.5 }] } as ClassifiedMemory;
  assert.equal(evaluatePhotoQuality(uncertain, 'nature.flowers').status, 'possible');
});

test('evaluation reads semantic signals, remains monotonic and bounds progress', () => {
  const catalog = COMPANION_ACHIEVEMENT_CATALOG.filter((def) => def.familyId === 'steppling');
  const context: CompanionAchievementContext = {
    familyId: 'steppling',
    values: {
      'steppling.maxSteps': 10000,
      'steppling.walkingStreak': 4,
      'steppling.walkEntries': 2,
      'steppling.quickGoals': 5,
      'steppling.quests': 1,
      'steppling.journeyGoals': 0,
    },
    sourceDayBySignal: {},
  };
  const first = evaluateCompanionAchievements(context, {}, catalog);
  assert.deepEqual(first.filter((def) => def.sectionId === 'step-days').map((def) => def.metric.target), [5000, 10000]);
  assert.deepEqual(first.filter((def) => def.sectionId === 'walking-streak').map((def) => def.metric.target), [3]);
  assert.deepEqual(first.filter((def) => def.sectionId === 'family-goals').map((def) => def.metric.target), [1, 5]);
  const unlocked = Object.fromEntries(first.map((def) => [def.id, { id: def.id, earnedAt: 1, sourceDayId: undefined, seenCelebration: true }]));
  assert.equal(evaluateCompanionAchievements(context, unlocked, catalog).length, 0);
  assert.ok(companionAchievementEntries(context, unlocked, catalog).every((entry) => entry.ratio >= 0 && entry.ratio <= 1));
});

test('the engine evaluates catalogs larger than one hundred without truncation', () => {
  const template = COMPANION_ACHIEVEMENT_CATALOG.find((def) => def.familyId === 'mossprout')!;
  const catalog = Array.from({ length: 120 }, (_, index) => ({
    ...template,
    id: `mossprout.scale-test.${index + 1}`,
    metric: { kind: 'signal' as const, signal: 'mossprout.scaleTest', target: index + 1, unit: 'finds', counting: 'total' as const },
  }));
  const context: CompanionAchievementContext = {
    familyId: 'mossprout',
    values: { 'mossprout.scaleTest': 120 },
    sourceDayBySignal: {},
  };
  assert.equal(evaluateCompanionAchievements(context, {}, catalog).length, 120);
  assert.equal(companionAchievementEntries(context, {}, catalog).length, 120);
});

test('section help explains the exact journal route and every section is actionable', () => {
  for (const family of katchimeraFamilies) {
    const sections = companionAchievementSections(family.id);
    assert.ok(sections.length > 0);
    assert.ok(sections.every((section) => section.recordingHelp.trim().length > 0), family.id);
  }
  const walks = companionAchievementSections('steppling').find((section) => section.id === 'walks-shared');
  assert.match(walks?.recordingHelp ?? '', /Moved or exercised/);
  assert.match(walks?.recordingHelp ?? '', /step totals alone do not count/i);
});

test('walks shared counts the Movement → Walk journal route, not a walk used only as another entry context', () => {
  const contexts = buildCompanionAchievementContexts({
    days: [{
      id: 'walk-day', isoDate: '2026-08-03', state: 'hatched', stepsCount: 9000,
      journalRecords: [
        { id: 'movement-walk', flowId: 'movement', categoryId: 'walk', fields: {}, createdAt: '2026-08-03T09:00:00Z' },
        { id: 'park-walk', flowId: 'went_somewhere', categoryId: 'park', fields: { context: 'walk' }, createdAt: '2026-08-03T11:00:00Z' },
      ],
    } as never],
    bond: { schemaVersion: 1, events: [] },
    quests: { schemaVersion: 4, quests: [], submissions: [], offerCycles: [], attempts: [] },
    journey: { schemaVersion: 3, goals: [], conversations: [], questEvents: [], reflectionEvents: [], checkIns: [], momentEvents: [] },
    quickGoals: { schemaVersion: 3, goals: [], completions: [], dismissals: [] },
  });
  assert.equal(contexts.get('steppling')?.values['steppling.walkEntries'], 1);
});

test('context folds steps, distinct media, goals and quests without treating repeats as new titles', () => {
  const contexts = buildCompanionAchievementContexts({
    days: [
      {
        id: 'day-1', isoDate: '2026-08-01', state: 'hatched', stepsCount: 12000,
        studioMoments: [{ id: 'film-1', label: 'Spirited Away', mediaType: 'film', emoji: '', createdAt: '2026-08-01T20:00:00Z' }],
      } as never,
      {
        id: 'day-2', isoDate: '2026-08-02', state: 'hatched', stepsCount: 6000,
        studioMoments: [{ id: 'film-2', label: 'Spirited Away', mediaType: 'film', emoji: '', createdAt: '2026-08-02T20:00:00Z' }],
      } as never,
    ],
    bond: { schemaVersion: 1, events: [] },
    quests: {
      schemaVersion: 4,
      quests: [{ questId: 'quest-steppling-walk-detail', creatureId: 'companion:steppling', title: 'Walk detail', hint: '', acceptedAt: 1, completedAt: 2, completedDayId: 'day-2', source: 'companion', questRunId: 'run-1' }],
      submissions: [], offerCycles: [], attempts: [],
    },
    journey: {
      schemaVersion: 3,
      goals: [{ id: 'goal-1', familyId: 'steppling', goalTypeId: 'walk', title: 'Walk', status: 'completed', isPrimary: false, createdAt: 1, updatedAt: 2, completedAt: 2 }],
      conversations: [], questEvents: [], reflectionEvents: [], checkIns: [], momentEvents: [],
    },
    quickGoals: {
      schemaVersion: 3,
      goals: [{ id: 'quick-1', familyId: 'steppling', title: 'Short walk', cadence: { kind: 'daily' }, status: 'active', createdAt: 1, updatedAt: 1 }],
      completions: [
        { id: 'complete-1', goalId: 'quick-1', familyId: 'steppling', dayId: 'day-1', completedAt: 1 },
        { id: 'complete-2', goalId: 'quick-1', familyId: 'steppling', dayId: 'day-2', completedAt: 2 },
      ],
      dismissals: [],
    },
  });
  assert.equal(contexts.get('steppling')?.values['steppling.maxSteps'], 12000);
  assert.equal(contexts.get('steppling')?.values['steppling.walkingStreak'], 2);
  assert.equal(contexts.get('steppling')?.values['steppling.quickGoals'], 2);
  assert.equal(contexts.get('steppling')?.values['steppling.quests'], 1);
  assert.equal(contexts.get('steppling')?.values['steppling.journeyGoals'], 1);
  assert.equal(contexts.get('flickerbun')?.values['flickerbun.screenEntries'], 2);
  assert.equal(contexts.get('flickerbun')?.values['flickerbun.distinctScreenTitles'], 1);
});

test('distinct places deduplicate stable venue identities and global discoveries exclude companion-owned rules', () => {
  const contexts = buildCompanionAchievementContexts({
    days: [
      { id: 'one', isoDate: '2026-08-01', state: 'hatched', stepsCount: 0, confirmedPlaces: [{ id: 'a', category: 'cafe', archetype: 'calm', label: 'Oak Cafe', confirmedAt: '2026-08-01', placeId: 'oak-1' }] } as never,
      { id: 'two', isoDate: '2026-08-02', state: 'hatched', stepsCount: 0, confirmedPlaces: [{ id: 'b', category: 'cafe', archetype: 'calm', label: 'Oak Cafe', confirmedAt: '2026-08-02', placeId: 'oak-1' }] } as never,
    ],
    bond: { schemaVersion: 1, events: [] },
    quests: { schemaVersion: 4, quests: [], submissions: [], offerCycles: [], attempts: [] },
    journey: { schemaVersion: 3, goals: [], conversations: [], questEvents: [], reflectionEvents: [], checkIns: [], momentEvents: [] },
    quickGoals: { schemaVersion: 3, goals: [], completions: [], dismissals: [] },
  });
  assert.equal(contexts.get('baristabbit')?.values['baristabbit.cafeVisits'], 2);
  assert.equal(contexts.get('skylo')?.values['skylo.distinctVenues'], 1);
  const globalIds = new Set(GLOBAL_DISCOVERY_CATALOG.map((definition) => definition.id));
  assert.ok(globalIds.has('first_memory'));
  assert.ok(!globalIds.has('steps_10k'));
  assert.ok(!globalIds.has('first_cinema'));
  assert.ok(!globalIds.has('museums_3'));
  assert.deepEqual([...GLOBAL_OWNERSHIP_IDS].sort(), [...COMPANION_OWNED_DISCOVERY_IDS].sort());
});
