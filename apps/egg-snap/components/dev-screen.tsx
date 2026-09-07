import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeveloperProfilePanel } from '@incubator/game-ui/developer-profile-panel';
import type { ProfileSnapshot } from '@incubator/profile/snapshots';
import { CHECKPOINTS, checkpointSnapshot, snapshots } from '../state/dev-profiles';
import { devStorage } from '../state/dev-storage';
import { useProfile } from '../state/provider';
import { Scene } from './scene';
import { Button } from './ui';

export default function DevScreen() {
  const { profile, refresh } = useProfile();
  const insets = useSafeAreaInsets();
  const restore = async (value: ProfileSnapshot) => {
    const rollback = await snapshots.restore(value);
    await devStorage.write('rollback', JSON.stringify(rollback));
    await refresh();
    router.dismissTo('/');
  };
  if (!__DEV__) return <Scene><Button onPress={() => router.dismissTo('/')}>Return home</Button></Scene>;
  return <Scene><View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}><DeveloperProfilePanel enabled={__DEV__} title="Egg Snap · Developer" diagnostics={JSON.stringify({ coins: profile?.coins, world: profile?.adventure, pendingResult: profile?.pendingResult }, null, 2)} actions={[
    { label: 'Return to game', run: async () => { router.dismissTo('/'); } },
    { label: 'Mechanics arena', run: async () => { router.replace('/arena'); } },
    { label: 'Capture profile', run: async () => { await devStorage.write('snapshot', JSON.stringify(await snapshots.capture())); } },
    { label: 'Restore captured profile', run: async () => { const value = await devStorage.read('snapshot'); if (!value) throw new Error('Capture a profile first'); await restore(JSON.parse(value)); } },
    { label: 'Roll back last restore', run: async () => { const value = await devStorage.read('rollback'); if (!value) throw new Error('No rollback saved'); await restore(JSON.parse(value)); } },
    ...CHECKPOINTS.map((label, index) => ({ label: index === 0 ? 'Reset profile · Fresh install' : `Load checkpoint · ${label}`, run: async () => { await restore(checkpointSnapshot(index)); } })),
  ]} /></View></Scene>;
}
