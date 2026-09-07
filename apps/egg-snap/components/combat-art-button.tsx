import {Pressable} from 'react-native';
import {Image} from 'expo-image';

const ART = {pause: require('../assets/controls/pause.png'), settings: require('../assets/controls/settings.png')};

/** The artwork is the whole button; the invisible hit area remains 48pt. */
export function CombatArtButton({kind, onPress}: {kind: keyof typeof ART; onPress: () => void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={kind === 'pause' ? 'Pause duel' : 'Duel settings'}
    onPress={onPress} style={({pressed}) => ({width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
      opacity: pressed ? .85 : 1, transform: [{scale: pressed ? .94 : 1}]})}>
    <Image source={ART[kind]} contentFit="contain" transition={0} style={{width: 48, height: 48}} />
  </Pressable>;
}
