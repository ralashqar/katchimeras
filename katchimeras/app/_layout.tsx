import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { DEV_TOOLS_ENABLED } from '@/constants/dev';
import { EggAvatarProvider } from '@/features/egg-avatar/egg-avatar-provider';
import { WispProvider } from '@/features/wisps/wisp-provider';
import { SceneProvider } from '@/features/scenes/scene-provider';
import { EconomyProvider } from '@/features/economy/economy-provider';
import { AvatarAccessReconciler } from '@/features/economy/avatar-access-reconciler';
import { AppActivityProvider } from '@/features/performance/app-activity';
import { GameScreenTransitionProvider, TransitionAwareStatusBar } from '@/features/navigation/game-screen-transition';
import { FtueProvider } from '@/features/onboarding/ftue-provider';
import { GameUIProvider } from '@/components/katchadeck/ui/game-ui-provider';
import { GameFeedbackProvider } from '@/features/ui/game-feedback-provider';
import { DevProfileLaunchReconciler } from '@/features/dev-profile-launch-reconciler';
import { GameWalletProvider } from '@/features/ui/game-wallet-provider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import '@/utils/travel-memory-task';
import { initializeCrashReporting } from '@/utils/crash-reporting';
import { runMossproutCampaignV2Migration } from '@/utils/mossprout-campaign-v2-migration';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();
initializeCrashReporting();

// DEV: apply any saved Asset Lab overrides at launch so draft world art
// renders in the Kingdom without opening the lab first (no-op in production).
if (DEV_TOOLS_ENABLED) {
  void import('@/utils/asset-lab').then((lab) => lab.loadAssetLabManifest()).catch(() => {});
}

function RootLayout() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme === 'light' ? 'light' : 'dark'];
  const [fontsLoaded] = useFonts({
    FredokaBold: require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf'),
    InstrumentSerif: require('../assets/fonts/InstrumentSerif-Regular.ttf'),
    Manrope: require('../assets/fonts/Manrope-Variable.ttf'),
  });
  const [campaignReady, setCampaignReady] = useState(false);

  useEffect(() => {
    let active = true;
    void runMossproutCampaignV2Migration()
      .catch((error) => Sentry.captureException(error))
      .finally(() => { if (active) setCampaignReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(themeColors.background);
  }, [themeColors.background]);

  useEffect(() => {
    if (fontsLoaded && campaignReady) {
      SplashScreen.hideAsync();
    }
  }, [campaignReady, fontsLoaded]);

  if (!fontsLoaded || !campaignReady) {
    return null;
  }

  const navigationTheme =
    colorScheme === 'light'
      ? {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: themeColors.background,
            border: themeColors.border,
            card: themeColors.surfaceElevated,
            primary: themeColors.tint,
            text: themeColors.text,
          },
        }
      : {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: themeColors.background,
            border: themeColors.border,
            card: themeColors.surfaceElevated,
            primary: themeColors.tint,
            text: themeColors.text,
          },
        };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <GameUIProvider>
          <EconomyProvider>
            <GameWalletProvider>
              <GameFeedbackProvider>
                <EggAvatarProvider>
                  <AvatarAccessReconciler />
                  <WispProvider>
                    <SceneProvider>
                    <FtueProvider>
                    <AppActivityProvider>
                      <DevProfileLaunchReconciler />
                      <GameScreenTransitionProvider>
                      <Stack>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="art-lab" options={{ title: 'Katchimera Art Lab' }} />
          <Stack.Screen name="world-base-lab" options={{ title: 'World Base Lab' }} />
          <Stack.Screen name="dev-atmosphere-lab" options={{ title: 'Atmosphere Lab', headerShown: false }} />
          <Stack.Screen name="dev-environment-gallery" options={{ title: 'Environment Gallery', headerShown: false }} />
          <Stack.Screen name="dev-katchimera-tile-lab" options={{ title: 'Katchimera Tile Lab' }} />
          <Stack.Screen name="dev-photo-place-lab" options={{ title: 'Photo Place Lab' }} />
          <Stack.Screen name="dev-subscription-lab" options={{ title: 'Subscription Simulator' }} />
          <Stack.Screen name="dev-ui-gallery" options={{ title: 'Game UI Gallery' }} />
          <Stack.Screen name="dev-profile-snapshots" options={{ title: 'Profile Snapshots' }} />
          <Stack.Screen name="dev-profile-snapshot-capture" options={{ contentStyle: { backgroundColor: 'transparent' }, presentation: 'formSheet', sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true, title: 'Capture Profile' }} />
          <Stack.Screen name="intelligence-lab" options={{ title: 'Intelligence Lab' }} />
          <Stack.Screen name="moment-capture" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="note-capture" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="photo-essence" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="day-map/[dayId]" options={{ title: 'Day Map' }} />
          <Stack.Screen name="card/[cardId]" options={{ title: 'Daily card' }} />
          <Stack.Screen name="life-map" options={{ headerShown: false, title: 'Life Map' }} />
          <Stack.Screen name="discoveries" options={{ headerShown: false, title: 'Discoveries' }} />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="streak" options={{ animation: 'fade', headerShown: false, title: 'Streak Story' }} />
          <Stack.Screen name="location-privacy" options={{ title: 'Photo places' }} />
          <Stack.Screen name="hatch-your-past" options={{ headerShown: false, gestureEnabled: false, title: 'Hatch your past' }} />
          <Stack.Screen name="katchimera/[creatureId]" options={{ animation: 'none', headerShown: false }} />
          <Stack.Screen name="katchimera/[creatureId]/activity" options={{ animation: 'slide_from_right', headerShown: false }} />
          <Stack.Screen name="wisp/[wispId]" options={{ headerShown: false }} />
          <Stack.Screen name="katchimera/[creatureId]/achievements" options={{ headerShown: false }} />
          <Stack.Screen name="katchimera/[creatureId]/cards" options={{ headerShown: false }} />
          <Stack.Screen name="katchimera/[creatureId]/quest/[questId]/game" options={{ animation: 'none', headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="game/[questId]" options={{ animation: 'none', headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="legacy-games" options={{ headerShown: false, title: 'Legacy Games' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Katchimeras Preview' }} />
                      </Stack>
                      <TransitionAwareStatusBar defaultStyle={colorScheme === 'light' ? 'dark' : 'light'} />
                      </GameScreenTransitionProvider>
                    </AppActivityProvider>
                    </FtueProvider>
                    </SceneProvider>
                  </WispProvider>
                </EggAvatarProvider>
              </GameFeedbackProvider>
            </GameWalletProvider>
          </EconomyProvider>
        </GameUIProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
