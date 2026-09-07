import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { createHexTileRenderer } from './hex-tile';
import { createSeamlessWorldImage } from './seamless-image';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useKingdomHexCamera } from './hex-camera';
import { kingdomCameraSnapshotForFrame, type KingdomWorldFrame } from './hex-camera-math';
import { buildMossproutCampaignScene, type MossproutSlotId, type MossproutArtId, type MossproutLayer } from './mossprout-scene';
import { playUpgradeSequence } from './upgrade-sequence';
import { HAVEN_UPGRADE_TIMING, HAVEN_UPGRADE_REDUCED_TIMING, type HavenUpgradePresentationPhase } from './upgrade-presentation';

const SeamlessWorldImage = createSeamlessWorldImage({ imageCrossfadeMs: 600 });
const { KingdomTileArt, HavenUpgradeTileArt } = createHexTileRenderer<MossproutLayer, 'map'>({
  SeamlessWorldImage, sourceForLod: layer => layer.source, overlayForLod: () => null,
});

export type NeighborhoodPresentation = { id: string; slot: MossproutSlotId; coinOrigin: { x: number; y: number } };
export type NeighborhoodTile = { slot: MossproutSlotId; label: string; resident?: ReactNode; onPress(): void; enabled: boolean };
export function Neighborhood({ width, height, art, previousArt, selected, tiles, presentation, onComplete, onFocusFrame, renderEffects }: {
  width: number; height: number;
  art: Partial<Record<MossproutSlotId, MossproutArtId>>;
  previousArt?: Partial<Record<MossproutSlotId, MossproutArtId>>;
  selected: MossproutSlotId; tiles: readonly NeighborhoodTile[];
  presentation?: NeighborhoodPresentation;
  onComplete(id: string): void;
  onFocusFrame(frame: KingdomWorldFrame, moving: boolean): void;
  renderEffects(phase: HavenUpgradePresentationPhase, reduced: boolean, area: KingdomWorldFrame, target: { x: number; y: number }): ReactNode;
}) {
  const reduced = useReducedMotion();
  const presentationId = presentation?.id;
  const [phaseState, setPhaseState] = useState<{ id: string; phase: HavenUpgradePresentationPhase } | null>(null);
  const phase = phaseState?.id === presentation?.id ? phaseState?.phase ?? 'armed' : 'armed';
  const [blended, setBlended] = useState<string | null>(null);
  const [timelineDone, setTimelineDone] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const committed = useMemo(() => buildMossproutCampaignScene(art), [art]);
  const from = useMemo(() => previousArt ? buildMossproutCampaignScene(previousArt) : committed, [previousArt, committed]);
  const showNew = !presentation;
  const scene = showNew ? committed : from;
  const viewport = useMemo(() => ({ width, height }), [width, height]);
  const size = useMemo(() => ({ width: scene.width, height: scene.height }), [scene.width, scene.height]);
  const target = committed.layers.find(layer => layer.id === (presentation?.slot ?? selected))!;
  const home = committed.layers.find(layer => layer.id === 'home')!;
  const maximumScale = Math.min(1.25, width / 550, height / 470);
  const initial = useMemo(() => kingdomCameraSnapshotForFrame(viewport, size, home.frame, { minimumScale: .18, maximumScale, horizontalPadding: 36, verticalPadding: 48 }), [viewport, size, home.frame, maximumScale]);
  const camera = useKingdomHexCamera({ center: home.residentAnchor, initialSnapshot: initial, viewport, scene: size,
    interactionEnabled: !presentation, minimumScale: .18, maximumScale });
  const latest = useRef({ camera, target, onComplete, onFocusFrame });
  latest.current = { camera, target, onComplete, onFocusFrame };
  useEffect(() => {
    if (!camera.ready || presentationId) return;
    latest.current.camera.focusFrame(latest.current.target.frame, { durationMs: reduced ? 0 : 520, screenCenterY: height * .46, horizontalPadding: 36, verticalPadding: 48 });
  }, [camera.ready, selected, presentationId, width, height, reduced]);
  useEffect(() => {
    if (!camera.ready || !presentationId || loaded !== presentationId) return;
    const id = presentationId;
    return playUpgradeSequence({ reduced,
      focus: settled => latest.current.camera.focusFrame(latest.current.target.frame, {
        durationMs: reduced ? HAVEN_UPGRADE_REDUCED_TIMING.cameraMs : HAVEN_UPGRADE_TIMING.cameraMs,
        screenCenterY: height * .46, horizontalPadding: 36, verticalPadding: 48, onComplete: settled }),
      onPhase: phase => setPhaseState({ id, phase }),
      onComplete: () => setTimelineDone(id),
    });
  }, [camera.ready, presentationId, loaded, reduced, height, width]);
  const outgoingReady = useCallback(() => { if (presentationId) setLoaded(presentationId); }, [presentationId]);
  const revealComplete = useCallback(() => { if (presentationId) setBlended(presentationId); }, [presentationId]);
  useEffect(() => {
    if (presentationId && blended === presentationId && timelineDone === presentationId) latest.current.onComplete(presentationId);
  }, [blended, timelineDone, presentationId]);
  const snapshot = camera.snapshot;
  const project = (f: KingdomWorldFrame) => ({ left: size.width / 2 + snapshot.tx + (f.left - size.width / 2) * snapshot.scale,
    top: size.height / 2 + snapshot.ty + (f.top - size.height / 2) * snapshot.scale,
    width: f.width * snapshot.scale, height: f.height * snapshot.scale });
  const screenFrame = useMemo(() => ({ left: size.width / 2 + snapshot.tx + (target.interactionFrame.left - size.width / 2) * snapshot.scale,
    top: size.height / 2 + snapshot.ty + (target.interactionFrame.top - size.height / 2) * snapshot.scale,
    width: target.interactionFrame.width * snapshot.scale, height: target.interactionFrame.height * snapshot.scale }), [size, snapshot, target.interactionFrame]);
  useEffect(() => { latest.current.onFocusFrame(screenFrame, camera.isMoving); }, [screenFrame, camera.isMoving]);
  const effectArea = project(target.frame);
  return <View style={{ width, height }}>
    <GestureDetector gesture={camera.gesture}><View style={{ width, height, overflow: 'hidden' }}>
      <Animated.View style={[{ position: 'absolute', width: size.width, height: size.height, opacity: camera.ready ? 1 : 0 }, camera.worldStyle]}>
        {scene.layers.map(layer => {
          const tile = tiles.find(t => t.slot === layer.id);
          return <Fragment key={layer.id}>
            {presentation?.slot === layer.id ? <HavenUpgradeTileArt key={presentation.id} fromLayer={layer} toLayer={target} imageLod="map" phase={phase} reducedMotion={reduced}
              onOutgoingReady={outgoingReady} onRevealComplete={revealComplete} /> : <KingdomTileArt source={layer.source} fallbackSource={null} overlaySource={null} frame={layer.frame}
                focusAnchorX={layer.residentAnchor.x} focusAnchorY={layer.residentAnchor.y} focusScale={1} priority="high" />}
            {tile?.resident && <View pointerEvents="none" style={{ position: 'absolute', left: layer.residentAnchor.x - 80, top: layer.residentAnchor.y - 140 }}>{tile.resident}</View>}
            <Pressable disabled={!tile?.enabled || !!presentation} onPress={tile?.onPress} accessibilityRole="button" accessibilityLabel={tile?.label ?? 'Dream Mist'}
              style={{ position: 'absolute', ...layer.interactionFrame, alignItems: 'center', justifyContent: 'flex-end' }}>
              {tile && <Text style={{ color: '#FFF7D5', backgroundColor: '#183A30DF', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 8, fontSize: 22, fontWeight: '700' }}>{tile.label}</Text>}
            </Pressable>
          </Fragment>;
        })}
      </Animated.View>
    </View></GestureDetector>
    {presentation && phase !== 'complete' && <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>{renderEffects(phase, reduced, effectArea, { x: screenFrame.left + screenFrame.width / 2, y: screenFrame.top + screenFrame.height / 2 })}</View>}
  </View>;
}
