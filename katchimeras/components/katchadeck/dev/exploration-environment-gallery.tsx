import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

import { CreatureHero } from '@/components/katchadeck/home/creature-hero';
import {
  TodayExplorationBackground,
  TodayExplorationSceneLayer,
  useTodayExplorationBackgroundMotion,
} from '@/components/katchadeck/home/today-exploration-background';
import { DevAtmosphereLayer } from '@/components/katchadeck/world/atmosphere-layer';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppFontFamilies, KatchaDeckUI, Lantern } from '@/constants/theme';
import { DEV_EXPLORATION_ENVIRONMENT_PREVIEWS } from '@/utils/dev-exploration-environments';
import { safeGoBack } from '@/utils/safe-navigation';
import {
  TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA,
  TODAY_KINGDOM_STAGE_HEIGHT,
} from '@/utils/today-kingdom-hero-layout';
import { router } from 'expo-router';

export function ExplorationEnvironmentGallery() {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const selected =
    DEV_EXPLORATION_ENVIRONMENT_PREVIEWS[selectedIndex]
    ?? DEV_EXPLORATION_ENVIRONMENT_PREVIEWS[0];

  const selectAdjacent = useCallback((direction: -1 | 1) => {
    setSelectedIndex((current) => {
      const count = DEV_EXPLORATION_ENVIRONMENT_PREVIEWS.length;
      return count > 0 ? (current + direction + count) % count : 0;
    });
  }, []);
  const motion = useTodayExplorationBackgroundMotion({
    activeKey: selected?.backgroundKey,
    enabled: selected != null,
    onQuickSwipe: selectAdjacent,
  });
  const stageTop =
    insets.top + TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA;

  if (!selected) {
    return (
      <View style={styles.emptyScreen}>
        <ThemedText selectable lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
          No cinematic Katchimera environments have been exported yet.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <GestureDetector gesture={motion.gesture}>
        <View style={styles.preview}>
          <TodayExplorationBackground
            backgroundKey={selected.backgroundKey}
            imageSize={motion.imageSize}
            translateX={motion.translateX}
          />
          <TodayExplorationSceneLayer translateX={motion.translateX}>
            <View
              key={selected.backgroundKey}
              style={[styles.heroStage, { top: stageTop }]}>
              <CreatureHero
                artLod="medium"
                compact
                creature={selected.creature}
                explorationStageTop={stageTop}
                hideKingdomEnvironmentArt
                kingdomEnvironment
              />
            </View>
          </TodayExplorationSceneLayer>
          <DevAtmosphereLayer
            plane="foreground"
            style={styles.atmosphere}
            target="today"
          />
        </View>
      </GestureDetector>

      <View style={[styles.topBar, { top: insets.top + 10 }]}>
        <Pressable
          accessibilityLabel="Close environment gallery"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => safeGoBack(router)}
          style={({ pressed }) => [
            styles.roundButton,
            pressed ? styles.pressed : null,
          ]}>
          <IconSymbol color={Lantern.moon50} name="xmark" size={16} />
        </Pressable>

        {controlsVisible ? (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(140)}
            pointerEvents="none"
            style={styles.titlePill}>
            <ThemedText
              numberOfLines={1}
              style={styles.title}
              lightColor={Lantern.moon50}
              darkColor={Lantern.moon50}>
              Environment gallery
            </ThemedText>
            <ThemedText
              selectable
              style={styles.counter}
              lightColor={Lantern.moon300}
              darkColor={Lantern.moon300}>
              {selectedIndex + 1}/{DEV_EXPLORATION_ENVIRONMENT_PREVIEWS.length}
            </ThemedText>
          </Animated.View>
        ) : (
          <View style={styles.topSpacer} />
        )}

        <Pressable
          accessibilityLabel={controlsVisible ? 'Hide gallery controls' : 'Show gallery controls'}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => setControlsVisible((visible) => !visible)}
          style={({ pressed }) => [
            styles.chromeButton,
            pressed ? styles.pressed : null,
          ]}>
          <ThemedText
            style={styles.chromeButtonLabel}
            lightColor={Lantern.moon50}
            darkColor={Lantern.moon50}>
            {controlsVisible ? 'Hide UI' : 'Show UI'}
          </ThemedText>
        </Pressable>
      </View>

      {controlsVisible ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[
            styles.controlDock,
            { paddingBottom: insets.bottom + 12 },
          ]}>
          <View style={styles.selectedRow}>
            <View style={styles.selectedCopy}>
              <ThemedText
                style={styles.kicker}
                lightColor={Lantern.ember300}
                darkColor={Lantern.ember300}>
                {selected.environmentLabel}
              </ThemedText>
              <ThemedText
                style={styles.selectedTitle}
                lightColor={Lantern.moon50}
                darkColor={Lantern.moon50}>
                {selected.creature.name}
              </ThemedText>
            </View>
            <ThemedText
              selectable
              style={styles.fitLabel}
              lightColor={Lantern.moon300}
              darkColor={Lantern.moon300}>
              {Math.round(width)}×{Math.round(height)} · pan ±{Math.round(motion.maxPan)}
            </ThemedText>
          </View>

          <ScrollView
            contentContainerStyle={styles.environmentList}
            contentInsetAdjustmentBehavior="never"
            horizontal
            showsHorizontalScrollIndicator={false}>
            {DEV_EXPLORATION_ENVIRONMENT_PREVIEWS.map((preview, index) => {
              const active = index === selectedIndex;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={preview.backgroundKey}
                  onPress={() => setSelectedIndex(index)}
                  style={({ pressed }) => [
                    styles.environmentChip,
                    active ? styles.environmentChipActive : null,
                    pressed ? styles.pressed : null,
                  ]}>
                  <ThemedText
                    numberOfLines={1}
                    style={styles.environmentChipLabel}
                    lightColor={active ? Lantern.emberInk : Lantern.moon50}
                    darkColor={active ? Lantern.emberInk : Lantern.moon50}>
                    {preview.creature.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <ThemedText
            selectable
            style={styles.hint}
            lightColor={Lantern.moon300}
            darkColor={Lantern.moon300}>
            Quick swipe changes environment · hold and drag explores the square art
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  atmosphere: {
    zIndex: 55,
  },
  chromeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(18, 15, 27, 0.78)',
    borderColor: 'rgba(255, 245, 220, 0.3)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  chromeButtonLabel: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 12,
    fontWeight: '800',
  },
  controlDock: {
    backgroundColor: 'rgba(14, 12, 21, 0.88)',
    borderColor: 'rgba(255, 245, 220, 0.18)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    bottom: 0,
    boxShadow: '0 -10px 32px rgba(8, 7, 12, 0.24)',
    gap: 10,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    position: 'absolute',
    right: 0,
    zIndex: 100,
  },
  counter: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  emptyScreen: {
    alignItems: 'center',
    backgroundColor: Lantern.ink950,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  environmentChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 245, 220, 0.16)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 94,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  environmentChipActive: {
    backgroundColor: Lantern.ember300,
    borderColor: 'rgba(255, 239, 196, 0.9)',
  },
  environmentChipLabel: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 12.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  environmentList: {
    gap: 8,
    paddingRight: 16,
  },
  fitLabel: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  heroStage: {
    alignItems: 'center',
    height: TODAY_KINGDOM_STAGE_HEIGHT,
    left: 0,
    overflow: 'visible',
    position: 'absolute',
    right: 0,
    zIndex: 3,
  },
  hint: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    textAlign: 'center',
  },
  kicker: {
    fontFamily: AppFontFamilies.manrope,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.72,
  },
  preview: {
    flex: 1,
  },
  roundButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(18, 15, 27, 0.78)',
    borderColor: 'rgba(255, 245, 220, 0.3)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  screen: {
    backgroundColor: Lantern.ink950,
    flex: 1,
  },
  selectedCopy: {
    flex: 1,
  },
  selectedRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
  },
  selectedTitle: {
    ...KatchaDeckUI.typography.screenHeader,
    fontSize: 19,
    lineHeight: 23,
  },
  title: {
    ...KatchaDeckUI.typography.screenMeta,
    flexShrink: 1,
  },
  titlePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(18, 15, 27, 0.78)',
    borderColor: 'rgba(255, 245, 220, 0.3)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    left: 14,
    position: 'absolute',
    right: 14,
    zIndex: 100,
  },
  topSpacer: {
    flex: 1,
  },
});
