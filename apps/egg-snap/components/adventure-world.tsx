import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StaticKingdomSkyBackground } from '@incubator/environments/world-sky';
import { Neighborhood, type NeighborhoodTile } from '@incubator/environments/neighborhood';
import { createUpgradeEffects } from '@incubator/environments/upgrade-effects';
import type { MossproutSlotId, MossproutArtId } from '@incubator/environments/mossprout-scene';
import type { KingdomWorldFrame } from '@incubator/environments/hex-camera-math';
import { MultipleSpotlights, type Frame } from '@incubator/presentation/spotlight';
import { SpeechTooltip } from '@incubator/game-ui/speech-tooltip';
import { NarrativePanel } from '@incubator/game-ui/narrative-panel';
import { useProfile } from '../state/provider';
import { repository } from '../state/repository';
import { worldAction, finishWorldPresentation, type WorldAction, EGGS } from '../state/adventure';
import { canPlay } from '../state/profile';
import { reconcileFtue, FTUE_STEPS } from '../state/ftue';
import { TILE_CAMPAIGNS, homeCampaignComplete, type CampaignTileId } from '../data/tile-campaigns';
import { getDuel } from '../data/campaign';
import { ftueEncounter } from '../data/ftue-encounters';
import { Scene } from './scene';
import { Egg } from './egg';
import { Button, Coins, Copy, Heading } from './ui';

