import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { WORLD_UPGRADE_DEFINITIONS, visibleWorldUpgradeOffers, worldUpgradeOffers } from '@/features/world-upgrades/world-upgrade-offers';
import { WORLD_UPGRADE_FLOWS, worldUpgradeRunId } from '@/features/world-upgrades/world-upgrade-flows';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { MOSSPROUT_FTUE_FLOW } from '@/features/onboarding/mossprout-ftue-flow';
import { createContentFlowRun, reduceContentFlow, stabilizeContentFlow } from '@/features/content-flow/content-flow-interpreter';
import { GLOW_DISCOVERY_FLOW, glowDiscoveryResumeCamera, glowDiscoveryResumeWorld } from '@/features/onboarding/glow-discovery-flow';
import { MOSSPROUT_NATURE_ISLANDS } from '@/constants/mossprout-nature-islands';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { readFileSync } from 'node:fs';
import { sharedResidentAnchor } from '@/components/katchadeck/world/shared-resident-presentation';
import type { KingdomHexScene } from '@/components/katchadeck/world/kingdom-hex-scene';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const NOW = Date.UTC(2026, 8, 5);
function world(coins = 2000) {
  const initial = createInitialMergeWorldState(NOW, ['mossprout']);
  return { ...initial, coins, characterProgress: { ...initial.characterProgress,
    mossprout: { friendshipLevel: 4, completedChapterIds: ['mossprout-chapter-0'] } } };
}
function restored(coins = 2000) {
  return reduceMergeWorld(world(coins), { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW }).state;
}

test('all nature island levels use the shared purchase flow, survive reload, and charge only once', () => {
  let state = restored(10_000);
  state = reduceMergeWorld(state, { type: 'reconcileHavenStory', characterId: 'mossprout', storyLevel: 4, now: NOW }).state;
  for (const island of MOSSPROUT_NATURE_ISLANDS) {
    for (const level of island.levels) {
      const offer = visibleWorldUpgradeOffers(worldUpgradeOffers(state), undefined, null)
        .find((candidate) => candidate.id === `nature:${island.id}`)!;
      assert.ok(offer, `${island.id} level ${level.level} has a marker`);
      assert.equal(offer.cost, level.coinCost);
      assert.equal(offer.nextLevel, level.level);
      assert.equal(offer.action, level.level === 1 ? 'Clear mist' : 'Upgrade');
      assert.ok(WORLD_UPGRADE_FLOWS.some((flow) => flow.id === worldUpgradeRunId(offer)));
      const command = { type: 'upgradeMossproutNatureIsland' as const, islandId: island.id,
        level: level.level, receiptId: worldUpgradeRunId(offer), now: NOW };
      const before = state.coins;
      const paid = reduceMergeWorld(state, command);
      assert.equal(paid.changed, true);
      assert.equal(paid.state.coins, before - level.coinCost);
      state = normalizeMergeWorldState(JSON.parse(JSON.stringify(paid.state)), NOW);
      assert.equal(state.haven.mossproutNatureIslands[island.id], level.level);
      assert.equal(reduceMergeWorld(state, command).state.coins, state.coins);
    }
    assert.equal(worldUpgradeOffers(state).some((offer) => offer.id === `nature:${island.id}`), false);
  }
  assert.equal(state.haven.tileStages.mossprout, 4);
});

