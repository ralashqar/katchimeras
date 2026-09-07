import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import { View, Text } from "react-native";
export default function WebDuel() {
  return (
    <WithSkiaWeb
      getComponent={() => import("../components/battle")}
      opts={{ locateFile: () => "/canvaskit.wasm" }}
      fallback={
        <View
          style={{
            flex: 1,
            backgroundColor: "#132B25",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#FFF8E7" }}>Waking your spark…</Text>
        </View>
      }
    />
  );
}
