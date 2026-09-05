import { Stack } from 'expo-router';

import { PhotoPlaceLab } from '@/components/dev/photo-place-lab';

export default function DevPhotoPlaceLabScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Photo Place Lab', headerLargeTitle: true }} />
      <PhotoPlaceLab />
    </>
  );
}