test('mist islands are targetable and every reveal keeps other tiles and camera bounds stable', () => {
  const file = 'components/katchadeck/world/mossprout-hex-neighborhood-scene.ts';
  const mocks: Record<string, unknown> = {
    './shared-resident-presentation': { sharedResidentAnchor },
    '@/constants/mossprout-memory-plants': { mossproutMemoryPlantById: new Map() },
    '@/components/katchadeck/world/kingdom-hex-scene': {
      tileVisibleBounds: (x: number, y: number) => ({ left: x - 200, top: y - 200, right: x + 200, bottom: y + 200 }),
    },
  };
  for (const match of readFileSync(file, 'utf8').matchAll(/require\('([^']+)'\)/g)) mocks[match[1]] = match[1];
  const module = loadNativeModule(file, mocks);
  const levels = { ...restored().haven.mossproutNatureIslands };
  const build = () => module.buildMossproutHexNeighborhoodScene([], levels) as KingdomHexScene;
  const baseline = build();
  for (const island of MOSSPROUT_NATURE_ISLANDS) {
    const id = `nature:mossprout:${island.id}`;
    const locked = baseline.tileArtLayers.find((layer) => layer.id === id)!;
    assert.ok(locked.interactionFrame, `${id} must be tappable while covered in mist`);
    let fallback: unknown;
    for (const level of island.levels) {
      const before = build();
      levels[island.id] = level.level;
      const scene = build();
      assert.equal(scene.width, baseline.width);
      assert.equal(scene.height, baseline.height);
      for (const layer of before.tileArtLayers.filter((candidate) => candidate.id !== id)) {
        assert.deepEqual(scene.tileArtLayers.find((candidate) => candidate.id === layer.id)?.frame, layer.frame);
      }
      const revealed = scene.tileArtLayers.find((layer) => layer.id === id)!;
      assert.notEqual(revealed.source, locked.source);
      assert.deepEqual(revealed.interactionFrame, locked.interactionFrame);
      if (level.level === 1) fallback = revealed.source;
      else assert.equal(revealed.source, fallback, 'missing bespoke art reuses the island fallback');
    }
  }
  const catalog = module.MOSSPROUT_NATURE_ISLAND_ART as unknown as typeof import('@/components/katchadeck/world/mossprout-hex-neighborhood-scene').MOSSPROUT_NATURE_ISLAND_ART;
  const seed = catalog['seed-nursery'];
  const bespoke = catalog['pond-sanctuary'];
  seed.levelArt = { 2: { sources: bespoke.sources, alphaBounds: bespoke.alphaBounds } };
  levels['seed-nursery'] = 2;
  const withBespoke = build();
  assert.equal(withBespoke.tileArtLayers.find((layer) => layer.id === 'nature:mossprout:seed-nursery')?.source, bespoke.sources.full);
  levels['seed-nursery'] = 3;
  const withFallback = build();
  assert.equal(withFallback.tileArtLayers.find((layer) => layer.id === 'nature:mossprout:seed-nursery')?.source, seed.sources.full);
  assert.equal(withBespoke.width, withFallback.width);
  assert.equal(withBespoke.height, withFallback.height);
});

test('only the next authored level is offered, preserving costs and aggregate Haven progression', () => {
  const initial = worldUpgradeOffers(world());
  assert.deepEqual(initial.filter((offer) => offer.eligible).map((offer) => [offer.id, offer.cost]), [['haven:mossprout', 20]]);
  const offers = worldUpgradeOffers(restored());
  assert.equal(offers.some((offer) => offer.id === 'haven:mossprout'), false);
  assert.equal(offers.find((offer) => offer.id === 'mist:steppling-home')?.cost, 40);
  for (const island of MOSSPROUT_NATURE_ISLANDS) {
    const offer = offers.find((item) => item.id === `nature:${island.id}`)!;
    assert.equal(offer.nextLevel, 1); assert.equal(offer.cost, island.levels[0].coinCost);
    assert.equal(offer.eligible, true);
  }
  assert.equal(new Set(WORLD_UPGRADE_DEFINITIONS.map(worldUpgradeRunId)).size, WORLD_UPGRADE_DEFINITIONS.length);
});

test('unaffordable spots remain discoverable and distinguish story gates from Glow shortages', () => {
  const offers = worldUpgradeOffers({ ...restored(), coins: 3 });
  const mist = offers.find((offer) => offer.id === 'mist:steppling-home')!;
  assert.equal(mist.eligible, true); assert.equal(mist.affordable, false); assert.equal(mist.missingGlow, 37);
  const locked = worldUpgradeOffers(createInitialMergeWorldState(NOW, ['mossprout']));
  assert.equal(locked.some((offer) => offer.eligible), false);
});

test('completed mist and max-level islands no longer expose upgrade offers', () => {
  let state = restored();
  state = reduceMergeWorld(state, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', receiptId: 'test:mist', now: NOW }).state;
  assert.equal(worldUpgradeOffers(state).some((offer) => offer.id === 'mist:steppling-home'), false);
  state = { ...state, haven: { ...state.haven, mossproutNatureIslands: { ...state.haven.mossproutNatureIslands, 'seed-nursery': 4 } } };
  assert.equal(worldUpgradeOffers(state).some((offer) => offer.id === 'nature:seed-nursery'), false);
});

test('every upgrade holds the old world before spending and replays its receipt-backed reveal', () => {
  for (const flow of WORLD_UPGRADE_FLOWS) {
    assert.deepEqual(validateContentFlowDefinition(flow), [], flow.id);
    const hold = flow.nodes.find((node) => node.id === 'upgrade.focus')!;
    assert.equal(hold.kind === 'presentation' && hold.payload?.holdWorldState, true);
    const commit = flow.nodes.find((node) => node.id === 'upgrade.commit')!;
    assert.deepEqual(commit.kind === 'effect' && commit.payload?.economy, { mode: 'normal' });
    const reveal = flow.nodes.find((node) => node.id === 'upgrade.reveal')!;
    assert.equal(reveal.kind === 'presentation' && reveal.replayPolicy, 'replay');
    assert.equal(reveal.kind === 'presentation' && reveal.payload?.sourceEffectNodeId, 'upgrade.commit');
  }
});

test('FTUE marker taps open a saved confirmation scene without spending', () => {
  for (const [flow, marker, confirmation] of [[MOSSPROUT_FTUE_FLOW, 'world.first_bloom_offer', 'world.first_bloom_restore'], [GLOW_DISCOVERY_FLOW, 'gateway.offer', 'gateway.buy']] as const) {
    const node = flow.nodes.find((item) => item.id === marker)!;
    assert.equal(node.kind, 'scene');
    assert.equal(node.kind === 'scene' && node.actions[0].next, confirmation);
    assert.equal(flow.nodes.find((item) => item.id === confirmation)?.kind, 'scene');
  }
});

test('ordinary purchase deduplicates rapid taps, validates fresh balance, and resumes the existing journal', async () => {
  let starts = 0; let retries = 0; let existing: { status: string } | null = null; let state = world();
  const runtime = loadNativeModule('features/world-upgrades/world-upgrade-runtime.ts', {
    '@/utils/merge-world/repository': { loadMergeWorldState: async () => state },
    '@/features/content-flow/content-flow-director': { startContentFlow: async () => { starts++; return { status: 'active' }; }, dispatchContentFlowCommand: async () => { retries++; return { status: 'active' }; } },
    '@/features/content-flow/content-flow-repository': { loadContentFlowRun: async () => existing, listContentFlowRuns: async () => [] },
    './world-upgrade-offers': { worldUpgradeOffers }, './world-upgrade-flows': { WORLD_UPGRADE_FLOWS, worldUpgradeRunId },
  });
  const offer = worldUpgradeOffers(state).find((item) => item.id === 'haven:mossprout')!;
  await Promise.all([runtime.purchaseWorldUpgrade(offer), runtime.purchaseWorldUpgrade(offer)]);
  assert.equal(starts, 1);
  state = { ...state, coins: 0 };
  await assert.rejects(runtime.purchaseWorldUpgrade(offer), /more Glow/); assert.equal(starts, 1);
  existing = { status: 'failed_recoverable' };
  await runtime.purchaseWorldUpgrade(offer); assert.equal(retries, 1); assert.equal(starts, 1);
  existing = { status: 'completed' };
  await runtime.purchaseWorldUpgrade(offer); assert.equal(retries, 1); assert.equal(starts, 1);
});

test('shared sheet sends insufficient Glow to Garden, confirms once affordable, and blocks closing while busy', async () => {
  const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;
  const module = loadNativeModule('components/katchadeck/world/world-upgrade-sheet.tsx', {
    'react-native': nativeViews, 'expo-image': { Image: host('Image') },
    '@/components/katchadeck/ui/katcha-sheet': { KatchaSheet: host('Sheet') },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: host('Button') },
    '@/components/themed-text': { ThemedText: host('Text') },
    '@/constants/game-currency-art': { GAME_CURRENCY_ART: { coins: 1 } },
    '@/constants/theme': { AppFontFamilies: { fredokaBold: 'Fredoka', manrope: 'Manrope' } },
    '@/components/katchadeck/onboarding/companion-ftue-coachmark': { CompanionFtueCoachmark: host('Coachmark') },
  }, { setTimeout, clearTimeout });
  const Sheet = module.WorldUpgradeSheet as React.ComponentType<Record<string, unknown>>;
  let confirms = 0; let gardens = 0; let closes = 0;
  const props = { offer: worldUpgradeOffers(world())[0], balance: 0, busy: false, actionRef: { current: null },
    onConfirm: () => confirms++, onGarden: () => gardens++, onClose: () => closes++ };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Sheet {...props} />); });
  let button = tree!.root.findByType(host('Button'));
  assert.equal(button.props.cost, undefined);
  assert.equal(button.props.label, 'Tend garden'); await act(async () => button.props.onPress());
  assert.equal(gardens, 1); assert.equal(confirms, 0);
  await act(async () => tree!.update(<Sheet {...props} balance={20} />));
  button = tree!.root.findByType(host('Button'));
  assert.equal(button.props.cost.currency, 'coins');
  assert.equal(button.props.cost.amount, 20);
  assert.equal(button.props.label, 'Restore'); await act(async () => button.props.onPress());
  assert.equal(confirms, 1);
  await act(async () => tree!.update(<Sheet {...props} balance={20} busy />));
  assert.equal(tree!.root.findByType(host('Button')).props.disabled, true);
  tree!.root.findByType(host('Sheet')).props.onRequestClose(); assert.equal(closes, 0);
  await act(async () => tree!.unmount());
});


