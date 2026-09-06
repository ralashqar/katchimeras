import {memo,useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {View,StyleSheet,type ImageSourcePropType} from 'react-native';
import Animated,{cancelAnimation,Easing,runOnJS,useAnimatedStyle,useSharedValue,useReducedMotion,withTiming,type SharedValue} from 'react-native-reanimated';
import {worldImageSourceKey,type createSeamlessWorldImage} from './seamless-image';
import type {HavenUpgradePresentationPhase} from './upgrade-presentation';
type AbsoluteFrame={left:number;top:number;width:number;height:number};
export function createHexTileRenderer<KingdomTileArtLayer extends {frame:AbsoluteFrame},KingdomHexTileLod extends string>({SeamlessWorldImage,sourceForLod:kingdomHexTileSourceForLod,overlayForLod:kingdomHexTileOverlaySourceForLod}: {SeamlessWorldImage:ReturnType<typeof createSeamlessWorldImage>;sourceForLod:(layer:KingdomTileArtLayer,lod:KingdomHexTileLod)=>ImageSourcePropType;overlayForLod:(layer:KingdomTileArtLayer,lod:KingdomHexTileLod)=>ImageSourcePropType|null}) {
const TileFocusTransform = memo(function TileFocusTransform({
  anchorX,
  anchorY,
  children,
  frame,
  scale: targetScale,
}: {
  anchorX: number;
  anchorY: number;
  children: ReactNode;
  frame: AbsoluteFrame;
  scale: number;
}) {
  const reduceMotion = useReducedMotion();
  const localScale = useSharedValue(1);
  useEffect(() => {
    localScale.value = withTiming(targetScale, {
      duration: reduceMotion ? 0 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [localScale, reduceMotion, targetScale]);
  const anchorDx = anchorX - (frame.left + frame.width / 2);
  const anchorDy = anchorY - (frame.top + frame.height / 2);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -anchorDx },
      { translateY: -anchorDy },
      { scale: localScale.value },
      { translateX: anchorDx },
      { translateY: anchorDy },
    ],
  }));
  return (
    <Animated.View pointerEvents="box-none" style={[styles.focusLayer, frame, animatedStyle]}>
      {children}
    </Animated.View>
  );
});

type TileArtProps = {
  hidden?: boolean;
  fallbackSource: ImageSourcePropType | null;
  focusAnchorX: number;
  focusAnchorY: number;
  focusScale: number;
  frame: { left: number; top: number; width: number; height: number };
  priority: 'low' | 'normal' | 'high';
  source: ImageSourcePropType;
  overlaySource: ImageSourcePropType | null;
  onSettled?: () => void;
};

const KingdomTileArt = memo(function KingdomTileArt({
  hidden = false,
  fallbackSource,
  focusAnchorX,
  focusAnchorY,
  focusScale,
  frame,
  priority,
  source,
  overlaySource,
  onSettled,
}: TileArtProps) {
  const sourceKey = worldImageSourceKey(source);
  const overlayKey = overlaySource ? worldImageSourceKey(overlaySource) : null;
  const [settledSource, setSettledSource] = useState<string | null>(null);
  const [settledOverlay, setSettledOverlay] = useState<string | null>(null);
  const handleSourceSettled = useCallback(() => setSettledSource(sourceKey), [sourceKey]);
  const handleOverlaySettled = useCallback(() => setSettledOverlay(overlayKey), [overlayKey]);
  useEffect(() => {
    if (settledSource === sourceKey && (!overlayKey || settledOverlay === overlayKey)) onSettled?.();
  }, [onSettled, overlayKey, settledOverlay, settledSource, sourceKey]);
  return (
    <TileFocusTransform anchorX={focusAnchorX} anchorY={focusAnchorY} frame={frame} scale={focusScale}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, hidden && { opacity: 0 }]}>
        <SeamlessWorldImage
          allowDownscaling
          retainOutgoingOpacity
          source={source}
          fallbackSource={fallbackSource}
          onSettled={handleSourceSettled}
          priority={priority}
        />
        {overlaySource ? (
          <SeamlessWorldImage
            allowDownscaling
            retainOutgoingOpacity
            onSettled={handleOverlaySettled}
            source={overlaySource}
            priority={priority}
          />
        ) : null}
      </View>
    </TileFocusTransform>
  );
});

