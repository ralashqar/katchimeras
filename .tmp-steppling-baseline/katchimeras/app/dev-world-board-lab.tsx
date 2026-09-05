import { Stack } from 'expo-router';

import { WorldBoardLabScreen } from '@/components/katchadeck/dev/world-board-lab-screen';

export default function DevWorldBoardLabRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'World + Board Lab' }} />
      <WorldBoardLabScreen />
    </>
  );
}