test('a legacy confirmation checkpoint crosses the new marker scene without replaying spending', async () => {
  let run = { runId: 'flow:old-ftue', definitionId: MOSSPROUT_FTUE_FLOW.id, definitionVersion: MOSSPROUT_FTUE_FLOW.version,
    nodeId: 'world.first_bloom_offer', status: 'active', phase: 'awaiting_scene' };
  const actions: string[] = [];
  const runtime = loadNativeModule('features/content-flow/ftue-content-flow-runtime.ts', {
    '@/features/onboarding/mossprout-ftue-flow': { MOSSPROUT_FTUE_VARIANTS: { id: 'test', variants: [] } },
    './content-flow-catalog': { contentFlowDefinition: () => MOSSPROUT_FTUE_FLOW },
    './content-flow-director': { dispatchContentFlowCommand: async (_id: string, command: { actionId: string }) => {
      actions.push(command.actionId); run = { ...run, nodeId: 'world.first_bloom_restore' }; return run;
    } },
    './content-flow-interpreter': {},
    './content-flow-repository': { loadContentFlowRun: async () => run },
    './story-variant-registry': { registerStoryVariantSet() {}, selectedStoryVariant: () => ({ definition: MOSSPROUT_FTUE_FLOW }) },
  });
  const result = await runtime.reconcileFtueCheckpoint({ runId: 'old-ftue', stepId: 'world.first_bloom_restore',
    receipts: [{ stepId: 'merge.serve_sprout', scriptVersion: 47, status: 'committed' }] });
  assert.equal(result.nodeId, 'world.first_bloom_restore');
  assert.deepEqual(actions, ['world.open_first_bloom_upgrade']);
});


