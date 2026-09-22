import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn, cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { heartwoodBuildingArt } from '@/constants/heartwood-building-art';
import { heartwoodBuildingById, type HeartwoodBuildingId } from '@/constants/heartwood-buildings';
import { HEARTWOOD_PATCH_ITEM as ITEM } from '@/constants/heartwood-patch-item';
import { AppFontFamilies } from '@/constants/theme';

const ASLEEP = { opacity: 0.5, scale: 0.84 };
const SOFT_GLOW = require('@incubator/art-characters/soft-glow.png');
const GLOW_TINT = '#C9F29B';

/**
 * A Heartwood building standing on its patch, the same size and footing as the
 * Wisp Lantern on its own. An unbuilt patch shows only a small sign: whatever
 * still grows there stays visible and tappable under it.
 *
 * `dormant` is the first session's Dew Spring before the garden wakes: dug out,
 * small and dim. When it clears the building swells into life, and `onSettled`
 * reports each look once it has come to rest (`<id>:dormant`, `<id>:awake`) so
 * the story only speaks about what the player has actually seen.
 *
 * While it is being upgraded, each Glow coin that lands (`impactNonce`) rocks
 * it and flashes a soft glow behind it; `charged` keeps the glow breathing
 * while the upgrade's field of light plays. The glow is a view that is always
 * mounted at opacity 0, so nothing mounts or unmounts on an impact. Being
 * built for the first time (`spawning`), the bare patch takes the coins the
 * same way: its sign is put away, the spot flashes under each landing, and the
 * building swells up out of the glow once the upgrade is written.
 */
export function HeartwoodBuildingWorld({ id, level, affordable, dormant = false, impactNonce = 0, charged = false, spawning = false, onSettled, onPress }: {
  id: HeartwoodBuildingId; level: number; affordable?: boolean; dormant?: boolean;
  /** Its first build is playing on the bare patch. */
  spawning?: boolean;
  /** Bumps once per coin landing during an upgrade. */
  impactNonce?: number;
  /** The upgrade's field of light is playing over it. */
  charged?: boolean;
  onSettled?: (visualKey: string) => void; onPress?: () => void;
}) {
  const reduced = useReducedMotion();
  const definition = heartwoodBuildingById.get(id)!;
  const built = level > 0;
  const life = useSharedValue(dormant ? 0 : 1);
  const pop = useSharedValue(0);
  const rock = useSharedValue(0);
  const glow = useSharedValue(0);
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;
  useEffect(() => {
    if (!built) return;
    const key = `${id}:${dormant ? 'dormant' : 'awake'}`;
    const settle = () => settledRef.current?.(key);
    cancelAnimation(life);
    cancelAnimation(pop);
    if (reduced || life.value === (dormant ? 0 : 1)) {
      life.value = dormant ? 0 : 1;
      // Already at rest in this look (a fresh mount): give the entrance its time before saying so.
      const timer = setTimeout(settle, reduced ? 120 : 700);
      return () => clearTimeout(timer);
    }
    pop.value = dormant ? 0 : withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 260 }));
    life.value = withTiming(dormant ? 0 : 1, { duration: 580 }, (finished) => { if (finished) runOnJS(settle)(); });
    return () => { cancelAnimation(life); cancelAnimation(pop); };
  }, [built, dormant, id, life, pop, reduced]);
  // A coin lands: a quick rock and a flash of light behind the building.
  const firstImpact = useRef(true);
  useEffect(() => {
    if (firstImpact.current) { firstImpact.current = false; return; }
    if (!impactNonce || reduced) return;
    rock.value = 0;
    rock.value = withSequence(withTiming(1, { duration: 45 }), withTiming(-0.8, { duration: 70 }), withTiming(0.4, { duration: 60 }), withTiming(0, { duration: 70 }));
    glow.value = withSequence(withTiming(1, { duration: 60 }), withTiming(charged ? 0.45 : 0, { duration: 420 }));
  }, [charged, glow, impactNonce, reduced, rock]);
  // The field of light: the glow breathes until it is over.
  useEffect(() => {
    if (reduced) { glow.value = 0; return; }
    if (!charged) { glow.value = withTiming(0, { duration: 360 }); return; }
    glow.value = withSequence(withTiming(0.9, { duration: 220 }), withTiming(0.5, { duration: 380 }), withTiming(0.85, { duration: 380 }), withTiming(0.4, { duration: 420 }));
    return () => cancelAnimation(glow);
  }, [charged, glow, reduced]);
  const stageStyle = useAnimatedStyle(() => ({
    opacity: ASLEEP.opacity + (1 - ASLEEP.opacity) * life.value,
    transform: [
      { translateX: rock.value * 3 },
      { rotate: `${rock.value * 4}deg` },
      { scale: ASLEEP.scale + (1 - ASLEEP.scale) * life.value + pop.value * 0.12 + Math.abs(rock.value) * 0.05 },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value * 0.9, transform: [{ scale: 1.5 + glow.value * 0.35 }] }));
  const label = <Text style={[styles.label, !built && styles.sign, !built && affordable && styles.signReady]}>
    {!built ? `+ ${definition.name}` : dormant ? definition.name : `${definition.name} · ${level}`}
  </Text>;
  // Built, the whole building is the button. Unbuilt, only the sign is: the plant under it keeps its own tap.
  if (!built) return <View pointerEvents="box-none" style={styles.world}>
    <View pointerEvents="none" style={styles.stage}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, glowStyle]}>
        <Image accessibilityIgnoresInvertColors contentFit="contain" source={SOFT_GLOW} style={StyleSheet.absoluteFill} tintColor={GLOW_TINT} transition={0} />
      </Animated.View>
    </View>
    {spawning ? null : <Pressable disabled={!onPress} onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Build the ${definition.name}`}>{label}</Pressable>}
  </View>;
  return <Pressable disabled={!onPress} onPress={onPress} accessibilityRole="button"
    accessibilityLabel={dormant ? `${definition.name}, not running yet` : `${definition.name}, Level ${level}. Open upgrades`} style={styles.world}>
    <Animated.View key="built" entering={reduced ? FadeIn.duration(100) : ZoomIn.duration(650)} style={styles.stage}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, glowStyle]}>
        <Image accessibilityIgnoresInvertColors contentFit="contain" source={SOFT_GLOW} style={StyleSheet.absoluteFill} tintColor={GLOW_TINT} transition={0} />
      </Animated.View>
      <Animated.View style={[styles.stage, stageStyle]}>
        {/* The world is zoomed by the camera: decode the art at its full size, not at this small box's, or it blurs when framed. */}
        <Image source={heartwoodBuildingArt(id, level)} style={styles.art} contentFit="contain" allowDownscaling={false} transition={reduced ? 0 : 250} />
      </Animated.View>
    </Animated.View>
    {label}
  </Pressable>;
}

const styles = StyleSheet.create({
  world: { width: ITEM.width, height: ITEM.height, alignItems: 'center', justifyContent: 'flex-end' },
  stage: { width: ITEM.art, height: ITEM.art },
  art: { width: ITEM.art, height: ITEM.art },
  label: { color: '#59482D', backgroundColor: '#FFF3DC', borderRadius: ITEM.labelRadius, padding: ITEM.labelPadding, fontFamily: AppFontFamilies.fredokaBold, fontSize: ITEM.labelFont },
  sign: { opacity: 0.86 },
  signReady: { opacity: 1, backgroundColor: '#E4F6C8', color: '#2F5A2A' },
});
