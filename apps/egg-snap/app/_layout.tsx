import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ProfileProvider } from "../state/provider";

export default function Layout() {
  const [loaded, error] = useFonts({
    EggDisplay: require("@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf"),
    EggBody: require("@incubator/art-fonts/Manrope-Variable.ttf"),
  });
  if (!loaded && !error) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ProfileProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#132B25" },
              animation: "fade",
            }}
          />
        </ProfileProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