test('mist upgrade stays available with a lagging FTUE or legacy chapter snapshot', () => {
  const state = restored();
  state.characterProgress.mossprout = { friendshipLevel: 1, completedChapterIds: [] };
  const offers = worldUpgradeOffers(state);
  assert.equal(offers.find((offer) => offer.id === 'mist:steppling-home')?.eligible, true);
  assert.equal(offers.some((offer) => offer.id.startsWith('nature:') && offer.eligible), false);
  for (const nodeId of ['gateway.ready', 'gateway.return', 'gateway.offer', 'gateway.buy']) {
    assert.deepEqual(visibleWorldUpgradeOffers(offers, 'companion.meditating', { nodeId, status: 'active' }).map((offer) => offer.id), ['mist:steppling-home']);
  }
  assert.deepEqual(visibleWorldUpgradeOffers(offers, undefined, { nodeId: 'lesson.spawn', status: 'active' }), []);
});

function mistUpgradeRuntime(initialNode = 'gateway.offer', initialStatus = 'active') {
  let run = { nodeId: initialNode, status: initialStatus, error: null as string | null };
  let block = false;
  const commands: string[] = [];
  const runtime = loadNativeModule('features/onboarding/glow-upgrade-runtime.ts', {
    '@/features/content-flow/content-flow-repository': { loadContentFlowRun: async () => run },
    '@/features/content-flow/content-flow-director': { dispatchContentFlowCommand: async (_id: string, command: { type: string; actionId?: string }) => {
      commands.push(command.actionId ?? command.type);
      if (block) return run;
      if (command.type === 'retry') run = { ...run, status: 'active', error: null, nodeId: run.nodeId === 'gateway.return' ? 'gateway.offer' : run.nodeId };
      if (command.actionId === 'return') run = { ...run, nodeId: 'gateway.offer' };
      if (command.actionId === 'open_upgrade') run = { ...run, nodeId: 'gateway.buy' };
      if (command.actionId === 'unlock') run = { ...run, nodeId: 'gateway.purchase.focus' };
      return run;
    } },
    './glow-discovery-flow': { GLOW_DISCOVERY_RUN_ID: 'story:glow-steppling-v1' },
    '@/utils/merge-world/glow-discovery-policy': { GLOW_GATEWAY_ID: 'mossprout:overgrown-trail' },
  });
  return { runtime, commands, setBlocked: (value: boolean) => { block = value; } };
}

