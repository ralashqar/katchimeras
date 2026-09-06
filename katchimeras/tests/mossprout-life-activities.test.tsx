import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { loadCompanionOverlay, loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';
import { emptyCompanionBondState, recordCompanionBondEvent, acknowledgeCompanionBondCelebration, COMPANION_BOND_REWARDS } from '../utils/companion-bond';
import { buildPhotoIntelligence } from '../utils/intelligence/photo-intelligence';
import { MOSSPROUT_NOTICE_PROMPTS, mossproutNoticePrompt, naturePhotoMatch, mossproutLifeActivityId } from '../utils/mossprout-life-activities';
import type { MossproutNaturePhoto, MossproutLifeCompletion } from '../utils/mossprout-life-activity-storage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const now = new Date(2026, 8, 5, 23, 59).getTime();
const dayId = '2026-09-05';
function naturePhoto(match: MossproutNaturePhoto['match'] = 'ready'): MossproutNaturePhoto {
  const data = buildPhotoIntelligence({ sourceId: 'file:///nature.jpg', observedAt: new Date(now).toISOString(), thumbnailUri: 'file:///nature.jpg', rawVision: null, vision: null });
  return { uri: 'file:///nature.jpg', capturedAt: now, memory: data.memory, evidence: data.evidence, vision: null, match };
}
function storageHarness(memoryGate?: Promise<void>) {
  // Match the calendar-day hook below; wall-clock saves otherwise land on a
  // different day and make completed activities appear unfinished in this test.
  class ActivityDate extends Date { static now() { return now; } }
  const disk = new Map<string, unknown>();
  let bond = emptyCompanionBondState();
  let failActivityWrite = false;
  let failMemory = false;
  let failAfterAward = false;
  const memories = new Map<string, unknown>();
  const journal = new Map<string, unknown>();
  const module = loadNativeModule('utils/mossprout-life-activity-storage.ts', {
    '@/utils/app-storage': { getStoredJson: (key: string, fallback: unknown) => structuredClone(disk.get(key) ?? fallback), setStoredJson: (key: string, value: unknown) => {
      if (failActivityWrite) throw new Error('disk'); disk.set(key, structuredClone(value));
    } },
    '@/constants/katchimera-skins': { companionIdForFamily: () => 'mossprout' },
    '@/utils/companion-bond': { COMPANION_BOND_REWARDS, recordCompanionBondEvent, acknowledgeCompanionBondCelebration },
    '@/utils/companion-bond-storage': { loadCompanionBondState: () => bond, saveCompanionBondState: (state: typeof bond) => { bond = state; if (failAfterAward) failActivityWrite = true; } },
    '@/utils/companion-life-storage': { rememberCompanionMoment: (entry: { id: string }) => journal.set(entry.id, entry) },
    '@/utils/world-identity-rules': { localDayId: (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` },
    './mossprout-life-activities': { MOSSPROUT_LIFE_TITLES: { photo: 'Photo', notice: 'Notice' }, mossproutLifeActivityId },
    './mossprout-photo-memory': { saveMossproutPhotoMemory: async (entry: MossproutLifeCompletion) => { if (memoryGate) await memoryGate; if (failMemory) throw new Error('memory'); memories.set(entry.id, entry.photo); } },
    './mossprout-nature-capture': { discardMossproutNaturePhoto() {} },
  }, { Date: ActivityDate });
  return { module, memories, journal, bond: () => bond,
    failMemory: (value: boolean) => { failMemory = value; },
    failAfterAward: () => { failAfterAward = true; },
    recover: () => { failAfterAward = false; failActivityWrite = false; },
  };
}

test('nature matching uses confidence and physical subjects, with manual fallback when Vision is missing', () => {
  const { memory } = naturePhoto();
  const quality = { qualityId: 'nature.plants', score: 0.9, centrality: 'primary' as const, status: 'inferred' as const, sources: [], reasons: [] };
  assert.equal(naturePhotoMatch({ ...memory, qualities: [quality] }, true), 'ready');
  assert.equal(naturePhotoMatch({ ...memory, qualities: [{ ...quality, score: 0.4 }] }, true), 'possible');
  assert.equal(naturePhotoMatch({ ...memory, qualities: [{ ...quality, score: 0.1 }] }, true), 'no_match');
  assert.equal(naturePhotoMatch(memory, false), 'unavailable');
  assert.equal(naturePhotoMatch({ ...memory, qualities: [{ ...quality, qualityId: 'nature.water' }] }, true), 'no_match');
  const screen = { ...memory, qualities: [quality], photoAnalysis: { representation: { kind: 'screenshot' } } } as unknown as typeof memory;
  assert.equal(naturePhotoMatch(screen, true), 'no_match');
  const detected = buildPhotoIntelligence({ sourceId: 'plant', observedAt: new Date(now).toISOString(), rawVision: {
    labels: [{ name: 'houseplant', confidence: 0.99 }], text: [], faceCount: 0,
  }, vision: null });
  assert.ok(detected.memory.qualities.some((item) => item.qualityId === 'nature.plants'));
});

test('noticing rotates consistently each calendar day and every choice has a response', () => {
  assert.equal(mossproutNoticePrompt(dayId), mossproutNoticePrompt(dayId));
  assert.notEqual(mossproutNoticePrompt(dayId), mossproutNoticePrompt('2026-09-06'));
  assert.equal(MOSSPROUT_NOTICE_PROMPTS.length, 3);
  assert.ok(MOSSPROUT_NOTICE_PROMPTS.every((prompt) => prompt.choices.length === 3 && prompt.choices.every((choice) => choice.reply.length > 20)));
});

test('activities award independently, retry partial writes once, and keep photos on their capture date', async () => {
  const h = storageHarness(); const m = h.module;
  const photo = naturePhoto();
  const pending = m.prepareMossproutLifeCompletion({ kind: 'photo', answer: 'Its colour', response: 'A little colour.', photo }, now + 120000);
  assert.equal(pending.dayId, dayId, 'midnight capture keeps its original day');
  h.failMemory(true);
  await assert.rejects(m.commitMossproutLifeCompletion(pending.id));
  assert.equal(h.bond().events.length, 0);
  h.failMemory(false); h.failAfterAward();
  await assert.rejects(m.commitMossproutLifeCompletion(pending.id));
  assert.equal(h.bond().events.length, 1);
  h.recover();
  const done = await m.commitMossproutLifeCompletion(pending.id);
  assert.equal(done.status, 'complete');
  assert.ok(done.receipt, 'crash after Bond write recovers the existing flight receipt');
  assert.equal(h.memories.size, 1);
  assert.equal(h.journal.size, 1);
  await m.commitMossproutLifeCompletion(pending.id);
  assert.equal(h.bond().events.length, 1);
  const notice = m.prepareMossproutLifeCompletion({ kind: 'notice', answer: 'Wind', response: 'Leaves rustle.' }, now);
  await m.commitMossproutLifeCompletion(notice.id);
  assert.equal(h.bond().events.length, 2);
  assert.equal(h.bond().events.reduce((total, event) => total + event.points, 0), 10);
  m.acknowledgeMossproutLifeCompletion(pending.id, now + 2000);
  assert.ok(m.loadMossproutLifeActivities().completions[pending.id].presentedAt);
  assert.ok(!h.bond().pendingCelebrations?.some((receipt) => receipt.eventId === pending.id));
  assert.equal(m.prepareMossproutLifeCompletion({ kind: 'photo', answer: 'Again', response: 'Again', photo }, now).id, pending.id);
  assert.equal(m.loadMossproutLifeActivities().completions[mossproutLifeActivityId('2026-09-06', 'photo')], undefined);
});

test('camera cancellation and stale camera returns never complete an activity', () => {
  const { module: m } = storageHarness();
  const first = m.beginMossproutNatureCapture(now);
  const second = m.beginMossproutNatureCapture(now + 1);
  m.finishMossproutNatureCapture(first.id, naturePhoto());
  assert.equal(m.loadMossproutLifeActivities().capture.id, second.id);
  m.cancelMossproutNatureCapture(second.id);
  m.finishMossproutNatureCapture(second.id, naturePhoto());
  assert.equal(m.loadMossproutLifeActivities().capture, null);
  assert.equal(Object.keys(m.loadMossproutLifeActivities().completions).length, 0);
});

test('native menu keeps the main card mounted, completes an option, and handles uncertain photos through dialogue', async () => {
  const h = storageHarness();
  const overlay = loadCompanionOverlay();
  const Host = overlay.CompanionSceneOverlayHost as React.ComponentType<{ children: React.ReactNode }>;
  let narration: string | null = null;
  let opened = false;
  const routes: unknown[] = [];
  const setNarration = (value: string | null) => { narration = value; };
  const setOpen = (value: boolean) => { opened = value; };
  const module = loadNativeModule('components/katchadeck/world/mossprout-life-activity-card.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable', ScrollView: 'ScrollView' },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' } },
    'expo-image': { Image: 'Image' }, 'expo-router': { usePathname: () => '/katchimeras', useRouter: () => ({ push: (route: unknown) => routes.push(route) }) },
    '@react-navigation/native': { useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]) },
    '@/components/katchadeck/ui/day-action-row': { DayActionActiveRow: 'Active', DayActionCompletedRow: 'Completed' },
    '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: 'Card', DayActionRewardChip: 'Reward' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/constants/katchimera-action-art': { katchimeraActionArt: () => 1 },
    '@/utils/companion-bond': { COMPANION_BOND_REWARDS },
    '@/hooks/use-companion-calendar-day': { useCompanionCalendarDay: () => dayId },
    '@/utils/mossprout-life-activities': await import('../utils/mossprout-life-activities'),
    '@/utils/mossprout-life-activity-storage': h.module,
    './companion-scene-overlay': overlay, './companion-choice-list': { CompanionChoiceList: 'Choices' },
    './mossprout-water-action': { MossproutWaterAction: 'Water' },
    './mossprout-notice-choices': loadNativeModule('components/katchadeck/world/mossprout-notice-choices.tsx', {
      'react-native': { ...nativeViews, ScrollView: 'ScrollView' },
      './companion-narrative-panel': { CompanionNarrativePanel: 'NarrativePanel' },
      './companion-choice-list': { CompanionChoiceList: 'Choices' },
    }),
  });
  const Card = module.MossproutLifeActivityCard as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Host><Card onOpenChange={setOpen} onNarration={setNarration} /></Host>); });
  const main = tree!.root.findByProps({ title: 'Grow with Mossprout' });
  const press = async (title: string) => act(async () => tree!.root.findByProps({ title }).parent!.props.onPress());
  const choose = async (id: string) => act(async () => tree!.root.findByType('Choices' as React.ElementType).props.onSelect(id));
  for (let index = 0; index < 3; index++) {
    await press('Grow with Mossprout');
    assert.equal(opened, true);
    assert.equal(tree!.root.findAllByType('Water' as React.ElementType).length, 1);
    assert.equal(tree!.root.findByType('Water' as React.ElementType).props.enteringEnabled, false);
    await act(async () => tree!.root.findByProps({ label: 'Back' }).props.onPress());
    assert.equal(opened, false);
    assert.equal(tree!.root.findByProps({ title: 'Grow with Mossprout' }), main);
  }
  await press('Grow with Mossprout');
  await press('Notice one small thing');
  assert.ok(narration);
  const options = tree!.root.findByType('Choices' as React.ElementType).props.options;
  assert.equal(tree!.root.findByType('NarrativePanel' as React.ElementType).props.accessibilityLabel, 'Noticing conversation');
  assert.equal(tree!.root.findByType('Choices' as React.ElementType).props.presentation, undefined, 'uses the shared responsive narrative choices');
  await choose(options[0].id);
  assert.equal(tree!.root.findAllByType('Choices' as React.ElementType).length, 0, 'no final confirmation');
  assert.equal(narration, mossproutNoticePrompt(dayId).choices[0].reply);
  assert.equal(opened, true, 'completion stays in the activity menu');
  const completed = tree!.root.findByType('Completed' as React.ElementType);
  await act(async () => completed.props.onFinished());
  assert.equal(tree!.root.findAllByProps({ title: 'Notice one small thing' }).length, 0);
  await press('Show Mossprout something growing');
  assert.equal(routes.length, 1);
  const session = h.module.loadMossproutLifeActivities().capture;
  await act(async () => h.module.finishMossproutNatureCapture(session.id, naturePhoto('possible')));
  assert.match(narration!, /What did you find/);
  await choose('plant'); await choose('colour'); await choose('done');
  assert.equal(h.memories.size, 1);
  assert.equal(h.bond().events.length, 2);
  await act(async () => tree!.root.findByType('Completed' as React.ElementType).props.onFinished());
  assert.equal(tree!.root.findAllByProps({ title: 'Show Mossprout something growing' }).length, 0);
  await act(async () => h.module.resetMossproutLifeActivities());
  assert.equal(tree!.root.findAllByProps({ title: 'Notice one small thing' }).length, 1, 'reset restores noticing in an already open menu');
  assert.equal(tree!.root.findAllByProps({ title: 'Show Mossprout something growing' }).length, 1);
  assert.equal(tree!.root.findAllByType('Completed' as React.ElementType).length, 0);
  assert.equal(narration, null);
  await press('Notice one small thing');
  assert.equal(narration, mossproutNoticePrompt(dayId).prompt);
  assert.equal(tree!.root.findAllByType('Water' as React.ElementType).length, 1);
  await act(async () => tree!.unmount());
});

test('camera integration bypasses Essence Review and generic quest rewards for companion activity captures', () => {
  const source = readFileSync('app/moment-capture.tsx', 'utf8');
  assert.match(source, /companionActivityId[\s\S]*?prepareMossproutNaturePhoto[\s\S]*?finishMossproutNatureCapture/);
  assert.match(source, /companionActivityId\s*\|\| state !== 'captured'/);
  assert.match(source, /capturedAtRef.current = Date.now\(\)/);
});


test('closing an inactive Garden overlay cannot remove the activity destination', async () => {
  const overlay = loadCompanionOverlay();
  const Host = overlay.CompanionSceneOverlayHost as React.ComponentType<{ children: React.ReactNode }>;
  const Overlay = overlay.CompanionSceneOverlay as React.ComponentType<{ visible: boolean; children: React.ReactNode }>;
  const Marker = 'Marker' as React.ElementType;
  function Scene({ garden = false, life = true, version = 0 }) {
    return <Host><Host>
      <Overlay visible={life}><Marker name="life" version={version} /></Overlay>
      <Overlay visible={garden}><Marker name="garden" version={version} /></Overlay>
    </Host></Host>;
  }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Scene />); });
  assert.equal(tree!.root.findByType(Marker).props.name, 'life');
  await act(async () => tree!.update(<Scene version={1} />));
  assert.equal(tree!.root.findByType(Marker).props.name, 'life');
  await act(async () => tree!.update(<Scene life={false} garden />));
  assert.equal(tree!.root.findByType(Marker).props.name, 'garden');
  await act(async () => tree!.update(<Scene life garden={false} />));
  assert.equal(tree!.root.findByType(Marker).props.name, 'life');
  await act(async () => tree!.unmount());
});

test('nature captures copy out of camera cache once and discard only owned files', () => {
  const files = new Set(['file:///cache/camera.jpg', 'file:///documents/unrelated.jpg']);
  let copies = 0;
  class Directory {
    uri: string;
    constructor(parent: string, name: string) { this.uri = `${parent}/${name}`; }
    create() {}
  }
  class File {
    uri: string;
    constructor(parent: string | Directory, name?: string) { this.uri = typeof parent === 'string' ? parent : `${parent.uri}/${name}`; }
    get exists() { return files.has(this.uri); }
    copy(target: File) { assert.ok(this.exists); copies++; files.add(target.uri); }
    delete() { files.delete(this.uri); }
  }
  const capture = loadNativeModule('utils/mossprout-nature-capture.ts', {
    'expo-file-system': { Directory, File, Paths: { document: 'file:///documents' } },
    '@/utils/intelligence/photo-intelligence': { buildPhotoIntelligence },
    './mossprout-life-activities': { naturePhotoMatch },
  });
  const photo = capture.prepareMossproutNaturePhoto('capture:one', 'file:///cache/camera.jpg', now, { rawVision: null, summary: null });
  assert.equal(photo.uri, 'file:///documents/mossprout-memories/capture-one.jpg');
  assert.equal(photo.memory.sourceId, photo.uri);
  assert.equal(photo.memory.createdAt, new Date(now).toISOString());
  capture.prepareMossproutNaturePhoto('capture:one', 'file:///cache/camera.jpg', now, { rawVision: null, summary: null });
  assert.equal(copies, 1);
  capture.discardMossproutNaturePhoto('file:///documents/unrelated.jpg');
  assert.ok(files.has('file:///documents/unrelated.jpg'));
  capture.discardMossproutNaturePhoto(photo.uri);
  assert.equal(files.has(photo.uri), false);
});


test('photo memory writes preserve capture date, propagate failures and remain idempotent', async () => {
  const { withCapturedMoment } = await import('../game/days/mutations/capture');
  const todayId = '2026-09-06';
  const photo = naturePhoto();
  // Exercise an archived capture independently of today's date.
  let archived = { id: `day-${dayId}`, isoDate: dayId, state: 'hatched', moments: [], locations: [],
    promptAnswers: [], classifiedMemories: [], capturedMeanings: [], evidence: [], capturedEnergy: { calm: 0.3 },
  } as unknown as import('../types/home').StoredHomeDayRecord;
  const completion: MossproutLifeCompletion = { id: `test:${dayId}`, kind: 'photo', dayId,
    occurredAt: photo.capturedAt, answer: 'Its shape', response: 'A new leaf.', photo, status: 'pending' };
  let failSave = true;
  const home = () => ({ today: { id: 'today', isoDate: todayId }, tomorrow: null, archivedDays: [archived] });
  const writer = loadNativeModule('utils/mossprout-photo-memory.ts', {
    '@/storage/repositories/home-repository': { homeRepository: { load: home, save: (next: ReturnType<typeof home>) => { if (failSave) throw new Error('disk'); archived = next.archivedDays[0]; } } },
    '@/game/days': { hydrateHomeState: (state: ReturnType<typeof home>) => ({ state }) },
    '@/game/days/actions': { applyCapturedMomentForDay: (state: ReturnType<typeof home>, capture: Parameters<typeof withCapturedMoment>[1], target: string, _profile: unknown, _now: Date, observedAt: string) => {
      assert.equal(target, archived.id);
      assert.equal(capture.captureMode, 'evidence_only');
      assert.equal(capture.sourceId, photo.uri);
      return { ...state, archivedDays: [withCapturedMoment(archived, capture, { food: { detected: false }, studio: { detected: false } }, new Date(observedAt), { allowHatched: true, journalOnly: true })] };
    } },
    '@/utils/onboarding-state': { loadOnboardingProfile: () => ({}) },
  });
  await assert.rejects(writer.saveMossproutPhotoMemory(completion));
  failSave = false;
  await writer.saveMossproutPhotoMemory(completion);
  await writer.saveMossproutPhotoMemory(completion);
  assert.equal(archived.classifiedMemories?.filter((item) => item.id === photo.memory.id).length, 1);
  assert.equal(archived.capturedMeanings?.filter((item) => item.sourceId === photo.uri).length, 1);
  assert.equal(archived.capturedMeanings?.find((item) => item.sourceId === photo.uri)?.createdAt, new Date(photo.capturedAt).toISOString());
  assert.deepEqual(archived.capturedEnergy, { calm: 0.3 });
});


test('profile reset clears noticing, pending captures and notifies mounted menus', async () => {
  const { module: m } = storageHarness();
  const entry = m.prepareMossproutLifeCompletion({ kind: 'notice', answer: 'Wind', response: 'Leaves rustle.' }, now);
  await m.commitMossproutLifeCompletion(entry.id);
  m.acknowledgeMossproutLifeCompletion(entry.id, now + 1);
  const capture = m.beginMossproutNatureCapture(now);
  let resetNotifications = 0;
  const unsubscribe = m.subscribeMossproutLifeActivities((reset?: boolean) => { if (reset) resetNotifications++; });
  const source = readFileSync('utils/reset-katchimera-progress-for-debug.ts', 'utf8');
  const mocks: Record<string, unknown> = {};
  for (const match of source.matchAll(/import \{ ([^}]+) \} from '([^']+)'/g)) {
    mocks[match[2]] = Object.fromEntries(match[1].split(',').map((name) => [name.trim(), () => {}]));
  }
  mocks['@/storage/repositories/relationship-progression-repository'] = { relationshipProgressionRepository: { resetForDebug() {} } };
  mocks['@/utils/mossprout-life-activity-storage'] = m;
  const reset = loadNativeModule('utils/reset-katchimera-progress-for-debug.ts', mocks);
  await reset.resetKatchimeraProgressForDebug();
  assert.equal(resetNotifications, 1);
  assert.equal(Object.keys(m.loadMossproutLifeActivities().completions).length, 0);
  assert.equal(m.loadMossproutLifeActivities().capture, null);
  m.finishMossproutNatureCapture(capture.id, naturePhoto());
  assert.equal(m.loadMossproutLifeActivities().capture, null, 'old camera result cannot restore reset data');
  assert.equal(m.prepareMossproutLifeCompletion({ kind: 'notice', answer: 'Wind', response: 'Leaves rustle.' }, now).status, 'pending');
  unsubscribe();
});

test('profile snapshots include activity progress and a fresh profile clears previous completions', () => {
  const key = 'companion:mossprout-life-activities:v1';
  const disk = new Map([[key, JSON.stringify({ version: 1, completions: { notice: { status: 'complete' } }, capture: null })], ['device.setting', 'true']]);
  const registry = loadNativeModule('utils/player-profile-domain-registry.ts', {
    '@/utils/app-storage': {
      getStoredKeys: () => [...disk.keys()], getStoredRaw: (name: string) => disk.get(name),
      removeStoredValue: (name: string) => disk.delete(name), setStoredRaw: (name: string, value: string) => disk.set(name, value),
    },
  });
  const snapshot = registry.captureKeyValueProfileDomain();
  assert.equal(snapshot[key], disk.get(key));
  assert.equal(registry.validateKeyValueProfileDomain(snapshot).length, 0);
  registry.replaceKeyValueProfileDomain({});
  assert.equal(disk.has(key), false);
  assert.equal(disk.get('device.setting'), 'true');
  registry.replaceKeyValueProfileDomain(snapshot);
  assert.equal(disk.get(key), snapshot[key]);
});


test('reset prevents an in-flight activity from restoring completion or rewards', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const h = storageHarness(gate);
  const pending = h.module.prepareMossproutLifeCompletion({ kind: 'photo', answer: 'Colour', response: 'Green.', photo: naturePhoto() }, now);
  const oldCommit = h.module.commitMossproutLifeCompletion(pending.id);
  h.module.resetMossproutLifeActivities();
  release();
  await assert.rejects(oldCommit, /Activity was reset/);
  assert.equal(Object.keys(h.module.loadMossproutLifeActivities().completions).length, 0);
  assert.equal(h.bond().events.length, 0);
  assert.equal(h.journal.size, 0);
});


test('first Grow shares the daily noticing receipt, survives interruption, and resets with the activity journal', async () => {
  const h = storageHarness();
  const copy = await import('../features/onboarding/mossprout-first-grow');
  let savedDay: string | undefined;
  const runtime = loadNativeModule('features/onboarding/mossprout-first-grow-runtime.ts', {
    '@/utils/onboarding-state': { loadOnboardingProfile: () => ({ mossproutAnswers: { firstNoticeDayId: savedDay } }) },
    '@/utils/world-identity-rules': { localDayId: () => dayId },
    '@/utils/mossprout-life-activity-storage': h.module,
    '@/utils/mossprout-life-activities': { mossproutLifeActivityId },
    './mossprout-profile': { recordMossproutOnboardingAnswer: (_key: string, value: string) => { savedDay = value; } },
    './mossprout-first-grow': copy,
  });
  assert.equal(runtime.loadFirstNoticeCompletion(), undefined);
  assert.equal(savedDay, dayId);
  h.failAfterAward();
  await assert.rejects(runtime.completeFirstNotice('light'));
  h.recover();
  const done = await runtime.completeFirstNotice('light');
  assert.equal(done.dayId, dayId);
  assert.equal(h.bond().events.length, 1);
  assert.equal(h.journal.size, 1);
  assert.equal(runtime.loadFirstNoticeCompletion().id, done.id);
  assert.equal((await runtime.completeFirstNotice('sound')).id, done.id);
  assert.equal(h.bond().events.length, 1);
  h.module.acknowledgeMossproutLifeCompletion(done.id);
  assert.ok(runtime.loadFirstNoticeCompletion().presentedAt);
  h.module.resetMossproutLifeActivities(); savedDay = undefined;
  assert.equal(runtime.loadFirstNoticeCompletion(), undefined);
});

test('FTUE opens noticing choices with one action tap, keeps Back hidden, and supports skipping', async () => {
  const copy = await import('../features/onboarding/mossprout-first-grow');
  let run = { runId: 'first-grow', stepId: 'companion.water_together', answers: {} as Record<string, { optionId: string }> };
  const listeners = new Set<() => void>();
  const actions: string[] = [];
  let narration: string | null = null;
  const onNarration = (value: string | null) => { narration = value; };
  const module = loadNativeModule('components/katchadeck/world/mossprout-first-grow-stage.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable' }, 'expo-image': { Image: 'Image' },
    '@/components/katchadeck/ui/day-action-row': { DayActionActiveRow: 'Active', DayActionCompletedRow: 'Completed' },
    '@/components/katchadeck/ui/day-action-card': { DayActionCardSurface: 'Card', DayActionRewardChip: 'Reward' },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/constants/katchimera-action-art': { katchimeraActionArt: () => 1 },
    '@/utils/companion-bond': { COMPANION_BOND_REWARDS },
    '@/features/onboarding/mossprout-first-grow': copy,
    '@/features/onboarding/mossprout-first-grow-runtime': { loadFirstNoticeCompletion: () => undefined, completeFirstNotice: () => assert.fail('skip must not reward') },
    '@/utils/mossprout-life-activity-storage': {},
    '@/features/onboarding/ftue-runtime': {
      useFtueRun: () => React.useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => run),
      advanceFtueActionDurably: async ({ actionId, optionId }: { actionId: string; optionId: string }) => {
        actions.push(actionId);
        const stepId = actionId === 'companion.choose_garden_return' ? 'companion.first_grow' : actionId === 'companion.open_first_grow' ? 'companion.first_notice' : 'companion.first_rest';
        run = { ...run, stepId, answers: { ...run.answers, [actionId]: { optionId } } }; listeners.forEach((listener) => listener());
      },
    },
    './companion-narrative-panel': { CompanionNarrativePanel: 'NarrativePanel' },
    './companion-choice-list': { CompanionChoiceList: 'Choices' },
    './mossprout-notice-choices': { MossproutNoticeChoices: 'NoticeChoices' },
  });
  const Stage = module.MossproutFirstGrowStage as React.ComponentType<{ onNarration: typeof onNarration }>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Stage onNarration={onNarration} />); });
  assert.equal(narration, copy.MOSSPROUT_GARDEN_RETURN.prompt);
  await act(async () => tree!.root.findByType('Choices' as React.ElementType).props.onSelect('pleased'));
  assert.match(narration!, /trying to look mysterious/);
  const press = (title: string) => act(async () => tree!.root.findByProps({ title }).parent!.props.onPress());
  assert.equal(tree!.root.findAllByProps({ title: 'Grow with Mossprout' }).length, 0, 'read the reply before the invitation');
  const continueButton = tree!.root.findByProps({ label: 'Continue' });
  await act(async () => tree!.update(<Stage onNarration={onNarration} />));
  assert.equal(tree!.root.findByProps({ label: 'Continue' }), continueButton, 'rerenders retain the current control');
  await act(async () => tree!.root.findByProps({ label: 'Continue' }).props.onPress());
  assert.equal(tree!.root.findAllByProps({ title: 'Grow with Mossprout' }).length, 0, 'FTUE skips the Grow gateway');
  const noticeRow = tree!.root.findByType('Active' as React.ElementType);
  assert.equal(noticeRow.props.animateLayout, false, 'FTUE changes do not animate a list gap');
  assert.equal(noticeRow.props.enteringEnabled, false, 'the notice card starts at its final position');
  await press('Notice one small thing');
  assert.equal(tree!.root.findAllByType('Active' as React.ElementType).length, 0, 'choices replace the invitation instead of retaining a second layout');
  assert.equal(tree!.root.findAllByProps({ label: 'Back' }).length, 0);
  assert.equal(narration, copy.MOSSPROUT_FIRST_NOTICE.prompt);
  await act(async () => tree!.root.findByType('NoticeChoices' as React.ElementType).props.onSelect('later'));
  assert.equal(run.stepId, 'companion.first_rest');
  assert.deepEqual(actions, ['companion.choose_garden_return', 'companion.open_first_grow', 'companion.skip_first_notice']);
  assert.equal(tree!.root.findAllByType('Completed' as React.ElementType).length, 0);
  await act(async () => tree!.unmount());
  run = { ...run, stepId: 'companion.first_notice' };
  await act(async () => { tree = create(<Stage onNarration={onNarration} />); });
  assert.equal(tree!.root.findAllByProps({ title: 'Grow with Mossprout' }).length, 0);
  assert.equal(tree!.root.findAllByType('NoticeChoices' as React.ElementType).length, 1, 'resume opens the saved noticing conversation directly');
  assert.equal(narration, copy.MOSSPROUT_FIRST_NOTICE.prompt);
  await act(async () => tree!.unmount());
});


test('FTUE speech pages preserve the copy within the 120-character limit', async () => {
  const { ftueDialoguePages, FTUE_DIALOGUE_MAX_CHARACTERS } = await import('../features/onboarding/ftue-dialogue-pages');
  const { MOSSPROUT_FTUE_COPY } = await import('../features/onboarding/mossprout-ftue-copy');
  const pages = ftueDialoguePages(MOSSPROUT_FTUE_COPY.farewell);
  assert.equal(pages.length, 3);
  for (const text of [MOSSPROUT_FTUE_COPY.farewell, 'A longer sentence with several words. '.repeat(12), 'x'.repeat(250)]) {
    const split = ftueDialoguePages(text);
    assert.ok(split.every((page) => page.length <= FTUE_DIALOGUE_MAX_CHARACTERS));
    assert.equal(split.join('').replace(/\s/g, ''), text.replace(/\s/g, ''), 'no truncated words or omitted sentences');
  }
});

test('Rest follows two Continue beats; failed saves retry the final action without replaying dialogue', async () => {
  const copy = await import('../features/onboarding/mossprout-ftue-copy');
  const { ftueDialoguePages } = await import('../features/onboarding/ftue-dialogue-pages');
  const module = loadNativeModule('components/katchadeck/world/mossprout-ftue-rest-action.tsx', {
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: 'Button' },
    '@/features/onboarding/mossprout-ftue-copy': copy,
  });
  const Rest = module.MossproutFtueRestAction as React.ComponentType<{ onNarration: (text: string | null) => void; onRest: () => Promise<void> }>;
  let narration: string | null = null; let saves = 0; let fail = true;
  const onRest = async () => { saves++; if (fail) throw new Error('save failed'); };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Rest onNarration={(text) => { narration = text; }} onRest={onRest} />); });
  const pages = ftueDialoguePages(copy.MOSSPROUT_FTUE_COPY.farewell);
  assert.equal(narration, pages[0]);
  await act(async () => tree!.root.findByProps({ label: 'Continue' }).props.onPress());
  assert.equal(narration, pages[1]); assert.equal(saves, 0);
  await act(async () => tree!.root.findByProps({ label: 'Continue' }).props.onPress());
  assert.equal(narration, pages[2]); assert.equal(saves, 0);
  await act(async () => { const press = tree!.root.findByProps({ label: copy.MOSSPROUT_FTUE_COPY.restAction }).props.onPress; press(); press(); });
  assert.equal(saves, 1); assert.equal(narration, pages[2]);
  fail = false;
  await act(async () => tree!.root.findByProps({ label: 'Try again' }).props.onPress());
  assert.equal(saves, 2);
  await act(async () => tree!.unmount());
});

test('hiding header Back removes the button while preserving the currency header', async () => {
  const module = loadNativeModule('components/katchadeck/world/katchimera-page-header.tsx', {
    'react-native': nativeViews, 'react-native-reanimated': nativeMotionHarness().animated,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) },
    '@/components/katchadeck/ui/bond-icon-art': { BondIconArt: 'Bond' },
    '@/components/katchadeck/ui/reward-arrival-motion': {},
    '@/components/katchadeck/ui/game-currency-hud': { GameCurrencyHud: 'Currency' },
    '@/components/katchadeck/ui/katchimera-back-button': { KatchimeraBackButton: 'Back' },
    '@/components/themed-text': { ThemedText: 'Text' }, '@/constants/theme': { AppFontFamilies: {} },
    '@/constants/game-currency-art': { GAME_CURRENCY_ART: {} }, '@/constants/game-ui': { GameUI: { type: { title: {}, numeric: {} } } },
    '@/features/ui/game-wallet-provider': { useGameWallet: () => ({ coins: 20 }) },
    '@/utils/companion-bond': {}, '@/utils/companion-bond-storage': { loadCompanionBondState: () => ({}), subscribeCompanionBondState: () => () => {} },
  });
  const Header = module.KatchimeraPageHeader as React.ComponentType<{ hideBack?: boolean; navigationLocked: boolean; onBack: () => void }>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Header hideBack navigationLocked onBack={() => {}} />); });
  assert.equal(tree!.root.findAllByType('Back' as React.ElementType).length, 0);
  assert.equal(tree!.root.findAllByType('Currency' as React.ElementType).length, 1);
  await act(async () => tree!.update(<Header navigationLocked={false} onBack={() => {}} />));
  assert.equal(tree!.root.findAllByType('Back' as React.ElementType).length, 1, 'regular interactions retain Back');
  await act(async () => tree!.unmount());
});
