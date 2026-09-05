import * as Updates from 'expo-updates';
import { DevSettings } from 'react-native';

export async function reloadAfterProfileSnapshotChange(): Promise<void> {
  if (process.env.EXPO_OS === 'web') {
    globalThis.location?.reload();
    return;
  }
  if (Updates.isEnabled) {
    await Updates.reloadAsync();
    return;
  }
  DevSettings.reload();
}
