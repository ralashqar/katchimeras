import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { AppActivityProvider } from '@/features/performance/app-activity';
import { useColorScheme } from '@/hooks/use-color-scheme';
import '@/utils/travel-memory-task';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// DEV: apply any saved Asset Lab overrides at launch so draft world art
// renders in the Kingdom without opening the lab first (no-op in production).
if (__DEV__) {
  void import('@/utils/asset-lab').then((lab) => lab.loadAssetLabManifest()).catch(() => {});
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme === 'light' ? 'light' : 'dark'];
  const [fontsLoaded] = useFonts({
    FredokaBold: require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf'),
    InstrumentSerif: require('../assets/fonts/InstrumentSerif-Regular.ttf'),
    Manrope: require('../assets/fonts/Manrope-Variable.ttf'),
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(themeColors.background);
  }, [themeColors.background]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
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
        <AppActivityProvider>
          <Stack>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="art-lab" options={{ title: 'Katchimera Art Lab' }} />
          <Stack.Screen name="world-base-lab" options={{ title: 'World Base Lab' }} />
          <Stack.Screen name="dev-atmosphere-lab" options={{ title: 'Atmosphere Lab', headerShown: false }} />
          <Stack.Screen name="dev-environment-gallery" options={{ title: 'Environment Gallery', headerShown: false }} />
          <Stack.Screen name="dev-katchimera-tile-lab" options={{ title: 'Katchimera Tile Lab' }} />
          <Stack.Screen name="dev-photo-place-lab" options={{ title: 'Photo Place Lab' }} />
          <Stack.Screen name="intelligence-lab" options={{ title: 'Intelligence Lab' }} />
          <Stack.Screen name="moment-capture" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="note-capture" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="photo-essence" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="day-map/[dayId]" options={{ title: 'Day Map' }} />
          <Stack.Screen name="card/[cardId]" options={{ title: 'Daily card' }} />
          <Stack.Screen name="life-map" options={{ headerShown: false, title: 'Life Map' }} />
          <Stack.Screen name="discoveries" options={{ headerShown: false, title: 'Discoveries' }} />
          <Stack.Screen name="streak" options={{ animation: 'fade', headerShown: false, title: 'Streak Story' }} />
          <Stack.Screen name="location-privacy" options={{ title: 'Photo places' }} />
          <Stack.Screen name="hatch-your-past" options={{ headerShown: false, gestureEnabled: false, title: 'Hatch your past' }} />
          <Stack.Screen name="katchimera/[creatureId]" options={{ headerShown: false }} />
          <Stack.Screen name="katchimera/[creatureId]/achievements" options={{ headerShown: false }} />
          <Stack.Screen name="katchimera/[creatureId]/quest/[questId]/game" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="game/[questId]" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Katchimeras Preview' }} />
          </Stack>
        </AppActivityProvider>
        <StatusBar style={colorScheme === 'light' ? 'dark' : 'light'} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