test('mist panel opens without buying, then duplicate confirms advance the saved story only once', async () => {
  const { runtime, commands } = mistUpgradeRuntime();
  assert.equal((await runtime.advanceGlowUpgrade('open')).nodeId, 'gateway.buy');
  assert.deepEqual(commands, ['open_upgrade']);
  await Promise.all([runtime.advanceGlowUpgrade('confirm'), runtime.advanceGlowUpgrade('confirm')]);
  assert.deepEqual(commands, ['open_upgrade', 'unlock']);
});

test('mist retries failed saves and rejects unchanged commands instead of leaving a permanent busy panel', async () => {
  const { runtime, commands, setBlocked } = mistUpgradeRuntime('gateway.buy', 'failed_recoverable');
  setBlocked(true);
  await assert.rejects(runtime.advanceGlowUpgrade('confirm'), /paused/);
  setBlocked(false);
  assert.equal((await runtime.advanceGlowUpgrade('confirm')).nodeId, 'gateway.purchase.focus');
  assert.deepEqual(commands, ['retry', 'retry', 'unlock']);
  const stalled = mistUpgradeRuntime();
  stalled.setBlocked(true);
  await assert.rejects(stalled.runtime.advanceGlowUpgrade('open'), /did not advance/);
  stalled.setBlocked(false);
  assert.equal((await stalled.runtime.advanceGlowUpgrade('open')).nodeId, 'gateway.buy');
});

