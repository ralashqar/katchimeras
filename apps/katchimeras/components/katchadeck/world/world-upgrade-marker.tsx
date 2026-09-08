import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { upgradePercent } from '@/features/world-upgrades/world-upgrade-stories';
import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import { ProgressBar } from '@/components/katchadeck/progress-bar';
import { katchimeraSkinById } from '@/constants/katchimera-skins';
import { getCreatureVisual } from '@/game/days/visuals';

const UPGRADE_ART = require('@incubator/art-world/ui/upgrade-toy-v1.png');
const CLEAR_MIST_ART = require('@incubator/art-world/ui/clear-mist-toy-v1.png');
const LOCK_ART = require('@incubator/art-world/hex/kingdom_dream_mist_lock_v1_512.webp');
const MARKER_SIZE = 68;
const MARKER_TILE_WIDTH_RATIO = 0.15;

export function WorldUpgradeMarker({ offer, frame, cameraScale, cameraX, cameraY, sceneWidth, sceneHeight, moving, hidden = false, selected = false, onPress, onTargetChange }: {
  offer: WorldUpgradeOffer; frame: { left: number; top: number; width: number; height: number };
  cameraScale: SharedValue<number>; cameraX: SharedValue<number>; cameraY: SharedValue<number>;
  sceneWidth: number; sceneHeight: number; moving: boolean; hidden?: boolean; selected?: boolean;
  onPress: (offer: WorldUpgradeOffer) => void; onTargetChange?: (id: string, node: View | null) => void;
}) {
  const reduced = useReducedMotion(); const pulse = useSharedValue(1);
  const visibility = useSharedValue(0);
  const wasSelected = useRef(false);
  const node = useRef<View | null>(null);
  const button = useRef<View | null>(null);
  const [bubbleHeight, setBubbleHeight] = useState(MARKER_SIZE);
  const sleepingSkin = offer.sleepingSkinId ? katchimeraSkinById.get(offer.sleepingSkinId) : null;
  const sleepingPortrait = sleepingSkin?.visualKey ? getCreatureVisual(sleepingSkin.visualKey, 'grown') : null;
  const locked = Boolean(offer.lockedReason) && !sleepingPortrait;
  const markerSkin = offer.markerSkinId ? katchimeraSkinById.get(offer.markerSkinId) : null;
  const markerPortrait = markerSkin?.visualKey ? getCreatureVisual(markerSkin.visualKey, 'grown') : null;
  const paintedWidth = markerPortrait || sleepingPortrait ? 78 : MARKER_SIZE;
  const campaignPending = Boolean(markerSkin && !offer.eligible);
  useEffect(() => {
    visibility.value = hidden ? withTiming(0, { duration: reduced ? 80 : 140 })
      : reduced ? withTiming(1, { duration: 100 }) : withSpring(1, { damping: 12, stiffness: 220, mass: 0.7 });
    if (selected) wasSelected.current = true;
    if (!hidden && wasSelected.current) {
      wasSelected.current = false;
      const timer = setTimeout(() => { const handle = findNodeHandle(button.current); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); }, reduced ? 100 : 300);
      return () => clearTimeout(timer);
    }
  }, [hidden, selected, reduced, visibility]);
  const glowProgress = offer.cost > 0 ? Math.max(0, Math.min(offer.cost, offer.cost - offer.missingGlow)) : 1;
  const glowTotal = Math.max(1, offer.cost);
  const target = useCallback((view: View | null) => { node.current = view; onTargetChange?.(offer.id, moving || hidden ? null : view); }, [moving, hidden, offer.id, onTargetChange]);
  useEffect(() => { onTargetChange?.(offer.id, moving || hidden ? null : node.current); return () => onTargetChange?.(offer.id, null); }, [moving, hidden, offer.id, onTargetChange]);
  useEffect(() => {
    pulse.value = offer.eligible && offer.affordable && !reduced ? withRepeat(withSequence(withTiming(1.045, { duration: 850 }), withTiming(1, { duration: 850 })), -1) : 1;
    return () => cancelAnimation(pulse);
  }, [offer.affordable, offer.eligible, pulse, reduced]);
  // Center the bubble just above the stairs in the lower part of the tile.
  // Artwork scales with the world; the screen-space hit target remains usable
  // when zoomed out. Tutorial measurement separately covers the painted badge.
  const projection = useAnimatedStyle(() => ({ transform: [
    { translateX: sceneWidth / 2 + cameraX.value + (frame.left + frame.width / 2 - sceneWidth / 2) * cameraScale.value - MARKER_SIZE / 2 },
    { translateY: sceneHeight / 2 + cameraY.value + (frame.top + frame.height * 0.62 - sceneHeight / 2) * cameraScale.value - MARKER_SIZE / 2 },
  ] }));
  const motion = useAnimatedStyle(() => ({ opacity: visibility.value, transform: [{
    scale: frame.width * MARKER_TILE_WIDTH_RATIO / MARKER_SIZE * cameraScale.value * pulse.value * (reduced ? 1 : visibility.value),
  }] }));
  // Stable envelope at the maximum pulse, independent of the entrance scale.
  // Include the intrinsic percentage row, top tail, rim and shadow. Measuring
  // the 68px press target clipped these whenever the world camera zoomed in.
  const spotlightBounds = useAnimatedStyle(() => {
    const scale = frame.width * MARKER_TILE_WIDTH_RATIO / MARKER_SIZE * cameraScale.value * 1.08;
    return { width: (paintedWidth + 8) * scale, height: (bubbleHeight + 18) * scale,
      left: MARKER_SIZE / 2 - (paintedWidth / 2 + 4) * scale,
      top: MARKER_SIZE / 2 - (bubbleHeight / 2 + 12) * scale };
  });
  return <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} style={[styles.position, projection]}>
      <Animated.View ref={target} collapsable={false} pointerEvents="none" accessible={false}
        onLayout={() => { onTargetChange?.(offer.id, null); if (!moving && !hidden) onTargetChange?.(offer.id, node.current); }} style={[styles.spotlightTarget, spotlightBounds]} />
      <Pressable ref={button} collapsable={false} accessibilityRole="button" accessibilityLabel={sleepingPortrait ? `${offer.name}, someone is resting here` : locked ? `${offer.name}, locked` : campaignPending ? `Continue with ${markerSkin?.displayName} at ${offer.name}` : `${offer.action} ${offer.name}, ${offer.cost} Glow`}
        accessibilityValue={locked || sleepingPortrait ? undefined : { min: 0, max: glowTotal, now: glowProgress, text: offer.cost > 0 ? `${glowProgress} of ${offer.cost} Glow` : 'Ready to upgrade' }}
        accessibilityHint={offer.lockedReason ?? (campaignPending ? 'Resumes this island story' : offer.affordable ? 'Opens upgrade details' : `${offer.missingGlow} more Glow needed. Opens upgrade details.`)}
        disabled={moving || hidden} onPress={() => onPress(offer)} style={styles.hitTarget}>
      <Animated.View pointerEvents="none" onLayout={(event) => setBubbleHeight(event.nativeEvent.layout.height)}
        style={[styles.bubble, markerPortrait || sleepingPortrait ? styles.portraitBubble : null, sleepingPortrait ? styles.sleepingBubble : null, motion]}>
        {sleepingPortrait ? <>
          <View style={[styles.portraitFrame, styles.sleepingFrame]}>
            <Image accessibilityIgnoresInvertColors allowDownscaling={false} cachePolicy="memory-disk" contentFit="contain"
              source={sleepingPortrait.source} style={[styles.portrait, styles.silhouette]} transition={0} accessible={false} />
          </View>
          <Text style={styles.sleepingGlyph}>z z</Text>
        </> : locked ? <Image accessibilityIgnoresInvertColors cachePolicy="memory-disk" contentFit="contain" source={LOCK_ART} style={styles.lockArt} transition={0} /> : <>
          {markerPortrait ? <View style={styles.portraitFrame}>
            <Image accessibilityIgnoresInvertColors allowDownscaling={false} cachePolicy="memory-disk" contentFit="contain"
              source={markerPortrait.source} style={styles.portrait} transition={0} accessible={false} />
          </View> : <Image source={offer.action === 'Clear mist' ? CLEAR_MIST_ART : UPGRADE_ART}
            style={styles.icon} contentFit="contain" transition={0} accessible={false} />}
          <View pointerEvents="none" style={[styles.progress, markerPortrait ? styles.portraitProgress : null]}>
            <ProgressBar current={glowProgress} total={glowTotal} minimumPercent={0} variant="egg" />
          </View>
          <Text style={styles.percent}>{upgradePercent(offer.cost - offer.missingGlow, offer.cost)}%</Text>
        </>}
        <View pointerEvents="none" style={styles.tail} />
      </Animated.View>
      </Pressable>
  </Animated.View>;
}
const styles = StyleSheet.create({
  spotlightTarget: { position: 'absolute' },
  position: { position: 'absolute', left: 0, top: 0, width: 68, height: 68, zIndex: 18 },
  hitTarget: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  bubble: { width: 68, minHeight: 68, alignItems: 'center', justifyContent: 'center', padding: 2, borderRadius: 18,
    backgroundColor: '#FFF3D0', borderWidth: 2, borderColor: '#D6AF62', boxShadow: '0 3px 5px rgba(67,43,18,0.24), inset 0 2px 0 #FFFBEF' },
  portraitBubble: { width: 78, minHeight: 84, paddingTop: 4, paddingBottom: 3, borderRadius: 22 },
  // Absolute offsets originate inside the 2px rim. Center the diamond on the
  // top border so its lower half covers the seam and its upper edges join it.
  tail: { position: 'absolute', top: -8, left: '50%', marginLeft: -6, width: 12, height: 12, transform: [{ rotate: '45deg' }], backgroundColor: '#FFF3D0', borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#D6AF62' },
  lockArt: { width: 54, height: 54 },
  icon: { width: 40, height: 40 },
  portraitFrame: { alignItems: 'center', backgroundColor: '#EAF6D2', borderColor: '#FFF6D8', borderRadius: 31, borderWidth: 4,
    boxShadow: '0 3px 7px rgba(35,44,25,0.32)', height: 62, justifyContent: 'center', overflow: 'hidden', width: 62 },
  portrait: { position: 'absolute', height: 82, width: 82, top: 0, left: -10 },
  progress: { width: 48, marginTop: 2 },
  portraitProgress: { width: 58, marginTop: -10, zIndex: 2, paddingHorizontal: 2, paddingVertical: 2, borderRadius: 999,
    backgroundColor: '#FFF3D0', borderWidth: 2, borderColor: '#D6AF62', boxShadow: '0 2px 4px rgba(67,43,18,0.22)' },
  percent: { color: '#654A26', fontSize: 12, lineHeight: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  // Resting friends sit in a dimmer bubble so the one open island reads as the next step.
  sleepingBubble: { backgroundColor: '#EFE6D2', borderColor: '#C9B48F' },
  sleepingFrame: { backgroundColor: '#D9DECF', borderColor: '#F3ECDD' },
  silhouette: { opacity: 0.78, tintColor: '#344238' },
  sleepingGlyph: { color: '#7B6544', fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 1, marginTop: 1 },
});
