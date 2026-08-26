import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { StreakBootstrap } from '@/components/katchadeck/streak/streak-bootstrap';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

// Haven is the persistent Home. The old tab destinations remain registered so
// existing deep links and developer tools keep working, but there is no longer
// a player-facing bottom navigation competing with the Haven world.
export const unstable_settings = {
  initialRouteName: 'katchimeras',
};

export default function TabLayout() {
  const onboardingProfile = loadOnboardingProfile();

  if (!onboardingProfile.completed) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
      <StreakBootstrap />
      <Tabs
        tabBar={() => null}
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
            href: null,
            title: 'Today',
          }}
        />
        <Tabs.Screen
          name="world"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="you"
          options={{
            freezeOnBlur: false,
            href: null,
            title: 'You',
          }}
        />
        <Tabs.Screen
          name="katchimeras"
          options={{
            freezeOnBlur: true,
            title: 'Haven',
          }}
        />
        <Tabs.Screen
          name="games"
          options={{
            // This route owns its own focus boundary. Let it observe blur so
            // it can unmount the visual board/worklets while retaining the
            // warm provider and its already-hydrated merge state.
            freezeOnBlur: false,
            href: null,
            title: 'Activities',
          }}
        />
        <Tabs.Screen
          name="collection"
          options={{
            freezeOnBlur: true,
            href: null,
            title: 'Deck',
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            freezeOnBlur: true,
            href: null,
            title: 'Dev',
          }}
        />
      </Tabs>
    </>
  );
}
