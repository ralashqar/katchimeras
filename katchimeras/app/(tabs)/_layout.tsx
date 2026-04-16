import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DEV_DEBUG_NAV_ENABLED } from '@/constants/dev';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const onboardingProfile = loadOnboardingProfile();

  if (!onboardingProfile.completed) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: 'rgba(10, 14, 24, 0.94)',
          borderTopColor: Colors[colorScheme ?? 'light'].border,
          display: DEV_DEBUG_NAV_ENABLED ? 'flex' : 'none',
          height: 88,
          paddingBottom: 10,
          paddingTop: 10,
          position: 'absolute',
        },
        tabBarLabelStyle: DEV_DEBUG_NAV_ENABLED
          ? {
              fontSize: 11,
              fontWeight: '600',
              marginBottom: 4,
            }
          : undefined,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: DEV_DEBUG_NAV_ENABLED ? '/explore' : null,
          title: DEV_DEBUG_NAV_ENABLED ? 'Dev' : 'World',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