const { HavenUpgradeEffects } = createUpgradeEffects({ coinArt: require('@incubator/art-merge-world/ui/coin.webp'), fontFamily: 'EggBody' });
const PALETTE = { accent: '#FFE28A', glow: '#A8E873', mist: 'rgba(226,255,213,0.88)', primary: '#4F9F57' };
export default function AdventureWorld() {
  const { profile: p, act, error, refresh } = useProfile();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<CampaignTileId>('nest');
  const [step, setStep] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [moving, setMoving] = useState(true);
  const [targetFrame, setTargetFrame] = useState<Frame | null>(null);
  const [actionFrame, setActionFrame] = useState<Frame | null>(null);
  const [coinFrame, setCoinFrame] = useState<Frame | null>(null);
  const actionRef = useRef<View>(null), coinRef = useRef<View>(null);
  const acknowledged = useRef(new Set<string>());
  const completeInFlight = useRef(false);
  const a = p?.adventure;
  const pending = a?.pendingPresentation;
  const mapTop = insets.top + 76;
  const mapHeight = Math.max(180, height - mapTop - insets.bottom - 310);
  useEffect(() => {
    if (!p) return;
    if (p.pendingResult) { router.replace('/results'); return; }
    if (!p.adventure!.legacy && !p.adventure!.fragments.includes('road')) { router.replace({ pathname: '/duel', params: { level: 'glade-1' } }); return; }
    let active = true;
    void reconcileFtue(p).then(run => { if (active) setStep(run.status === 'completed' ? null : run.nodeId); }).catch(e => { if (active) setFailure(String(e)); });
    return () => { active = false; };
  }, [p]);
  useEffect(() => {
    if (step === 'mist') setSelected('trail');
    else if (step === 'rescue' || step === 'guard' || step === 'boss') setSelected('trail');
  }, [step]);
  const art = useMemo<Partial<Record<MossproutSlotId, MossproutArtId>>>(() => ({
    home: !a?.nestLevel ? 'broken' : a.nestLevel > 1 ? 'grown' : 'home',
    gate: a?.revealed.includes('trail') ? 'gate' : 'mist',
    east: a?.revealed.includes('beyond') ? 'east' : 'mist',
  }), [a?.nestLevel, a?.revealed]);
  const previousArt = useMemo(() => !pending ? undefined : { ...art,
    [pending.action === 'clear-mist' ? 'gate' : pending.action === 'reveal-beyond' ? 'east' : 'home']:
      pending.action === 'clear-mist' || pending.action === 'reveal-beyond' ? 'mist' : pending.from === 0 ? 'broken' : 'home',
  } as Partial<Record<MossproutSlotId, MossproutArtId>>, [art, pending]);
  const focusFrame = useCallback((frame: KingdomWorldFrame, isMoving: boolean) => {
    setMoving(isMoving);
    const next = { x: frame.left, y: frame.top + mapTop, width: frame.width, height: frame.height };
    setTargetFrame(old => old?.x === next.x && old.y === next.y && old.width === next.width && old.height === next.height ? old : next);
  }, [mapTop]);
  const measureControls = useCallback(() => {
    actionRef.current?.measureInWindow((x, y, w, h) => { if (w && h) setActionFrame({ x, y, width: w, height: h }); });
    coinRef.current?.measureInWindow((x, y, w, h) => { if (w && h) setCoinFrame({ x, y, width: w, height: h }); });
  }, []);
  useEffect(() => { const frame = requestAnimationFrame(measureControls); return () => cancelAnimationFrame(frame); }, [measureControls, width, height, selected, step, pending?.id]);
  const complete = useCallback((id: string) => {
    if (completeInFlight.current) return;
    completeInFlight.current = true;
    void act(() => repository.update(value => finishWorldPresentation(value, id))).catch(e => setFailure(String(e))).finally(() => { completeInFlight.current = false; });
  }, [act]);
  if (!p) return <Scene><View style={{ padding: 30, paddingTop: 100 }}><Heading>Egg Snap</Heading><Copy>{error ?? 'Waking your world...'}</Copy>{error && <Button onPress={() => void refresh()}>Try again</Button>}</View></Scene>;
  if (!a || p.pendingResult || (!a.legacy && !a.fragments.includes('road'))) return null;
  const campaign = TILE_CAMPAIGNS.find(t => t.id === selected)!;
  const unlocked = a.revealed.includes(selected);
  const wins = campaign.levels.filter(id => p.completed.includes(id)).length;
  const nextBattle = campaign.levels.find(id => !p.completed.includes(id) && canPlay(p, id));
  const tileDone = wins === campaign.levels.length || (selected === 'trail' && a.fragments.includes('captain'));
  const revealReady = selected === 'trail' ? homeCampaignComplete(p.completed) : a.fragments.includes('captain');
  const repair = selected === 'nest' && !a.nestLevel;
  const upgrade = selected === 'nest' && a.nestLevel > 0 && a.upgradeTokens > 0;
  const locked = busy || !!pending || moving;
  const action: WorldAction | null = repair ? 'repair' : upgrade ? 'upgrade' : !unlocked ? selected === 'trail' ? 'clear-mist' : 'reveal-beyond' : null;
  const affordable = action === 'repair' ? a.legacy || p.coins >= 40 : action === 'upgrade' ? true : p.coins >= campaign.cost && revealReady;
  const seenKey = `world-v2:${step}`;
  const coachingTile = step === 'repair' || step === 'home-two' || step === 'home-three' ? 'nest' : 'trail';
  const coach = step && selected === coachingTile && !p.seen.includes(seenKey) && !acknowledged.current.has(seenKey) && !pending && !moving;
  const copy = FTUE_STEPS.find(([id]) => id === step)?.[1];
  const acknowledge = async () => {
    if (!step || p.seen.includes(seenKey)) return;
    acknowledged.current.add(seenKey);
    await act(() => repository.seen(seenKey));
  };
  const perform = async () => {
    if (locked) return;
    setBusy(true); setFailure('');
    try {
      if (action) await act(() => repository.update(value => worldAction(value, action)));
      else if (nextBattle) { await acknowledge(); router.push({ pathname: '/duel', params: { level: nextBattle } }); }
    } catch (e) { setFailure(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const outfit = a.appearances[a.activeEgg];
  const egg = EGGS.find(e => e.id === a.activeEgg)!;
  const tiles: NeighborhoodTile[] = TILE_CAMPAIGNS.filter(t => t.id !== 'beyond' || a.fragments.includes('captain') || a.revealed.includes('beyond')).map(t => ({
    slot: t.slot, label: a.revealed.includes(t.id) ? `${t.name}  ${t.levels.filter(id => p.completed.includes(id)).length}/${t.levels.length}` : 'Dream Mist',
    enabled: !busy && !pending, onPress: () => setSelected(t.id),
    resident: t.id === 'nest' ? <Egg size={160} skin={outfit.skin} characterId={a.activeEgg === 'pip' ? undefined : a.activeEgg} face={outfit.face} hat={outfit.hat} held={outfit.held} paused={!!pending} /> : undefined,
  }));
  const presentation = pending ? { id: pending.id, slot: (pending.action === 'clear-mist' ? 'gate' : pending.action === 'reveal-beyond' ? 'east' : 'home') as MossproutSlotId,
    coinOrigin: { x: (coinFrame?.x ?? width - 55) + (coinFrame?.width ?? 0) / 2, y: (coinFrame?.y ?? insets.top + 24) + (coinFrame?.height ?? 0) / 2 - mapTop } } : undefined;
  return <View style={{ flex: 1, backgroundColor: '#2379C6' }}>
    <StaticKingdomSkyBackground active />
    <View style={{ height: mapTop, paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View><Heading small>Sunny Scramble</Heading><Copy>Golden Shell {a.fragments.length}/2</Copy></View>
      <View ref={coinRef} collapsable={false} onLayout={measureControls}><Coins value={p.coins} /></View>
    </View>
    <Neighborhood width={width} height={mapHeight} art={art} previousArt={previousArt} selected={campaign.slot} tiles={tiles} presentation={presentation} onComplete={complete} onFocusFrame={focusFrame}
      renderEffects={(phase, reduced, area, target) => <HavenUpgradeEffects phase={phase} reducedMotion={reduced} area={area} target={target}
        presentation={{ nonce: pending?.action === 'repair' ? 1 : pending?.action === 'upgrade' ? 3 : 2, coinOrigin: presentation?.coinOrigin ?? { x: 0, y: 0 }, palette: PALETTE, reactionLine: pending?.action === 'repair' ? 'Fewer splinters. Already an improvement.' : 'More land. Somehow, more neighbours.' }}
        showCoins={pending?.action !== 'upgrade'} showReaction />} />
    <NarrativePanel style={{ marginHorizontal: 16, padding: 14, gap: 8, backgroundColor: '#18382FED', borderColor: '#77937B' }}>
      <Heading small>{unlocked ? campaign.name : 'Something in the mist'}</Heading>
      <Copy>{unlocked ? tileDone ? 'Clearing reclaimed. Replay any encounter.' : `${wins}/${campaign.levels.length} battles won${nextBattle ? ` - ${ftueEncounter(getDuel(nextBattle), p).rival}` : ''}` : revealReady ? `${campaign.cost} coins to unveil this clearing` : selected === 'trail' ? 'Win all three home battles to reveal this clearing.' : 'Defeat Captain Crack to explore farther.'}</Copy>
      {unlocked && <View style={{ flexDirection: 'row', gap: 6 }}>{campaign.levels.map((id, i) => <Button key={id} secondary disabled={locked || !p.completed.includes(id)} onPress={() => router.push({ pathname: '/duel', params: { level: id } })}>{p.completed.includes(id) ? '✓ ' : ''}{i + 1}</Button>)}</View>}
      <View ref={actionRef} collapsable={false} onLayout={measureControls}>
        {(action || nextBattle) && <Button disabled={locked || (!!action && !affordable)} onPress={() => void perform()}>{pending ? 'Restoring...' : repair ? 'Fix the nest · 40 coins' : upgrade ? 'Grow the nest · Gift' : !unlocked ? `Reveal · ${campaign.cost} coins` : 'Play next'}</Button>}
      </View>
      {!!(failure || error) && <Copy accessibilityRole="alert">{failure || error}</Copy>}
      {!!failure && pending && <Button secondary onPress={() => complete(pending.id)}>Finish restoration</Button>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button secondary disabled={locked} onPress={() => setSelected('nest')}>Home</Button>
        {a.nestLevel > 0 && <Button secondary disabled={locked} onPress={() => router.push('/avatar')}>{egg.name}</Button>}
        {__DEV__ && <Button secondary disabled={!!pending} onPress={() => router.replace('/dev')}>Dev</Button>}
      </View>
    </NarrativePanel>
    {coach && copy && targetFrame && actionFrame && <>
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, zIndex: 70, overflow: 'hidden' }}><MultipleSpotlights frames={[targetFrame, actionFrame]} opacity={.48} radius={18} screen={{ x: 0, y: 0, width, height }} /></View>
      <SpeechTooltip left={16} top={Math.max(mapTop + 8, mapTop + mapHeight - 100)} width={Math.min(300, width - 32)} tailLeft={Math.max(18, Math.min(250, targetFrame.x + targetFrame.width / 2 - 26))} below style={{ zIndex: 80 }}>
        <Copy style={{ color: '#273A2A', fontSize: 15 }}>{copy}</Copy>
      </SpeechTooltip>
    </>}
  </View>;
}
