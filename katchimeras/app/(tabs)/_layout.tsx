import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { DayCaptureSession } from '@/components/katchadeck/home/day-capture-session';
import { MeadowTabBar } from '@/components/katchadeck/ui/meadow-tab-bar';
import { WorldTileAtlasProvider } from '@/components/katchadeck/world/world-tile-atlas-provider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DEV_DEBUG_NAV_ENABLED } from '@/constants/dev';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

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
    <WorldTileAtlasProvider>
      <DayCaptureSession />
      <Tabs
        // The carved-wood Meadow bar (generated art + centre capture button)
        // replaces the stock bar entirely.
        tabBar={(props) => <MeadowTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          // Companion surfaces mount on first visit and freeze while blurred;
          // Today remains the only continuously live screen.
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
            title: 'Katchimeras',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="pawprint.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="collection"
          options={{
            title: 'Deck',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="sparkles" color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            href: DEV_DEBUG_NAV_ENABLED ? '/explore' : null,
            title: 'Dev',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="paperplane.fill" color={color} />,
          }}
        />
      </Tabs>
    </WorldTileAtlasProvider>
  );
}