test('already paid mist resumes its reveal without another charge; unpaid mist is never auto-purchased', async () => {
  const { runtime, commands } = mistUpgradeRuntime('gateway.buy');
  const initial = restored();
  assert.equal(await runtime.recoverPaidGlowUpgrade(initial), null);
  assert.deepEqual(commands, []);
  const paid = reduceMergeWorld(initial, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', receiptId: 'earlier-purchase', now: NOW }).state;
  assert.equal((await runtime.recoverPaidGlowUpgrade(paid)).nodeId, 'gateway.purchase.focus');
  const resumed = reduceMergeWorld(paid, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', receiptId: 'recovered-story-purchase', now: NOW + 1 });
  assert.equal(resumed.state.coins, paid.coins);
  assert.equal(resumed.storyWorldMutationReceipt?.coinCost, 0);
});


test('enough Glow returns straight to an actionable scene with no camera acknowledgement', () => {
  const initial = { ...createContentFlowRun(GLOW_DISCOVERY_FLOW, { runId: 'return-with-glow', now: NOW }), nodeId: 'gateway.ready' };
  const ready = stabilizeContentFlow(GLOW_DISCOVERY_FLOW, initial).run;
  const returned = reduceContentFlow(GLOW_DISCOVERY_FLOW, ready, { type: 'submit_scene', actionId: 'return' });
  assert.equal(returned.run.nodeId, 'gateway.offer');
  assert.equal(returned.run.phase, 'awaiting_input');
  assert.equal(returned.pendingWork.kind, 'none');
  assert.equal(GLOW_DISCOVERY_FLOW.migrations?.['gateway.return'], 'gateway.offer');
});

test('a save stuck in the old return-camera step can open the new panel without a camera callback', async () => {
  for (const nodeId of ['gateway.return', 'gateway.ready']) {
    const { runtime, commands } = mistUpgradeRuntime(nodeId);
    assert.equal((await runtime.advanceGlowUpgrade('open')).nodeId, 'gateway.buy');
    assert.deepEqual(commands, [nodeId === 'gateway.return' ? 'retry' : 'return', 'open_upgrade']);
    assert.equal(commands.includes('unlock'), false);
  }
});

test('returning to mist exposes the upgrade bubble until tapped, including resumed confirmation', async () => {
  const offers = worldUpgradeOffers(restored());
  for (const nodeId of ['gateway.ready', 'gateway.return', 'gateway.offer', 'gateway.buy']) {
    const visible = visibleWorldUpgradeOffers(offers, 'companion.meditating', { nodeId, status: 'active' });
    assert.equal(visible.length, 1);
    assert.equal(visible[0].id, 'mist:steppling-home');
    const { runtime, commands } = mistUpgradeRuntime(nodeId);
    assert.equal(commands.length, 0, 'showing the bubble does not open or purchase automatically');
    assert.equal((await runtime.advanceGlowUpgrade('open')).nodeId, 'gateway.buy');
    assert.equal(commands.includes('unlock'), false, 'tapping opens confirmation without payment');
    assert.equal(visibleWorldUpgradeOffers(offers, undefined, { nodeId: 'gateway.buy', status: 'active' })[0].id,
      'mist:steppling-home', 'closing confirmation leaves its bubble available');
  }
});


test('currency button renders project art and amount, announces cost, and retains cost while loading', async () => {
  let haptics = 0;
  let hapticsUnavailable = false;
  const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;
  const module = loadNativeModule('components/katchadeck/ui/katcha-button.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable', ActivityIndicator: 'Spinner' },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' } },
    'expo-image': { Image: 'Image' },
    'expo-haptics': { selectionAsync: async () => {
      haptics++;
      if (hapticsUnavailable) throw new Error('Haptics unavailable');
    } },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '@/components/katchadeck/motion': { usePressMotion: () => ({}) },
    '@/components/katchadeck/ui/katcha-surface': { useKatchaSurface: () => ({ tokens: {} }) },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/ui/icon-symbol': { IconSymbol: 'Icon' },
    './animated-border-highlight': { AnimatedBorderHighlight: 'BorderHighlight' },
    '@/constants/game-cta': loadNativeModule('constants/game-cta.ts', {
      '@/constants/theme': { AppFontFamilies: { fredokaBold: 'FredokaBold' } },
    }),
    '@/constants/game-currency-art': { GAME_CURRENCY_ART: { coins: 'glow-art', energy: 'energy-art' } },
  });
  const Button = module.KatchaButton as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Button fullWidth label="Restore" cost={{ currency: 'coins', amount: 20 }} />); });
  assert.equal(tree!.root.findByType(host('Pressable')).props.accessibilityLabel, 'Restore, 20 Glow');
  assert.equal(tree!.root.findByType(host('Image')).props.source, 'glow-art');
  assert.equal(tree!.root.findAllByType(host('BorderHighlight')).length, 1);
  assert.deepEqual(tree!.root.findAllByType(host('Text')).map((node) => node.props.children), ['Restore', '20']);
  await act(async () => tree!.update(<Button label="Feed" loading size="compact" cost={{ currency: 'energy', amount: 5 }} />));
  assert.equal(tree!.root.findByType(host('Pressable')).props.disabled, true);
  assert.equal(tree!.root.findByType(host('Pressable')).props.accessibilityLabel, 'Feed, 5 Energy');
  assert.equal(tree!.root.findByType(host('Image')).props.source, 'energy-art');
  assert.equal(tree!.root.findAllByType(host('Spinner')).length, 1);
  assert.equal(tree!.root.findAllByType(host('BorderHighlight')).length, 0);
  await act(async () => tree!.update(<Button label="Continue" />));
  assert.equal(tree!.root.findAllByType(host('Image')).length, 0);
  assert.equal(tree!.root.findByType(host('Pressable')).props.accessibilityLabel, 'Continue');
  assert.equal(tree!.root.findAllByType(host('BorderHighlight')).length, 1);
  await act(async () => tree!.update(<Button label="Restore" disabled />));
  assert.equal(tree!.root.findAllByType(host('BorderHighlight')).length, 0);
  await act(async () => tree!.update(<Button label="Cancel" variant="secondary" />));
  assert.equal(tree!.root.findAllByType(host('BorderHighlight')).length, 0);
  let presses = 0;
  await act(async () => tree!.update(<Button label="Continue" onPress={() => presses++} />));
  await act(async () => tree!.root.findByType(host('Pressable')).props.onPress());
  assert.equal(presses, 1);
  assert.equal(haptics, 1, 'one haptic per accepted CTA tap');
  await act(async () => tree!.update(<Button label="Continue" disabled onPress={() => presses++} />));
  await act(async () => tree!.root.findByType(host('Pressable')).props.onPress());
  await act(async () => tree!.update(<Button label="Continue" loading onPress={() => presses++} />));
  await act(async () => tree!.root.findByType(host('Pressable')).props.onPress());
  assert.equal(presses, 1, 'disabled and loading CTAs cannot dispatch');
  assert.equal(haptics, 1, 'disabled and loading CTAs stay silent');
  hapticsUnavailable = true;
  await act(async () => tree!.update(<Button label="Continue" onPress={() => presses++} />));
  await act(async () => tree!.root.findByType(host('Pressable')).props.onPress());
  assert.equal(presses, 2, 'unavailable haptics never block the action');
  await act(async () => tree!.unmount());
});


