import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { DayCaptureSession } from '@/components/katchadeck/home/day-capture-session';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DEV_DEBUG_NAV_ENABLED } from '@/constants/dev';
import { Lantern } from '@/constants/theme';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

// The World is now the app's home: it lands here on launch (the Today tab
// remains available alongside it).
export const unstable_settings = {
  initialRouteName: 'world',
};

export default function TabLayout() {
  const onboardingProfile = loadOnboardingProfile();

  if (!onboardingProfile.completed) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
      <DayCaptureSession />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Lantern.ember300,
          tabBarInactiveTintColor: Lantern.moon500,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: 'rgba(28, 24, 48, 0.94)',
            borderTopWidth: 0,
            borderRadius: 999,
            bottom: 24,
            boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
            height: 68,
            left: 24,
            marginHorizontal: 24,
            paddingBottom: 8,
            paddingTop: 10,
            position: 'absolute',
            right: 24,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="world"
          options={{
            title: 'World',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="globe.americas.fill" color={color} />,
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
