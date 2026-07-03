import { Redirect, Tabs } from 'expo-router';
import React, { useSyncExternalStore } from 'react';

import { DayCaptureSession } from '@/components/katchadeck/home/day-capture-session';
import { MeadowTabBar } from '@/components/katchadeck/ui/meadow-tab-bar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DEV_DEBUG_NAV_ENABLED } from '@/constants/dev';
import { Lantern } from '@/constants/theme';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { isArrivalPending, subscribeArrivalPending } from '@/utils/kingdom-arrival';

// Today is the app's home — the daily capture surface. The Kingdom (the
// persistent world every day builds) sits alongside it as the long-term tab.
export const unstable_settings = {
  initialRouteName: 'today',
};

export default function TabLayout() {
  const onboardingProfile = loadOnboardingProfile();
  // A hatched day is waiting to be witnessed in the Kingdom (cleared by the
  // morning ceremony there).
  const arrivalPending = useSyncExternalStore(subscribeArrivalPending, isArrivalPending);

  if (!onboardingProfile.completed) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
      <DayCaptureSession />
      <Tabs
        // The carved-wood Meadow bar (generated art + centre capture button)
        // replaces the stock bar entirely.
        tabBar={(props) => <MeadowTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
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
            title: 'Kingdom',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="globe.americas.fill" color={color} />,
            tabBarBadge: arrivalPending ? '' : undefined,
            tabBarBadgeStyle: {
              backgroundColor: Lantern.ember300,
              maxHeight: 10,
              maxWidth: 10,
              minHeight: 10,
              minWidth: 10,
              top: 4,
            },
          }}
        />
        <Tabs.Screen
          name="collection"
          options={{
            title: 'Collection',
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
    </>
  );
}
