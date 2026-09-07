import { StaticKingdomSkyBackground } from '@incubator/environments/world-sky';
import { createUpgradeEffects } from '@incubator/environments/upgrade-effects';
import type { HavenUpgradePresentationPhase } from '@incubator/environments/upgrade-presentation';
import { useContentFlowSurface } from '../state/story-surfaces';
import { useCallback, useEffect, useState } from 'react';
import { router, usePathname } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Neighborhood, type NeighborhoodTile } from '@incubator/environments/neighborhood';
import { MOSSPROUT_PRESET } from '@incubator/environments/mossprout-preset';
import { createHexProjection } from '@incubator/environments/hex';
import { NarrativePanel } from '@incubator/game-ui/narrative-panel';
import type { ContentFlowRun } from '@incubator/story/types';
import { useProfile } from '../state/provider';
import { repository } from '../state/repository';
import { worldAction, type WorldAction, EGGS } from '../state/adventure';
import { reconcileFtue, FTUE_STEPS } from '../state/ftue';
import { Scene } from './scene';
import { Egg } from './egg';
import { Button, Coins, Copy, Heading } from './ui';
import { HEX_ART } from '../data/art';

const { HavenUpgradeEffects } = createUpgradeEffects({ coinArt: require('@incubator/art-merge-world/ui/coin.webp'), fontFamily: 'EggBody' });
const upgradeEffects = (phase: HavenUpgradePresentationPhase, reduced: boolean) => <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}><HavenUpgradeEffects phase={phase} reducedMotion={reduced} area={{ left: 0, top: 0, width: 400, height: 400 }} target={{ x: 200, y: 200 }} presentation={{ nonce: 1, coinOrigin: { x: 200, y: 0 }, palette: { accent: '#F8D77C', glow: '#E6F7AD', mist: '#D5EAC8', primary: '#94C574' }, reactionLine: '' }} showCoins={false} showReaction={false} /></View>;
const projection = createHexProjection(MOSSPROUT_PRESET.layout, 'neighborhood');
export default function AdventureWorld() {
  const pathname = usePathname();
  const { profile: p, act, error, refresh } = useProfile();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const surface = useContentFlowSurface("egg-snap-world");
  const [run, setRun] = useState<ContentFlowRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [close, setClose] = useState(false);
  const [moving, setMoving] = useState(false);
  const [reaction, setReaction] = useState('');
  const settled = useCallback(() => setMoving(false), []);
  useEffect(() => {
    if (!p || pathname !== '/') return;
    let active = true;
    void reconcileFtue(p).then(value => { if (active) setRun(value); }).catch(e => { if (active) setFailure(String(e)); });
    return () => { active = false; };
  }, [p, pathname]);
  useEffect(() => {
    if (!p || pathname !== '/') return;
    if (p.pendingResult) { router.replace('/results'); return; }
    if (!p.adventure!.legacy && !p.adventure!.fragments.includes('road')) router.replace({ pathname: '/duel', params: { level: 'glade-1' } });
  }, [p, pathname]);
  if (!p) return <Scene><View style={{ flex: 1, justifyContent: 'center', padding: 30, gap: 16 }}><Heading>Egg Snap</Heading><Copy>{error ?? 'Waking your world…'}</Copy>{error && <Button onPress={() => void refresh()}>Try again</Button>}</View></Scene>;
  const a = p.adventure!;
  // Redirect-only visits must not decode map art or start resident animations.
  if (p.pendingResult || (!a.legacy && !a.fragments.includes('road'))) return null;
  const expanded = a.revealed.includes('trail') && !close;
  const bossWon = a.fragments.includes('captain');
  const actWorld = async (action: WorldAction) => {
    if (busy) return;
    setBusy(true); setFailure('');
    try {
      await act(() => repository.update(value => worldAction(value, action)));
      setReaction(action === 'repair' ? 'Pip: Fewer splinters. Already an improvement.' : action === 'clear-mist' ? 'The Golden Shell has more pieces. And apparently more neighbours.' : action === 'chest' ? 'Pip: Finders keepers. That’s official egg law.' : 'Home sweet, slightly fancier home.');
      if (action === 'clear-mist') { setClose(false); setMoving(true); }
    } catch (e) { setFailure(e instanceof Error ? e.message : 'Unable to save'); }
    finally { setBusy(false); }
  };
  const duel = (level: string) => router.push({ pathname: '/duel', params: { level } });
  const tiles: NeighborhoodTile[] = [];
  const add = (id: string, coord: { q: number; r: number }, source: number, label: string, enabled: boolean, onPress: () => void, completed = false, resident?: NeighborhoodTile['resident']) => {
    const point = projection.hexToWorld(coord);
    tiles.push({ id, ...point, source, label, enabled: enabled && !busy && !moving, completed, onPress, resident, faction: ['trail', 'rescue', 'boss'].includes(id) && source !== MOSSPROUT_PRESET.mist ? completed ? 'player' : 'rival' : undefined });
  };
  const egg = EGGS.find(e => e.id === a.activeEgg)!;
  const outfit = a.appearances[a.activeEgg];
  add('nest', MOSSPROUT_PRESET.home.coord, MOSSPROUT_PRESET.home.source, `${egg.name}’s Nest`, a.nestLevel > 0, () => router.push('/avatar'), false, <Egg size={160} skin={outfit.skin} face={outfit.face} hat={outfit.hat} held={outfit.held} />);
  add('garden', MOSSPROUT_PRESET.garden.coord, MOSSPROUT_PRESET.garden.levels[Math.min(2, a.nestLevel)], a.nestLevel === 0 ? `Fix it! · ${a.legacy ? 'Free' : '40 coins'}` : a.upgradeTokens ? 'Grow your nest · Gift' : 'Training Nest', a.nestLevel === 0 || a.upgradeTokens > 0, () => void actWorld(a.nestLevel === 0 ? 'repair' : 'upgrade'), a.nestLevel > 0);
  add('trail', MOSSPROUT_PRESET.gate.coord, a.revealed.includes('trail') ? p.completed.includes('glade-2') ? HEX_ART.glade : MOSSPROUT_PRESET.garden.levels[0] : MOSSPROUT_PRESET.mist, a.revealed.includes('trail') ? 'Rigged road' : 'Clear Dream Mist', a.nestLevel > 0, () => a.revealed.includes('trail') ? duel('glade-2') : void actWorld('clear-mist'), p.completed.includes('glade-2'));
  if (a.revealed.includes('trail')) {
    const trailWon = p.completed.includes('glade-2');
    add('chest', { q: 1, r: 0 }, trailWon ? HEX_ART.glade : MOSSPROUT_PRESET.mist, a.claims.includes('chest') ? 'Treasure claimed' : 'Roadside chest', trailWon && !a.claims.includes('chest'), () => void actWorld('chest'), a.claims.includes('chest'));
    if (trailWon) add('rescue', { q: 1, r: -1 }, a.claims.includes('chest') ? HEX_ART.glade : MOSSPROUT_PRESET.mist, a.eggs.includes('pollen') ? 'Pollen is free!' : 'Rescue Pollen', a.claims.includes('chest'), () => a.eggs.includes('pollen') ? router.push('/avatar') : duel('glade-3'), a.eggs.includes('pollen'), a.claims.includes('chest') ? <Egg size={145} skin="honeycomb" face={a.eggs.includes('pollen') ? 'grin' : 'surprise'} /> : undefined);
    if (a.claims.includes('chest')) add('boss', { q: 0, r: -1 }, a.eggs.includes('pollen') ? bossWon ? HEX_ART.glade : MOSSPROUT_PRESET.garden.levels[0] : MOSSPROUT_PRESET.mist, bossWon ? 'Captain cracked!' : 'Captain Crack', a.eggs.includes('pollen'), () => duel('glade-6'), bossWon);
    if (a.eggs.includes('pollen')) add('beyond', { q: 0, r: -2 }, bossWon ? HEX_ART.cheerlet : MOSSPROUT_PRESET.mist, bossWon ? 'The world beyond' : 'Beyond the mist', bossWon, () => router.push('/campaign'));
  }
  const focus = projection.hexToWorld(expanded ? { q: .4, r: bossWon ? -.1 : .2 } : { q: 0, r: 1.15 });
  const viewport = Math.max(220, height - insets.top - insets.bottom - 300);
  const zoom = Math.min(width / (expanded ? 1100 : 760), viewport / (expanded ? 1950 : 1080));
  const objective = FTUE_STEPS.find(([id]) => id === (surface.run ?? run)?.nodeId)?.[1];
  return <View style={{ flex: 1, backgroundColor: '#2379C6' }}><StaticKingdomSkyBackground active={pathname === '/'} />
    <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 22, gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Heading small>{expanded ? 'Sunny Scramble' : 'Home, sweet nest'}</Heading><Coins value={p.coins} /></View>
      <Copy>{bossWon ? 'Two fragments found. A whole world to scramble.' : `Golden Shell · ${a.fragments.length} / 2 fragments`}</Copy>
    </View>
    <Neighborhood width={width} height={viewport} tiles={tiles} focus={focus} zoom={zoom} locked={busy || moving || !expanded} onSettled={settled} renderUpgradeEffects={upgradeEffects} paths={[
      { from: 'garden', to: 'nest', open: a.nestLevel > 0 }, { from: 'nest', to: 'trail', open: a.revealed.includes('trail') },
      { from: 'trail', to: 'chest', open: p.completed.includes('glade-2') }, { from: 'chest', to: 'rescue', open: a.claims.includes('chest') },
      { from: 'rescue', to: 'boss', open: a.eggs.includes('pollen') }, { from: 'boss', to: 'beyond', open: bossWon },
    ]} />
    <NarrativePanel style={{ marginHorizontal: 16, padding: 16, gap: 10, backgroundColor: '#18382FED', borderColor: '#77937B' }}>
      <Copy>{reaction || objective || 'Pip: I suppose we’re adventurers now.'}</Copy>
      {!bossWon && <Button disabled={busy || moving} onPress={() => {
        if (!a.nestLevel) void actWorld('repair');
        else if (!a.revealed.includes('trail')) void actWorld('clear-mist');
        else if (!p.completed.includes('glade-2')) duel('glade-2');
        else if (!a.claims.includes('chest')) void actWorld('chest');
        else if (!a.eggs.includes('pollen')) duel('glade-3');
        else duel('glade-6');
      }}>{!a.nestLevel ? 'Fix the nest' : !a.revealed.includes('trail') ? 'Clear Dream Mist' : !p.completed.includes('glade-2') ? 'Challenge the roadside rival' : !a.claims.includes('chest') ? 'Open the chest' : !a.eggs.includes('pollen') ? 'Rescue Pollen' : 'Face Captain Crack'}</Button>}
      {bossWon && <Button disabled={busy || moving} onPress={() => a.upgradeTokens ? void actWorld('upgrade') : router.push('/campaign')}>{a.upgradeTokens ? 'Grow your nest · Gift' : 'Explore the world beyond'}</Button>}
      {(failure || error) && <Copy accessibilityRole="alert">{failure || error}</Copy>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {a.revealed.includes('trail') && <Button secondary onPress={() => { setClose(!close); setMoving(true); }}>{close ? 'World map' : 'Nest'}</Button>}
        {a.nestLevel > 0 && <Button secondary onPress={() => router.push('/avatar')}>Your eggs</Button>}
        {__DEV__ && <Button secondary onPress={() => router.replace('/dev')}>Dev</Button>}
      </View>
    </NarrativePanel>
  </View>;
}
