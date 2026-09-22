import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialMergeWorldState, normalizeMergeWorldState } from '@/utils/merge-world/engine';
import { reduceAdventure } from '@/features/shared-adventure/runtime';
import { HEARTWOOD_STORY, heartwoodRoad, needsHeartwoodRecap } from '@/features/shared-adventure/heartwood-opening';
import { SHARED_ADVENTURE_ENABLED, FIRST_ANSWER } from '@/features/shared-adventure/catalog';
import { ADVENTURE_FLOWS } from '@/features/shared-adventure/definitions';
import { MOSSPROUT_FTUE_COPY, MOSSPROUT_GREETING_OPTIONS } from '@/features/onboarding/mossprout-ftue-copy';
import { mossproutFtueConversationDefinitions, resolveMossproutFtueConversation } from '@/constants/mossprout-ftue-conversations';

const NOW = Date.parse('2026-09-18T12:00:00Z');
test('Heartwood is available without a development global; every greeting establishes the destination and first action', () => {
  assert.equal(SHARED_ADVENTURE_ENABLED, true);
  assert.equal('introduction' in HEARTWOOD_STORY, false, 'the first session shows Heartwood in the world, never on a sheet');
  for (const option of MOSSPROUT_GREETING_OPTIONS) {
    assert.match(option.reply, /Heartwood|Garden/, 'every answer lands on the destination or the first action');
  }
  for (const definition of mossproutFtueConversationDefinitions.filter(d => d.id.includes('first-meeting'))) {
    const resolved = resolveMossproutFtueConversation(definition, 'calm', definition.version, 'A day with some rain.');
    const hello = resolved.nodes.find(n => n.id === 'hello');
    assert.ok(hello?.kind === 'choice');
    assert.match(hello.prompt, /Heartwood/);
    assert.equal(resolved.nodes.some(n => n.id === 'followup'), false, 'one question, then the Seed');
    assert.equal(hello.options.length, 3);
  }
  assert.match(MOSSPROUT_FTUE_COPY.farewell, /needn’t wait/);
});

test('early presentation receipts persist and retry without awarding or unlocking the later chapter', () => {
  let world = createInitialMergeWorldState(NOW);
  const coins = world.coins;
  assert.equal(needsHeartwoodRecap(world), true);
  assert.equal(heartwoodRoad(world).objective, 'Wake the Garden');
  for (const scene of ['introduction', 'signal'] as const) {
    world = reduceAdventure(world, { type: 'presented', scene }, NOW + 1).state;
    world = normalizeMergeWorldState(JSON.parse(JSON.stringify(world)), NOW + 2);
    assert.equal(reduceAdventure(world, { type: 'presented', scene }, NOW + 3).changed, false);
  }
  assert.equal(needsHeartwoodRecap(world), false);
  assert.equal(world.coins, coins);
  assert.equal(world.kingdomGoal?.introducedAt, undefined);
  assert.deepEqual(world.sharedAdventure?.acknowledged, {});
  // Watching a scene does not fabricate a completed restoration.
  assert.equal(heartwoodRoad(world).chapters[0].complete, false);
  world.haven.tileStages.mossprout = 1;
  assert.equal(heartwoodRoad(world).objective, 'Wake the Garden');
  world.haven.plantableMemories.push({ id: 'first', definitionId: 'momentum', status: 'planted', slotId: 'front-centre', growthPoints: 1, source: { kind: 'ftue', sourceId: 'opening' }, earnedAt: NOW, plantedAt: NOW });
  assert.equal(heartwoodRoad(world).objective, 'Find Steppling at the broken trail');
  world.kingdomGoal = { introducedAt: NOW, coachmarkSeenAt: null };
  assert.equal(heartwoodRoad(world).objective, 'Our first signal');
});

test('progressed saves get one recap without replaying rewards or resetting a completed adventure', () => {
  let world = createInitialMergeWorldState(NOW);
  world.kingdomGoal = { introducedAt: NOW, coachmarkSeenAt: null };
  world = reduceAdventure(world, { type: 'presented', scene: 'recap' }, NOW).state;
  world.sharedAdventure!.completedAt = NOW;
  const before = structuredClone(world);
  assert.equal(needsHeartwoodRecap(world), false);
  assert.equal(heartwoodRoad(world).signal, true);
  assert.deepEqual(reduceAdventure(world, { type: 'presented', scene: 'recap' }, NOW + 1).state, before);
});

test('every old shared scene has a semantic migration; only the finale receives an answer', () => {
  for (const [index, flow] of ADVENTURE_FLOWS.entries()) {
    FIRST_ANSWER.beats[index].lines.forEach((_, line) => {
      const target = flow.migrations?.[`line:${line}`];
      assert.ok(flow.nodes.some(n => n.id === target));
    });
  }
  assert.equal(ADVENTURE_FLOWS.at(-1)?.migrations?.['line:2'], 'receive-answer');
  assert.equal('signal' in HEARTWOOD_STORY, false, 'the bud is a caption, never a sheet');
  assert.match(FIRST_ANSWER.beats.at(-1)!.lines[2], /Three flashes back/);
});
