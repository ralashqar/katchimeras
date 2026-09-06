import { Stack } from 'expo-router';

import { ExplorationEnvironmentGallery } from '@/components/katchadeck/dev/exploration-environment-gallery';

export default function DevEnvironmentGalleryScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          animation: 'fade',
          headerShown: false,
          title: 'Environment Gallery',
        }}
      />
      <ExplorationEnvironmentGallery />
    </>
  );
}