test('legacy Garden restoration and finished mist requests enable the same paid unlock as the panel', () => {
  const initial = createInitialMergeWorldState(NOW, ['mossprout']);
  const structureRestored = reduceMergeWorld(initial, {
    type: 'upgradeHavenStructure', structureId: 'mossprout-garden', level: 1,
    receiptId: 'legacy-garden-restore', now: NOW,
  }).state;
  const completedLesson = { ...initial, glowDiscoveryLesson: { preparedAt: NOW,
    servedOrderIds: ['mossprout:glow:plant-1', 'mossprout:glow:plant-2'] } };
  const missingResident = { ...restored(), unlockedCharacters: [] };
  for (const saved of [structureRestored, completedLesson, missingResident]) {
    const state = { ...saved, coins: 55 };
    const offer = worldUpgradeOffers(state).find((candidate) => candidate.id === 'mist:steppling-home')!;
    assert.equal(offer.eligible, true);
    assert.equal(offer.affordable, true);
    const command = { type: 'unlockWorldTarget' as const, targetId: 'mossprout:overgrown-trail', receiptId: 'clear-mist', now: NOW };
    const purchase = reduceMergeWorld(state, command);
    assert.equal(purchase.changed, true);
    assert.equal(purchase.state.coins, 15);
    assert.ok(purchase.state.worldUnlocks?.['mossprout:overgrown-trail']);
    assert.equal(reduceMergeWorld(purchase.state, command).state.coins, 15);
    const poor = reduceMergeWorld({ ...state, coins: 39 }, command);
    assert.equal(poor.changed, false);
  }
  assert.equal(worldUpgradeOffers({ ...initial, coins: 55 }).find((offer) => offer.id === 'mist:steppling-home')?.eligible, false);
});


