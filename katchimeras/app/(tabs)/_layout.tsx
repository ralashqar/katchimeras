import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { DayCaptureSession } from '@/components/katchadeck/home/day-capture-session';
import { StreakBootstrap } from '@/components/katchadeck/streak/streak-bootstrap';
import { MeadowTabBar } from '@/components/katchadeck/ui/meadow-tab-bar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DEV_DEBUG_NAV_ENABLED } from '@/constants/dev';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { EggAvatarCustomizerModeProvider } from '@/features/egg-avatar/egg-avatar-customizer-mode';

// Today is the daily capture surface. The lightweight Katchimeras roster is
// visible in navigation; the persistent world route remains registered but
// hidden while its London/hex presentation is out of the main tab bar.
export const unstable_settings = {
  initialRouteName: 'today',
};

export default function TabLayout() {
  const onboardingProfile = loadOnboardingProfile();

  if (!onboardingProfile.completed) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <EggAvatarCustomizerModeProvider>
      <DayCaptureSession />
      <StreakBootstrap />
      <Tabs
        // The carved-wood Meadow bar (generated art + centre capture button)
        // replaces the stock bar entirely.
        tabBar={(props) => <MeadowTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          // Companion surfaces mount on first visit and freeze while blurred.
          // Today opts out below so its focus boundary can release the heavy
          // scene instead of leaving UI-thread animations alive off-screen.
          lazy: true,
          freezeOnBlur: true,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="today"
          options={{
            freezeOnBlur: false,
            title: 'Today',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="moon.stars.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="world"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="katchimeras"
          options={{
            freezeOnBlur: true,
            title: 'Katchimeras',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="pawprint.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="games"
          options={{
            freezeOnBlur: true,
            title: 'Games',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="gamecontroller.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="collection"
          options={{
            freezeOnBlur: true,
            title: 'Deck',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="sparkles" color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            freezeOnBlur: true,
            href: DEV_DEBUG_NAV_ENABLED ? '/explore' : null,
            title: 'Dev',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="paperplane.fill" color={color} />,
          }}
        />
      </Tabs>
    </EggAvatarCustomizerModeProvider>
  );
}
