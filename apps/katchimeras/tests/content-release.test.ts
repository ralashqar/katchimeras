import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeContentRelease } from '@/features/content-packs/normalize-release';
import { normalizeContentPack } from '@/features/content-packs/normalize-content-pack';
import { canonicalContent, installContentRecord, retireContentRecords, validateReleaseComposition } from '@/features/content-packs/release';
import type { ActiveContentPack, ContentPack, ContentRegistrySnapshot } from '@/types/content-pack';
import type { LiveEventDefinition } from '@/types/live-ops';

const fixture = JSON.parse(readFileSync('data/content-packs/event-column-shot.json', 'utf8')) as ContentPack;
const empty: ContentRegistrySnapshot = { version: 2, revision: 0, packs: [] };

test('event rewards resolve against the candidate catalogue and each pack declares its required schema', () => {
  const event: LiveEventDefinition = { id: 'moonlit', version: 1, title: 'Moonlit', description: 'Silver mist', enabled: false,
    startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-08T00:00:00Z', claimEndsAt: '2026-10-10T00:00:00Z', minHarmony: 0,
    rules: [{ id: 'orders', kind: 'order_completed', points: 20, limit: 30 }],
    tiers: [{ id: 'one', points: 100, free: { id: 'gift', items: [{ kind: 'wisp', id: 'not-a-wisp' }] } }] };
  const pack: ContentPack = { id: 'moonlit', version: 1, contentSchemaVersion: 2, liveEvents: [event] };
  assert.ok(normalizeContentRelease([pack]).issues.some((issue) => issue.includes('not available')));
  const valid = { ...pack, liveEvents: [{ ...event, tiers: [] }] };
  assert.deepEqual(normalizeContentRelease([valid]).issues, []);
  assert.ok(normalizeContentRelease([{ ...valid, contentSchemaVersion: 1 }, { id: 'other', version: 1, contentSchemaVersion: 2 }]).issues.some((issue) => issue.includes('schema 2')));
});

test('a new chain mission validates before its pack has ever been primed', () => {
  const result = normalizeContentPack(fixture);
  assert.deepEqual(result.issues, []);
  assert.equal(result.pack?.id, fixture.id);
});

test('dependent packs validate together, without registering candidate content', () => {
  const { missions, ...base } = fixture;
  const missionPack: ContentPack = { id: 'harvest-missions', version: 1, contentSchemaVersion: 1, dependencies: [{ id: base.id, version: base.version }], missions };
  assert.ok(normalizeContentRelease([missionPack]).issues.length);
  assert.deepEqual(normalizeContentRelease([base, missionPack]).issues, []);
  assert.ok(validateReleaseComposition([base, { ...missionPack, dependencies: [{ id: base.id, version: 99 }] }]).some((issue) => issue.includes('requires')));
});

test('release collisions and dependency cycles fail as a whole', () => {
  assert.ok(normalizeContentRelease([fixture, { ...fixture, id: 'duplicate' }]).issues.some((issue) => issue.includes('owned by both')));
  const a: ContentPack = { id: 'a', version: 1, contentSchemaVersion: 1, dependencies: [{ id: 'b', version: 1 }] };
  const b: ContentPack = { id: 'b', version: 1, contentSchemaVersion: 1, dependencies: [{ id: 'a', version: 1 }] };
  assert.ok(validateReleaseComposition([a, b]).some((issue) => issue.includes('cyclic')));
  assert.ok(normalizeContentRelease([{ ...fixture, missions: [null] }]).issues.length);
});

test('retirement preserves definitions, assets and permanent ownership references', () => {
  const record: ActiveContentPack = { pack: fixture, source: 'remote', activatedAt: 10, artUris: { 'tile:harvest-grove:full': 'file:///owned.webp' } };
  const installed = installContentRecord(empty, record);
  const retired = retireContentRecords(installed, new Set(), 20);
  assert.equal(retired.packs[0]?.retiredAt, 20);
  assert.equal(retired.packs[0]?.pack, fixture);
  assert.equal(retired.packs[0]?.artUris, record.artUris);
  assert.equal(retireContentRecords(retired, new Set(), 30), retired);
  assert.equal(retireContentRecords(retired, new Set([fixture.id]), 30).packs[0]?.retiredAt, undefined);
  assert.throws(() => installContentRecord(installed, { ...record, pack: { ...fixture, version: 2 } }), /save migration/);
});

test('immutable comparison ignores JSON object key order, not array order', () => {
  assert.equal(canonicalContent({ a: 1, b: 2 }), canonicalContent({ b: 2, a: 1 }));
  assert.notEqual(canonicalContent([1, 2]), canonicalContent([2, 1]));
});