const HavenUpgradeTileArt = memo(function HavenUpgradeTileArt({
  fromLayer,
  imageLod,
  onRevealComplete,
  onOutgoingReady,
  takeoverConfirmed = true,
  sharedRevealProgress,
  phase,
  reducedMotion,
  toLayer,
}: {
  fromLayer: KingdomTileArtLayer;
  imageLod: KingdomHexTileLod;
  onRevealComplete?: () => void;
  onOutgoingReady?: () => void;
  takeoverConfirmed?: boolean;
  sharedRevealProgress?: SharedValue<number>;
  phase: HavenUpgradePresentationPhase;
  reducedMotion: boolean;
  toLayer: KingdomTileArtLayer;
}) {
  const revealActive = phase === 'reveal' || phase === 'react' || phase === 'complete';
  const oldSource = kingdomHexTileSourceForLod(fromLayer, imageLod);
  const newSource = kingdomHexTileSourceForLod(toLayer, imageLod);
  const oldOverlaySource = kingdomHexTileOverlaySourceForLod(fromLayer, imageLod);
  const newOverlaySource = kingdomHexTileOverlaySourceForLod(toLayer, imageLod);
  const sourceKey = worldImageSourceKey(newSource);
  const overlayKey = newOverlaySource ? worldImageSourceKey(newOverlaySource) : null;
  const [readySource, setReadySource] = useState<string | null>(null);
  const [readyOverlay, setReadyOverlay] = useState<string | null>(null);
  const handleSourceReady = useCallback(() => setReadySource(sourceKey), [sourceKey]);
  const handleOverlayReady = useCallback(() => setReadyOverlay(overlayKey), [overlayKey]);
  const targetReady = readySource === sourceKey && (!overlayKey || readyOverlay === overlayKey);
  const oldKey = worldImageSourceKey(oldSource);
  const oldOverlayKey = oldOverlaySource ? worldImageSourceKey(oldOverlaySource) : null;
  const [paintedOld, setPaintedOld] = useState<string | null>(null);
  const [paintedOldOverlay, setPaintedOldOverlay] = useState<string | null>(null);
  const handleOldReady = useCallback(() => setPaintedOld(oldKey), [oldKey]);
  const handleOldOverlayReady = useCallback(() => setPaintedOldOverlay(oldOverlayKey), [oldOverlayKey]);
  const outgoingReady = paintedOld === oldKey && (!oldOverlayKey || paintedOldOverlay === oldOverlayKey);
  useEffect(() => {
    if (outgoingReady && (phase !== 'complete' || targetReady)) onOutgoingReady?.();
  }, [onOutgoingReady, outgoingReady, phase, targetReady]);
  const onRevealCompleteRef = useRef(onRevealComplete);
  onRevealCompleteRef.current = onRevealComplete;
  const finishReveal = useCallback(() => onRevealCompleteRef.current?.(), []);
  // Starting the reveal is not proof that its terminal frame was drawn.
  // Late-mounted reveal/react layers must still blend from the old tile.
  // Only the completed handoff may begin with the restored art fully visible.
  const localRevealProgress = useSharedValue(phase === 'complete' ? 1 : 0);
  const revealProgress = sharedRevealProgress ?? localRevealProgress;

  useEffect(() => {
    if (!revealActive || !targetReady || !outgoingReady || !takeoverConfirmed) return;
    revealProgress.value = withTiming(1, {
      duration: reducedMotion ? 180 : 480,
      easing: Easing.inOut(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(finishReveal)();
    });
    return () => cancelAnimation(revealProgress);
  }, [finishReveal, reducedMotion, revealActive, revealProgress, targetReady, outgoingReady, takeoverConfirmed]);

  const oldStyle = useAnimatedStyle(() => ({ opacity: 1 - revealProgress.value }));
  const newStyle = useAnimatedStyle(() => ({ opacity: revealProgress.value }));
  const artChanges = havenUpgradeLayerArtChanges(fromLayer, toLayer, imageLod);

  if (!artChanges) return null;

  return (
    <>
      <Animated.View collapsable={false} needsOffscreenAlphaCompositing pointerEvents="none" style={[styles.tileArt, fromLayer.frame, oldStyle]}>
        <SeamlessWorldImage priority="high" source={oldSource} transitionDuration={0} onSettled={handleOldReady} />
        {oldOverlaySource ? <SeamlessWorldImage priority="high" source={oldOverlaySource} transitionDuration={0} onSettled={handleOldOverlayReady} /> : null}
      </Animated.View>
      <Animated.View collapsable={false} needsOffscreenAlphaCompositing pointerEvents="none" style={[styles.tileArt, toLayer.frame, newStyle]}>
        <SeamlessWorldImage priority="high" source={newSource} transitionDuration={0} onSettled={handleSourceReady} />
        {newOverlaySource ? <SeamlessWorldImage priority="high" source={newOverlaySource} transitionDuration={0} onSettled={handleOverlayReady} /> : null}
      </Animated.View>
    </>
  );
});

function havenUpgradeLayerArtChanges(
  fromLayer: KingdomTileArtLayer,
  toLayer: KingdomTileArtLayer,
  imageLod: KingdomHexTileLod,
) {
  return kingdomHexTileSourceForLod(fromLayer, imageLod) !== kingdomHexTileSourceForLod(toLayer, imageLod)
    || kingdomHexTileOverlaySourceForLod(fromLayer, imageLod) !== kingdomHexTileOverlaySourceForLod(toLayer, imageLod);
}

const styles=StyleSheet.create({focusLayer:{position:'absolute'},tileArt:{position:'absolute'}});
return {KingdomTileArt,HavenUpgradeTileArt,TileFocusTransform,havenUpgradeLayerArtChanges};
}
