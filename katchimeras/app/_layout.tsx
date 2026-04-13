import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme === 'light' ? 'light' : 'dark'];
  const [fontsLoaded] = useFonts({
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
        <Stack>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="art-lab" options={{ title: 'Katchimera Art Lab' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'KatchaDeck Premium' }} />
        </Stack>
        <StatusBar style={colorScheme === 'light' ? 'dark' : 'light'} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