test('saved mist checkpoints restore one stable close-up without replaying purchase or egg framing', () => {
  const expected = { kind: 'focus_target', target: { kind: 'haven_gateway' }, zoom: 1.2, anchorY: 0.46, durationMs: 900 };
  for (const nodeId of ['garden.open', 'lesson.prepare', 'lesson.spawn', 'lesson.repeat.serve', 'gateway.ready', 'gateway.return', 'gateway.offer', 'gateway.buy']) {
    assert.deepEqual(glowDiscoveryResumeCamera({ nodeId, status: 'active' }), expected);
    assert.deepEqual(glowDiscoveryResumeCamera({ nodeId, status: 'failed_recoverable' }), expected);
    assert.equal(glowDiscoveryResumeCamera({ nodeId, status: 'completed' }), null);
  }
  assert.equal(glowDiscoveryResumeCamera({ nodeId: 'gateway.offer', status: 'active' }),
    glowDiscoveryResumeCamera({ nodeId: 'gateway.buy', status: 'active' }), 'opening confirmation keeps the same camera directive');
  for (const nodeId of ['gateway.focus', 'gateway.purchase.focus', 'gateway.egg', 'egg.enter', 'complete']) {
    assert.equal(glowDiscoveryResumeCamera({ nodeId, status: 'active' }), null);
  }
  assert.equal(glowDiscoveryResumeCamera(null), null);
});


test('unfinished Glow discovery owns the Mossprout map even after the original FTUE completes', () => {
  assert.equal(glowDiscoveryResumeWorld({ status: 'active' }), 'mossprout');
  assert.equal(glowDiscoveryResumeWorld({ status: 'failed_recoverable' }), 'mossprout');
  assert.equal(glowDiscoveryResumeWorld({ status: 'completed' }), null);
  assert.equal(glowDiscoveryResumeWorld(null), null);
});

test('startup waits for the saved Glow journal before choosing the selector or Mossprout world', async () => {
  let finishLoad: (run: unknown) => void = () => {};
  const saved = new Promise((resolve) => { finishLoad = resolve; });
  const module = loadNativeModule('features/onboarding/glow-discovery-runtime.ts', {
    '@/features/content-flow/content-flow-director': {},
    '@/features/content-flow/content-flow-repository': {
      loadContentFlowRun: () => saved, subscribeContentFlowJournal: () => () => {},
    },
    '@/utils/merge-world/glow-discovery-policy': {},
    '@/utils/merge-world/repository': {},
    './glow-discovery-flow': { GLOW_DISCOVERY_RUN_ID: 'story:glow-steppling-v1' },
  });
  let snapshot: { run: null | { status: 'active' }; ready: boolean };
  function Host() { snapshot = module.useGlowDiscoveryState(); return null; }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Host />); });
  assert.equal(snapshot!.ready, false, 'do not briefly mount the top-level selector while loading');
  await act(async () => { finishLoad({ nodeId: 'gateway.offer', status: 'active' }); });
  assert.equal(snapshot!.ready, true);
  assert.equal(glowDiscoveryResumeWorld(snapshot!.run), 'mossprout');
  await act(async () => tree!.unmount());
});
