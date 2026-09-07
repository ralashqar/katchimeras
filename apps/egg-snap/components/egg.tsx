import { CHARACTER_ART } from '../data/character-art.gen';
import { EXPRESSIONS, characterById, type CharacterExpression } from '../data/characters';
import { useCharacterExpression } from '@incubator/avatar/character-expressions';
import { HATS, HELD } from "../data/accessories";
import { memo, useEffect, useState } from "react";
import { LayeredAvatar } from "@incubator/avatar/layered-avatar";
import { EggEnergy } from "@incubator/avatar/energy";
import { useEggExpressionPlayer } from "@incubator/avatar/expressions";
import { Image } from "expo-image";
import { AppState, Image as NativeImage, View, StyleSheet } from "react-native";
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useReducedMotion, type SharedValue } from "react-native-reanimated";
import { DEFEAT_SHAKE_MS, healthCrackOpacity } from '../game/hatch-presentation';
import { EggHatchPuff } from './egg-hatch-puff';
import { BODIES, FACES, WISP } from "../data/art";

export const Egg = memo(function Egg({
  skin = "classic",
  characterId,
  hat, held,
  streak = 0,
  size = 160,
  face,
  pulse = 0,
  feedKey = 0,
  hitKey = 0,
  hitSignal,
  dizzySignal,
  hurt = false,
  wisp = false,
  paused = false,
  anchor,
  health,
  hatchAt,
  clock,
}: {
  skin?: string;
  characterId?: string;
  hat?: string | null;
  held?: string | null;
  streak?: number;
  size?: number;
  face?: string;
  pulse?: number;
  feedKey?: number;
  hitKey?: number;
  hitSignal?: SharedValue<number>;
  dizzySignal?: SharedValue<number>;
  hurt?: boolean;
  wisp?: boolean;
  paused?: boolean;
  anchor?: { x: number; y: number };
  health?: SharedValue<number>;
  hatchAt?: number;
  clock?: SharedValue<number>;
}) {
  const character = characterById(characterId ?? skin);
  const art = character ? CHARACTER_ART[character.id] : undefined;
  const body = BODIES[skin] ?? BODIES.classic;
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    if (!art) return;
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, [art]);
  useEffect(() => {
    if (!art || paused) return;
    const urls = Object.values(art.faces).map(source => typeof source === 'number' ? NativeImage.resolveAssetSource(source).uri : source.uri).filter((uri): uri is string => !!uri);
    void Image.prefetch(urls, 'memory').catch(() => {});
  }, [art, paused]);
  const [signalHit, setSignalHit] = useState(0);
  useAnimatedReaction(() => hitSignal?.value ?? 0, (value, previous) => {
    if (value > 0 && value !== previous) runOnJS(setSignalHit)(value);
  });
  const [dizzyKey, setDizzyKey] = useState(0);
  useAnimatedReaction(() => dizzySignal?.value ?? 0, (value, previous) => {
    if (value > 0 && value !== previous) runOnJS(setDizzyKey)(value);
  });
  useEffect(() => {
    if (!dizzyKey || paused) return;
    const timer = setTimeout(() => setDizzyKey(0), 900);
    return () => clearTimeout(timer);
  }, [dizzyKey, paused]);
  const baseFaceId = dizzyKey ? 'dizzy' : hurt
    ? "surprise"
    : (face ??
      (streak >= 10
        ? "heroic"
        : streak >= 3
          ? "determined"
          : streak >= 1
            ? "curious"
            : "sleepy"));
  const expression = useEggExpressionPlayer({ baseFaceId, paused: paused || !foreground });
  const reduceMotion = useReducedMotion();
  const aliases: Record<string, CharacterExpression> = {curious: 'neutral', sleepy: 'neutral', heroic: 'happy', surprise: 'surprised', grin: 'happy', dizzy: 'hurt'};
  const characterFace = useCharacterExpression({base: (EXPRESSIONS as readonly string[]).includes(baseFaceId) ? baseFaceId as CharacterExpression : aliases[baseFaceId] ?? 'neutral', defeated: hatchAt !== undefined, hurt: hurt || !!dizzyKey, attackKey: pulse || feedKey, hitKey: signalHit || hitKey, paused: paused || !foreground, reduced: reduceMotion, enabled: !!art});
  const crackStyle = useAnimatedStyle(() => ({opacity: healthCrackOpacity(health?.value ?? 1)}));
  const hatchStyle = useAnimatedStyle(() => {
    if (hatchAt === undefined || !clock) return {opacity: 1, transform: [{translateX: 0}, {scale: 1}]};
    const age = Math.max(0, clock.value - hatchAt);
    const exit = Math.max(0, Math.min(1, (age - DEFEAT_SHAKE_MS) / 240));
    const shake = reduceMotion || age >= DEFEAT_SHAKE_MS ? 0 : Math.sin(age * Math.PI / 55) * (2 + age / 250);
    return {opacity: 1 - exit, transform: [{translateX: shake}, {scale: reduceMotion ? 1 : 1 + .04 * Math.min(1, age/1000) - .64 * exit * exit}]};
  });
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={`${character?.name ?? body.name} egg`}
    >
      <Animated.View style={[StyleSheet.absoluteFill, hatchStyle]}><EggEnergy
        energy={Math.min(1, streak / 10)}
        pulseKey={pulse}
        feedKey={feedKey}
        hitKey={hitKey}
        hitSignal={hitSignal}
        glowTexture={require("../assets/effects/egg-aura.png")}
        rimTexture={require("../assets/effects/egg-rim.png")}
        hurt={hurt}
        reduceMotion={reduceMotion}
        paused={paused || hatchAt !== undefined}
        anchor={anchor}
      >
        <LayeredAvatar
          bodySource={art?.body ?? body.source}
          faceSource={art ? art.faces[characterFace.faceId] ?? art.faces.neutral : (FACES[expression.faceId] ?? FACES.sleepy).source}
          bodyPresentation={art ? {scale: 1, offsetX: 0, offsetY: 0} : body.presentation}
          facePresentation={art ? {scale: 1, offsetX: 0, offsetY: 0} : undefined}
          hat={!character && hat ? HATS[hat]?.source : null}
          heldAccessory={!character && held ? HELD[held]?.source : null}
          heldPresentation={{ scale: 1, offsetX: 0, offsetY: 0 }}
          hatPresentation={{ scale: 1, offsetX: 0, offsetY: 0 }}
          faceTransitionDuration={art ? characterFace.transitionMs : expression.transitionMs}
          bodyOverlay={health && <Animated.View style={[StyleSheet.absoluteFill, crackStyle]}>
            <Image source={require('@incubator/art-egg-avatars/effects/crack-2.png')} contentFit="contain" style={StyleSheet.absoluteFill} />
          </Animated.View>}
        />
      </EggEnergy>
      {wisp && (
        <Image
          source={WISP}
          contentFit="contain"
          style={{
            position: "absolute",
            right: -size * 0.08,
            top: size * 0.15,
            width: size * 0.3,
            height: size * 0.3,
          }}
        />
      )}</Animated.View>
      {hatchAt !== undefined && clock && <EggHatchPuff size={size} clock={clock} at={hatchAt} reduced={reduceMotion} />}
    </View>
  );
});
