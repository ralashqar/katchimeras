import {StyleSheet, View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';

/** Decoration sits behind the unclipped gesture layer; no masks can cut off a held piece. */
export function CombatTraySurface() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, {borderRadius: 28, borderWidth: 1.5,
    borderColor: '#F1DFC0', boxShadow: '0px 4px 8px #07160E66', overflow: 'hidden'}]}>
    <LinearGradient colors={['#37684F', '#1A4031', '#123025']} style={StyleSheet.absoluteFill} />
    <LinearGradient colors={['#102D24', '#18392C']} style={{position: 'absolute', inset: 10, borderRadius: 20,
      borderTopWidth: 2, borderTopColor: '#071D1BCC', borderBottomWidth: 1, borderBottomColor: '#99C68C40'}} />
  </View>;
}
