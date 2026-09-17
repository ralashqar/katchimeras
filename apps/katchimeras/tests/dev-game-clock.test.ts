import { createContentFlowDirector } from '@incubator/story/director';
import { createContentFlowCatalog } from '@incubator/story/catalog';
import { createContentFlowEffects } from '@incubator/story/effects';
import type { ContentFlowRun } from '@/types/content-flow';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createGameClock } from '@/utils/game-clock';
import { loadNativeModule } from './helpers/native-motion-harness';
import { eventPhase } from '@/features/live-ops/rules';
import { createLocalEventPilot } from '@/features/live-ops/local-catalog';
import { journeyChapterState } from '@/features/companion/journey-triggers';
import { FEASTLE_CHAPTER } from '@/constants/companion-journey-chapters/feastle';
import { emptyRelationshipProgressState } from '@/game/katchimeras/relationship-progression';
import { emptyCompanionContentState } from '@/utils/companion-content';
import { emptyCompanionBondState } from '@/utils/companion-bond';
const HOUR = 3600000;

function harness(enabled = true) {
  const saved = new Map<string, unknown>();
  const real = { now: Date.parse('2026-10-02T12:00:00Z') };
  const clock = createGameClock(enabled, () => real.now);
  const load = () => loadNativeModule('utils/dev-game-clock.ts', {
    '@/constants/dev': { DEV_TOOLS_ENABLED: enabled },
    '@/utils/game-clock': { gameClock: clock },
    '@/utils/app-storage': { getStoredJson: (key: string, fallback: unknown) => saved.get(key) ?? fallback, setStoredJson: (key: string, value: unknown) => saved.set(key, value), removeStoredValue: (key: string) => saved.delete(key) },
  });
  return { saved, real, clock, load, dev: load() };
}

test('skips accumulate, wall time continues, restart restores offset, reset clears it', () => {
  const h = harness();
  let notifications = 0;
  const unsubscribe = h.clock.subscribe(() => notifications++);
  h.dev.advanceDevGameTime(HOUR); h.dev.advanceDevGameTime(4 * HOUR); h.dev.advanceDevGameTime(24 * HOUR);
  assert.equal(h.clock.offset(), 29 * HOUR);
  h.real.now += 2000;
  assert.equal(h.clock.now(), h.real.now + 29 * HOUR);
  h.clock.setOffset(0); h.load();
  assert.equal(h.clock.offset(), 29 * HOUR);
  h.dev.resetDevGameTime(); h.load();
  assert.equal(h.clock.now(), h.real.now);
  assert.equal(h.saved.size, 0);
  assert.ok(notifications >= 5);
  unsubscribe();
});

test('production and invalid offsets cannot change gameplay time', () => {
  const h = harness(false);
  h.dev.advanceDevGameTime(HOUR); h.clock.setOffset(HOUR);
  assert.equal(h.clock.now(), h.real.now);
  const dev = harness();
  for (const value of [NaN, Infinity, -1, 0.5]) dev.dev.advanceDevGameTime(value);
  assert.equal(dev.clock.offset(), 0);
});

test('four-hour skip opens an authored chapter time gate and advances event phase', () => {
  const h = harness();
  const chapter = { ...FEASTLE_CHAPTER, episodes: [FEASTLE_CHAPTER.episodes[0], { ...FEASTLE_CHAPTER.episodes[1], unlock: [{ kind: 'since_previous' as const, ms: 4 * HOUR }] }] };
  const relationships = { ...emptyRelationshipProgressState(), journeyEpisodes: { 'feastle:day-1': { familyId: 'feastle', episodeId: 'day-1', completedAt: h.real.now, answers: {}, facts: {} } } };
  const state = () => journeyChapterState(chapter, { familyId: 'feastle', now: h.clock.now(), relationships, world: null, dayOneComplete: true, bond: emptyCompanionBondState(), content: emptyCompanionContentState() });
  assert.equal(state().next?.status, 'locked');
  const event = { ...createLocalEventPilot().liveEvents![0], enabled: true, endsAt: new Date(h.real.now + HOUR).toISOString(), claimEndsAt: new Date(h.real.now + 24 * HOUR).toISOString() };
  const before = eventPhase(event, h.clock.now());
  h.dev.advanceDevGameTime(4 * HOUR);
  assert.equal(state().next?.status, 'available');
  assert.notEqual(eventPhase(event, h.clock.now()), before);
});

test('both progress and onboarding profile resets clear the persisted clock', async () => {
  for (const [file, reset] of [['utils/reset-katchimera-progress-for-debug.ts', 'resetKatchimeraProgressForDebug'], ['utils/onboarding-state.ts', 'resetOnboardingProfile']]) {
    const h = harness(); h.dev.advanceDevGameTime(HOUR);
    // Stub independent storage services; execute the actual reset coordinator.
    const mocks: Record<string, unknown> = {};
    for (const match of readFileSync(file, 'utf8').matchAll(/from ['"]([^'"]+)['"]/g)) mocks[match[1]] = new Proxy({}, { get: () => new Proxy(() => {}, { get: () => () => {} }) });
    mocks['@/utils/dev-game-clock'] = h.dev;
    const module = loadNativeModule(file, mocks);
    await module[reset]();
    assert.equal(h.clock.offset(), 0);
    assert.equal(h.saved.size, 0);
  }
});

test('clear all storage resets the running clock without a reload', () => {
  const h = harness(); h.dev.advanceDevGameTime(HOUR);
  const storage = loadNativeModule('utils/app-storage.ts', {
    '@/utils/game-clock': { gameClock: h.clock },
    'expo-sqlite/localStorage/install': {}, 'expo-sqlite/kv-store': {},
  }, { localStorage: { clear: () => h.saved.clear() } });
  storage.clearAllStoredValues();
  assert.equal(h.clock.offset(), 0);
  assert.equal(h.saved.size, 0);
});

test('story creation and completion use the injected clock, including effects', async () => {
  const h = harness(); h.dev.advanceDevGameTime(4 * HOUR);
  const runs = new Map<string, ContentFlowRun>();
  const effects = createContentFlowEffects();
  effects.registerContentFlowEffect('test', async () => ({}));
  const director = createContentFlowDirector({ catalog: createContentFlowCatalog(), effects, createClientId: () => 'test', now: h.clock.now, repository: {
    listContentFlowRuns: async () => [...runs.values()],
    loadContentFlowRun: async id => runs.get(id) ?? null,
    saveContentFlowTransition: async run => { runs.set(run.runId, run); },
    reduceContentFlowRunAtomically: async ({ runId, reduce }) => { const current = runs.get(runId); const run = current ? reduce(current) : null; if (run) runs.set(runId, run); return { run, eventRecorded: false }; },
  } });
  const run = await director.startContentFlow({ id: 'clock-test', version: 1, entryNodeId: 'grant', nodes: [
    { id: 'grant', kind: 'effect', capability: 'test', effectType: 'test', effectId: 'grant', next: 'done' },
    { id: 'done', kind: 'complete' },
  ] });
  assert.equal(run.createdAt, h.clock.now());
  assert.equal(run.completedAt, h.clock.now());
});
