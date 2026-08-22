import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EggAvatar } from '@/components/katchadeck/egg-avatar/egg-avatar';
import { ThemedText } from '@/components/themed-text';
import { useEggAvatar } from '@/features/egg-avatar/egg-avatar-provider';
import { homeTabBarHeight, HOME_TAB_BAR_MIN_BOTTOM_PADDING } from '@/constants/home-loop-layout';
import { Lantern } from '@/constants/theme';
import { Meadow } from '@/constants/meadow-theme';
import { type GameSurfaceId, useGameScreenTransition } from '@/features/navigation/game-screen-transition';

// The Meadow tab bar (mockup v2): a dark charcoal pill floating over the
// parchment, the ACTIVE tab wrapped in a warm gold capsule, and a big raised
// cream capture button in the middle that opens the live Moment Capture
// camera. (The carved-wood variant was retired — design/today-mockup-v2.jpeg.)

// Routes that never render as tab items (expo-router registers them anyway).
const HIDDEN_ROUTES = new Set(['index', 'world', 'you', 'games']);

const INACTIVE = 'rgba(226, 221, 238, 0.72)';
const TRANSITION_SURFACES: Partial<Record<string, GameSurfaceId>> = {
  katchimeras: 'katchimeras',
  today: 'today',
  you: 'you',
};

export function MeadowTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { equippedFaceId, equippedSkinId } = useEggAvatar();
  const { active: transitionActive, transitionTo } = useGameScreenTransition();
  const youFocused = state.routes[state.index]?.name === 'you';
  const youRoute = state.routes.find((route) => route.name === 'you');
  const bottomPadding = Math.max(insets.bottom, HOME_TAB_BAR_MIN_BOTTOM_PADDING);
  const items = state.routes.filter((route) => {
    if (HIDDEN_ROUTES.has(route.name)) return false;
    // Screens hidden via `href: null` (e.g. Dev when the flag is off).
    const options = descriptors[route.key]?.options as { href?: unknown } | undefined;
    return options?.href !== null;
  });
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          height: homeTabBarHeight(insets.bottom),
          paddingBottom: bottomPadding,
        },
      ]}>
      {items.map((route, index) => {
        const { options } = descriptors[route.key];
        const routeFocused = state.routes[state.index]?.key === route.key;
        const focused = routeFocused;
        const color = focused ? Meadow.navActive : INACTIVE;
        const onPress = () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!routeFocused && !event.defaultPrevented) {
            const target = TRANSITION_SURFACES[route.name];
            if (target) {
              transitionTo({
                announcement: `Opening ${options.title ?? route.name}`,
                navigate: () => navigation.navigate(route.name),
                target,
              });
            } else {
              navigation.navigate(route.name);
            }
          }
        };
        return (
          <Fragment key={route.key}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title}
              disabled={transitionActive}
              onPress={onPress}
              style={[styles.item, focused ? styles.itemActive : null]}>
              <View>
                {options.tabBarIcon?.({ focused, color, size: 24 })}
                {options.tabBarBadge !== undefined ? <View style={styles.badgeDot} pointerEvents="none" /> : null}
              </View>
              <ThemedText numberOfLines={1} style={styles.label} lightColor={color} darkColor={color}>
                {(options.title ?? route.name).toUpperCase()}
              </ThemedText>
            </Pressable>
          </Fragment>
        );
      })}
      <Pressable
        accessibilityHint="Choose your egg avatar skin"
        accessibilityLabel="Profile and egg skins"
        accessibilityRole="button"
        disabled={transitionActive}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (!youRoute) return;
          const event = navigation.emit({ type: 'tabPress', target: youRoute.key, canPreventDefault: true });
          if (youFocused || event.defaultPrevented) return;
          transitionTo({
            announcement: 'Opening You',
            navigate: () => navigation.navigate('you'),
            target: 'you',
          });
        }}
        style={({ pressed }) => [styles.item, youFocused && styles.itemActive, pressed && styles.itemPressed]}
      >
        <View style={styles.avatarIcon}>
          <EggAvatar faceId={equippedFaceId} presentation="button" size={30} skinId={equippedSkinId} />
        </View>
        <ThemedText numberOfLines={1} style={styles.label} lightColor={youFocused ? Meadow.navActive : INACTIVE} darkColor={youFocused ? Meadow.navActive : INACTIVE}>
          YOU
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 40, 0.96)',
    borderCurve: 'continuous',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    bottom: 0,
    boxShadow: '0 -8px 28px rgba(10, 8, 4, 0.34)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    left: 0,
    paddingHorizontal: 10,
    position: 'absolute',
    right: 0,
  },
  item: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    flex: 1,
    gap: 3,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  itemPressed: { opacity: 0.74, transform: [{ scale: 0.97 }] },
  itemActive: {
    backgroundColor: 'rgba(229, 179, 111, 0.16)',
    boxShadow: '0 0 16px rgba(229, 179, 111, 0.25)',
  },
  label: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  badgeDot: {
    backgroundColor: Lantern.ember300,
    borderRadius: 999,
    height: 9,
    position: 'absolute',
    right: -3,
    top: -2,
    width: 9,
  },
  avatarIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,245,220,0.92)',
    borderColor: 'rgba(255,231,178,0.38)',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 28,
  },
});
