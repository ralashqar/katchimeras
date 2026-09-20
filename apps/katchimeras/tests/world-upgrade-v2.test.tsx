import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { WORLD_UPGRADE_DEFINITIONS, worldUpgradeOffers } from '@/features/world-upgrades/world-upgrade-offers';
import { WORLD_UPGRADE_STORIES, upgradePercent, upgradeSpeaker } from '@/features/world-upgrades/world-upgrade-stories';
import { reconcileUpgradeProgress } from '@/features/world-upgrades/world-upgrade-progress';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { LEGACY_WORLD_UPGRADE_FLOWS, WORLD_UPGRADE_FLOWS } from '@/features/world-upgrades/world-upgrade-flows';
import * as upgradePanelModel from '@/features/upgrade-stage/upgrade-panel-model';
import { upgradeStageLayout } from '@/features/upgrade-stage/upgrade-stage-layout';
import { loadNativeModule, nativeMotionHarness, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const NOW = Date.UTC(2026, 8, 6);
const initial = () => ({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 10000 });
test('shared dialogue portrait preserves the world-selector circle and art geometry', () => {
  const module = loadNativeModule('components/katchadeck/world/haven-character-portrait.tsx', {
    'react-native': nativeViews, 'expo-image': { Image: 'Image' },
  });
  for (const size of [156, 72]) {
    const portrait = module.HavenCharacterPortrait({ source: 42, size });
    const [circle, art] = portrait.props.children;
    assert.equal(portrait.props.style.width, size);
    assert.ok(Math.abs(circle.props.style.width - 112 * size / 156) < 1e-9);
    assert.ok(Math.abs(circle.props.style.borderRadius - 56 * size / 156) < 1e-9);
    assert.ok(Math.abs(circle.props.style.top - 20 * size / 156) < 1e-9);
    assert.equal(circle.props.style.borderColor, '#FFF6D8');
    assert.equal(art.props.style.width, size); assert.equal(art.props.source, 42);
  }
});
test('only the shared clearings keep a panel story; every island friend tells their own', () => {
  assert.equal(WORLD_UPGRADE_STORIES.length, 2);
  assert.deepEqual(WORLD_UPGRADE_STORIES.map((story) => story.id), ['haven:mossprout:1', 'mist:steppling-home:1']);
  for (const offer of WORLD_UPGRADE_DEFINITIONS) {
    if (offer.transition === 'island_reveal' || offer.id.startsWith('nature:')) {
      assert.equal(WORLD_UPGRADE_STORIES.some((item) => item.offerId === offer.id), false, `${offer.id} is narrated by its island campaign`);
      continue;
    }
    const story = WORLD_UPGRADE_STORIES.find((item) => item.offerId === offer.id && item.level === offer.nextLevel);
    assert.ok(story); assert.equal(story.before.length, 3); assert.equal(story.after.length, 1);
    for (const line of [...story.before, ...story.after]) { assert.ok(line.text.length); assert.ok(katchimeraSkinById.get(line.speaker)?.visualKey); }
    assert.equal(story.rewardSkinId, undefined, 'cards are earned through island stories, never a purchase');
  }
  const mossproutLine = WORLD_UPGRADE_STORIES[0]!.before[0]!;
  assert.equal(upgradeSpeaker({ ...mossproutLine, speaker: 'steppling', beforeSteppling: 'quiet' }, false).text, 'quiet');
  assert.equal(upgradeSpeaker({ ...mossproutLine, speaker: 'steppling' }, true).speaker, 'steppling');
  assert.ok(WORLD_UPGRADE_FLOWS.every((flow) => flow.version === 3));
  assert.ok(LEGACY_WORLD_UPGRADE_FLOWS.every((flow) => flow.version === 2));
});
test('Glow percent cannot signal affordable before exact cost', () => {
  assert.deepEqual([0, 10, 19.99, 20, 40].map((balance) => upgradePercent(balance, 20)), [0, 50, 99, 100, 100]);
  assert.equal(upgradePercent(0, 0), 100); assert.equal(upgradePercent(-1, 20), 0);
  const offers = worldUpgradeOffers(initial());
  assert.equal(offers.find((offer) => offer.id === 'haven:mossprout')?.maxLevel, 4);
  assert.equal(offers.find((offer) => offer.id === 'mist:steppling-home')?.maxLevel, 1);
});
test('legacy fully grown islands bring their friend home once, across reload, with no story grant left behind', () => {
  const grown = initial();
  const legacy = { ...grown, version: 23, upgradeSkinGrants: { 'nature:orchard-grove:4': { skinId: 'amberleaf', grantedAt: NOW - 1 } },
    haven: { ...grown.haven, mossproutNatureIslands: { ...grown.haven.mossproutNatureIslands, 'orchard-grove': 4 as const, 'wildgrowth-grove': 4 as const } } };
  let state = normalizeMergeWorldState(JSON.parse(JSON.stringify(legacy)), NOW);
  assert.equal(state.haven.mossproutNatureIslands['orchard-grove'], 4, 'earned levels are never put back under mist');
  assert.equal(state.haven.mossproutNatureIslands['wildgrowth-grove'], 4);
  for (const [islandId, skinId] of [['orchard-grove', 'amberleaf'], ['wildgrowth-grove', 'fernip']] as const) {
    assert.equal(state.ownedKatchimeraCards.filter((card) => card.cardId === skinId).length, 1, `${skinId} is home exactly once`);
    assert.equal(state.ownedKatchimeraCards.find((card) => card.cardId === skinId)?.acquisition, 'island_campaign');
    assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId, level: 4, now: NOW, receiptId: `v2:${islandId}:4` }).changed, false);
  }
  assert.deepEqual(state.upgradeSkinGrants, {}, 'island stories no longer mint grants');
  state = normalizeMergeWorldState(JSON.parse(JSON.stringify(state)), NOW);
  assert.equal(state.ownedKatchimeraCards.filter((card) => card.cardId === 'amberleaf' || card.cardId === 'fernip').length, 2);
  assert.ok(state.mossproutResidentSkinIds.includes('fernip'));
});
test('read cursors clamp to available dialogue and do not mutate currency or tiles', () => {
  const state = initial();
  const reconciled = reconcileUpgradeProgress({ ...state, upgradeStoryRead: { 'haven:mossprout:1': 500, 'nature:seed-nursery:4': 2, bogus: 8 } });
  assert.deepEqual(reconciled.upgradeStoryRead, { 'haven:mossprout:1': 3 });
  assert.equal(reconciled.coins, state.coins); assert.deepEqual(reconciled.haven, state.haven);
});

test('docked panel pins its action, keeps shortage explicit, waits for its exit, and reading never buys', async () => {
  const motion = nativeMotionHarness(); const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;
  const readCalls: unknown[] = [];
  const frames: (() => void)[] = [];
  const globals = { setTimeout, clearTimeout, requestAnimationFrame: (callback: () => void) => { frames.push(callback); return frames.length; }, cancelAnimationFrame() {} };
  const pan: Record<string, () => unknown> = { enabled: () => pan, activeOffsetY: () => pan, onUpdate: () => pan, onEnd: () => pan };
  const shared = {
    'react-native': { ...nativeViews, Pressable: 'Pressable', Text: 'Text', Modal: 'Modal', ScrollView: 'ScrollView', Platform: { OS: 'ios' }, AccessibilityInfo: { setAccessibilityFocus() {} }, findNodeHandle: () => null, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'react-native-reanimated': motion.animated,
    '@/components/ui/icon-symbol': { IconSymbol: 'Icon' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-haptics': { notificationAsync: async () => undefined, NotificationFeedbackType: { Success: 'success' } },
    'react-native-gesture-handler': { Gesture: { Pan: () => pan }, GestureDetector: ({ children }: { children: React.ReactNode }) => children },
    'expo-image': { Image: host('Image') },
    '@/components/katchadeck/progress-bar': { ProgressBar: host('ProgressBar') },
    '@/components/katchadeck/ui/katcha-button': { KatchaButton: host('Button') },
    '@/components/katchadeck/ui/katcha-surface': { KatchaSurfaceProvider: ({ children }: { children: React.ReactNode }) => children },
    '@/constants/game-currency-art': { GAME_CURRENCY_ART: { coins: 42 } },
    '@/constants/katcha-ui': { KatchaUI: { touchTarget: 44, radius: { pill: 999 }, type: { companionCardTitle: { fontFamily: 'Fredoka' }, companionBody: { fontFamily: 'Manrope' }, label: {} } } },
    '@/constants/theme': { AppFontFamilies: { fredokaBold: 'Fredoka' } },
    '@/constants/upgrade-panel': { UpgradePanelUI: new Proxy({ motion: { enter: 260, exit: 140, settle: 300 } } as Record<string, unknown>, { get: (tokens, key: string) => key in tokens ? tokens[key] : ['#000', '#000', '#000'] }) },
    '@/constants/game-ui': { GameUI: { surface: { sage: {} } } },
  };
  const rows = loadNativeModule('components/katchadeck/upgrade/upgrade-rows.tsx', shared, globals);
  const dock = loadNativeModule('components/katchadeck/upgrade/upgrade-dock.tsx', { ...shared, './upgrade-rows': rows }, globals);
  const module = loadNativeModule('components/katchadeck/world/world-upgrade-panel.tsx', {
    ...shared,
    '@/components/katchadeck/upgrade/upgrade-dock': dock, '@/components/katchadeck/upgrade/upgrade-rows': rows,
    '@/features/upgrade-stage/upgrade-panel-model': upgradePanelModel,
    '@/features/upgrade-stage/upgrade-level-art': { tileLevelArt: (_id: string, level: number, misted?: boolean) => misted ? 'mist-art' : 700 + level },
    './world-upgrade-narrative': { WorldUpgradeNarrative: host('Narrative') },
    '@/constants/island-campaigns/registry': { islandCampaignForOffer: () => null },
    '@/constants/katchimera-skins': { katchimeraSkinById }, '@/game/days/visuals': { getCreatureVisual: () => ({ source: 1 }) },
    './companion-merge-request-tray': {
      COMPANION_MERGE_REQUEST_PALETTE: {},
      CompanionMergeRequestTray: host('RequestTray'),
    },
    '@/features/world-upgrades/world-upgrade-stories': { WORLD_UPGRADE_STORIES, upgradeSpeaker, worldUpgradeStory: (id: string, level: number) => WORLD_UPGRADE_STORIES.find((story) => story.offerId === id && story.level === level) },
  }, globals);
  const Panel = module.WorldUpgradePanel as React.ComponentType<Record<string, unknown>>;
  let closes = 0; let purchases = 0; let gardens = 0;
  const world = { ...initial(), coins: 0 };
  const layout = upgradeStageLayout({ width: 390, height: 844 }, { top: 59, bottom: 34 });
  const props = { world, layout, bottomInset: 34, offer: worldUpgradeOffers(world).find((offer) => offer.id === 'haven:mossprout')!, busy: false, actionRef: { current: null }, onClose: () => closes++, onConfirm: () => purchases++, onGarden: () => gardens++, saveRead: async (...args: unknown[]) => { readCalls.push(args); } };
  const settle = async () => { await act(async () => { frames.splice(0).forEach((frame) => frame()); motion.advance(260); }); };
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Panel {...props} />); });
  const sheet = () => tree!.root.findByType(host('AnimatedView'));
  const panelMotion = () => sheet().props.style[2].read();
  assert.deepEqual({ ...sheet().props.style[1] }, { width: 390, height: layout.panelHeight }, 'the panel is the size the camera was framed against, before any measuring');
  assert.equal(panelMotion().opacity, 0, 'mounts off-screen');
  assert.equal(panelMotion().transform[0].translateY, layout.panelHeight + 24);
  await settle();
  assert.equal(panelMotion().opacity, 1); assert.equal(panelMotion().transform[0].translateY, 0);
  assert.equal(frames.length, 0, 'the entrance plays once');
  type Node = { type?: unknown; parent: Node | null };
  const inScroll = (node: Node) => { for (let at = node.parent; at; at = at.parent) if (at.type === 'ScrollView') return true; return false; };
  const buy = tree!.root.findAllByType(host('Button')).find((node) => node.props.label === 'Restore')!;
  assert.equal(inScroll(buy as unknown as Node), false, 'the action is pinned under the scrolling content');
  assert.equal(buy.props.disabled, true); assert.equal(buy.props.cost.amount, 20);
  assert.equal(tree!.root.findByType(host('ProgressBar')).props.total, 20, 'the shortage is a requirement row');
  assert.ok(tree!.root.findAllByType(host('Text')).some((node) => node.props.children === '0 / 20'));
  const tend = tree!.root.findAllByType(host('Button')).find((node) => node.props.label === 'Tend garden')!;
  assert.equal(inScroll(tend as unknown as Node), true); assert.equal(tend.props.size, 'compact');
  const flat = () => tree!.root.findAllByType(host('Text')).map((node) => [node.props.children].flat().filter((child) => typeof child === 'string' || typeof child === 'number').join(''));
  assert.ok(flat().includes('0%'), 'the title bar reads how close the next level is');
  assert.equal(buy.props.size, 'compact', 'a short action sits beside the hero copy');
  const slots = () => tree!.root.findAllByType(host('Pressable')).filter((node) => node.props.accessibilityRole === 'radio');
  assert.deepEqual(slots().map((node) => node.props.accessibilityState.selected), [false, true, false, false, false], 'the road opens on the level being bought, after the stage the tile stands on');
  assert.deepEqual(slots().map((node) => node.props.accessibilityLabel.split(',')[0].split('.')[0]), ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'], 'levels read from 1, never 0');
  assert.ok(flat().includes('Lv. 1'), 'an unrestored tile is level 1 on screen');
  assert.equal(inScroll(slots()[0] as unknown as Node), true);
  assert.equal(tree!.root.findAllByType(host('ScrollView')).filter((node) => node.props.horizontal).length, 1, 'more than four stages scroll sideways');
  const pictures = () => tree!.root.findAllByType(host('Image')).map((node) => node.props.source).filter((source) => typeof source === 'number' && source >= 700);
  assert.deepEqual(pictures(), [700], 'only the stage the tile stands on is pictured, in its own slot; the hero row carries no picture');
  assert.ok(flat().includes('Now'), 'and that slot is marked');
  assert.equal(flat().filter((text) => text === '?').length, 4, 'every level not yet reached is a question mark');
  await act(async () => slots()[2].props.onPress());
  assert.ok(flat().includes('Reach Level 2 first'), 'a level further on explains itself, in the numbers the player sees');
  assert.ok(flat().includes('? ? ?'), 'and keeps its name to itself');
  assert.deepEqual(pictures(), [700]);
  assert.equal(tree!.root.findAllByType(host('Button')).some((node) => node.props.label === 'Restore'), false, 'and cannot be bought from there');
  await act(async () => slots()[0].props.onPress());
  assert.ok(flat().includes('Current stage'), 'the stage it stands on can be looked at');
  await act(async () => slots()[1].props.onPress());
  assert.ok(tree!.root.findAllByType(host('Button')).some((node) => node.props.label === 'Restore'));
  const coachStates: { visible: boolean; revision: number }[] = [];
  const onCoachmarkChange = (state: { visible: boolean; revision: number }) => coachStates.push(state);
  await act(async () => tree!.update(<Panel {...props} world={{ ...world, coins: 20 }} coached onCoachmarkChange={onCoachmarkChange} />));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 330)); });
  assert.deepEqual({ ...coachStates.at(-1) }, { visible: true, revision: layout.panelHeight }, 'a settled affordable tutorial publishes a screen-level guide with no scrolling');
  assert.equal(tree!.root.findAllByType(host('Button')).some((node) => node.props.label === 'Tend garden'), false, 'a met requirement offers nowhere to go');
  const tabs = () => tree!.root.findAllByType(host('Pressable')).filter((node) => node.props.accessibilityRole === 'tab');
  assert.deepEqual(tabs().map((node) => node.props.accessibilityState.selected), [true, false], 'a tile with a story has an Upgrade tab and a Story tab');
  await act(async () => tabs()[1].props.onPress());
  assert.equal(coachStates.at(-1)?.visible, false, 'the Story tab hides the upgrade guide');
  assert.equal(tree!.root.findAllByType(host('ProgressBar')).length, 0, 'the Story tab shows no upgrade rows');
  await act(async () => tree!.root.findAllByType(host('Pressable')).find((node) => node.props.accessibilityLabel === 'Expand story history')!.props.onPress());
  assert.equal(tree!.root.findAllByType(host('Narrative')).length, 1, 'the story opens from its tab');
  await act(async () => tree!.root.findByType(host('Narrative')).props.onClose());
  await act(async () => tabs()[0].props.onPress());
  assert.equal(coachStates.at(-1)?.visible, true);
  await act(async () => tree!.update(<Panel {...props} onCoachmarkChange={onCoachmarkChange} />));
  assert.equal(coachStates.at(-1)?.visible, false, 'shortage hides the purchase guide');
  assert.equal(tree!.root.findAllByType(host('Narrative')).length, 0);
  assert.ok(!tree!.root.findAllByType(host('Text')).some((node) => node.props.children === WORLD_UPGRADE_STORIES[0].before[0].text), 'base info contains no dialogue');
  assert.equal(readCalls.length, 0, 'opening base info does not mark story read');
  assert.equal(purchases, 0);
  await act(async () => { tree!.root.findAllByType(host('Button')).find((node) => node.props.label === 'Tend garden')!.props.onPress(); motion.advance(139); });
  assert.equal(gardens, 0);
  await act(async () => motion.advance(1)); assert.equal(gardens, 1, 'going to the Garden waits for the exit too');
  await act(async () => tree!.unmount());
  await act(async () => { tree = create(<Panel {...props} />); }); await settle();
  const close = tree!.root.findAllByType(host('Pressable')).find((node) => node.props.accessibilityLabel === 'Close upgrade')!;
  await act(async () => { close.props.onPress(); close.props.onPress(); motion.advance(139); });
  assert.equal(closes, 0);
  await act(async () => motion.advance(1)); assert.equal(closes, 1);
  await act(async () => tree!.unmount());
  const affordable = { ...props, world: { ...world, coins: 20 } };
  await act(async () => { tree = create(<Panel {...affordable} busy />); }); await settle();
  const busyClose = tree!.root.findAllByType(host('Pressable')).find((node) => node.props.accessibilityLabel === 'Close upgrade')!;
  await act(async () => { busyClose.props.onPress(); motion.advance(150); });
  assert.equal(closes, 1, 'busy purchase cannot be dismissed');
  await act(async () => tree!.update(<Panel {...affordable} />));
  const confirm = tree!.root.findAllByType(host('Button')).find((node) => node.props.label === 'Restore')!;
  await act(async () => { confirm.props.onPress(); confirm.props.onPress(); motion.advance(139); });
  assert.equal(purchases, 0);
  await act(async () => motion.advance(1)); assert.equal(purchases, 1, 'rapid taps spend once after exit');
  assert.equal(panelMotion().opacity, 0);
  await act(async () => tree!.update(<Panel {...affordable} error="Please retry" />));
  await act(async () => motion.advance(260));
  assert.equal(panelMotion().opacity, 1, 'a failed purchase brings the retained panel back');
  const retry = tree!.root.findAllByType(host('Button')).find((node) => node.props.label === 'Try again')!;
  assert.equal(retry.props.disabled, false, 'failure restores an actionable panel');
  await act(async () => tree!.unmount());
  const saved = { ...world, upgradeStoryRead: { 'haven:mossprout:1': 2 } };
  const beforeResume = readCalls.length;
  await act(async () => { tree = create(<Panel {...props} world={saved} />); });
  assert.equal(readCalls.length, beforeResume, 'resuming does not reset the saved cursor');
  assert.equal(tree!.root.findAllByType(host('Narrative')).length, 0, 'saved progress never puts dialogue in the base card');
  await act(async () => tree!.unmount());

  // A friend's island still under the mist (Wander Trail): current and next level are both 0. With the Glow in
  // hand the panel must offer Clear mist, read a full gauge, and picture the mist rather than the island.
  const reveal = { ...props.offer, id: 'nature:wanderling-trail', transition: 'island_reveal', name: 'Wander Trail', nextName: 'A path nobody marked', currentLevel: 0, nextLevel: 0, maxLevel: 4, cost: 40, action: 'Clear mist', eligible: true };
  await act(async () => { tree = create(<Panel {...props} offer={reveal} world={{ ...world, coins: 40 }} />); }); await settle();
  const clear = tree!.root.findAllByType(host('Button')).find((node) => node.props.label === 'Clear mist')!;
  assert.ok(clear, 'a reveal step always carries its action'); assert.equal(clear.props.disabled, false); assert.equal(clear.props.cost.amount, 40);
  assert.equal(inScroll(clear as unknown as Node), false);
  assert.equal(flat().some((text) => /Reach Level/.test(text)), false, 'it is never mistaken for a level further ahead');
  assert.equal(flat().some((text) => /Lv\./.test(text)), false, 'a misted tile has no level to show yet');
  assert.equal(tree!.root.findAllByType(host('Image')).filter((node) => node.props.source !== 42).length, 0, 'nothing under the mist is pictured');
  assert.ok(tree!.root.findAllByType(host('LinearGradient')).some((node) => [node.props.style].flat().some((style) => style?.width === '100%')), 'the gauge is full at 100%');
  await act(async () => { clear.props.onPress(); motion.advance(140); });
  assert.equal(purchases, 2, 'and it buys');
  await act(async () => tree!.unmount());

  let campaignActions = 0;
  const campaignOffer = {
    ...props.offer,
    id: 'nature:bloom-garden',
    name: 'Bloom Garden',
    currentLevel: 1,
    nextLevel: 2,
    maxLevel: 4,
    nextName: 'Colour Beds',
    cost: 60,
    eligible: false,
  };
  const campaignOrder = {
    id: 'petalimp-bloom-level-2:test',
    title: 'A little colour',
    definitionIds: ['bouquet'],
    served: false,
  };
  const campaignState = {
    actionLabel: 'Open Merge',
    order: campaignOrder,
    residentName: 'Petalimp',
    residentSkinId: 'petalimp',
    stateLabel: 'Requested in Merge',
  };
  await act(async () => { tree = create(<Panel {...props} offer={campaignOffer} campaignState={campaignState} onCampaignAction={() => campaignActions++} />); });
  const requestTray = tree!.root.findByType(host('RequestTray'));
  assert.equal(requestTray.props.countLabel, 'Requested');
  assert.equal(requestTray.props.requests[0].served, false);
  assert.equal(typeof requestTray.props.onRequestPress, 'function', 'the current request can deep-link to Merge from its tray');
  assert.ok(tree!.root.findAllByType(host('Button')).some((node) => node.props.label === 'Open Merge'));
  await act(async () => { requestTray.props.onRequestPress(campaignOrder.id); motion.advance(140); });
  assert.equal(campaignActions, 1, 'the campaign panel owns the explicit Merge handoff');
  await act(async () => tree!.unmount());

  // Starting a friend's chapter: their own phrase for it is long and says nothing of the price, so the button reads
  // as every other upgrade does, the verb and the Glow it spends (or that it is free).
  await act(async () => { tree = create(<Panel {...props} world={{ ...world, coins: 100 }} offer={campaignOffer} campaignState={{ ...campaignState, action: 'start_story', actionLabel: 'Plan with Petalimp', actionCost: 60, order: null }} onCampaignAction={() => campaignActions++} />); });
  const start = tree!.root.findAllByType(host('Button')).find((node) => node.props.label === 'Restore')!;
  assert.ok(start, 'a short verb, not the friend’s sentence'); assert.equal(start.props.cost.amount, 60, 'with its cost on the button');
  assert.equal(tree!.root.findAllByType(host('Button')).some((node) => node.props.label === 'Plan with Petalimp'), false);
  await act(async () => tree!.unmount());
  await act(async () => { tree = create(<Panel {...props} offer={campaignOffer} campaignState={{ ...campaignState, action: 'start_story', actionLabel: 'Plan with Petalimp', order: null }} onCampaignAction={() => campaignActions++} />); });
  assert.equal(tree!.root.findAllByType(host('Button')).find((node) => node.props.label === 'Restore')!.props.cost, undefined);
  assert.ok(tree!.root.findAllByType(host('Text')).some((node) => node.props.children === 'Free'), 'the first stage is a gift, and says so');
  await act(async () => tree!.unmount());

  await act(async () => { tree = create(<Panel {...props} offer={campaignOffer} campaignState={{ ...campaignState, actionLabel: 'Talk to Petalimp', order: { ...campaignOrder, served: true }, stateLabel: 'Request complete' }} onCampaignAction={() => campaignActions++} />); });
  const completeTray = tree!.root.findByType(host('RequestTray'));
  assert.equal(completeTray.props.countLabel, 'Complete');
  assert.equal(completeTray.props.requests[0].served, true, 'the same panel shows the durable green completion state');
  assert.equal(completeTray.props.onRequestPress, undefined, 'a served request cannot reopen Merge from its tray');
  await act(async () => tree!.unmount());
});
